import { Request, Response, NextFunction } from 'express';
import { ReportService, TipoRelatorio } from '../services/report.service.js';
import { PautaFinalService } from '../services/pautaFinal.service.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import { consolidarPlanoEnsino, calcularFrequenciaAluno } from '../services/frequencia.service.js';
import { validarBloqueioAcademicoInstitucionalOuErro } from '../services/bloqueioAcademico.service.js';
import prisma from '../lib/prisma.js';

/**
 * Gerar relatório oficial
 */
export const gerarRelatorio = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tipoRelatorio, referenciaId, anoLetivo, turmaId, disciplinaId, alunoId, trimestre } = req.body;

    if (!tipoRelatorio || !referenciaId) {
      throw new AppError('Tipo de relatório e ID de referência são obrigatórios', 400);
    }

    // Validar tipo de relatório
    if (!Object.values(TipoRelatorio).includes(tipoRelatorio)) {
      throw new AppError('Tipo de relatório inválido', 400);
    }

    const resultado = await ReportService.gerarRelatorio(req, {
      tipoRelatorio: tipoRelatorio as TipoRelatorio,
      referenciaId,
      anoLetivo: anoLetivo ? Number(anoLetivo) : undefined,
      turmaId,
      disciplinaId,
      alunoId,
      trimestre: trimestre ? Number(trimestre) : undefined,
    });

    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
};

/**
 * Listar relatórios gerados
 */
export const listarRelatorios = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { tipoRelatorio, referenciaId, anoLetivo, dataInicio, dataFim } = req.query;

    const filtros: any = {};

    if (tipoRelatorio) {
      filtros.tipoRelatorio = tipoRelatorio as string;
    }

    if (referenciaId) {
      filtros.referenciaId = referenciaId as string;
    }

    if (anoLetivo) {
      filtros.anoLetivo = Number(anoLetivo);
    }

    if (dataInicio) {
      filtros.dataInicio = new Date(dataInicio as string);
    }

    if (dataFim) {
      filtros.dataFim = new Date(dataFim as string);
    }

    const relatorios = await ReportService.listarRelatorios(instituicaoId, filtros);

    res.json(relatorios);
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar relatório por ID
 */
export const buscarRelatorio = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const instituicaoId = requireTenantScope(req);

    const relatorio = await ReportService.buscarRelatorio(id, instituicaoId);

    res.json(relatorio);
  } catch (error) {
    next(error);
  }
};

/**
 * Download do relatório (PDF)
 */
export const downloadRelatorio = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const instituicaoId = requireTenantScope(req);

    const pdfBuffer = await ReportService.buscarArquivoRelatorio(id, instituicaoId);
    const relatorio = await ReportService.buscarRelatorio(id, instituicaoId);

    // Configurar headers para download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${relatorio.nomeArquivo || `relatorio_${id}.pdf`}"`
    );
    res.setHeader('Content-Length', pdfBuffer.length.toString());

    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

/**
 * Visualizar relatório (inline no browser)
 */
export const visualizarRelatorio = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const instituicaoId = requireTenantScope(req);

    const pdfBuffer = await ReportService.buscarArquivoRelatorio(id, instituicaoId);

    // Configurar headers para visualização inline
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Content-Length', pdfBuffer.length.toString());

    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

/**
 * Gerar Pauta Final
 * POST /relatorios/pauta-final
 */
export const gerarPautaFinal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { turmaId, disciplinaId, semestreId, anoLetivo, trimestre } = req.body;

    if (!turmaId || !disciplinaId || !anoLetivo) {
      throw new AppError('Turma, disciplina e ano letivo são obrigatórios', 400);
    }

    const instituicaoId = requireTenantScope(req);
    const tipoAcademico = req.user?.tipoAcademico || null;

    // BLOQUEIO ACADÊMICO INSTITUCIONAL: Validar todos os alunos da turma antes de gerar pauta
    const matriculas = await prisma.matricula.findMany({
      where: {
        turmaId,
        aluno: {
          instituicaoId,
          statusAluno: {
            in: ['Cursando', 'Ativo'],
          },
        },
        status: 'Ativa',
      },
      select: {
        alunoId: true,
      },
    });

    // Buscar anoLetivoId se necessário
    const anoLetivoObj = await prisma.anoLetivo.findFirst({
      where: {
        instituicaoId,
        ano: Number(anoLetivo),
      },
      select: {
        id: true,
      },
    });

    // Validar cada aluno antes de gerar pauta
    for (const matricula of matriculas) {
      await validarBloqueioAcademicoInstitucionalOuErro(
        matricula.alunoId,
        instituicaoId,
        tipoAcademico,
        disciplinaId,
        anoLetivoObj?.id
      );
    }

    // Gerar PDF diretamente
    const pdfBuffer = await PautaFinalService.gerarPautaFinal(req, {
      turmaId,
      disciplinaId,
      semestreId,
      anoLetivo: Number(anoLetivo),
      trimestre: trimestre ? Number(trimestre) : undefined,
    });

    // Criar registro no banco
    // instituicaoId já foi declarado acima (linha 154)
    const userId = req.user?.userId;

    const relatorio = await ReportService.gerarRelatorio(req, {
      tipoRelatorio: TipoRelatorio.PAUTA_FINAL,
      referenciaId: `${turmaId}-${disciplinaId}`,
      anoLetivo: Number(anoLetivo),
      turmaId,
      disciplinaId,
      trimestre: trimestre ? Number(trimestre) : undefined,
    });

    // Salvar PDF gerado
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
    
    // Salvar arquivo manualmente (process.cwd() = backend root ao rodar npm run start)
    const fs = await import('fs/promises');
    const path = await import('path');
    const uploadsDir = path.join(process.cwd(), 'uploads', 'relatorios');
    await fs.mkdir(uploadsDir, { recursive: true });
    const nomeArquivo = `pauta-final_${relatorio.id}_${Date.now()}.pdf`;
    const caminhoCompleto = path.join(uploadsDir, nomeArquivo);
    await fs.writeFile(caminhoCompleto, pdfBuffer);


    // Retornar PDF para download imediato
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="pauta-final-${turmaId}-${Date.now()}.pdf"`
    );
    res.setHeader('Content-Length', pdfBuffer.length.toString());

    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar dados da Pauta por Plano de Ensino (base para relatórios SIGA)
 * GET /relatorios/pauta/:planoEnsinoId
 * 
 * REGRAS:
 * - PROFESSOR: só vê pauta de seus planos de ensino
 * - ADMIN/SECRETARIA: podem ver qualquer pauta da instituição
 * - ALUNO: NÃO pode ver pauta (apenas boletim próprio)
 * - Read-only: não altera dados
 */
export const getPautaPlanoEnsino = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planoEnsinoId } = req.params;
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;
    const userRoles = req.user?.roles || [];

    if (!planoEnsinoId) {
      throw new AppError('planoEnsinoId é obrigatório', 400);
    }

    // Validar que ALUNO não pode ver pauta
    if (userRoles.includes('ALUNO') && !userRoles.includes('ADMIN') && !userRoles.includes('SECRETARIA') && !userRoles.includes('PROFESSOR')) {
      throw new AppError('Acesso negado: alunos não podem visualizar pautas. Use o boletim para ver suas notas.', 403);
    }

    // Buscar plano de ensino para validar permissões
    const planoEnsino = await prisma.planoEnsino.findFirst({
      where: {
        id: planoEnsinoId,
        instituicaoId,
      },
      select: {
        id: true,
        professorId: true,
        disciplinaId: true,
        turmaId: true,
        instituicao: {
          select: {
            tipoAcademico: true,
          },
        },
      },
    });

    if (!planoEnsino) {
      throw new AppError('Plano de ensino não encontrado ou não pertence à sua instituição', 404);
    }

    // Validar que PROFESSOR só vê seus planos
    // REGRA SIGA/SIGAE: PROFESSOR só pode ver pautas dos seus próprios planos de ensino
    // ADMIN/COORDENADOR/DIRETOR podem ver qualquer pauta
    if (userRoles.includes('PROFESSOR') && !userRoles.includes('ADMIN') && !userRoles.includes('SECRETARIA')) {
      // REGRA ARQUITETURAL: req.professor.id é professores.id (middleware resolveProfessor aplicado)
      if (!req.professor?.id) {
        throw new AppError('Professor não identificado. Middleware resolveProfessor deve ser aplicado nesta rota.', 500);
      }
      
      // Validar que o plano de ensino pertence ao professor autenticado
      // CORREÇÃO: planoEnsino.professorId agora é professores.id, não users.id
      if (planoEnsino.professorId !== req.professor.id) {
        throw new AppError('Acesso negado: você só pode visualizar pautas dos seus planos de ensino.', 403);
      }
    }

    // Usar serviço de consolidação que já calcula frequência e notas
    const pauta = await consolidarPlanoEnsino(
      planoEnsinoId, 
      instituicaoId,
      req.user?.tipoAcademico || null // CRÍTICO: tipoAcademico vem do JWT
    );

    // Adicionar informações do tipo de instituição para o frontend
    const pautaComTipo = {
      ...pauta,
      tipoInstituicao: planoEnsino.instituicao?.tipoAcademico || null,
    };

    res.json(pautaComTipo);
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar dados do Boletim por Aluno (base para relatórios SIGA)
 * GET /relatorios/boletim/:alunoId
 * 
 * REGRAS:
 * - ALUNO: só vê próprio boletim
 * - ADMIN/SECRETARIA/PROFESSOR: podem ver qualquer boletim da instituição
 */
export const getBoletimAluno = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { alunoId } = req.params;
    const { anoLetivoId, anoLetivo } = req.query;
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;
    const userRoles = req.user?.roles || [];

    if (!alunoId) {
      throw new AppError('alunoId é obrigatório', 400);
    }

    // Validar que ALUNO só pode ver próprio boletim
    if (userRoles.includes('ALUNO') && !userRoles.includes('ADMIN') && !userRoles.includes('SECRETARIA') && !userRoles.includes('PROFESSOR')) {
      if (alunoId !== userId) {
        throw new AppError('Você só pode acessar seu próprio boletim', 403);
      }
    }

    // Verificar se o aluno pertence à instituição
    const aluno = await prisma.user.findFirst({
      where: {
        id: alunoId,
        instituicaoId,
      },
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
        numeroIdentificacao: true,
        numeroIdentificacaoPublica: true,
      },
    });

    if (!aluno) {
      throw new AppError('Aluno não encontrado ou não pertence à sua instituição', 404);
    }

    // BLOQUEIO ACADÊMICO INSTITUCIONAL: Validar curso/classe do aluno
    const tipoAcademico = req.user?.tipoAcademico || null;
    await validarBloqueioAcademicoInstitucionalOuErro(
      alunoId,
      instituicaoId,
      tipoAcademico
    );

    // Buscar planos de ensino do aluno (via matrículas na turma ou matrículas anuais)
    const planoWhere: any = {
      instituicaoId,
    };

    if (anoLetivoId) {
      planoWhere.anoLetivoId = String(anoLetivoId);
    } else if (anoLetivo) {
      planoWhere.anoLetivo = Number(anoLetivo);
    }

    // Buscar turmas do aluno
    const turmasDoAluno = await prisma.matricula.findMany({
      where: {
        alunoId,
        ...(anoLetivoId ? { anoLetivoId: String(anoLetivoId) } : {}),
        ...(anoLetivo ? { anoLetivo: Number(anoLetivo) } : {}),
      },
      include: {
        turma: {
          select: {
            id: true,
            instituicaoId: true,
          },
        },
      },
    });

    const turmaIds = turmasDoAluno
      .filter(m => m.turma.instituicaoId === instituicaoId)
      .map(m => m.turma.id);

    // Buscar matrículas anuais
    const matriculasAnuais = await prisma.matriculaAnual.findMany({
      where: {
        alunoId,
        instituicaoId,
        ...(anoLetivoId ? { anoLetivoId: String(anoLetivoId) } : {}),
        ...(anoLetivo ? { anoLetivo: Number(anoLetivo) } : {}),
      },
    });

    const disciplinaIds = matriculasAnuais.map(m => m.disciplinaId).filter(Boolean) as string[];

    // REGRA SIGA/SIGAE: Alunos só veem disciplinas do Plano de Ensino ATIVO (APROVADO + não bloqueado)
    // Buscar planos de ensino ATIVOS apenas
    // Evitar OR vazio (Prisma validation error) - quando aluno não tem turmas nem disciplinas, retornar vazio
    const orConditions: Array<{ turmaId?: { in: string[] }; disciplinaId?: { in: string[] } }> = [];
    if (turmaIds.length > 0) orConditions.push({ turmaId: { in: turmaIds } });
    if (disciplinaIds.length > 0) orConditions.push({ disciplinaId: { in: disciplinaIds } });

    const planosEnsino = orConditions.length > 0
      ? await prisma.planoEnsino.findMany({
          where: {
            ...planoWhere,
            estado: 'APROVADO', // REGRA: Apenas planos APROVADOS
            bloqueado: false,   // REGRA: Planos bloqueados não aparecem para alunos
            OR: orConditions,
          },
          include: {
            disciplina: {
              select: { id: true, nome: true, cargaHoraria: true },
            },
            curso: {
              select: { id: true, nome: true, codigo: true },
            },
            classe: {
              select: { id: true, nome: true, codigo: true },
            },
            turma: {
              select: { id: true, nome: true },
            },
        professor: {
          select: {
            id: true,
            user: { select: { nomeCompleto: true } },
          },
        },
          },
        })
      : [];

    // Para cada plano, calcular frequência e notas do aluno
    const { calcularMedia } = await import('../services/calculoNota.service.js');
    
    const disciplinas = await Promise.all(
      planosEnsino.map(async (plano) => {
        const frequencia = await calcularFrequenciaAluno(plano.id, alunoId, instituicaoId);
        
        // Buscar notas usando serviço de cálculo
        const resultadoNotas = await calcularMedia({
          alunoId,
          planoEnsinoId: plano.id,
          instituicaoId,
          tipoAcademico: req.user?.tipoAcademico || null, // CRÍTICO: tipoAcademico vem do JWT
        });

        return {
          planoEnsinoId: plano.id,
          disciplina: {
            id: plano.disciplina.id,
            nome: plano.disciplina.nome,
            cargaHoraria: plano.disciplina.cargaHoraria,
          },
          curso: plano.curso,
          classe: plano.classe,
          turma: plano.turma,
          professor: plano.professor ? {
            id: plano.professor.id,
            nomeCompleto: plano.professor.user?.nomeCompleto ?? '',
          } : null,
          semestre: plano.semestre || null, // Semestre vem do Plano de Ensino
          frequencia,
          notas: {
            mediaFinal: resultadoNotas.media_final,
            status: resultadoNotas.status,
            detalhes: resultadoNotas.detalhes_calculo,
          },
          situacaoAcademica: frequencia.situacao === 'IRREGULAR' 
            ? 'REPROVADO_FALTA' 
            : (resultadoNotas.status === 'APROVADO' ? 'APROVADO' : 'REPROVADO'),
        };
      })
    );

    res.json({
      aluno,
      anoLetivo: anoLetivoId || anoLetivo || null,
      disciplinas,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar dados do Histórico Escolar por Aluno (base para relatórios SIGA)
 * GET /relatorios/historico/:alunoId
 * 
 * REGRAS:
 * - ALUNO: só vê próprio histórico
 * - ADMIN/SECRETARIA/PROFESSOR: podem ver qualquer histórico da instituição
 * - Histórico é IMUTÁVEL (somente leitura)
 * - Histórico usa SNAPSHOT (não calcula dinamicamente)
 * - Apenas anos letivos ENCERRADOS têm histórico disponível
 */
export const getHistoricoEscolar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { alunoId } = req.params;
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;
    const userRoles = req.user?.roles || [];

    if (!alunoId) {
      throw new AppError('alunoId é obrigatório', 400);
    }

    // Validar que ALUNO só pode ver próprio histórico
    if (userRoles.includes('ALUNO') && !userRoles.includes('ADMIN') && !userRoles.includes('SECRETARIA') && !userRoles.includes('PROFESSOR')) {
      if (alunoId !== userId) {
        throw new AppError('Você só pode acessar seu próprio histórico escolar', 403);
      }
    }

    // Verificar se o aluno pertence à instituição
    const aluno = await prisma.user.findFirst({
      where: {
        id: alunoId,
        instituicaoId,
      },
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
        numeroIdentificacao: true,
        numeroIdentificacaoPublica: true,
        dataNascimento: true,
      },
    });

    if (!aluno) {
      throw new AppError('Aluno não encontrado ou não pertence à sua instituição', 404);
    }

    // BLOQUEIO ACADÊMICO INSTITUCIONAL: Validar curso/classe do aluno
    const tipoAcademico = req.user?.tipoAcademico || null;
    await validarBloqueioAcademicoInstitucionalOuErro(
      alunoId,
      instituicaoId,
      tipoAcademico
    );

    // Buscar histórico usando SNAPSHOT (não calcular dinamicamente)
    const { buscarHistoricoAluno } = await import('../services/historicoAcademico.service.js');
    const { anoLetivoId } = req.query;
    const historicoSnapshot = await buscarHistoricoAluno(
      alunoId,
      instituicaoId,
      anoLetivoId as string | undefined
    );

    if (historicoSnapshot.length === 0) {
      // Verificar se há anos letivos encerrados sem histórico gerado
      const anosLetivosEncerrados = await prisma.anoLetivo.findMany({
        where: {
          instituicaoId,
          status: 'ENCERRADO',
          OR: [
            {
              turmas: {
                some: {
                  matriculas: {
                    some: {
                      alunoId,
                    },
                  },
                },
              },
            },
            {
              matriculasAnuais: {
                some: {
                  alunoId,
                },
              },
            },
          ],
        },
        select: {
          id: true,
          ano: true,
        },
        orderBy: {
          ano: 'desc',
        },
      });

      if (anosLetivosEncerrados.length > 0) {
        return res.json({
          aluno,
          historico: [],
          aviso: `Nenhum histórico acadêmico encontrado. O histórico só é gerado automaticamente quando um ano letivo é encerrado. Existem ${anosLetivosEncerrados.length} ano(s) letivo(s) encerrado(s) sem histórico gerado.`,
        });
      }

      return res.json({
        aluno,
        historico: [],
        aviso: 'Nenhum histórico acadêmico encontrado. O histórico só é gerado automaticamente quando um ano letivo é encerrado.',
      });
    }

    // Agrupar histórico por ano letivo
    const historicoAgrupado = historicoSnapshot.reduce((acc: any, item: any) => {
      const anoLetivoKey = item.anoLetivo.id;
      if (!acc[anoLetivoKey]) {
        acc[anoLetivoKey] = {
          anoLetivo: {
            id: item.anoLetivo.id,
            ano: item.anoLetivo.ano,
            status: item.anoLetivo.status,
          },
          disciplinas: [],
        };
      }

      // Verificar se é equivalência ou histórico normal
      const isEquivalencia = (item as any).origemEquivalencia === true;
      
      acc[anoLetivoKey].disciplinas.push({
        disciplina: {
          id: item.disciplina.id,
          nome: item.disciplina.nome,
          cargaHoraria: item.disciplina.cargaHoraria,
        },
        curso: item.curso,
        classe: item.classe,
        turma: item.turma,
        frequencia: isEquivalencia
          ? {
              totalAulas: 0,
              presencas: 0,
              faltas: 0,
              faltasJustificadas: 0,
              percentualFrequencia: 100,
              situacao: 'REGULAR',
              observacao: 'Dispensada por Equivalência',
            }
          : {
              totalAulas: item.totalAulas,
              presencas: item.presencas,
              faltas: item.faltas,
              faltasJustificadas: item.faltasJustificadas,
              percentualFrequencia: Number(item.percentualFrequencia),
              situacao: item.percentualFrequencia >= 75 ? 'REGULAR' : 'IRREGULAR',
            },
        notas: {
          mediaFinal: Number(item.mediaFinal),
          mediaParcial: item.mediaParcial ? Number(item.mediaParcial) : undefined,
          status: item.situacaoAcademica === 'APROVADO' ? 'APROVADO' : 'REPROVADO',
        },
        situacaoAcademica: item.situacaoAcademica,
        geradoEm: item.geradoEm,
        origemEncerramento: item.origemEncerramento,
        // Incluir dados de equivalência se aplicável
        ...(isEquivalencia && (item as any).equivalencia
          ? {
              origemEquivalencia: true,
              equivalencia: {
                disciplinaOrigem: (item as any).equivalencia.disciplinaOrigem,
                cursoOrigem: (item as any).equivalencia.cursoOrigem,
                instituicaoOrigemNome: (item as any).equivalencia.instituicaoOrigemNome,
                criterio: (item as any).equivalencia.criterio,
                deferidoEm: (item as any).equivalencia.deferidoEm,
                deferidoPor: (item as any).equivalencia.deferidoPor,
              },
            }
          : {}),
      });

      return acc;
    }, {});

    const historico = Object.values(historicoAgrupado).sort((a: any, b: any) => {
      return b.anoLetivo.ano - a.anoLetivo.ano;
    });

    res.json({
      aluno,
      historico,
      aviso: 'Histórico acadêmico consolidado (snapshot imutável). Dados gerados no encerramento do ano letivo.',
    });
  } catch (error) {
    next(error);
  }
};

