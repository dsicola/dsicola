import React from 'react';
import { calculatePasswordStrength, getStrengthColor, getStrengthTextColor, type PasswordStrength } from '@/utils/passwordStrength';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface PasswordStrengthBarProps {
  password: string;
  showRequirements?: boolean;
  className?: string;
}

export const PasswordStrengthBar: React.FC<PasswordStrengthBarProps> = ({
  password,
  showRequirements = true,
  className = '',
}) => {
  const strengthResult = calculatePasswordStrength(password);
  const { strength, score, feedback, requirements } = strengthResult;

  const colorClass = getStrengthColor(strength);
  const textColorClass = getStrengthTextColor(strength);

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Barra de progresso */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className={`font-medium ${textColorClass}`}>
            Força da senha: <strong>{strength}</strong>
          </span>
          <span className="text-muted-foreground text-xs">{score}%</span>
        </div>
        <Progress 
          value={score} 
          className="h-2"
        />
      </div>

      {/* Mensagem de feedback */}
      <div className={`flex items-start gap-2 text-sm ${textColorClass}`}>
        {strength === 'PÉSSIMA' ? (
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
        ) : (
          <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
        )}
        <span>{feedback}</span>
      </div>

      {/* Lista de requisitos */}
      {showRequirements && password && (
        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            {requirements.minLength ? (
              <CheckCircle2 className="h-3 w-3 text-green-600" />
            ) : (
              <AlertCircle className="h-3 w-3 text-red-600" />
            )}
            <span>Mínimo {requirements.minLengthValue} caracteres</span>
          </div>
          <div className="flex items-center gap-2">
            {requirements.hasUpperCase ? (
              <CheckCircle2 className="h-3 w-3 text-green-600" />
            ) : (
              <AlertCircle className="h-3 w-3 text-red-600" />
            )}
            <span>Pelo menos uma letra maiúscula</span>
          </div>
          <div className="flex items-center gap-2">
            {requirements.hasLowerCase ? (
              <CheckCircle2 className="h-3 w-3 text-green-600" />
            ) : (
              <AlertCircle className="h-3 w-3 text-red-600" />
            )}
            <span>Pelo menos uma letra minúscula</span>
          </div>
          <div className="flex items-center gap-2">
            {requirements.hasNumber ? (
              <CheckCircle2 className="h-3 w-3 text-green-600" />
            ) : (
              <AlertCircle className="h-3 w-3 text-red-600" />
            )}
            <span>Pelo menos um número</span>
          </div>
          <div className="flex items-center gap-2">
            {requirements.hasSpecialChar ? (
              <CheckCircle2 className="h-3 w-3 text-green-600" />
            ) : (
              <AlertCircle className="h-3 w-3 text-red-600" />
            )}
            <span>Pelo menos um caractere especial (!@#$%^&*...)</span>
          </div>
        </div>
      )}
    </div>
  );
};

