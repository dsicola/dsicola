import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import type { PautaCalculoTemplate } from '../pauta-engine/types.js';
import { angolaSecundarioV1Template } from '../pauta-engine/templates/angolaSecundarioV1.js';

/** Builtins suportados pelo motor (`pauta-engine`). */
const BUILTIN: Record<string, PautaCalculoTemplate> = {
  'angola-secundario-v1': angolaSecundarioV1Template,
};

export const DEFAULT_BUILTIN_MINI_PAUTA_ID = 'angola-secundario-v1';

export function getBuiltinMiniPautaTemplate(builtinId: string): PautaCalculoTemplate {
  const t = BUILTIN[builtinId];
  if (!t) throw new AppError(`Template builtin desconhecido: ${builtinId}`, 500);
  return t;
}

type ConfigJson =
  | { kind: 'builtin'; builtinId: string }
  | { kind: 'embedded'; template: PautaCalculoTemplate };

function parseConfigJson(raw: unknown): ConfigJson {
  if (raw == null || typeof raw !== 'object') {
    return { kind: 'builtin', builtinId: DEFAULT_BUILTIN_MINI_PAUTA_ID };
  }
  const o = raw as Record<string, unknown>;
  if (o.kind === 'builtin' && typeof o.builtinId === 'string' && o.builtinId.trim()) {
    return { kind: 'builtin', builtinId: o.builtinId.trim() };
  }
  if (o.kind === 'embedded' && o.template != null && typeof o.template === 'object') {
    return { kind: 'embedded', template: o.template as PautaCalculoTemplate };
  }
  if (typeof o.builtinId === 'string' && o.builtinId.trim()) {
    return { kind: 'builtin', builtinId: o.builtinId.trim() };
  }
  return { kind: 'builtin', builtinId: DEFAULT_BUILTIN_MINI_PAUTA_ID };
}

function resolveFromConfig(cfg: ConfigJson): PautaCalculoTemplate {
  if (cfg.kind === 'builtin') {
    return getBuiltinMiniPautaTemplate(cfg.builtinId);
  }
  const t = cfg.template;
  if (
    !t?.id ||
    typeof t.version !== 'number' ||
    !t.bindings ||
    typeof t.bindings !== 'object' ||
    !t.computed ||
    typeof t.computed !== 'object'
  ) {
    throw new AppError('Template embedded inválido: exige id, version, bindings e computed', 400);
  }
  return t;
}

/** Interpreta `config_json` armazenado na BD. */
export function resolvePautaTemplateFromConfigJson(configJson: unknown): PautaCalculoTemplate {
  return resolveFromConfig(parseConfigJson(configJson));
}

/**
 * Template de mini-pauta (secundário) ativo para a instituição.
 * Sem `active_academic_template_id` → builtin Angola v1.
 */
export async function resolvePautaTemplateForInstituicao(
  instituicaoId: string,
): Promise<PautaCalculoTemplate> {
  const inst = await prisma.instituicao.findUnique({
    where: { id: instituicaoId },
    select: {
      activeAcademicTemplateId: true,
      activeAcademicTemplate: { select: { id: true, configJson: true, ativo: true } },
    },
  });

  if (
    !inst?.activeAcademicTemplateId ||
    !inst.activeAcademicTemplate?.ativo ||
    inst.activeAcademicTemplate.id !== inst.activeAcademicTemplateId
  ) {
    return getBuiltinMiniPautaTemplate(DEFAULT_BUILTIN_MINI_PAUTA_ID);
  }

  try {
    return resolvePautaTemplateFromConfigJson(inst.activeAcademicTemplate.configJson);
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError('Falha ao interpretar template académico da instituição', 500);
  }
}
