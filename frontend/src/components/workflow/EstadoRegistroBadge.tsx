import { Badge } from '@/components/ui/badge';
import { FileEdit, Eye, CheckCircle2, Lock } from 'lucide-react';

/**
 * Estados padronizados do sistema
 */
export type EstadoRegistro = 'RASCUNHO' | 'EM_REVISAO' | 'APROVADO' | 'ENCERRADO';

interface EstadoRegistroBadgeProps {
  estado: EstadoRegistro | string | null | undefined;
  className?: string;
}

/**
 * Badge padronizado para estados de registros
 * Usado em: Semestre, PlanoEnsino, Avaliacao, Pauta
 */
export function EstadoRegistroBadge({ estado, className }: EstadoRegistroBadgeProps) {
  if (!estado) {
    return (
      <Badge variant="outline" className={className}>
        Sem estado
      </Badge>
    );
  }

  const estadoUpper = estado.toUpperCase() as EstadoRegistro;

  const statusConfig: Record<EstadoRegistro, {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    icon: typeof FileEdit;
    className: string;
  }> = {
    RASCUNHO: {
      label: 'Rascunho',
      variant: 'secondary',
      icon: FileEdit,
      className: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300',
    },
    EM_REVISAO: {
      label: 'Em Revisão',
      variant: 'default',
      icon: Eye,
      className: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900 dark:text-blue-300',
    },
    APROVADO: {
      label: 'Aprovado',
      variant: 'default',
      icon: CheckCircle2,
      className: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900 dark:text-green-300',
    },
    ENCERRADO: {
      label: 'Encerrado',
      variant: 'destructive',
      icon: Lock,
      className: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900 dark:text-red-300',
    },
  };

  const config = statusConfig[estadoUpper];
  
  // Se estado não for reconhecido, mostrar como outline
  if (!config) {
    return (
      <Badge variant="outline" className={className}>
        {estado}
      </Badge>
    );
  }

  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={`flex items-center gap-1.5 ${config.className} ${className || ''}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

/**
 * Verificar se estado permite edição
 */
export function estadoPermiteEdicao(estado: EstadoRegistro | string | null | undefined): boolean {
  if (!estado) return true; // Se não tiver estado, permite (compatibilidade)
  return estado.toUpperCase() !== 'ENCERRADO';
}

/**
 * Verificar se estado está encerrado
 */
export function estadoEncerrado(estado: EstadoRegistro | string | null | undefined): boolean {
  if (!estado) return false;
  return estado.toUpperCase() === 'ENCERRADO';
}

