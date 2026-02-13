/**
 * Cores padrão baseadas no tipo acadêmico da instituição
 */

export interface DefaultColors {
  cor_primaria: string;
  cor_secundaria: string;
  cor_terciaria: string;
}

/**
 * Retorna as cores padrão para Ensino Superior
 * Esquema sóbrio e institucional: azul institucional profundo
 */
export function getDefaultColorsSuperior(): DefaultColors {
  return {
    cor_primaria: '#1E40AF',      // Azul institucional (#1E40AF)
    cor_secundaria: '#64748B',    // Cinza elegante
    cor_terciaria: '#F1F5F9',     // Cinza claro para fundos
  };
}

/**
 * Retorna as cores padrão para Ensino Secundário
 * Esquema leve e educacional: verde institucional
 */
export function getDefaultColorsSecundario(): DefaultColors {
  return {
    cor_primaria: '#166534',      // Verde institucional (#166534)
    cor_secundaria: '#6B7280',    // Cinza suave
    cor_terciaria: '#F0FDF4',     // Verde muito claro para fundos
  };
}

/**
 * Retorna as cores padrão baseadas no tipo acadêmico
 * @param tipoAcademico - 'SUPERIOR', 'SECUNDARIO' ou null
 * @returns Cores padrão apropriadas
 */
export function getDefaultColorsByTipoAcademico(
  tipoAcademico: 'SUPERIOR' | 'SECUNDARIO' | null
): DefaultColors {
  if (tipoAcademico === 'SUPERIOR') {
    return getDefaultColorsSuperior();
  } else if (tipoAcademico === 'SECUNDARIO') {
    return getDefaultColorsSecundario();
  }
  
  // Fallback para cores neutras se tipo não identificado
  return {
    cor_primaria: '#8B5CF6',      // Roxo neutro
    cor_secundaria: '#1F2937',    // Cinza escuro
    cor_terciaria: '#F8FAFC',     // Cinza muito claro
  };
}

