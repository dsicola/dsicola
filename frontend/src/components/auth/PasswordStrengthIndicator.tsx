import React from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserRole } from '@/types/auth';

interface PasswordRequirement {
  label: string;
  met: boolean;
}

interface PasswordStrengthIndicatorProps {
  password: string;
  /**
   * Se true, mostra apenas requisitos simplificados (maiúscula + caractere especial)
   * Para roles ADMIN, PROFESSOR, SECRETARIA, SUPER_ADMIN, POS
   * @deprecated Use 'userRole' instead for more accurate validation
   */
  simplified?: boolean;
  /**
   * Role do usuário para determinar requisitos de senha
   * Se fornecido, ignora 'simplified' e calcula baseado na role
   */
  userRole?: UserRole | UserRole[];
}

/**
 * Verifica se uma role exige senha forte
 */
export const requiresStrongPassword = (role?: UserRole | UserRole[]): boolean => {
  if (!role) return false;
  
  const rolesExigemSenhaForte: UserRole[] = ['SUPER_ADMIN', 'COMERCIAL', 'ADMIN', 'PROFESSOR', 'SECRETARIA', 'POS', 'RH', 'FINANCEIRO'];
  const rolesArray = Array.isArray(role) ? role : [role];
  
  return rolesArray.some(r => rolesExigemSenhaForte.includes(r));
};

export const getPasswordRequirements = (
  password: string, 
  simplified: boolean = false,
  userRole?: UserRole | UserRole[]
): PasswordRequirement[] => {
  // Se userRole fornecido, usar para determinar requisitos
  const needsStrongPassword = userRole ? requiresStrongPassword(userRole) : simplified;
  
  if (needsStrongPassword) {
    // Requisitos para roles que exigem senha forte: ADMIN, PROFESSOR, SECRETARIA, SUPER_ADMIN, POS
    return [
      { label: 'Mínimo 8 caracteres', met: password.length >= 8 },
      { label: 'Uma letra maiúscula', met: /[A-Z]/.test(password) },
      { label: 'Uma letra minúscula', met: /[a-z]/.test(password) },
      { label: 'Um número', met: /[0-9]/.test(password) },
      { label: 'Um caractere especial (!@#$%^&*)', met: /[!@#$%^&*(),.?":{}|<>\[\]\\\/_+\-=~`]/.test(password) },
    ];
  }
  
  // Requisitos para ALUNO e outras roles (apenas comprimento mínimo)
  return [
    { label: 'Mínimo 6 caracteres', met: password.length >= 6 },
  ];
};

export const isPasswordStrong = (
  password: string, 
  simplified: boolean = false,
  userRole?: UserRole | UserRole[]
): boolean => {
  if (!password) return false;
  
  const requirements = getPasswordRequirements(password, simplified, userRole);
  const needsStrongPassword = userRole ? requiresStrongPassword(userRole) : simplified;
  
  if (needsStrongPassword) {
    // Para ADMIN e PROFESSOR: exige que TODOS os requisitos sejam atendidos
    // E que a senha não seja classificada como "Péssima"
    const allMet = requirements.every(req => req.met);
    if (!allMet) return false;
    
    // Verificar se não é "Péssima" baseado em critérios adicionais
    const strength = getPasswordStrengthLevel(password, requirements);
    return strength !== 'PÉSSIMA';
  }
  
  // Para outras roles: apenas verificar requisitos básicos
  return requirements.every(req => req.met);
};

/**
 * Calcula o nível de força da senha
 */
export type PasswordStrengthLevel = 'PÉSSIMA' | 'MÉDIA' | 'BOA' | 'FORTE';

export const getPasswordStrengthLevel = (
  password: string,
  requirements: PasswordRequirement[]
): PasswordStrengthLevel => {
  if (!password) return 'PÉSSIMA';
  
  const metCount = requirements.filter(r => r.met).length;
  const totalRequirements = requirements.length;
  
  // Requisitos mínimos para não ser "Péssima":
  // - Mínimo 8 caracteres
  // - Pelo menos 1 maiúscula
  // - Pelo menos 1 caractere especial
  const hasMinLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>\[\]\\\/_+\-=~`]/.test(password);
  
  const meetsMinimum = hasMinLength && hasUpperCase && hasSpecialChar;
  
  if (!meetsMinimum) {
    return 'PÉSSIMA';
  }
  
  // Calcular score baseado em critérios
  let score = 0;
  
  // Comprimento (máximo 30 pontos)
  if (password.length >= 8) score += 10;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;
  
  // Diversidade de caracteres (máximo 40 pontos)
  if (hasUpperCase) score += 10;
  if (/[a-z]/.test(password)) score += 10;
  if (/[0-9]/.test(password)) score += 10;
  if (hasSpecialChar) score += 10;
  
  // Complexidade adicional (máximo 30 pontos)
  const typeCount = [
    hasUpperCase,
    /[a-z]/.test(password),
    /[0-9]/.test(password),
    hasSpecialChar,
  ].filter(Boolean).length;
  
  if (typeCount >= 3) score += 15;
  if (typeCount === 4) score += 15;
  
  // Classificar baseado no score
  if (score < 40) return 'PÉSSIMA';
  if (score < 60) return 'MÉDIA';
  if (score < 80) return 'BOA';
  return 'FORTE';
};

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({ 
  password, 
  simplified = false,
  userRole 
}) => {
  const requirements = getPasswordRequirements(password, simplified, userRole);
  const metCount = requirements.filter(r => r.met).length;
  const totalRequirements = requirements.length;
  const strengthPercentage = totalRequirements > 0 ? (metCount / totalRequirements) * 100 : 0;
  
  const strengthLevel = getPasswordStrengthLevel(password, requirements);
  
  const getStrengthLevel = () => {
    switch (strengthLevel) {
      case 'PÉSSIMA':
        return { level: 0, color: 'bg-red-500', text: 'Péssima', textColor: 'text-red-600' };
      case 'MÉDIA':
        return { level: 2, color: 'bg-orange-500', text: 'Média', textColor: 'text-orange-600' };
      case 'BOA':
        return { level: 3, color: 'bg-green-500', text: 'Boa', textColor: 'text-green-600' };
      case 'FORTE':
        return { level: 4, color: 'bg-blue-500', text: 'Forte', textColor: 'text-blue-600' };
      default:
        return { level: 0, color: 'bg-gray-300', text: 'Péssima', textColor: 'text-gray-600' };
    }
  };

  const strength = getStrengthLevel();
  
  // Calcular porcentagem baseada no nível de força
  const strengthPercentageMap = {
    'PÉSSIMA': 25,
    'MÉDIA': 50,
    'BOA': 75,
    'FORTE': 100,
  };
  
  const finalStrengthPercentage = strengthPercentageMap[strengthLevel] || 0;

  if (!password) return null;

  return (
    <div className="space-y-3 mt-2">
      {/* Strength bar - Barra profissional de força da senha */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="text-muted-foreground font-medium">Força da senha:</span>
          <span className={cn("font-semibold", strength.textColor)}>
            {strength.text}
          </span>
        </div>
        <div className="relative h-2.5 bg-muted rounded-full overflow-hidden shadow-inner">
          <div 
            className={cn(
              "h-full transition-all duration-500 ease-out rounded-full",
              strength.color,
              strength.level > 0 && "shadow-sm"
            )}
            style={{ width: `${finalStrengthPercentage}%` }}
          />
          {/* Indicador de progresso com gradiente para melhor visualização */}
          {strength.level >= 3 && (
            <div 
              className={cn(
                "absolute inset-0 h-full rounded-full opacity-30",
                strength.level === 4 ? "bg-gradient-to-r from-green-400 to-green-600" :
                "bg-gradient-to-r from-yellow-400 to-yellow-600"
              )}
              style={{ width: `${finalStrengthPercentage}%` }}
            />
          )}
        </div>
      </div>

      {/* Mensagem de feedback */}
      {strengthLevel === 'PÉSSIMA' && (
        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded-md border border-red-200 dark:border-red-800">
          <X className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>Senha muito fraca. Utilize letras, números e símbolos.</span>
        </div>
      )}

      {/* Requirements list */}
      <ul className="grid grid-cols-1 gap-1.5 text-xs">
        {requirements.map((req, index) => (
          <li 
            key={index}
            className={cn(
              "flex items-center gap-2 transition-all duration-200",
              req.met 
                ? "text-green-600 dark:text-green-400" 
                : "text-muted-foreground"
            )}
          >
            <div className={cn(
              "flex items-center justify-center w-4 h-4 rounded-full transition-all",
              req.met 
                ? "bg-green-100 dark:bg-green-900/30" 
                : "bg-muted"
            )}>
              {req.met ? (
                <Check className="h-2.5 w-2.5 text-green-600 dark:text-green-400" />
              ) : (
                <X className="h-2.5 w-2.5 text-muted-foreground" />
              )}
            </div>
            <span className={cn(
              "transition-all",
              req.met && "font-medium"
            )}>
              {req.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
