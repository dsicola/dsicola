import { Request } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';
import { validarBloqueioAcademicoInstitucionalOuErro } from './bloqueioAcademico.service.js';
import PDFDocument from 'pdfkit';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * ========================================
 * SERVIÇO DE PAUTA FINAL
 * ========================================
 * 
 * Gera relatório oficial de Pauta Final com valor legal
 * Requer que o semestre/período esteja ENCERRADO
 */

interface PautaFinalParams {
  turmaId: string;
  disciplinaId: string;
  semestreId?: string;
  anoLetivo: number;
  trimestre?: number;
}

interface AlunoPauta {
  numero: number;
  nomeCompleto: string;
  numeroIdentificacao?: string;
  notas: {
    trimestre1?: number;
    trimestre2?: number;
    trimestre3?: number;
    mediaAnual?: number;
    exame?: number;
    notaFinal?: number;
  };
  frequencia: {
    totalAulas: number;
    presencas: number;
    faltas: number;
    percentual: number;
  };
  status: 'APROVADO' | 'REPROVADO' | 'REPROVADO_FALTA';
  observacoes?: string;
}

export class PautaFinalService {
  /**
   * Gerar Pauta Final
   */
  static async gerarPautaFinal(
    req: Request,
    params: PautaFinalParams
  ): Promise<Buffer> {
    const instituicaoId = requireTenantScope(req);
    const tipoAcademico = (req.user as any)?.tipoAcademico || null;

    // Validar que semestre/período está ENCERRADO
    await this.validarSemestreEncerrado(instituicaoId, params);

    // Buscar dados da instituição
    const instituicao = await prisma.instituicao.findUnique({
      where: { id: instituicaoId },
      select: {
        id: true,
        nome: true,
        endereco: true,
        telefone: true,
        emailContato: true,
      },
    });

    if (!instituicao) {
      throw new AppError('Instituição não encontrada', 404);
    }

    // Buscar dados da turma
    const turma = await prisma.turma.findFirst({
      where: {
        id: params.turmaId,
        instituicaoId,
      },
      include: {
        disciplina: {
          select: {
            id: true,
            nome: true,
            cargaHoraria: true,
          },
        },
        curso: {
          select: {
            id: true,
            nome: true,
          },
        },
        classe: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });

    if (!turma) {
      throw new AppError('Turma não encontrada', 404);
    }

    if (!turma.disciplina) {
      throw new AppError('Disciplina não encontrada', 404);
    }

    // Buscar alunos da turma (matriculados ativos)
    const matriculas = await prisma.matricula.findMany({
      where: {
        turmaId: params.turmaId,
        aluno: {
          instituicaoId,
          statusAluno: {
            in: ['Cursando', 'Ativo'],
          },
        },
        status: 'Ativa',
      },
      include: {
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            numeroIdentificacao: true,
            numeroIdentificacaoPublica: true,
          },
        },
      },
      orderBy: {
        aluno: {
          nomeCompleto: 'asc',
        },
      },
    });

    if (matriculas.length === 0) {
      throw new AppError('Nenhum aluno encontrado na turma', 404);
    }

    // Buscar semestre
    let semestre = null;
    if (params.semestreId) {
      semestre = await prisma.semestre.findFirst({
        where: {
          id: params.semestreId,
          instituicaoId,
        },
      });
    } else {
      // Buscar semestre pelo ano letivo
      semestre = await prisma.semestre.findFirst({
        where: {
          anoLetivo: params.anoLetivo,
          instituicaoId,
        },
        orderBy: {
          numero: 'desc',
        },
      });
    }

    // Buscar dados de notas e frequências para cada aluno
    const alunosPauta: AlunoPauta[] = [];

    // Buscar anoLetivoId se necessário para validação
    const anoLetivoObj = await prisma.anoLetivo.findFirst({
      where: {
        instituicaoId,
        ano: params.anoLetivo,
      },
      select: {
        id: true,
      },
    });

    for (let i = 0; i < matriculas.length; i++) {
      const matricula = matriculas[i];
      const alunoId = matricula.alunoId;

      // BLOQUEIO ACADÊMICO INSTITUCIONAL: Validar curso/classe do aluno antes de incluir na pauta
      await validarBloqueioAcademicoInstitucionalOuErro(
        alunoId,
        instituicaoId,
        tipoAcademico,
        params.disciplinaId,
        anoLetivoObj?.id
      );

      // Buscar avaliações da disciplina
      const planoEnsino = await prisma.planoEnsino.findFirst({
        where: {
          disciplinaId: params.disciplinaId,
          turmaId: params.turmaId,
          anoLetivo: params.anoLetivo,
          instituicaoId,
        },
        include: {
          avaliacoes: {
            where: {
              estado: 'ENCERRADO',
            },
            include: {
              notas: {
                where: {
                  alunoId,
                },
              },
            },
            orderBy: {
              trimestre: 'asc',
            },
          },
        },
      });

      // Calcular notas por trimestre
      const notas: AlunoPauta['notas'] = {};
      let mediaAnual = 0;
      let totalPesos = 0;

      if (planoEnsino) {
        for (const avaliacao of planoEnsino.avaliacoes) {
          const notaAluno = avaliacao.notas.find((n) => n.alunoId === alunoId);
          if (notaAluno) {
            const valor = Number(notaAluno.valor);
            const peso = Number(avaliacao.peso);

            if (avaliacao.trimestre === 1) {
              notas.trimestre1 = valor;
            } else if (avaliacao.trimestre === 2) {
              notas.trimestre2 = valor;
            } else if (avaliacao.trimestre === 3) {
              notas.trimestre3 = valor;
            }

            mediaAnual += valor * peso;
            totalPesos += peso;
          }
        }

        if (totalPesos > 0) {
          notas.mediaAnual = mediaAnual / totalPesos;
        }
      }

      // Buscar frequência
      const aulasLancadas = await prisma.aulaLancada.findMany({
        where: {
          planoAula: {
            planoEnsino: {
              disciplinaId: params.disciplinaId,
              turmaId: params.turmaId,
              anoLetivo: params.anoLetivo,
              instituicaoId,
            },
          },
        },
      });

      const totalAulas = aulasLancadas.length;
      const presencas = await prisma.presenca.count({
        where: {
          alunoId,
          aulaLancada: {
            planoAula: {
              planoEnsino: {
                disciplinaId: params.disciplinaId,
                turmaId: params.turmaId,
                anoLetivo: params.anoLetivo,
                instituicaoId,
              },
            },
          },
          status: 'PRESENTE',
        },
      });

      const faltas = totalAulas - presencas;
      const percentualFrequencia = totalAulas > 0 ? (presencas / totalAulas) * 100 : 0;

      // Determinar status
      let status: 'APROVADO' | 'REPROVADO' | 'REPROVADO_FALTA' = 'APROVADO';
      if (percentualFrequencia < 75) {
        status = 'REPROVADO_FALTA';
      } else if (notas.mediaAnual && notas.mediaAnual < 10) {
        status = 'REPROVADO';
      }

      alunosPauta.push({
        numero: i + 1,
        nomeCompleto: matricula.aluno.nomeCompleto,
        numeroIdentificacao: matricula.aluno.numeroIdentificacao || matricula.aluno.numeroIdentificacaoPublica || undefined,
        notas,
        frequencia: {
          totalAulas,
          presencas,
          faltas,
          percentual: percentualFrequencia,
        },
        status,
      });
    }

    // Gerar PDF
    return this.gerarPDF(instituicao, turma, alunosPauta, params, semestre);
  }

  /**
   * Validar que semestre/período está ENCERRADO
   */
  private static async validarSemestreEncerrado(
    instituicaoId: string,
    params: PautaFinalParams
  ): Promise<void> {
    let semestre = null;

    if (params.semestreId) {
      semestre = await prisma.semestre.findFirst({
        where: {
          id: params.semestreId,
          instituicaoId,
        },
      });
    } else {
      // Buscar semestre pelo ano letivo
      semestre = await prisma.semestre.findFirst({
        where: {
          anoLetivo: params.anoLetivo,
          instituicaoId,
        },
        orderBy: {
          numero: 'desc',
        },
      });
    }

    if (!semestre) {
      throw new AppError('Semestre não encontrado', 404);
    }

    if (semestre.estado !== 'ENCERRADO') {
      throw new AppError(
        'O semestre/período deve estar ENCERRADO para gerar a Pauta Final',
        400
      );
    }
  }

  /**
   * Gerar PDF da Pauta Final
   */
  private static async gerarPDF(
    instituicao: any,
    turma: any,
    alunosPauta: AlunoPauta[],
    params: PautaFinalParams,
    semestre: any
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 50, bottom: 50, left: 50, right: 50 },
        });

        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });
        doc.on('error', reject);

        // Cabeçalho
        doc.fontSize(16).font('Helvetica-Bold');
        doc.text(instituicao.nome.toUpperCase(), { align: 'center' });
        doc.moveDown(0.5);

        doc.fontSize(14).font('Helvetica-Bold');
        doc.text('PAUTA FINAL', { align: 'center' });
        doc.moveDown(1);

        // Dados da instituição
        doc.fontSize(10).font('Helvetica');
        if (instituicao.endereco) {
          doc.text(`Endereço: ${instituicao.endereco}`);
        }
        if (instituicao.telefone) {
          doc.text(`Telefone: ${instituicao.telefone}`);
        }
        if (instituicao.emailContato) {
          doc.text(`Email: ${instituicao.emailContato}`);
        }
        doc.moveDown(1);

        // Dados da turma/disciplina
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('DADOS ACADÉMICOS', { underline: true });
        doc.moveDown(0.5);

        doc.fontSize(10).font('Helvetica');
        doc.text(`Ano Letivo: ${params.anoLetivo}`);
        if (semestre) {
          doc.text(`Semestre: ${semestre.numero}º Semestre`);
        }
        if (turma.curso) {
          doc.text(`Curso: ${turma.curso.nome}`);
        }
        if (turma.classe) {
          doc.text(`Classe: ${turma.classe.nome}`);
        }
        doc.text(`Turma: ${turma.nome}`);
        doc.text(`Disciplina: ${turma.disciplina.nome}`);
        if (turma.disciplina.cargaHoraria) {
          doc.text(`Carga Horária: ${turma.disciplina.cargaHoraria} horas`);
        }
        doc.moveDown(1);

        // Tabela de alunos
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('RESULTADOS FINAIS', { underline: true });
        doc.moveDown(0.5);

        // Cabeçalho da tabela
        const tableTop = doc.y;
        const colWidths = [30, 150, 80, 60, 60, 60, 60, 50, 80];
        const rowHeight = 20;
        let currentY = tableTop;

        doc.fontSize(9).font('Helvetica-Bold');
        doc.rect(50, currentY, 500, rowHeight).fillAndStroke('#E5E7EB', '#000000');
        doc.fillColor('#000000');
        doc.text('Nº', 55, currentY + 5);
        doc.text('Nome do Aluno', 85, currentY + 5);
        doc.text('1º Trim.', 235, currentY + 5);
        doc.text('2º Trim.', 295, currentY + 5);
        doc.text('3º Trim.', 355, currentY + 5);
        doc.text('Média', 415, currentY + 5);
        doc.text('Freq. %', 475, currentY + 5);
        doc.text('Status', 530, currentY + 5);

        currentY += rowHeight;

        // Linhas de alunos
        doc.fontSize(8).font('Helvetica');
        for (const aluno of alunosPauta) {
          // Verificar se precisa de nova página
          if (currentY > 700) {
            doc.addPage();
            currentY = 50;
            // Re-desenhar cabeçalho
            doc.fontSize(9).font('Helvetica-Bold');
            doc.rect(50, currentY, 500, rowHeight).fillAndStroke('#E5E7EB', '#000000');
            doc.fillColor('#000000');
            doc.text('Nº', 55, currentY + 5);
            doc.text('Nome do Aluno', 85, currentY + 5);
            doc.text('1º Trim.', 235, currentY + 5);
            doc.text('2º Trim.', 295, currentY + 5);
            doc.text('3º Trim.', 355, currentY + 5);
            doc.text('Média', 415, currentY + 5);
            doc.text('Freq. %', 475, currentY + 5);
            doc.text('Status', 530, currentY + 5);
            currentY += rowHeight;
            doc.fontSize(8).font('Helvetica');
          }

          // Linha do aluno
          doc.rect(50, currentY, 500, rowHeight).stroke();
          doc.text(String(aluno.numero), 55, currentY + 5);
          doc.text(aluno.nomeCompleto.substring(0, 20), 85, currentY + 5);
          doc.text(aluno.notas.trimestre1?.toFixed(1) || '-', 235, currentY + 5, { width: 60, align: 'center' });
          doc.text(aluno.notas.trimestre2?.toFixed(1) || '-', 295, currentY + 5, { width: 60, align: 'center' });
          doc.text(aluno.notas.trimestre3?.toFixed(1) || '-', 355, currentY + 5, { width: 60, align: 'center' });
          doc.text(aluno.notas.mediaAnual?.toFixed(1) || '-', 415, currentY + 5, { width: 60, align: 'center' });
          doc.text(`${aluno.frequencia.percentual.toFixed(0)}%`, 475, currentY + 5, { width: 60, align: 'center' });
          
          // Status com cor
          if (aluno.status === 'APROVADO') {
            doc.fillColor('#10B981');
          } else {
            doc.fillColor('#EF4444');
          }
          doc.text(aluno.status === 'APROVADO' ? 'APROVADO' : aluno.status === 'REPROVADO_FALTA' ? 'REP. FALTA' : 'REPROVADO', 530, currentY + 5);
          doc.fillColor('#000000');

          currentY += rowHeight;
        }

        // Rodapé
        const footerY = 750;
        doc.fontSize(8).font('Helvetica');
        doc.text(
          `Relatório gerado pelo sistema DSICOLA em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
          50,
          footerY,
          { align: 'center', width: 500 }
        );

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}

