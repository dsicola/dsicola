import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAnoLetivoAtivo } from '@/hooks/useAnoLetivoAtivo';
import {
  UserPlus,
  GraduationCap,
  BookOpen,
  Users,
  ClipboardList,
  DollarSign,
  FileText,
  Bell,
  CreditCard,
  KeyRound,
  Calendar,
  Settings,
  UserCog,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickAction {
  label: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  requiresAnoLetivo?: boolean; // Se requer ano letivo ativo
  roles?: string[]; // Roles que podem ver esta ação
}

const allQuickActions: QuickAction[] = [
  {
    label: 'Admitir Estudante',
    icon: <UserPlus className="h-5 w-5" />,
    path: '/admin-dashboard/criar-aluno',
    color: 'bg-blue-500 hover:bg-blue-600 text-white',
    // REMOVIDO: requiresAnoLetivo - Aluno é entidade ADMINISTRATIVA, não depende de Ano Letivo
    roles: ['ADMIN', 'SECRETARIA', 'SUPER_ADMIN'],
  },
  {
    label: 'Adicionar Professor',
    icon: <GraduationCap className="h-5 w-5" />,
    path: '/admin-dashboard/criar-professor',
    color: 'bg-green-500 hover:bg-green-600 text-white',
    roles: ['ADMIN', 'SUPER_ADMIN'],
  },
  {
    label: 'Adicionar Disciplinas',
    icon: <BookOpen className="h-5 w-5" />,
    path: '/admin-dashboard/configuracao-ensino?tab=disciplinas',
    color: 'bg-purple-500 hover:bg-purple-600 text-white',
    // REMOVIDO: requiresAnoLetivo - Disciplina é entidade ADMINISTRATIVA, não depende de Ano Letivo
    roles: ['ADMIN', 'SUPER_ADMIN'],
  },
  {
    label: 'Adicionar Turma',
    icon: <Users className="h-5 w-5" />,
    path: '/admin-dashboard/configuracao-ensino?tab=turmas',
    color: 'bg-orange-500 hover:bg-orange-600 text-white',
    requiresAnoLetivo: true,
    roles: ['ADMIN', 'SUPER_ADMIN'],
  },
  {
    label: 'Registrar Notas',
    icon: <ClipboardList className="h-5 w-5" />,
    path: '/admin-dashboard/avaliacoes-notas',
    color: 'bg-teal-500 hover:bg-teal-600 text-white',
    requiresAnoLetivo: true,
    roles: ['ADMIN', 'SECRETARIA', 'SUPER_ADMIN'],
  },
  {
    label: 'Gestão Financeira',
    icon: <DollarSign className="h-5 w-5" />,
    path: '/admin-dashboard/gestao-financeira',
    color: 'bg-amber-500 hover:bg-amber-600 text-white',
    roles: ['ADMIN', 'SECRETARIA', 'SUPER_ADMIN'],
  },
  {
    label: 'Boletins',
    icon: <FileText className="h-5 w-5" />,
    path: '/admin-dashboard/boletim',
    color: 'bg-cyan-500 hover:bg-cyan-600 text-white',
    requiresAnoLetivo: true,
    roles: ['ADMIN', 'SECRETARIA', 'SUPER_ADMIN'],
  },
  {
    label: 'Notificações',
    icon: <Bell className="h-5 w-5" />,
    path: '/admin-dashboard/notificacoes',
    color: 'bg-rose-500 hover:bg-rose-600 text-white',
    roles: ['ADMIN', 'SUPER_ADMIN'],
  },
  {
    label: 'Ano Letivo',
    icon: <Calendar className="h-5 w-5" />,
    path: '/admin-dashboard/configuracao-ensino?tab=anos-letivos',
    color: 'bg-indigo-500 hover:bg-indigo-600 text-white',
    roles: ['ADMIN', 'SUPER_ADMIN'],
  },
  {
    label: 'Configurações',
    icon: <Settings className="h-5 w-5" />,
    path: '/admin-dashboard/configuracoes-instituicao',
    color: 'bg-slate-500 hover:bg-slate-600 text-white',
    roles: ['ADMIN', 'SUPER_ADMIN'],
  },
];

/**
 * Componente de Ações Rápidas totalmente responsivo
 * - Mobile: carrossel horizontal ou lista vertical compacta
 * - Tablet: grid 2xN
 * - Desktop: grid adaptável
 */
export function ResponsiveQuickActions() {
  const navigate = useNavigate();
  const { role, roles } = useAuth();
  const { hasAnoLetivoAtivo } = useAnoLetivoAtivo();

  // Filtrar ações por role e ano letivo
  const filteredActions = allQuickActions.filter((action) => {
    // Verificar role
    if (action.roles && !action.roles.includes(role || '')) {
      return false;
    }

    // REMOVIDO: Filtro por ano letivo - ações administrativas não devem ser filtradas
    // Apenas ações acadêmicas (Turma, Notas, Boletins) requerem ano letivo
    // Mas essas ações já estão marcadas corretamente e não devem ser ocultadas, apenas desabilitadas

    return true;
  });

  if (filteredActions.length === 0) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-lg">Ações Rápidas</CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-6">
        {/* Mobile: Scroll horizontal suave */}
        <div className="flex sm:hidden gap-3 overflow-x-auto pb-2 -mx-3 px-3 snap-x snap-mandatory scrollbar-hide">
          {filteredActions.map((action, index) => (
            <Button
              key={action.label}
              variant="ghost"
              className={cn(
                'flex flex-col items-center justify-center h-20 w-20 gap-1.5 shrink-0 snap-center',
                action.color,
                !hasAnoLetivoAtivo && action.requiresAnoLetivo && 'opacity-50 cursor-not-allowed'
              )}
              onClick={() => {
                if (hasAnoLetivoAtivo || !action.requiresAnoLetivo) {
                  navigate(action.path);
                }
              }}
              disabled={action.requiresAnoLetivo && !hasAnoLetivoAtivo}
            >
              {action.icon}
              <span className="text-[10px] text-center font-medium leading-tight">
                {action.label.split(' ')[0]}
              </span>
            </Button>
          ))}
        </div>

        {/* Tablet/Desktop: Grid responsivo */}
        <div className="hidden sm:grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filteredActions.map((action) => (
            <Button
              key={action.label}
              variant="ghost"
              className={cn(
                'flex flex-col items-center justify-center h-20 sm:h-24 gap-2',
                action.color,
                !hasAnoLetivoAtivo && action.requiresAnoLetivo && 'opacity-50 cursor-not-allowed'
              )}
              onClick={() => {
                if (hasAnoLetivoAtivo || !action.requiresAnoLetivo) {
                  navigate(action.path);
                }
              }}
              disabled={action.requiresAnoLetivo && !hasAnoLetivoAtivo}
              title={action.requiresAnoLetivo && !hasAnoLetivoAtivo ? 'Requer Ano Letivo ativo' : undefined}
            >
              {action.icon}
              <span className="text-xs text-center font-medium leading-tight px-1">
                {action.label}
              </span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

