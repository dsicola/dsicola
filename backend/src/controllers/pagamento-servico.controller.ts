/**
 * Pagamentos avulsos de Bata e Passe (fora da matrícula inicial)
 * Permite pagar apenas bata ou apenas passe para alunos já matriculados
 */

import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';
import { Decimal } from '@prisma/client/runtime/library';
import { TipoServicoAvulso } from '@prisma/client';
import { emitirReciboServico } from '../services/recibo-servico.service.js';
import { AuditService } from '../services/audit.service.js';
import { ModuloAuditoria, EntidadeAuditoria } from '../services/audit.service.js';

/**
 * Obter valores disponíveis de bata/passe para um aluno (baseado em curso/classe da matrícula)
 * GET /pagamentos-servico/valores-disponiveis/:alunoId
 */
export const getValoresDisponiveis = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { alunoId } = req.params;
    const instituicaoId = requireTenantScope(req);

    const aluno = await prisma.user.findFirst({
      where: {
        id: alunoId,
        instituicaoId,
        roles: { some: { role: 'ALUNO' } },
      },
    });

    if (!aluno) {
      throw new AppError('Estudante não encontrado', 404);
    }

    const config = await prisma.configuracaoInstituicao.findUnique({
      where: { instituicaoId },
    });

    const valorPasseInstitucional = config?.valorPasse ? Number(config.valorPasse) : 0;

    let valorBata = 0;
    let exigeBata = false;
    let valorPasse = valorPasseInstitucional;
    let exigePasse = false;
    let cursoId: string | null = null;
    let classeId: string | null = null;
    let matriculaId: string | null = null;
    let matriculaAnualId: string | null = null;
    let anoLetivoId: string | null = null;

    // 1. Tentar MatriculaAnual (fluxo atual - curso/classe direto)
    const matAnual = await prisma.matriculaAnual.findFirst({
      where: {
        alunoId,
        instituicaoId,
        status: 'ATIVA',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        curso: true,
        classe: true,
      },
    });

    if (matAnual) {
      matriculaAnualId = matAnual.id;
      anoLetivoId = matAnual.anoLetivoId ?? null;

      if (matAnual.curso) {
        cursoId = matAnual.curso.id;
        exigeBata = matAnual.curso.exigeBata ?? false;
        valorBata = matAnual.curso.exigeBata && matAnual.curso.valorBata
          ? Number(matAnual.curso.valorBata)
          : 0;
        exigePasse = matAnual.curso.exigePasse ?? false;
        valorPasse = matAnual.curso.exigePasse && matAnual.curso.valorPasse
          ? Number(matAnual.curso.valorPasse)
          : valorPasseInstitucional;
      }
      if (matAnual.classe) {
        classeId = matAnual.classe.id;
        exigeBata = matAnual.classe.exigeBata ?? false;
        valorBata = matAnual.classe.exigeBata && matAnual.classe.valorBata
          ? Number(matAnual.classe.valorBata)
          : 0;
        exigePasse = matAnual.classe.exigePasse ?? false;
        valorPasse = matAnual.classe.exigePasse && matAnual.classe.valorPasse
          ? Number(matAnual.classe.valorPasse)
          : valorPasseInstitucional;
      }
    }

    // 2. Se não tem MatriculaAnual, tentar Matricula (turma -> curso/classe)
    if (!matAnual) {
      const mat = await prisma.matricula.findFirst({
        where: {
          alunoId,
          status: 'Ativa',
        },
        orderBy: { dataMatricula: 'desc' },
        include: {
          turma: {
            include: {
              curso: true,
              classe: true,
            },
          },
        },
      });

      if (mat?.turma) {
        matriculaId = mat.id;
        anoLetivoId = mat.anoLetivoId ?? null;

        if (mat.turma.curso) {
          cursoId = mat.turma.curso.id;
          exigeBata = mat.turma.curso.exigeBata ?? false;
          valorBata = mat.turma.curso.exigeBata && mat.turma.curso.valorBata
            ? Number(mat.turma.curso.valorBata)
            : 0;
          exigePasse = mat.turma.curso.exigePasse ?? false;
          valorPasse = mat.turma.curso.exigePasse && mat.turma.curso.valorPasse
            ? Number(mat.turma.curso.valorPasse)
            : valorPasseInstitucional;
        }
        if (mat.turma.classe) {
          classeId = mat.turma.classe.id;
          exigeBata = mat.turma.classe.exigeBata ?? false;
          valorBata = mat.turma.classe.exigeBata && mat.turma.classe.valorBata
            ? Number(mat.turma.classe.valorBata)
            : 0;
          exigePasse = mat.turma.classe.exigePasse ?? false;
          valorPasse = mat.turma.classe.exigePasse && mat.turma.classe.valorPasse
            ? Number(mat.turma.classe.valorPasse)
            : valorPasseInstitucional;
        }
      }
    }

    res.json({
      aluno: {
        id: aluno.id,
        nomeCompleto: aluno.nomeCompleto,
        numeroIdentificacaoPublica: aluno.numeroIdentificacaoPublica,
      },
      bata: {
        valor: valorBata,
        exige: exigeBata,
      },
      passe: {
        valor: valorPasse,
        exige: exigePasse,
      },
      cursoId,
      classeId,
      matriculaId,
      matriculaAnualId,
      anoLetivoId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Registrar pagamento avulso de bata ou passe
 * POST /pagamentos-servico
 */
export const registrarPagamentoServico = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { alunoId, tipoServico, valor, metodoPagamento, observacoes } = req.body;
    const userId = req.user?.userId;
    const instituicaoId = requireTenantScope(req);

    if (!alunoId || !tipoServico || !valor || !metodoPagamento) {
      throw new AppError('alunoId, tipoServico, valor e metodoPagamento são obrigatórios', 400);
    }

    const tipo = tipoServico.toUpperCase() as TipoServicoAvulso;
    if (tipo !== 'BATA' && tipo !== 'PASSE') {
      throw new AppError('tipoServico deve ser BATA ou PASSE', 400);
    }

    const valorDecimal = new Decimal(Number(valor));
    if (valorDecimal.lte(0)) {
      throw new AppError('Valor deve ser maior que zero', 400);
    }

    const valores = await getValoresDisponiveisInternal(alunoId, instituicaoId);
    if (!valores) {
      throw new AppError('Estudante não encontrado ou sem matrícula ativa', 404);
    }

    const valorEsperado = tipo === 'BATA' ? valores.bata.valor : valores.passe.valor;
    if (valorEsperado <= 0) {
      throw new AppError(
        `O curso/classe do estudante não possui valor configurado para ${tipo === 'BATA' ? 'bata' : 'passe'}. Configure em Taxas e Serviços.`,
        400
      );
    }

    const pagamento = await prisma.pagamentoServico.create({
      data: {
        instituicaoId,
        alunoId,
        tipoServico: tipo,
        valor: valorDecimal,
        metodoPagamento,
        cursoId: valores.cursoId ?? undefined,
        classeId: valores.classeId ?? undefined,
        matriculaId: valores.matriculaId ?? undefined,
        matriculaAnualId: valores.matriculaAnualId ?? undefined,
        anoLetivoId: valores.anoLetivoId ?? undefined,
        registradoPor: userId ?? undefined,
        observacoes: observacoes || undefined,
      },
      include: {
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            numeroIdentificacaoPublica: true,
            email: true,
          },
        },
        curso: { select: { nome: true } },
        classe: { select: { nome: true } },
      },
    });

    const reciboResult = await emitirReciboServico({
      pagamentoServicoId: pagamento.id,
      instituicaoId,
      estudanteId: pagamento.alunoId,
      tipoServico: tipo,
      valor: Number(pagamento.valor),
      formaPagamento: pagamento.metodoPagamento,
      operadorId: userId ?? undefined,
    });

    AuditService.logCreate(req, {
      modulo: ModuloAuditoria.FINANCEIRO,
      entidade: EntidadeAuditoria.PAGAMENTO,
      entidadeId: pagamento.id,
      dadosNovos: {
        pagamentoServicoId: pagamento.id,
        reciboId: reciboResult.id,
        numeroRecibo: reciboResult.numeroRecibo,
        alunoId,
        tipoServico: tipo,
        valor: pagamento.valor.toString(),
        metodoPagamento,
      },
      observacao: observacoes ?? undefined,
    }).catch((err) => console.error('[registrarPagamentoServico] Erro audit:', err));

    res.status(201).json({
      pagamento,
      reciboId: reciboResult.id,
      numeroRecibo: reciboResult.numeroRecibo,
    });
  } catch (error) {
    next(error);
  }
};

async function getValoresDisponiveisInternal(
  alunoId: string,
  instituicaoId: string
): Promise<{
  cursoId: string | null;
  classeId: string | null;
  matriculaId: string | null;
  matriculaAnualId: string | null;
  anoLetivoId: string | null;
  bata: { valor: number; exige: boolean };
  passe: { valor: number; exige: boolean };
} | null> {
  const config = await prisma.configuracaoInstituicao.findUnique({
    where: { instituicaoId },
  });
  const valorPasseInstitucional = config?.valorPasse ? Number(config.valorPasse) : 0;

  let valorBata = 0;
  let exigeBata = false;
  let valorPasse = valorPasseInstitucional;
  let exigePasse = false;
  let cursoId: string | null = null;
  let classeId: string | null = null;
  let matriculaId: string | null = null;
  let matriculaAnualId: string | null = null;
  let anoLetivoId: string | null = null;

  const matAnual = await prisma.matriculaAnual.findFirst({
    where: { alunoId, instituicaoId, status: 'ATIVA' },
    orderBy: { createdAt: 'desc' },
    include: { curso: true, classe: true },
  });

  if (matAnual) {
    matriculaAnualId = matAnual.id;
    anoLetivoId = matAnual.anoLetivoId ?? null;
    if (matAnual.curso) {
      cursoId = matAnual.curso.id;
      exigeBata = matAnual.curso.exigeBata ?? false;
      valorBata = matAnual.curso.exigeBata && matAnual.curso.valorBata ? Number(matAnual.curso.valorBata) : 0;
      exigePasse = matAnual.curso.exigePasse ?? false;
      valorPasse = matAnual.curso.exigePasse && matAnual.curso.valorPasse ? Number(matAnual.curso.valorPasse) : valorPasseInstitucional;
    }
    if (matAnual.classe) {
      classeId = matAnual.classe.id;
      exigeBata = matAnual.classe.exigeBata ?? false;
      valorBata = matAnual.classe.exigeBata && matAnual.classe.valorBata ? Number(matAnual.classe.valorBata) : 0;
      exigePasse = matAnual.classe.exigePasse ?? false;
      valorPasse = matAnual.classe.exigePasse && matAnual.classe.valorPasse ? Number(matAnual.classe.valorPasse) : valorPasseInstitucional;
    }
  } else {
    const mat = await prisma.matricula.findFirst({
      where: { alunoId, status: 'Ativa' },
      orderBy: { dataMatricula: 'desc' },
      include: { turma: { include: { curso: true, classe: true } } },
    });
    if (mat?.turma) {
      matriculaId = mat.id;
      anoLetivoId = mat.anoLetivoId ?? null;
      if (mat.turma.curso) {
        cursoId = mat.turma.curso.id;
        exigeBata = mat.turma.curso.exigeBata ?? false;
        valorBata = mat.turma.curso.exigeBata && mat.turma.curso.valorBata ? Number(mat.turma.curso.valorBata) : 0;
        exigePasse = mat.turma.curso.exigePasse ?? false;
        valorPasse = mat.turma.curso.exigePasse && mat.turma.curso.valorPasse ? Number(mat.turma.curso.valorPasse) : valorPasseInstitucional;
      }
      if (mat.turma.classe) {
        classeId = mat.turma.classe.id;
        exigeBata = mat.turma.classe.exigeBata ?? false;
        valorBata = mat.turma.classe.exigeBata && mat.turma.classe.valorBata ? Number(mat.turma.classe.valorBata) : 0;
        exigePasse = mat.turma.classe.exigePasse ?? false;
        valorPasse = mat.turma.classe.exigePasse && mat.turma.classe.valorPasse ? Number(mat.turma.classe.valorPasse) : valorPasseInstitucional;
      }
    }
  }

  return {
    cursoId,
    classeId,
    matriculaId,
    matriculaAnualId,
    anoLetivoId,
    bata: { valor: valorBata, exige: exigeBata },
    passe: { valor: valorPasse, exige: exigePasse },
  };
}

/**
 * Listar pagamentos de serviço (bata/passe)
 * GET /pagamentos-servico
 */
export const getAllPagamentosServico = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { alunoId, tipoServico, dataInicio, dataFim } = req.query;

    const where: Record<string, unknown> = { instituicaoId };

    if (alunoId) where.alunoId = alunoId as string;
    if (tipoServico) where.tipoServico = (tipoServico as string).toUpperCase();

    if (dataInicio || dataFim) {
      where.dataPagamento = {};
      if (dataInicio) (where.dataPagamento as Record<string, Date>).gte = new Date(dataInicio as string);
      if (dataFim) (where.dataPagamento as Record<string, Date>).lte = new Date((dataFim as string) + 'T23:59:59.999Z');
    }

    const pagamentos = await prisma.pagamentoServico.findMany({
      where,
      include: {
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            numeroIdentificacaoPublica: true,
            email: true,
          },
        },
        curso: { select: { nome: true } },
        classe: { select: { nome: true } },
        reciboServico: { select: { numeroRecibo: true, status: true } },
      },
      orderBy: { dataPagamento: 'desc' },
    });

    res.json(pagamentos);
  } catch (error) {
    next(error);
  }
};

/**
 * Obter pagamento de serviço por ID
 * GET /pagamentos-servico/:id
 */
export const getPagamentoServicoById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const instituicaoId = requireTenantScope(req);

    const pagamento = await prisma.pagamentoServico.findFirst({
      where: { id, instituicaoId },
      include: {
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            numeroIdentificacaoPublica: true,
            email: true,
          },
        },
        curso: { select: { nome: true } },
        classe: { select: { nome: true } },
        reciboServico: { select: { id: true, numeroRecibo: true, status: true } },
      },
    });

    if (!pagamento) {
      throw new AppError('Pagamento de serviço não encontrado', 404);
    }

    res.json(pagamento);
  } catch (error) {
    next(error);
  }
};
