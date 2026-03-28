import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import {
  addInstitutionFilter,
  getInstituicaoIdFromFilter,
  requireTenantScope,
} from '../middlewares/auth.js';
import { AcademicProgressionService } from '../services/academicProgressionEngine.service.js';
import {
  disciplinaChaveCreateSchema,
  marcarDesistentesSchema,
  regraAprovacaoCreateSchema,
  simularProgressaoSchema,
} from '../validators/academicProgression.validators.js';

function parseBody<T>(schema: { parse: (x: unknown) => T }, req: Request): T {
  return schema.parse(req.body);
}

/** POST /academic/progression/simular */
export const simularProgressao = async (req: Request, res: Response, next: NextFunction) => {
  try {
    requireTenantScope(req);
    const { matriculaAnualId, anoLetivoDestinoId, overrideSequencial } = parseBody(
      simularProgressaoSchema,
      req
    );
    const filter = addInstitutionFilter(req);
    const ma = await prisma.matriculaAnual.findFirst({
      where: { id: matriculaAnualId, ...filter },
    });
    if (!ma) {
      throw new AppError('Matrícula anual não encontrada', 404);
    }

    const result = await AcademicProgressionService.progredirEstudante(matriculaAnualId, {
      anoLetivoDestinoId,
      userRoles: req.user?.roles ?? [],
      overrideSequencial,
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
};

/** POST /academic/progression/avaliar */
export const avaliarMatriculaAnual = async (req: Request, res: Response, next: NextFunction) => {
  try {
    requireTenantScope(req);
    const matriculaAnualId = String(req.body?.matriculaAnualId || '');
    if (!matriculaAnualId) {
      throw new AppError('matriculaAnualId é obrigatório', 400);
    }
    const filter = addInstitutionFilter(req);
    const ma = await prisma.matriculaAnual.findFirst({
      where: { id: matriculaAnualId, ...filter },
    });
    if (!ma) {
      throw new AppError('Matrícula anual não encontrada', 404);
    }
    const resultado = await AcademicProgressionService.avaliarEstudante(matriculaAnualId);
    res.json(resultado);
  } catch (e) {
    next(e);
  }
};

/** GET /academic/progression/proxima-classe/:classeId */
export const proximaClasse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { classeId } = req.params;
    const filter = addInstitutionFilter(req);
    const c = await prisma.classe.findFirst({ where: { id: classeId, ...filter } });
    if (!c) {
      throw new AppError('Classe não encontrada', 404);
    }
    const out = await AcademicProgressionService.obterProximaClasse(classeId, instituicaoId);
    res.json(out);
  } catch (e) {
    next(e);
  }
};

/** POST /academic/progression/detectar-desistentes */
export const detectarDesistentes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const body = parseBody(marcarDesistentesSchema, req);
    const out = await AcademicProgressionService.marcarDesistentesSemMatriculaNovoAno(
      instituicaoId,
      body.anoLetivoAnteriorId,
      body.anoLetivoNovoId
    );
    res.json(out);
  } catch (e) {
    next(e);
  }
};

/** GET /academic/progression/taxa-aprovacao?anoLetivoId= */
export const taxaAprovacao = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const anoLetivoId = String(req.query.anoLetivoId || '');
    if (!anoLetivoId) {
      throw new AppError('anoLetivoId é obrigatório', 400);
    }
    const filter = addInstitutionFilter(req);
    const ano = await prisma.anoLetivo.findFirst({
      where: { id: anoLetivoId, ...filter },
    });
    if (!ano) {
      throw new AppError('Ano letivo não encontrado', 404);
    }
    const rows = await AcademicProgressionService.taxaAprovacaoPorCurso(instituicaoId, anoLetivoId);
    res.json(rows);
  } catch (e) {
    next(e);
  }
};

/** GET /academic/progression/regras */
export const listarRegras = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const instituicaoId = getInstituicaoIdFromFilter(filter);
    if (!instituicaoId) {
      throw new AppError('Instituição obrigatória', 400);
    }
    const rows = await prisma.regraAprovacao.findMany({
      where: { instituicaoId },
      orderBy: { updatedAt: 'desc' },
      include: {
        curso: { select: { id: true, nome: true, codigo: true } },
        classe: { select: { id: true, nome: true, codigo: true } },
      },
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
};

/** POST /academic/progression/regras */
export const criarRegra = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const instituicaoId = getInstituicaoIdFromFilter(filter);
    if (!instituicaoId) {
      throw new AppError('Instituição obrigatória', 400);
    }
    const data = parseBody(regraAprovacaoCreateSchema, req);
    if (data.cursoId) {
      const c = await prisma.curso.findFirst({ where: { id: data.cursoId, instituicaoId } });
      if (!c) throw new AppError('Curso inválido para esta instituição', 400);
    }
    if (data.classeId) {
      const cl = await prisma.classe.findFirst({ where: { id: data.classeId, instituicaoId } });
      if (!cl) throw new AppError('Classe inválida para esta instituição', 400);
    }
    const row = await prisma.regraAprovacao.create({
      data: {
        instituicaoId,
        cursoId: data.cursoId ?? null,
        classeId: data.classeId ?? null,
        mediaMinima: data.mediaMinima != null ? data.mediaMinima : null,
        maxReprovacoes: data.maxReprovacoes != null ? data.maxReprovacoes : null,
        exigeDisciplinasChave: data.exigeDisciplinasChave ?? false,
      },
    });
    res.status(201).json(row);
  } catch (e) {
    next(e);
  }
};

/** DELETE /academic/progression/regras/:id */
export const removerRegra = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const instituicaoId = getInstituicaoIdFromFilter(filter);
    if (!instituicaoId) {
      throw new AppError('Instituição obrigatória', 400);
    }
    const { id } = req.params;
    const deleted = await prisma.regraAprovacao.deleteMany({
      where: { id, instituicaoId },
    });
    if (deleted.count === 0) {
      throw new AppError('Regra não encontrada', 404);
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

/** GET /academic/progression/disciplinas-chave */
export const listarDisciplinasChave = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const instituicaoId = getInstituicaoIdFromFilter(filter);
    if (!instituicaoId) {
      throw new AppError('Instituição obrigatória', 400);
    }
    const cursoId = req.query.cursoId ? String(req.query.cursoId) : undefined;
    const rows = await prisma.disciplinaChave.findMany({
      where: {
        instituicaoId,
        ...(cursoId ? { cursoId } : {}),
      },
      include: {
        curso: { select: { id: true, nome: true } },
        classe: { select: { id: true, nome: true } },
        disciplina: { select: { id: true, nome: true, codigo: true } },
      },
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
};

/** POST /academic/progression/disciplinas-chave */
export const criarDisciplinaChave = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const instituicaoId = getInstituicaoIdFromFilter(filter);
    if (!instituicaoId) {
      throw new AppError('Instituição obrigatória', 400);
    }
    const data = parseBody(disciplinaChaveCreateSchema, req);
    const c = await prisma.curso.findFirst({ where: { id: data.cursoId, instituicaoId } });
    if (!c) throw new AppError('Curso inválido', 400);
    const d = await prisma.disciplina.findFirst({
      where: { id: data.disciplinaId, instituicaoId },
    });
    if (!d) throw new AppError('Disciplina inválida', 400);
    if (data.classeId) {
      const cl = await prisma.classe.findFirst({ where: { id: data.classeId, instituicaoId } });
      if (!cl) throw new AppError('Classe inválida', 400);
    }
    const row = await prisma.disciplinaChave.create({
      data: {
        instituicaoId,
        cursoId: data.cursoId,
        classeId: data.classeId ?? null,
        disciplinaId: data.disciplinaId,
      },
    });
    res.status(201).json(row);
  } catch (e) {
    next(e);
  }
};

/** DELETE /academic/progression/disciplinas-chave/:id */
export const removerDisciplinaChave = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const instituicaoId = getInstituicaoIdFromFilter(filter);
    if (!instituicaoId) {
      throw new AppError('Instituição obrigatória', 400);
    }
    const { id } = req.params;
    const deleted = await prisma.disciplinaChave.deleteMany({
      where: { id, instituicaoId },
    });
    if (deleted.count === 0) {
      throw new AppError('Registo não encontrado', 404);
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
