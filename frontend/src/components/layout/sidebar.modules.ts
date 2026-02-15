import {
  LayoutDashboard,
  GraduationCap,
  DollarSign,
  Briefcase,
  Building2,
  Settings,
  ShoppingCart,
  Shield,
  MessageCircle,
  Megaphone,
  Video,
  LucideIcon,
} from 'lucide-react';

/**
 * Configuração de Sidebar Profissional - Padrão SIGA/SIGAA
 * 
 * PRINCÍPIOS:
 * - Sidebar lista APENAS módulos de alto nível
 * - Dashboard continua como HUB central
 * - Navegação estrutural, não operacional
 * - Filtros por role e tipoInstituicao
 * - Ícones institucionais neutros (sem emojis)
 */

export interface SidebarModule {
  label: string;
  icon: LucideIcon;
  path: string;
  roles: string[];
  tipoInstituicao?: ('SUPERIOR' | 'SECUNDARIO')[]; // Opcional: se não especificado, aparece para ambos
  description?: string; // Tooltip/descrição do módulo
}

/**
 * Configuração de módulos de alto nível
 * Cada módulo representa uma área funcional do sistema
 */
export const sidebarModules: SidebarModule[] = [
  // ==================== DASHBOARD ====================
  // Nota: O path do dashboard será resolvido dinamicamente baseado no role
  // usando getDashboardPathForRole() no componente DynamicSidebar
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/admin-dashboard', // Path padrão, será substituído dinamicamente
    roles: ['SUPER_ADMIN', 'ADMIN', 'PROFESSOR', 'ALUNO', 'FUNCIONARIO', 'SECRETARIA', 'RESPONSAVEL', 'DIRECAO', 'COORDENADOR', 'RH', 'FINANCEIRO', 'POS'],
    description: 'Hub central com visão geral e acesso rápido',
  },

  // ==================== ACADÊMICA ====================
  {
    label: 'Acadêmica',
    icon: GraduationCap,
    path: '/admin-dashboard/gestao-academica',
    roles: ['SUPER_ADMIN', 'ADMIN', 'PROFESSOR', 'SECRETARIA', 'DIRECAO', 'COORDENADOR'],
    description: 'Gestão acadêmica: cursos, disciplinas, turmas, planos de ensino',
  },

  // ==================== FINANÇAS ====================
  // FINANCEIRO + POS: acesso ao departamento financeiro
  {
    label: 'Finanças',
    icon: DollarSign,
    path: '/admin-dashboard/pagamentos',
    roles: ['SUPER_ADMIN', 'ADMIN', 'SECRETARIA', 'FINANCEIRO', 'POS'],
    description: 'Gestão financeira: pagamentos, bolsas, descontos, contratos',
  },

  // ==================== RECURSOS HUMANOS ====================
  // RH: acesso exclusivo ao departamento de RH
  {
    label: 'Recursos Humanos',
    icon: Briefcase,
    path: '/admin-dashboard/recursos-humanos',
    roles: ['SUPER_ADMIN', 'ADMIN', 'FUNCIONARIO', 'RH'],
    description: 'RH: funcionários, cargos, departamentos, frequência, folha de pagamento',
  },

  // ==================== ADMINISTRATIVO ====================
  // SECRETARIA: departamento administrativo (estudantes, matrículas, documentos)
  {
    label: 'Administrativo',
    icon: Building2,
    path: '/admin-dashboard/gestao-alunos',
    roles: ['SUPER_ADMIN', 'ADMIN', 'SECRETARIA', 'FUNCIONARIO'],
    description: 'Gestão administrativa: estudantes, matrículas, documentos, comunicados',
  },

  // ==================== CHAT ====================
  {
    label: 'Chat',
    icon: MessageCircle,
    path: '/chat',
    roles: ['SUPER_ADMIN', 'ADMIN', 'PROFESSOR', 'ALUNO', 'SECRETARIA', 'FUNCIONARIO'],
    description: 'Conversas por disciplina ou mensagens diretas',
  },

  // ==================== COMUNICADOS / MURAL ====================
  {
    label: 'Comunicados',
    icon: Megaphone,
    path: '/admin-dashboard/comunicados', // Será substituído dinamicamente por getComunicadosPathForRole
    roles: ['SUPER_ADMIN', 'ADMIN', 'PROFESSOR', 'ALUNO', 'SECRETARIA', 'FUNCIONARIO'],
    description: 'Mural de avisos e comunicados da instituição',
  },

  // ==================== VIDEOAULAS ====================
  {
    label: 'Videoaulas',
    icon: Video,
    path: '/video-aulas',
    roles: ['SUPER_ADMIN', 'ADMIN', 'PROFESSOR', 'SECRETARIA', 'DIRECAO', 'COORDENADOR'],
    description: 'Videoaulas de treinamento para aprender a usar o sistema',
  },

  // ==================== SISTEMA ====================
  {
    label: 'Sistema',
    icon: Settings,
    path: '/admin-dashboard/configuracoes',
    roles: ['SUPER_ADMIN', 'ADMIN'],
    description: 'Configurações do sistema: backup, auditoria, configurações institucionais',
  },

  // ==================== COMERCIAL ====================
  {
    label: 'Comercial',
    icon: ShoppingCart,
    path: '/admin-dashboard/minha-assinatura',
    roles: ['SUPER_ADMIN', 'ADMIN'],
    description: 'Gestão comercial: assinaturas, planos, licenças',
  },
];

/**
 * Módulos específicos para SUPER_ADMIN
 * SUPER_ADMIN vê APENAS:
 * - Dashboard
 * - Instituições (gerenciar)
 * - Administradores (gerenciar)
 * - Planos (gerenciar)
 * NADA de itens operacionais de instituições
 */
function getSuperAdminModules(): SidebarModule[] {
  return [
    {
      label: 'Dashboard',
      icon: LayoutDashboard,
      path: '/super-admin?tab=instituicoes', // Default para instituições
      roles: ['SUPER_ADMIN'],
      description: 'Hub central com visão geral e acesso rápido',
    },
    {
      label: 'Instituições',
      icon: Building2,
      path: '/super-admin?tab=instituicoes',
      roles: ['SUPER_ADMIN'],
      description: 'Gerenciar instituições cadastradas na plataforma',
    },
    {
      label: 'Equipe Comercial',
      icon: Briefcase,
      path: '/super-admin?tab=equipe-comercial',
      roles: ['SUPER_ADMIN'],
      description: 'Gerenciar usuários com perfil Comercial',
    },
    {
      label: 'Super Admin',
      icon: Shield,
      path: '/super-admin?tab=usuarios', // Tab "usuarios" = Super Admins
      roles: ['SUPER_ADMIN'],
      description: 'Gerenciar Super Administradores da plataforma',
    },
    {
      label: 'Administradores de Instituições',
      icon: Briefcase,
      path: '/super-admin?tab=admins-instituicoes',
      roles: ['SUPER_ADMIN'],
      description: 'Gerenciar administradores de todas as instituições',
    },
    {
      label: 'Planos',
      icon: ShoppingCart,
      path: '/super-admin?tab=planos',
      roles: ['SUPER_ADMIN'],
      description: 'Gerenciar planos e assinaturas',
    },
    {
      label: 'Videoaulas',
      icon: Video,
      path: '/super-admin?tab=videoaulas',
      roles: ['SUPER_ADMIN'],
      description: 'Criar videoaulas tutoriais para admin e professores',
    },
  ];
}

/**
 * Filtrar módulos baseado em role e tipoInstituicao
 * RBAC estrito: usuário só vê módulos que pode acessar
 * SUPER_ADMIN tem módulos específicos e simplificados
 */
export function getSidebarModulesForRole(
  userRoles: string[],
  tipoAcademico: 'SUPERIOR' | 'SECUNDARIO' | null = null
): SidebarModule[] {
  // SUPER_ADMIN tem módulos específicos e simplificados
  if (userRoles.includes('SUPER_ADMIN')) {
    return getSuperAdminModules();
  }

  // Se não houver roles, retornar apenas Dashboard (acesso básico)
  if (!userRoles || userRoles.length === 0) {
    return sidebarModules.filter(module => module.label === 'Dashboard');
  }
  
  const filtered = sidebarModules.filter((module) => {
    // Verificar se algum role do usuário tem permissão
    const hasRoleAccess = userRoles.some((role) => module.roles.includes(role));
    
    if (!hasRoleAccess) {
      return false;
    }

    // Se módulo tem restrição de tipoInstituicao, verificar
    if (module.tipoInstituicao && tipoAcademico) {
      return module.tipoInstituicao.includes(tipoAcademico);
    }

    // Se módulo não tem restrição de tipoInstituicao, permitir
    return true;
  });
  
  // Garantir que Dashboard sempre apareça (fallback de segurança)
  const hasDashboard = filtered.some(m => m.label === 'Dashboard');
  if (!hasDashboard) {
    const dashboardModule = sidebarModules.find(m => m.label === 'Dashboard');
    if (dashboardModule) {
      filtered.unshift(dashboardModule);
    }
  }
  
  // Debug em desenvolvimento
  if (process.env.NODE_ENV === 'development' && filtered.length === 0 && userRoles.length > 0) {
    console.warn('[getSidebarModulesForRole] ⚠️ Nenhum módulo encontrado:', {
      userRoles,
      tipoAcademico,
      totalModules: sidebarModules.length,
      moduleRoles: sidebarModules.map(m => ({ label: m.label, roles: m.roles })),
    });
  }
  
  return filtered;
}

/**
 * Obter path de Comunicados baseado no role
 */
export function getComunicadosPathForRole(userRoles: string[]): string {
  if (userRoles.includes('PROFESSOR')) return '/painel-professor/comunicados';
  if (userRoles.includes('ALUNO')) return '/painel-aluno/comunicados';
  if (userRoles.includes('SECRETARIA') || userRoles.includes('FUNCIONARIO')) return '/secretaria-dashboard/comunicados';
  return '/admin-dashboard/comunicados';
}

/**
 * Obter path do dashboard baseado no role
 * Por departamento: RH → Recursos Humanos, FINANCEIRO/POS → Finanças, SECRETARIA → Administrativo
 */
export function getDashboardPathForRole(userRoles: string[]): string {
  if (userRoles.includes('SUPER_ADMIN')) {
    return '/super-admin';
  }
  if (userRoles.includes('PROFESSOR')) {
    return '/painel-professor';
  }
  if (userRoles.includes('ALUNO')) {
    return '/painel-aluno';
  }
  if (userRoles.includes('POS')) {
    return '/ponto-de-venda';
  }
  if (userRoles.includes('RH')) {
    return '/admin-dashboard/recursos-humanos';
  }
  if (userRoles.includes('FINANCEIRO')) {
    return '/admin-dashboard/pagamentos';
  }
  if (userRoles.includes('SECRETARIA') || userRoles.includes('FUNCIONARIO')) {
    return '/secretaria-dashboard';
  }
  if (userRoles.includes('RESPONSAVEL')) {
    return '/painel-responsavel';
  }
  return '/admin-dashboard';
}

