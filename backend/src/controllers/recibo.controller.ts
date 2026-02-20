import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const getMesNome = (mes: number) => MESES[mes - 1] ?? '';

/** TURMA no recibo: deve mostrar só o nome da turma (ex: "Turma A"), não "10ª Classe - Turma A" */
function extrairNomeTurmaRecibo(nome: string | null | undefined): string | null {
  if (!nome || !String(nome).trim()) return null;
  const s = String(nome).trim();
  const match = s.match(/^\d+ª\s*Classe\s*[-–—]\s*(.+)$/i);
  return match ? match[1].trim() : s;
}

/**
 * GET /recibos/:id
 * Multi-tenant: filtra por req.user.instituicaoId (JWT)
 * Retorna dados completos SIGAE para PDF: instituição, estudante, financeiro
 */
export const getReciboById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const instituicaoId = requireTenantScope(req);

    const recibo = await prisma.recibo.findFirst({
      where: {
        id,
        instituicaoId,
      },
      include: {
        instituicao: {
          select: {
            nome: true,
            logoUrl: true,
            emailContato: true,
            telefone: true,
            endereco: true,
            tipoAcademico: true,
          },
        },
        mensalidade: {
          include: {
            aluno: {
              select: {
                id: true,
                nomeCompleto: true,
                email: true,
                numeroIdentificacao: true,
                numeroIdentificacaoPublica: true,
              },
            },
            curso: { select: { id: true, nome: true, codigo: true } },
            classe: { select: { id: true, nome: true } },
            matricula: {
              select: {
                id: true,
                anoLetivo: true,
                turma: {
                  select: {
                    id: true,
                    nome: true,
                    ano: true,
                    semestre: true,
                    curso: { select: { id: true, nome: true } },
                    classe: { select: { id: true, nome: true } },
                    anoLetivoRef: { select: { ano: true } },
                    turno: { select: { nome: true } },
                  },
                },
                anoLetivoRef: { select: { ano: true } },
              },
            },
          },
        },
        pagamento: true,
      },
    });

    if (!recibo) {
      throw new AppError('Recibo não encontrado', 404);
    }

    // Buscar nome do operador (SIGAE)
    let operadorNome: string | null = null;
    if (recibo.operadorId) {
      const operador = await prisma.user.findUnique({
        where: { id: recibo.operadorId },
        select: { nomeCompleto: true },
      });
      operadorNome = operador?.nomeCompleto ?? null;
    }

    // Buscar ConfiguracaoInstituicao para NIF/morada fiscal e IVA (SIGAE)
    const config = await prisma.configuracaoInstituicao.findFirst({
      where: { instituicaoId: recibo.instituicaoId },
      select: { nif: true, enderecoFiscal: true, telefoneFiscal: true, percentualImpostoPadrao: true },
    });

    const aluno = recibo.mensalidade?.aluno;
    const mensalidade = recibo.mensalidade;
    const matricula = mensalidade?.matricula;
    let turma = matricula?.turma;
    const tipoAcademico = recibo.instituicao?.tipoAcademico ?? null;

    // Fallback: quando mensalidade não tem matrícula, buscar da matrícula ativa do aluno
    if (!turma && aluno?.id) {
      const matAtiva = await prisma.matricula.findFirst({
        where: { alunoId: aluno.id, status: 'Ativa' },
        orderBy: { createdAt: 'desc' },
        include: {
          turma: {
            select: {
              nome: true,
              ano: true,
              semestre: true,
              curso: { select: { nome: true } },
              classe: { select: { nome: true } },
              anoLetivoRef: { select: { ano: true } },
              turno: { select: { nome: true } },
            },
          },
        },
      });
      turma = matAtiva?.turma ?? null;
    }

    // Contexto acadêmico SIGAE: dados da MATRÍCULA (nunca do frontend)
    // Ensino Superior: Curso + Ano de Frequência + Turma + Ano Letivo
    // Ensino Secundário: Curso (área) + Classe de Frequência + Turma + Ano Letivo
    let curso = turma?.curso?.nome ?? mensalidade?.curso?.nome ?? null;
    // Fallback secundário: quando turma/mensalidade não têm curso, buscar da matrícula anual ativa
    if (!curso && aluno?.id && tipoAcademico !== 'SUPERIOR') {
      const ma = await prisma.matriculaAnual.findFirst({
        where: { alunoId: aluno.id, status: 'ATIVA', instituicaoId: recibo.instituicaoId },
        orderBy: { createdAt: 'desc' },
        include: { curso: { select: { nome: true } } },
      });
      curso = ma?.curso?.nome ?? null;
    }
    const turmaNome = extrairNomeTurmaRecibo(turma?.nome) ?? turma?.nome ?? null;
    const anoLetivo = matricula?.anoLetivo ?? matricula?.anoLetivoRef?.ano ?? turma?.anoLetivoRef?.ano ?? null;
    const turno = (turma as { turno?: { nome?: string } })?.turno?.nome ?? null;
    const semestre = turma?.semestre != null ? `${turma.semestre}º` : null;

    // Ensino Superior: anoFrequencia = "1º Ano", "2º Ano" (ano curricular, NUNCA ano civil tipo 2026)
    // turma.ano: 1-7 = ano do curso; 2020+ = ano civil (ignorar)
    let anoFrequencia: string | null = null;
    if (tipoAcademico === 'SUPERIOR') {
      const ta = turma?.ano;
      if (ta != null && ta >= 1 && ta <= 7) {
        anoFrequencia = `${ta}º Ano`;
      } else if (turma?.classe?.nome && /^\dº\s*Ano$/i.test(turma.classe.nome.trim())) {
        anoFrequencia = turma.classe.nome.trim();
      } else if (aluno?.id) {
        const ma = await prisma.matriculaAnual.findFirst({
          where: { alunoId: aluno.id, status: 'ATIVA', instituicaoId: recibo.instituicaoId, nivelEnsino: 'SUPERIOR' },
          orderBy: { createdAt: 'desc' },
          select: { classeOuAnoCurso: true },
        });
        if (ma?.classeOuAnoCurso && /^\dº\s*Ano$/i.test(ma.classeOuAnoCurso.trim())) {
          anoFrequencia = ma.classeOuAnoCurso.trim();
        }
      }
    }

    // Ensino Secundário: classeFrequencia = "10ª Classe", "12ª Classe" (da tabela Classe)
    let classeFrequencia: string | null = null;
    if (tipoAcademico !== 'SUPERIOR') {
      classeFrequencia = turma?.classe?.nome ?? mensalidade?.classe?.nome ?? null;
      if (!classeFrequencia && aluno?.id) {
        const ma = await prisma.matriculaAnual.findFirst({
          where: { alunoId: aluno.id, status: 'ATIVA', instituicaoId: recibo.instituicaoId, nivelEnsino: 'SECUNDARIO' },
          orderBy: { createdAt: 'desc' },
          select: { classeOuAnoCurso: true, classe: { select: { nome: true } } },
        });
        classeFrequencia = ma?.classe?.nome ?? ma?.classeOuAnoCurso ?? null;
      }
    }

    const valorDesconto = Number(recibo.valorDesconto ?? 0);
    const valorPago = Number(recibo.valor);
    const valorBase = mensalidade ? Number(mensalidade.valor) : valorPago;
    const valorMulta = mensalidade ? Number(mensalidade.valorMulta ?? 0) : 0;
    const valorJuros = mensalidade ? Number(mensalidade.valorJuros ?? 0) : 0;
    // IVA: Ensino Superior - quando instituição tem percentualImpostoPadrao (ex: 14%)
    let valorIVA = 0;
    if (tipoAcademico === 'SUPERIOR' && config?.percentualImpostoPadrao != null) {
      const pct = Number(config.percentualImpostoPadrao);
      if (pct > 0) valorIVA = Math.round((valorBase - valorDesconto) * (pct / 100) * 100) / 100;
    }
    const totalPago = valorBase - valorDesconto + valorMulta + valorJuros + valorIVA;

    // Formato SIGAE para PDF (compatível com ReciboData do frontend)
    const pdfData = {
      instituicao: {
        nome: recibo.instituicao?.nome ?? '',
        logoUrl: recibo.instituicao?.logoUrl ?? null,
        email: recibo.instituicao?.emailContato ?? null,
        telefone: recibo.instituicao?.telefone ?? config?.telefoneFiscal ?? null,
        endereco: recibo.instituicao?.endereco ?? config?.enderecoFiscal ?? null,
        nif: config?.nif ?? null,
        tipoAcademico,
      },
      aluno: {
        nome: aluno?.nomeCompleto ?? '',
        numeroId: aluno?.numeroIdentificacaoPublica ?? aluno?.numeroIdentificacao ?? null,
        bi: aluno?.numeroIdentificacao ?? null,
        email: aluno?.email ?? null,
        curso,
        turma: turmaNome,
        anoLetivo,
        anoFrequencia,
        classeFrequencia,
        turno,
        semestre,
        tipoAcademico,
      },
      pagamento: {
        valor: valorBase,
        valorDesconto,
        valorMulta,
        valorJuros,
        valorIVA: valorIVA > 0 ? valorIVA : undefined,
        totalPago,
        mesReferencia: parseInt(String(mensalidade?.mesReferencia ?? '1'), 10) || 1,
        anoReferencia: mensalidade?.anoReferencia ?? new Date().getFullYear(),
        serie: tipoAcademico === 'SUPERIOR' ? `${mensalidade?.anoReferencia ?? new Date().getFullYear()}-A` : null,
        dataPagamento: recibo.dataEmissao?.toISOString?.() ?? recibo.pagamento?.dataPagamento?.toISOString?.() ?? new Date().toISOString(),
        formaPagamento: recibo.formaPagamento ?? recibo.pagamento?.metodoPagamento ?? 'N/A',
        reciboNumero: recibo.numeroRecibo,
        operador: operadorNome,
        descricao: `Mensalidade de ${getMesNome(parseInt(String(mensalidade?.mesReferencia ?? '1'), 10) || 1)}/${mensalidade?.anoReferencia ?? new Date().getFullYear()}`,
      },
      status: recibo.status,
    };

    // Resposta: objeto completo + pdfData para uso direto na geração de PDF
    const { instituicaoId: _, ...reciboSemInst } = recibo;
    res.json({
      ...reciboSemInst,
      pdfData,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /recibos?matriculaId=...
 * Multi-tenant: filtra por req.user.instituicaoId (JWT)
 */
export const getRecibos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { matriculaId } = req.query;

    const where: any = { instituicaoId };

    if (matriculaId && typeof matriculaId === 'string') {
      // Recibos vinculados à matrícula (direto ou via mensalidade)
      where.OR = [
        { matriculaId },
        { mensalidade: { matriculaId } },
      ];
    }

    const recibos = await prisma.recibo.findMany({
      where,
      include: {
        mensalidade: {
          include: {
            aluno: {
              select: {
                id: true,
                nomeCompleto: true,
                numeroIdentificacaoPublica: true,
              },
            },
          },
        },
      },
      orderBy: { dataEmissao: 'desc' },
    });

    // Não incluir instituicaoId na resposta
    const resultado = recibos.map(({ instituicaoId: _, ...r }) => r);
    res.json(resultado);
  } catch (error) {
    next(error);
  }
};
