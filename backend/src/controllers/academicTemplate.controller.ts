import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';
import {
  DEFAULT_BUILTIN_MINI_PAUTA_ID,
  resolvePautaTemplateFromConfigJson,
} from '../services/academicTemplate.service.js';

const ALLOWED_BUILTIN_IDS = new Set<string>([DEFAULT_BUILTIN_MINI_PAUTA_ID]);

function rejectBodyInstituicaoId(req: Request) {
  if (req.body?.instituicaoId !== undefined && req.body?.instituicaoId !== null) {
    throw new AppError('Violação multi-tenant: instituicaoId não pode ser enviado pelo cliente.', 403);
  }
}

function summarizeConfigJson(configJson: unknown): string {
  try {
    const raw = configJson as Record<string, unknown>;
    if (raw?.kind === 'builtin' && typeof raw.builtinId === 'string') {
      return `Motor incorporado: ${raw.builtinId}`;
    }
    if (raw?.kind === 'embedded') {
      const t = (raw.template as Record<string, unknown>)?.id;
      return typeof t === 'string' ? `Template personalizado: ${t}` : 'Template personalizado (embedded)';
    }
    if (typeof raw?.builtinId === 'string') {
      return `Motor incorporado: ${raw.builtinId}`;
    }
    return 'Configuração registada';
  } catch {
    return '—';
  }
}

/**
 * GET — lista templates da instituição + template ativo.
 * Ensino superior: devolve lista vazia (motor não aplicável à mini-pauta secundária).
 */
export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const inst = await prisma.instituicao.findUnique({
      where: { id: instituicaoId },
      select: {
        tipoAcademico: true,
        activeAcademicTemplateId: true,
        activeAcademicTemplate: {
          select: { id: true, nome: true, versao: true, configJson: true },
        },
      },
    });
    if (!inst) throw new AppError('Instituição não encontrada', 404);

    if (inst.tipoAcademico !== 'SECUNDARIO') {
      return res.json({
        tipoAcademico: inst.tipoAcademico,
        secundarioMotorDisponivel: false,
        activeAcademicTemplateId: null,
        activeSummary: null,
        templates: [],
      });
    }

    const rows = await prisma.academicTemplate.findMany({
      where: { instituicaoId },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        nome: true,
        versao: true,
        ativo: true,
        createdAt: true,
        configJson: true,
      },
    });

    const templates = rows.map((r) => ({
      id: r.id,
      nome: r.nome,
      versao: r.versao,
      ativo: r.ativo,
      createdAt: r.createdAt.toISOString(),
      summary: summarizeConfigJson(r.configJson),
    }));

    let activeSummary: string | null = null;
    if (inst.activeAcademicTemplate) {
      activeSummary = `${inst.activeAcademicTemplate.nome} (v${inst.activeAcademicTemplate.versao}) — ${summarizeConfigJson(inst.activeAcademicTemplate.configJson)}`;
    } else {
      activeSummary = `Padrão do sistema (${DEFAULT_BUILTIN_MINI_PAUTA_ID})`;
    }

    return res.json({
      tipoAcademico: inst.tipoAcademico,
      secundarioMotorDisponivel: true,
      activeAcademicTemplateId: inst.activeAcademicTemplateId,
      activeSummary,
      templates,
    });
  } catch (e) {
    next(e);
  }
};

/**
 * POST — novo registo de template (imutável). Apenas `builtin` na whitelist.
 */
export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    rejectBodyInstituicaoId(req);
    const instituicaoId = requireTenantScope(req);
    const instPerm = await prisma.instituicao.findUnique({
      where: { id: instituicaoId },
      select: { tipoAcademico: true },
    });
    if (instPerm?.tipoAcademico !== 'SECUNDARIO') {
      throw new AppError('Gestão de motor mini-pauta só aplica-se a instituições de Ensino Secundário.', 400);
    }

    const nome = String(req.body?.nome ?? '').trim().slice(0, 100);
    if (!nome) throw new AppError('Nome do registo é obrigatório.', 400);

    const builtinId = String(req.body?.builtinId ?? DEFAULT_BUILTIN_MINI_PAUTA_ID).trim();
    if (!ALLOWED_BUILTIN_IDS.has(builtinId)) {
      throw new AppError(`Motor incorporado não suportado: ${builtinId}`, 400);
    }

    const maxVersao = await prisma.academicTemplate.aggregate({
      where: { instituicaoId },
      _max: { versao: true },
    });
    const nextVersao = (maxVersao._max.versao ?? 0) + 1;

    const configJson = { kind: 'builtin', builtinId };

    const row = await prisma.academicTemplate.create({
      data: {
        instituicaoId,
        nome,
        configJson,
        ativo: true,
        versao: nextVersao,
      },
      select: {
        id: true,
        nome: true,
        versao: true,
        createdAt: true,
        configJson: true,
      },
    });

    resolvePautaTemplateFromConfigJson(row.configJson);

    return res.status(201).json({
      id: row.id,
      nome: row.nome,
      versao: row.versao,
      createdAt: row.createdAt.toISOString(),
      summary: summarizeConfigJson(row.configJson),
    });
  } catch (e) {
    next(e);
  }
};

/**
 * PUT /active — define qual template está ativo (ou null = padrão do sistema).
 */
export const setActive = async (req: Request, res: Response, next: NextFunction) => {
  try {
    rejectBodyInstituicaoId(req);
    const instituicaoId = requireTenantScope(req);
    const instPerm = await prisma.instituicao.findUnique({
      where: { id: instituicaoId },
      select: { tipoAcademico: true },
    });
    if (instPerm?.tipoAcademico !== 'SECUNDARIO') {
      throw new AppError('Gestão de motor mini-pauta só aplica-se a instituições de Ensino Secundário.', 400);
    }

    const templateId =
      req.body?.templateId === null || req.body?.templateId === ''
        ? null
        : String(req.body?.templateId ?? '').trim() || null;

    if (templateId) {
      const tpl = await prisma.academicTemplate.findFirst({
        where: { id: templateId, instituicaoId },
      });
      if (!tpl) {
        throw new AppError('Template não encontrado ou não pertence à sua instituição.', 404);
      }
      if (!tpl.ativo) {
        throw new AppError('Este registo de template está inativo.', 400);
      }
      resolvePautaTemplateFromConfigJson(tpl.configJson);
    }

    await prisma.instituicao.update({
      where: { id: instituicaoId },
      data: { activeAcademicTemplateId: templateId },
    });

    return res.json({
      ok: true,
      activeAcademicTemplateId: templateId,
      message: templateId
        ? 'Template ativo atualizado. Novos cálculos e pré-visualizações usam este registo.'
        : 'A instituição voltou a usar o motor padrão do sistema (builtin).',
    });
  } catch (e) {
    next(e);
  }
};
