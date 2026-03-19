import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope, addInstitutionFilter } from '../middlewares/auth.js';
import {
  calcularFolhaProfessorContratado,
  criarOuAtualizarFolhaProfessor,
  contarAulasProfessorNoMes,
} from '../services/professorFolha.service.js';
import { registarFaltaManual, processarFaltasAutomaticas } from '../services/professorFalta.service.js';

/**
 * GET /folha-professor?mes=3&ano=2026
 * Lista folhas de pagamento de professores contratados
 */
export const listar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const mes = req.query.mes ? parseInt(String(req.query.mes), 10) : new Date().getMonth() + 1;
    const ano = req.query.ano ? parseInt(String(req.query.ano), 10) : new Date().getFullYear();

    const folhas = await prisma.folhaPagamentoProfessor.findMany({
      where: { professor: { instituicaoId }, mes, ano },
      include: {
        professor: {
          include: {
            user: { select: { nomeCompleto: true, email: true } },
          },
        },
      },
      orderBy: { professorId: 'asc' },
    });

    const data = folhas.map((f) => ({
      id: f.id,
      professorId: f.professorId,
      professorNome: f.professor.user.nomeCompleto,
      professorEmail: f.professor.user.email,
      mes: f.mes,
      ano: f.ano,
      totalAulas: f.totalAulas,
      valorPorAula: parseFloat(f.valorPorAula.toString()),
      salarioBruto: parseFloat(f.salarioBruto.toString()),
      faltasNaoJustificadas: parseFloat(f.faltasNaoJustificadas?.toString() ?? '0'),
      valorDescontoFaltas: parseFloat(f.valorDescontoFaltas.toString()),
      outrosDescontos: parseFloat(f.outrosDescontos.toString()),
      bonus: parseFloat(f.bonus.toString()),
      salarioLiquido: parseFloat(f.salarioLiquido.toString()),
      status: f.status,
      observacoes: f.observacoes,
    }));

    res.json({ data, mes, ano });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /folha-professor/calcular
 * Calcula ou recalcula folha para um professor contratado
 * Body: { professorId, mes, ano, faltasNaoJustificadas?, outrosDescontos?, bonus?, observacoes? }
 */
export const calcular = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { professorId, mes, ano, faltasNaoJustificadas, outrosDescontos, bonus, observacoes } = req.body;

    if (!professorId || !mes || !ano) {
      throw new AppError('professorId, mes e ano são obrigatórios', 400);
    }

    const filter = addInstitutionFilter(req);
    const professor = await prisma.professor.findFirst({
      where: { id: professorId, ...filter },
    });
    if (!professor) {
      throw new AppError('Professor não encontrado', 404);
    }

    const folha = await criarOuAtualizarFolhaProfessor(
      professorId,
      parseInt(String(mes), 10),
      parseInt(String(ano), 10),
      instituicaoId,
      {
        faltasNaoJustificadas: faltasNaoJustificadas != null ? parseFloat(String(faltasNaoJustificadas)) : undefined,
        outrosDescontos: outrosDescontos != null ? parseFloat(String(outrosDescontos)) : undefined,
        bonus: bonus != null ? parseFloat(String(bonus)) : undefined,
        observacoes,
      }
    );

    res.json({
      id: folha.id,
      professorId: folha.professorId,
      mes: folha.mes,
      ano: folha.ano,
      totalAulas: folha.totalAulas,
      valorPorAula: parseFloat(folha.valorPorAula.toString()),
      salarioBruto: parseFloat(folha.salarioBruto.toString()),
      faltasNaoJustificadas: parseFloat(folha.faltasNaoJustificadas?.toString() ?? '0'),
      valorDescontoFaltas: parseFloat(folha.valorDescontoFaltas.toString()),
      outrosDescontos: parseFloat(folha.outrosDescontos.toString()),
      bonus: parseFloat(folha.bonus.toString()),
      salarioLiquido: parseFloat(folha.salarioLiquido.toString()),
      status: folha.status,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /folha-professor/calcular-todos
 * Calcula folhas de todos os professores CONTRATADOS do mês
 * Body: { mes, ano }
 */
export const calcularTodos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const mes = req.body.mes ?? new Date().getMonth() + 1;
    const ano = req.body.ano ?? new Date().getFullYear();

    const professoresContratados = await prisma.professor.findMany({
      where: {
        instituicaoId,
        tipoVinculo: 'CONTRATADO',
        valorPorAula: { not: null },
      },
    });

    const resultados: { professorId: string; professorNome: string; folhaId?: string; erro?: string }[] = [];

    for (const p of professoresContratados) {
      try {
        const folha = await criarOuAtualizarFolhaProfessor(p.id, mes, ano, instituicaoId);
        const user = await prisma.user.findUnique({ where: { id: p.userId }, select: { nomeCompleto: true } });
        resultados.push({ professorId: p.id, professorNome: user?.nomeCompleto ?? '-', folhaId: folha.id });
      } catch (e: any) {
        const user = await prisma.user.findUnique({ where: { id: p.userId }, select: { nomeCompleto: true } });
        resultados.push({ professorId: p.id, professorNome: user?.nomeCompleto ?? '-', erro: e?.message ?? 'Erro' });
      }
    }

    res.json({ mes, ano, resultados });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /folha-professor/preview/:professorId?mes=3&ano=2026
 * Preview do cálculo (sem gravar)
 */
export const preview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { professorId } = req.params;
    const mes = req.query.mes ? parseInt(String(req.query.mes), 10) : new Date().getMonth() + 1;
    const ano = req.query.ano ? parseInt(String(req.query.ano), 10) : new Date().getFullYear();

    const filter = addInstitutionFilter(req);
    const professor = await prisma.professor.findFirst({
      where: { id: professorId, ...filter },
      include: { user: { select: { nomeCompleto: true } } },
    });
    if (!professor) {
      throw new AppError('Professor não encontrado', 404);
    }

    const totalAulas = await contarAulasProfessorNoMes(professorId!, mes, ano, instituicaoId);
    const calc = await calcularFolhaProfessorContratado(professorId!, mes, ano, instituicaoId);

    res.json({
      professorId,
      professorNome: professor.user.nomeCompleto,
      mes,
      ano,
      totalAulas,
      valorPorAula: calc.valorPorAula,
      salarioBruto: calc.salarioBruto,
      faltasNaoJustificadas: Number(calc.faltasNaoJustificadas),
      valorDescontoFaltas: calc.valorDescontoFaltas,
      outrosDescontos: calc.outrosDescontos,
      bonus: calc.bonus,
      salarioLiquido: calc.salarioLiquido,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /folha-professor/faltas
 * Regista falta manual (ADMIN, RH, SECRETARIA)
 * Body: { professorId, data, fracaoFalta?, justificada?, observacoes? }
 */
export const registarFalta = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { professorId, data, fracaoFalta, justificada, observacoes } = req.body;
    const userId = req.user?.userId;

    if (!professorId || !data) {
      throw new AppError('professorId e data são obrigatórios', 400);
    }

    const falta = await registarFaltaManual(
      professorId,
      new Date(data),
      instituicaoId,
      {
        fracaoFalta: fracaoFalta != null ? parseFloat(String(fracaoFalta)) : undefined,
        justificada: justificada ?? false,
        registadoPorId: userId ?? undefined,
        observacoes,
      }
    );

    res.status(201).json({
      id: falta.id,
      professorId: falta.professorId,
      professorNome: falta.professor.user.nomeCompleto,
      data: falta.data.toISOString().split('T')[0],
      fracaoFalta: parseFloat(falta.fracaoFalta.toString()),
      justificada: falta.justificada,
      origem: falta.origem,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /folha-professor/faltas/processar
 * Processa faltas automáticas para uma data (aulas previstas não dadas)
 * Body: { data }
 */
export const processarFaltas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const data = req.body.data ? new Date(req.body.data) : new Date();

    const result = await processarFaltasAutomaticas(data, instituicaoId);
    res.json({
      data: data.toISOString().split('T')[0],
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /folha-professor/faltas?professorId=&mes=&ano=
 * Lista faltas de um professor ou da instituição
 */
export const listarFaltas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { professorId, mes, ano } = req.query;

    const where: any = { instituicaoId };
    if (professorId) where.professorId = String(professorId);
    if (mes && ano) {
      const m = parseInt(String(mes), 10);
      const a = parseInt(String(ano), 10);
      where.data = {
        gte: new Date(a, m - 1, 1),
        lte: new Date(a, m, 0, 23, 59, 59, 999),
      };
    }

    const faltas = await prisma.professorFalta.findMany({
      where,
      include: {
        professor: { include: { user: { select: { nomeCompleto: true } } } },
        registadoPor: { select: { nomeCompleto: true } },
      },
      orderBy: { data: 'desc' },
      take: 200,
    });

    const data = faltas.map((f) => ({
      id: f.id,
      professorId: f.professorId,
      professorNome: f.professor.user.nomeCompleto,
      data: f.data.toISOString().split('T')[0],
      fracaoFalta: parseFloat(f.fracaoFalta.toString()),
      justificada: f.justificada,
      origem: f.origem,
      registadoPor: f.registadoPor?.nomeCompleto ?? null,
      observacoes: f.observacoes,
    }));

    res.json({ data });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /folha-professor/faltas/:id
 * Atualiza falta (justificar/desjustificar) — ADMIN, RH, SECRETARIA
 * Regra: justificada=true → não desconta; justificada=false → desconta (se configurado)
 */
export const atualizarFalta = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;
    const { justificada, observacoes } = req.body;

    const falta = await prisma.professorFalta.findFirst({
      where: { id, instituicaoId },
      include: { professor: { include: { user: { select: { nomeCompleto: true } } } } },
    });
    if (!falta) throw new AppError('Falta não encontrada', 404);

    const updateData: { justificada?: boolean; observacoes?: string } = {};
    if (typeof justificada === 'boolean') updateData.justificada = justificada;
    if (observacoes !== undefined) updateData.observacoes = observacoes ?? null;

    if (Object.keys(updateData).length === 0) {
      return res.json({
        id: falta.id,
        professorId: falta.professorId,
        professorNome: falta.professor.user.nomeCompleto,
        data: falta.data.toISOString().split('T')[0],
        fracaoFalta: parseFloat(falta.fracaoFalta.toString()),
        justificada: falta.justificada,
        origem: falta.origem,
        observacoes: falta.observacoes,
      });
    }

    const atualizada = await prisma.professorFalta.update({
      where: { id },
      data: updateData,
      include: { professor: { include: { user: { select: { nomeCompleto: true } } } } },
    });

    res.json({
      id: atualizada.id,
      professorId: atualizada.professorId,
      professorNome: atualizada.professor.user.nomeCompleto,
      data: atualizada.data.toISOString().split('T')[0],
      fracaoFalta: parseFloat(atualizada.fracaoFalta.toString()),
      justificada: atualizada.justificada,
      origem: atualizada.origem,
      observacoes: atualizada.observacoes,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /folha-professor/faltas/:id
 * Remove falta (ex: engano — professor deu a aula e esqueceu de lançar)
 * Permite que o professor lance a aula retroativamente após remoção
 */
export const removerFalta = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;

    const falta = await prisma.professorFalta.findFirst({
      where: { id, instituicaoId },
    });

    if (!falta) {
      throw new AppError('Falta não encontrada', 404);
    }

    await prisma.professorFalta.delete({ where: { id } });
    res.json({ message: 'Falta removida. O professor pode lançar a aula para esta data.' });
  } catch (error) {
    next(error);
  }
};
