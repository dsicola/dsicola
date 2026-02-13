import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const getMesNome = (mes: number) => MESES[mes - 1] ?? '';

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

    // Buscar ConfiguracaoInstituicao para NIF/morada fiscal (SIGAE)
    const config = await prisma.configuracaoInstituicao.findFirst({
      where: { instituicaoId: recibo.instituicaoId },
      select: { nif: true, enderecoFiscal: true, telefoneFiscal: true },
    });

    const aluno = recibo.mensalidade?.aluno;
    const mensalidade = recibo.mensalidade;
    const matricula = mensalidade?.matricula;
    const turma = matricula?.turma;
    const tipoAcademico = recibo.instituicao?.tipoAcademico ?? null;

    // Contexto acadêmico SIGAE: dados da MATRÍCULA (nunca do frontend)
    // Ensino Superior: Curso + Ano de Frequência + Turma + Ano Letivo
    // Ensino Secundário: Curso (se existir) + Classe de Frequência + Turma + Ano Letivo
    const curso = turma?.curso?.nome ?? mensalidade?.curso?.nome ?? null;
    const turmaNome = turma?.nome ?? null;
    const anoLetivo = matricula?.anoLetivo ?? matricula?.anoLetivoRef?.ano ?? turma?.anoLetivoRef?.ano ?? null;

    const anoFrequencia =
      tipoAcademico === 'SUPERIOR' && turma?.ano != null
        ? `${turma.ano}º Ano`
        : null;

    const classeFrequencia =
      tipoAcademico !== 'SUPERIOR'
        ? (turma?.classe?.nome ?? mensalidade?.classe?.nome ?? null)
        : null;

    const valorDesconto = Number(recibo.valorDesconto ?? 0);
    const valorPago = Number(recibo.valor);
    const valorBase = mensalidade ? Number(mensalidade.valor) : valorPago;
    const valorMulta = mensalidade ? Number(mensalidade.valorMulta ?? 0) : 0;
    const valorJuros = mensalidade ? Number(mensalidade.valorJuros ?? 0) : 0;
    const totalPago = valorBase - valorDesconto + valorMulta + valorJuros;

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
        tipoAcademico,
      },
      pagamento: {
        valor: valorBase,
        valorDesconto,
        valorMulta,
        valorJuros,
        totalPago,
        mesReferencia: parseInt(String(mensalidade?.mesReferencia ?? '1'), 10) || 1,
        anoReferencia: mensalidade?.anoReferencia ?? new Date().getFullYear(),
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
