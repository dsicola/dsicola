import { TipoAcademico } from '@prisma/client';

/**
 * Interface para cores padrão
 */
export interface DefaultColors {
  corPrimaria: string;
  corSecundaria: string;
  corTerciaria: string;
}

/**
 * Retorna as cores padrão para Ensino Superior
 * Esquema sóbrio e institucional: azul institucional profundo
 */
export function getDefaultColorsSuperior(): DefaultColors {
  return {
    corPrimaria: '#1E40AF',      // Azul institucional (#1E40AF)
    corSecundaria: '#64748B',    // Cinza elegante
    corTerciaria: '#F1F5F9',     // Cinza claro para fundos
  };
}

/**
 * Retorna as cores padrão para Ensino Secundário
 * Esquema leve e educacional: verde institucional
 */
export function getDefaultColorsSecundario(): DefaultColors {
  return {
    corPrimaria: '#166534',      // Verde institucional (#166534)
    corSecundaria: '#6B7280',    // Cinza suave
    corTerciaria: '#F0FDF4',     // Verde muito claro para fundos
  };
}

/**
 * Retorna as cores padrão baseadas no tipo acadêmico
 * @param tipoAcademico - 'SUPERIOR', 'SECUNDARIO' ou null
 * @returns Cores padrão apropriadas
 */
export function getDefaultColorsByTipoAcademico(
  tipoAcademico: TipoAcademico | null
): DefaultColors {
  if (tipoAcademico === TipoAcademico.SUPERIOR) {
    return getDefaultColorsSuperior();
  } else if (tipoAcademico === TipoAcademico.SECUNDARIO) {
    return getDefaultColorsSecundario();
  }
  
  // Fallback para cores neutras se tipo não identificado
  return {
    corPrimaria: '#8B5CF6',      // Roxo neutro
    corSecundaria: '#1F2937',    // Cinza escuro
    corTerciaria: '#F8FAFC',     // Cinza muito claro
  };
}

