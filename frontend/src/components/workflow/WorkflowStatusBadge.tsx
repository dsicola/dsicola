import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, XCircle, Lock, FileEdit } from 'lucide-react';

type StatusWorkflow = 'RASCUNHO' | 'SUBMETIDO' | 'APROVADO' | 'REJEITADO' | 'BLOQUEADO';

interface WorkflowStatusBadgeProps {
  status: StatusWorkflow;
  className?: string;
}

export function WorkflowStatusBadge({ status, className }: WorkflowStatusBadgeProps) {
  const statusConfig = {
    RASCUNHO: {
      label: 'Rascunho',
      variant: 'secondary' as const,
      icon: FileEdit,
      className: 'bg-gray-100 text-gray-700 border-gray-300',
    },
    SUBMETIDO: {
      label: 'Submetido',
      variant: 'default' as const,
      icon: Clock,
      className: 'bg-blue-100 text-blue-700 border-blue-300',
    },
    APROVADO: {
      label: 'Aprovado',
      variant: 'default' as const,
      icon: CheckCircle2,
      className: 'bg-green-100 text-green-700 border-green-300',
    },
    REJEITADO: {
      label: 'Rejeitado',
      variant: 'destructive' as const,
      icon: XCircle,
      className: 'bg-red-100 text-red-700 border-red-300',
    },
    BLOQUEADO: {
      label: 'Bloqueado',
      variant: 'destructive' as const,
      icon: Lock,
      className: 'bg-orange-100 text-orange-700 border-orange-300',
    },
  };

  const config = statusConfig[status];
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

