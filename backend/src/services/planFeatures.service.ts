/**
 * Validação de funcionalidades do plano vs uso da instituição
 * Garante alinhamento: planos, assinaturas e configurações
 *
 * REGRAS PROFISSIONAIS:
 * - multiCampus: Plano.multiCampus + ConfiguracaoInstituicao.multiCampus
 * - funcionalidades: 100% dinâmico - apenas o que está em Plano.funcionalidades
 * - sem fallbacks hardcoded - planos legados devem ter funcionalidades preenchidas via migração
 */

import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';

/** Funcionalidades conhecidas (para validação e labels) - não usadas como fallback */
export const FUNCIONALIDADES_PLANO = [
  'gestao_alunos',
  'gestao_professores',
  'notas',
  'frequencia',
  'financeiro',
  'documentos',
  'comunicados',
  'analytics',
  'api_access',
  'alojamentos',
] as const;

export type FuncionalidadePlano = (typeof FUNCIONALIDADES_PLANO)[number];

/** Mapeamento rota/módulo → funcionalidade do plano */
export const ROTA_PARA_FUNCIONALIDADE: Record<string, FuncionalidadePlano> = {
  alojamentos: 'alojamentos',
  comunicados: 'comunicados',
  analytics: 'analytics',
  api_access: 'api_access',
  relatorios: 'analytics',
};

export interface PlanFeatures {
  multiCampus: boolean;
  funcionalidades: string[];
  planoNome: string;
}

/**
 * Obtém as funcionalidades do plano da assinatura ativa da instituição
 */
export async function getPlanFeatures(instituicaoId: string): Promise<PlanFeatures | null> {
  const assinatura = await prisma.assinatura.findUnique({
    where: { instituicaoId, status: 'ativa' },
    include: { plano: true },
  });

  if (!assinatura?.plano) return null;

  const plano = assinatura.plano;
  const funcionalidades = Array.isArray(plano.funcionalidades)
    ? (plano.funcionalidades as string[]).map((f) => String(f).toLowerCase())
    : [];

  return {
    multiCampus: Boolean(plano.multiCampus),
    funcionalidades,
    planoNome: plano.nome,
  };
}

/**
 * Valida se o plano da instituição inclui multiCampus
 * @throws AppError se plano não tiver multiCampus
 */
export async function validatePlanMultiCampus(
  instituicaoId: string,
  bypassSuperAdmin = false,
  userRoles?: string[]
): Promise<void> {
  if (bypassSuperAdmin && userRoles?.includes('SUPER_ADMIN')) return;

  const features = await getPlanFeatures(instituicaoId);
  if (!features) {
    throw new AppError(
      'Sua instituição não possui assinatura ativa. Entre em contato com o suporte.',
      403
    );
  }

  if (!features.multiCampus) {
    throw new AppError(
      `O recurso multi-campus não está incluído no seu plano "${features.planoNome}". ` +
        'Atualize seu plano para utilizar múltiplos campus.',
      403
    );
  }
}

/**
 * Valida se o plano da instituição inclui uma funcionalidade
 * @throws AppError se plano não tiver a funcionalidade
 */
export async function validatePlanFuncionalidade(
  instituicaoId: string,
  funcionalidade: string,
  bypassSuperAdmin = false,
  userRoles?: string[]
): Promise<void> {
  if (bypassSuperAdmin && userRoles?.includes('SUPER_ADMIN')) return;

  const features = await getPlanFeatures(instituicaoId);
  if (!features) {
    throw new AppError(
      'Sua instituição não possui assinatura ativa. Entre em contato com o suporte.',
      403
    );
  }

  const key = funcionalidade.toLowerCase();
  const hasFeature = features.funcionalidades.includes(key);

  if (!hasFeature) {
    const label = getFuncionalidadeLabel(key);
    throw new AppError(
      `O recurso "${label}" não está incluído no seu plano "${features.planoNome}". ` +
        'Atualize seu plano para utilizar esta funcionalidade.',
      403
    );
  }
}

function getFuncionalidadeLabel(key: string): string {
  const labels: Record<string, string> = {
    alojamentos: 'Gestão de Alojamentos',
    comunicados: 'Comunicados',
    analytics: 'Analytics e Relatórios Avançados',
    api_access: 'Acesso à API',
  };
  return labels[key] || key;
}

/**
 * Valida se a instituição pode ativar multiCampus na config
 * (plano deve ter multiCampus)
 */
export async function canEnableConfigMultiCampus(
  instituicaoId: string,
  userRoles?: string[]
): Promise<boolean> {
  if (userRoles?.includes('SUPER_ADMIN')) return true;
  const features = await getPlanFeatures(instituicaoId);
  return features?.multiCampus ?? false;
}

/**
 * Valida se a instituição pode criar campus (para multi-campus)
 * Regra: 1º campus sempre permitido. 2º+ campus exige plan.multiCampus E config.multiCampus
 */
export async function canCreateCampus(
  instituicaoId: string,
  currentCampusCount: number,
  configMultiCampus: boolean,
  userRoles?: string[]
): Promise<void> {
  if (userRoles?.includes('SUPER_ADMIN')) return;

  // Primeiro campus: sempre permitido
  if (currentCampusCount === 0) return;

  // Segundo ou mais: exige plano e config
  const features = await getPlanFeatures(instituicaoId);
  if (!features) {
    throw new AppError(
      'Sua instituição não possui assinatura ativa. Entre em contato com o suporte.',
      403
    );
  }

  if (!features.multiCampus) {
    throw new AppError(
      `O recurso multi-campus não está incluído no seu plano "${features.planoNome}". ` +
        'Atualize seu plano para cadastrar múltiplos campus.',
      403
    );
  }

  if (!configMultiCampus) {
    throw new AppError(
      'Ative o recurso multi-campus nas configurações da instituição antes de cadastrar novos campus.',
      403
    );
  }
}

/**
 * Valida compatibilidade plano ↔ instituição (tipoAcademico)
 * - Plano com tipoAcademico null = serve ambos (SECUNDARIO e SUPERIOR)
 * - Plano SECUNDARIO = apenas instituições SECUNDARIO
 * - Plano SUPERIOR = apenas instituições SUPERIOR
 */
export function isPlanoCompativelComInstituicao(
  planoTipoAcademico: 'SECUNDARIO' | 'SUPERIOR' | null,
  instituicaoTipoAcademico: 'SECUNDARIO' | 'SUPERIOR' | null
): boolean {
  if (!instituicaoTipoAcademico) return true;
  if (!planoTipoAcademico) return true; // plano null = ambos
  return planoTipoAcademico === instituicaoTipoAcademico;
}

/**
 * Valida e lança se plano não for compatível com instituição
 */
export function validatePlanoInstituicaoCompatibilidade(
  planoTipoAcademico: 'SECUNDARIO' | 'SUPERIOR' | null,
  instituicaoTipoAcademico: 'SECUNDARIO' | 'SUPERIOR' | null,
  planoNome: string
): void {
  if (isPlanoCompativelComInstituicao(planoTipoAcademico, instituicaoTipoAcademico)) return;

  const tipoInst = instituicaoTipoAcademico === 'SECUNDARIO' ? 'Ensino Secundário' : 'Ensino Superior';
  const tipoPlano = planoTipoAcademico === 'SECUNDARIO' ? 'Ensino Secundário' : 'Ensino Superior';
  throw new AppError(
    `O plano "${planoNome}" é exclusivo para ${tipoPlano}. ` +
      `Sua instituição é do tipo ${tipoInst}. Escolha um plano compatível.`,
    400
  );
}
