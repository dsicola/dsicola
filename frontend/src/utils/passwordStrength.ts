/**
 * Utilitário para validação e classificação de força de senha
 * 
 * Classifica senhas em 4 níveis:
 * - Péssima: Não atende requisitos mínimos
 * - Média: Atende requisitos básicos
 * - Boa: Atende requisitos e tem boa complexidade
 * - Forte: Atende todos os requisitos e tem alta complexidade
 */

export type PasswordStrength = 'PÉSSIMA' | 'MÉDIA' | 'BOA' | 'FORTE';

export interface PasswordStrengthResult {
  strength: PasswordStrength;
  score: number; // 0-100
  feedback: string;
  requirements: {
    minLength: boolean;
    hasUpperCase: boolean;
    hasLowerCase: boolean;
    hasNumber: boolean;
    hasSpecialChar: boolean;
    minLengthValue: number;
  };
}

/**
 * Calcula a força da senha
 * @param password - Senha a ser avaliada
 * @returns Resultado com classificação e feedback
 */
export function calculatePasswordStrength(password: string): PasswordStrengthResult {
  if (!password) {
    return {
      strength: 'PÉSSIMA',
      score: 0,
      feedback: 'Digite uma senha',
      requirements: {
        minLength: false,
        hasUpperCase: false,
        hasLowerCase: false,
        hasNumber: false,
        hasSpecialChar: false,
        minLengthValue: 8,
      },
    };
  }

  const requirements = {
    minLength: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[!@#$%^&*(),.?":{}|<>\[\]\\\/_+\-=~`]/.test(password),
    minLengthValue: 8,
  };

  // Calcular score baseado em critérios
  let score = 0;
  
  // Comprimento (máximo 30 pontos)
  if (password.length >= 8) score += 10;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;
  
  // Diversidade de caracteres (máximo 40 pontos)
  if (requirements.hasUpperCase) score += 10;
  if (requirements.hasLowerCase) score += 10;
  if (requirements.hasNumber) score += 10;
  if (requirements.hasSpecialChar) score += 10;
  
  // Complexidade adicional (máximo 30 pontos)
  // Verificar padrões comuns (reduzir score se encontrados)
  const commonPatterns = [
    /(.)\1{2,}/, // Caracteres repetidos (aaa, 111)
    /(012|123|234|345|456|567|678|789|890)/, // Sequências numéricas
    /(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i, // Sequências alfabéticas
  ];
  
  const hasCommonPattern = commonPatterns.some(pattern => pattern.test(password));
  if (!hasCommonPattern) {
    score += 10; // Bônus por não ter padrões comuns
  }
  
  // Verificar se tem combinação de diferentes tipos de caracteres
  const typeCount = [
    requirements.hasUpperCase,
    requirements.hasLowerCase,
    requirements.hasNumber,
    requirements.hasSpecialChar,
  ].filter(Boolean).length;
  
  if (typeCount >= 3) score += 10; // Bônus por ter 3+ tipos diferentes
  if (typeCount === 4) score += 10; // Bônus extra por ter todos os tipos
  
  // Garantir que score não ultrapasse 100
  score = Math.min(100, score);
  
  // Classificar baseado no score e requisitos mínimos
  let strength: PasswordStrength;
  let feedback: string;
  
  // Requisitos mínimos para ADMIN e PROFESSOR:
  // - Mínimo 8 caracteres
  // - Pelo menos 1 maiúscula
  // - Pelo menos 1 caractere especial
  const meetsMinimumRequirements = 
    requirements.minLength && 
    requirements.hasUpperCase && 
    requirements.hasSpecialChar;
  
  if (!meetsMinimumRequirements || score < 40) {
    strength = 'PÉSSIMA';
    feedback = 'Senha muito fraca. Utilize letras maiúsculas, números e símbolos.';
  } else if (score < 60) {
    strength = 'MÉDIA';
    feedback = 'Senha aceitável, mas pode ser melhorada.';
  } else if (score < 80) {
    strength = 'BOA';
    feedback = 'Senha boa. Continue assim!';
  } else {
    strength = 'FORTE';
    feedback = 'Senha forte. Excelente escolha!';
  }
  
  return {
    strength,
    score,
    feedback,
    requirements,
  };
}

/**
 * Verifica se a senha atende aos requisitos mínimos para ADMIN e PROFESSOR
 * @param password - Senha a ser verificada
 * @returns true se atende aos requisitos mínimos
 */
export function meetsMinimumRequirements(password: string): boolean {
  const result = calculatePasswordStrength(password);
  return result.strength !== 'PÉSSIMA';
}

/**
 * Obtém a cor da barra de progresso baseada na força
 */
export function getStrengthColor(strength: PasswordStrength): string {
  switch (strength) {
    case 'PÉSSIMA':
      return 'bg-red-500';
    case 'MÉDIA':
      return 'bg-orange-500';
    case 'BOA':
      return 'bg-green-500';
    case 'FORTE':
      return 'bg-blue-500';
    default:
      return 'bg-gray-300';
  }
}

/**
 * Obtém o texto da cor baseada na força
 */
export function getStrengthTextColor(strength: PasswordStrength): string {
  switch (strength) {
    case 'PÉSSIMA':
      return 'text-red-600';
    case 'MÉDIA':
      return 'text-orange-600';
    case 'BOA':
      return 'text-green-600';
    case 'FORTE':
      return 'text-blue-600';
    default:
      return 'text-gray-600';
  }
}

