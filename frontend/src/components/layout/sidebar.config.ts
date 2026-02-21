import {
  LayoutDashboard,
  Library,
  NotebookText,
  UsersRound,
  BookMarked,
  ClipboardCheck,
  CalendarDays,
  FileText,
  UserRound,
  ClipboardList,
  History,
  Award,
  GraduationCap,
  Presentation,
  UserCheck,
  PenLine,
  Wallet,
  BadgePercent,
  AlertCircle,
  FileSignature,
  FileDown,
  Users,
  Briefcase,
  Building2,
  Clock,
  Banknote,
  Fingerprint,
  Megaphone,
  Mail,
  Bell,
  MessageCircle,
  Activity,
  ScrollText,
  BarChart3,
  Database,
  Settings,
  ShieldCheck,
  Network,
  BookOpen,
  Video,
  Receipt,
  Calendar,
  CalendarRange,
  RefreshCw,
  HardDrive,
  UserCog,
  Shield,
  Package,
  CalendarCheck,
  FileCheck,
  Key,
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';

export interface SidebarSection {
  section: string;
  items: SidebarItem[];
}

export interface SidebarItem {
  label: string;
  icon: LucideIcon;
  path: string;
  roles: string[];
  subItems?: SidebarSubItem[];
}

export interface SidebarSubItem {
  label: string;
  path: string;
  roles?: string[];
}

/**
 * Configuração centralizada do menu lateral (Sidebar)
 * Organizado por domínios institucionais com RBAC estrito
 * Configuração de sidebar
 * 
 * PRINCÍPIOS ABSOLUTOS:
 * - Sidebar é ESTRUTURAL (não é dashboard)
 * - Usuário só vê o que pode acessar
 * - Itens invisíveis ≠ itens desabilitados
 * - Acadêmico ≠ Financeiro ≠ RH ≠ Sistema
 * - Ícones institucionais neutros (Lucide Icons)
 * - Nenhum emoji ou ícone lúdico
 * - Mesma família de ícones em TODO o sistema
 */
export const sidebarConfig: SidebarSection[] = [
  // ==================== GERAL ====================
  {
    section: 'Geral',
    items: [
      {
        label: 'Dashboard',
        icon: LayoutDashboard,
        path: '/admin-dashboard',
        roles: ['SUPER_ADMIN', 'ADMIN', 'PROFESSOR', 'ALUNO', 'SECRETARIA', 'RESPONSAVEL', 'DIRECAO', 'COORDENADOR'],
      },
    ],
  },

  // ==================== ACADÊMICO ====================
  {
    section: 'Acadêmico',
    items: [
      {
        label: 'Cursos',
        icon: Library,
        path: '/admin-dashboard/gestao-academica?tab=cursos',
        roles: ['ADMIN'], // SUPER_ADMIN não gerencia cursos de instituições específicas
      },
      {
        label: 'Disciplinas',
        icon: NotebookText,
        path: '/admin-dashboard/gestao-academica?tab=disciplinas',
        roles: ['ADMIN'], // SUPER_ADMIN não gerencia disciplinas de instituições específicas
      },
      {
        label: 'Matriz Curricular',
        icon: Network,
        path: '/admin-dashboard/gestao-academica?tab=matriz-curricular',
        roles: ['ADMIN'], // SUPER_ADMIN não gerencia matriz curricular de instituições específicas
      },
      {
        label: 'Turmas',
        icon: UsersRound,
        path: '/admin-dashboard/gestao-academica?tab=turmas',
        roles: ['ADMIN', 'PROFESSOR', 'SECRETARIA'], // SUPER_ADMIN não gerencia turmas de instituições específicas
      },
      {
        label: 'Planos de Ensino',
        icon: BookMarked,
        path: '/admin-dashboard/plano-ensino',
        roles: ['ADMIN', 'PROFESSOR'],
      },
      {
        label: 'Avaliações',
        icon: ClipboardCheck,
        path: '/admin-dashboard/avaliacoes-notas',
        roles: ['ADMIN', 'PROFESSOR'],
      },
      {
        label: 'Biblioteca',
        icon: BookOpen,
        path: '/admin-dashboard/biblioteca',
        roles: ['ADMIN', 'SECRETARIA'], // SUPER_ADMIN não gerencia biblioteca de instituições específicas
      },
      {
        label: 'Videoaulas',
        icon: Video,
        path: '/video-aulas',
        roles: ['SUPER_ADMIN', 'ADMIN', 'PROFESSOR', 'SECRETARIA', 'DIRECAO', 'COORDENADOR'],
      },
      {
        label: 'Documentos Acadêmicos',
        icon: FileText,
        path: '/admin-dashboard/certificados',
        roles: ['ADMIN', 'SECRETARIA'], // SUPER_ADMIN não gerencia documentos de instituições específicas
      },
    ],
  },

  // ==================== ESTUDANTES ====================
  {
    section: 'Estudantes',
    items: [
      {
        label: 'Estudantes',
        icon: UserRound,
        path: '/admin-dashboard/gestao-alunos',
        roles: ['ADMIN', 'SECRETARIA', 'DIRECAO', 'COORDENADOR'], // SUPER_ADMIN não gerencia estudantes de instituições específicas
      },
      {
        label: 'Matrículas em Turmas',
        icon: ClipboardList,
        path: '/admin-dashboard/gestao-alunos?tab=matriculas-turmas',
        roles: ['ADMIN', 'SECRETARIA', 'DIRECAO', 'COORDENADOR'], // SUPER_ADMIN não gerencia matrículas de instituições específicas
      },
      {
        label: 'Histórico Acadêmico',
        icon: History,
        path: '/admin-dashboard/gestao-alunos?tab=historico',
        roles: ['ADMIN', 'ALUNO', 'SECRETARIA'], // SUPER_ADMIN não gerencia histórico de instituições específicas
      },
      {
        label: 'Boletins',
        icon: Award,
        path: '/admin-dashboard/certificados',
        roles: ['ADMIN', 'ALUNO', 'SECRETARIA'], // SUPER_ADMIN não gerencia boletins de instituições específicas
      },
    ],
  },

  // ==================== PROFESSORES ====================
  {
    section: 'Professores',
    items: [
      {
        label: 'Professores',
        icon: GraduationCap,
        path: '/admin-dashboard/gestao-professores',
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        label: 'Notas',
        icon: ClipboardList,
        path: '/admin-dashboard/avaliacoes-notas',
        roles: ['ADMIN', 'PROFESSOR'],
      },
      {
        label: 'Aulas',
        icon: Presentation,
        path: '/admin-dashboard/lancamento-aulas',
        roles: ['ADMIN', 'PROFESSOR'],
      },
      {
        label: 'Presenças',
        icon: UserCheck,
        path: '/admin-dashboard/presencas',
        roles: ['ADMIN', 'PROFESSOR'],
      },
      {
        label: 'Lançar Notas',
        icon: PenLine,
        path: '/admin-dashboard/avaliacoes-notas',
        roles: ['ADMIN', 'PROFESSOR'],
      },
    ],
  },

  // ==================== FINANCEIRO ====================
  {
    section: 'Financeiro',
    items: [
      {
        label: 'Mensalidades / Propinas',
        icon: Wallet,
        path: '/admin-dashboard/pagamentos',
        roles: ['ADMIN'], // SUPER_ADMIN não gerencia mensalidades de instituições específicas
      },
      {
        label: 'Faturas e Pagamentos',
        icon: Receipt,
        path: '/admin-dashboard/faturas-pagamentos',
        roles: ['ADMIN'], // SUPER_ADMIN não gerencia faturas de instituições específicas
      },
      {
        label: 'Bolsas e Descontos',
        icon: BadgePercent,
        path: '/admin-dashboard/bolsas',
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        label: 'Multas',
        icon: AlertCircle,
        path: '/admin-dashboard/configuracao-multas',
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        label: 'Fornecedores',
        icon: Building2,
        path: '/admin-dashboard/recursos-humanos?tab=fornecedores',
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        label: 'Contratos',
        icon: FileSignature,
        path: '/admin-dashboard/contratos',
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        label: 'Relatórios Financeiros',
        icon: BarChart3,
        path: '/admin-dashboard/gestao-financeira',
        roles: ['SUPER_ADMIN', 'ADMIN', 'SECRETARIA', 'FINANCEIRO'],
      },
      {
        label: 'Auditoria Financeira',
        icon: Shield,
        path: '/admin-dashboard/auditoria?tipo=financeiro',
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        label: 'Exportar SAFT',
        icon: FileDown,
        path: '/super-admin/exportar-saft',
        roles: ['SUPER_ADMIN'],
      },
    ],
  },

  // ==================== RECURSOS HUMANOS ====================
  {
    section: 'Recursos Humanos',
    items: [
      {
        label: 'Funcionários',
        icon: Users,
        path: '/admin-dashboard/recursos-humanos',
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        label: 'Professores',
        icon: GraduationCap,
        path: '/admin-dashboard/gestao-professores',
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        label: 'Cargos',
        icon: Briefcase,
        path: '/admin-dashboard/recursos-humanos?tab=cargos',
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        label: 'Departamentos',
        icon: Building2,
        path: '/admin-dashboard/recursos-humanos?tab=departamentos',
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        label: 'Permissões (RBAC)',
        icon: Shield,
        path: '/admin-dashboard/recursos-humanos?tab=permissoes',
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        label: 'Frequência',
        icon: Clock,
        path: '/admin-dashboard/ponto-relatorio',
        roles: ['SUPER_ADMIN', 'ADMIN', 'SECRETARIA', 'DIRECAO', 'COORDENADOR', 'RH'],
      },
      {
        label: 'Folha de Pagamento',
        icon: Banknote,
        path: '/admin-dashboard/folha-pagamento',
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        label: 'Biometria',
        icon: Fingerprint,
        path: '/admin-dashboard/biometria',
        roles: ['SUPER_ADMIN', 'ADMIN', 'SECRETARIA', 'DIRECAO', 'COORDENADOR', 'RH'],
      },
    ],
  },

  // ==================== ADMINISTRATIVO ====================
  {
    section: 'Administrativo',
    items: [
      {
        label: 'Instituição',
        icon: Building2,
        path: '/admin-dashboard/configuracoes-instituicao',
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        label: 'Ano Letivo',
        icon: Calendar,
        path: '/admin-dashboard/configuracao-ensino?tab=anos-letivos',
        roles: ['ADMIN'], // SUPER_ADMIN não gerencia ano letivo de instituições específicas
      },
      {
        label: 'Calendário Acadêmico',
        icon: CalendarDays,
        path: '/admin-dashboard/calendario',
        roles: ['ADMIN', 'SECRETARIA'], // SUPER_ADMIN não gerencia calendário de instituições específicas
      },
      {
        label: 'Calendário Acadêmico',
        icon: CalendarDays,
        path: '/admin-dashboard/calendario',
        roles: ['ADMIN', 'SECRETARIA'],
      },
      {
        label: 'Períodos de Lançamento',
        icon: CalendarRange,
        path: '/admin-dashboard/configuracao-ensino?tab=periodos-lancamento-notas',
        roles: ['ADMIN', 'SECRETARIA'],
      },
      {
        label: 'Encerramento de Ano Letivo',
        icon: FileText,
        path: '/admin-dashboard/configuracao-ensino?tab=encerramentos',
        roles: ['ADMIN'], // SUPER_ADMIN não gerencia encerramento de instituições específicas
      },
      {
        label: 'Reabertura Excepcional',
        icon: RefreshCw,
        path: '/admin-dashboard/configuracao-ensino?tab=reabertura-ano-letivo',
        roles: ['ADMIN'], // SUPER_ADMIN não gerencia reabertura de instituições específicas
      },
      {
        label: 'Eventos Governamentais',
        icon: Building2,
        path: '/admin-dashboard/eventos-governamentais',
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        label: 'Auditorias Administrativas',
        icon: Shield,
        path: '/admin-dashboard/auditoria',
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
    ],
  },

  // ==================== COMUNICAÇÃO ====================
  {
    section: 'Comunicação',
    items: [
      {
        label: 'Chat',
        icon: MessageCircle,
        path: '/chat',
        roles: ['SUPER_ADMIN', 'ADMIN', 'PROFESSOR', 'ALUNO', 'SECRETARIA', 'DIRECAO', 'COORDENADOR'],
      },
      {
        label: 'Comunicados',
        icon: Megaphone,
        path: '/admin-dashboard/comunicados',
        roles: ['SUPER_ADMIN', 'ADMIN', 'PROFESSOR', 'ALUNO', 'SECRETARIA', 'DIRECAO', 'COORDENADOR'],
      },
      {
        label: 'Emails Enviados',
        icon: Mail,
        path: '/admin-dashboard/emails',
        roles: ['SUPER_ADMIN', 'ADMIN', 'SECRETARIA'],
      },
      {
        label: 'Notificações',
        icon: Bell,
        path: '/admin-dashboard/notificacoes',
        roles: ['SUPER_ADMIN', 'ADMIN', 'PROFESSOR', 'ALUNO', 'SECRETARIA', 'DIRECAO', 'COORDENADOR'],
      },
    ],
  },

  // ==================== SISTEMA ====================
  {
    section: 'Sistema',
    items: [
      {
        label: 'Backups',
        icon: HardDrive,
        path: '/admin-dashboard/backup',
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        label: 'Restauração',
        icon: Database,
        path: '/admin-dashboard/backup',
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        label: 'Logs',
        icon: FileText,
        path: '/admin-dashboard/logs',
        roles: ['SUPER_ADMIN'],
      },
      {
        label: 'Auditoria Geral',
        icon: Activity,
        path: '/admin-dashboard/auditoria',
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        label: 'Painel de Segurança',
        icon: Shield,
        path: '/admin-dashboard/seguranca',
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        label: 'Analytics',
        icon: BarChart3,
        path: '/admin-dashboard/analytics',
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        label: 'Integrações',
        icon: Settings,
        path: '/admin-dashboard/integracoes',
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
      {
        label: 'Termos Legais e Aceite',
        icon: FileCheck,
        path: '/admin-dashboard/termos-legais',
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
    ],
  },

  // ==================== COMERCIAL ====================
  {
    section: 'Comercial',
    items: [
      {
        label: 'Plano da Instituição',
        icon: Package,
        path: '/admin-dashboard/minha-assinatura',
        roles: ['ADMIN'],
      },
      {
        label: 'Status da Licença',
        icon: ShieldCheck,
        path: '/admin-dashboard/minha-assinatura',
        roles: ['ADMIN'],
      },
    ],
  },
];

/**
 * Sidebar específico para SUPER_ADMIN
 * SUPER_ADMIN vê APENAS:
 * - Dashboard
 * - Instituições (gerenciar)
 * - Administradores (gerenciar)
 * - Planos (gerenciar)
 * NADA de itens operacionais de instituições
 */
function getSuperAdminSidebar(): SidebarSection[] {
  return [
    {
      section: 'Geral',
      items: [
        {
          label: 'Dashboard',
          icon: LayoutDashboard,
          path: '/super-admin',
          roles: ['SUPER_ADMIN'],
        },
      ],
    },
    {
      section: 'Gerenciamento',
      items: [
        {
          label: 'Instituições',
          icon: Building2,
          path: '/super-admin',
          roles: ['SUPER_ADMIN'],
        },
        {
          label: 'Administradores',
          icon: Users,
          path: '/super-admin',
          roles: ['SUPER_ADMIN'],
        },
        {
          label: 'Planos',
          icon: Package,
          path: '/super-admin',
          roles: ['SUPER_ADMIN'],
        },
      ],
    },
  ];
}

/**
 * Filtrar itens de menu baseado no role do usuário
 * RBAC estrito: usuário só vê o que pode acessar
 * SUPER_ADMIN tem sidebar específico e simplificado
 */
export function getSidebarItemsForRole(userRoles: string[]): SidebarSection[] {
  // SUPER_ADMIN tem sidebar específico e simplificado
  if (userRoles.includes('SUPER_ADMIN')) {
    return getSuperAdminSidebar();
  }

  // Outros roles usam sidebar padrão filtrado
  return sidebarConfig
    .map((section) => {
      const filteredItems = section.items.filter((item) => {
        // Verificar se algum role do usuário tem permissão
        return userRoles.some((role) => item.roles.includes(role));
      });

      // Retornar seção apenas se tiver itens visíveis
      if (filteredItems.length === 0) {
        return null;
      }

      return {
        ...section,
        items: filteredItems.map((item) => {
          // Filtrar subitens se existirem
          if (item.subItems) {
            const filteredSubItems = item.subItems.filter((subItem) => {
              if (subItem.roles) {
                return userRoles.some((role) => subItem.roles!.includes(role));
              }
              // Se subitem não tem roles específicos, herda do item pai
              return true;
            });

            return {
              ...item,
              subItems: filteredSubItems.length > 0 ? filteredSubItems : undefined,
            };
          }

          return item;
        }),
      };
    })
    .filter((section): section is SidebarSection => section !== null);
}
