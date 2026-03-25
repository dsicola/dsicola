import {
  LayoutDashboard,
  GraduationCap,
  Users,
  DollarSign,
  Briefcase,
  Building2,
  Home,
  Settings,
  ShoppingCart,
  Shield,
  MessageCircle,
  Share2,
  Globe2,
  Megaphone,
  Video,
  FileText,
  BarChart3,
  Wallet,
  History,
  Award,
  ClipboardList,
  ClipboardCheck,
  Calendar,
  BookOpen,
  HelpCircle,
  FileSpreadsheet,
  LucideIcon,
} from 'lucide-react';

/**
 * Configuração de Sidebar Profissional
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
  /** Chave i18n (ex: menu.dashboard). Se definida, o label exibido vem da tradução. */
  labelKey?: string;
  icon: LucideIcon;
  path: string;
  roles: string[];
  tipoInstituicao?: ('SUPERIOR' | 'SECUNDARIO')[]; // Opcional: se não especificado, aparece para ambos
  description?: string; // Tooltip/descrição do módulo
  /** Funcionalidade do plano necessária (ex: 'comunicados', 'alojamentos', 'analytics'). Se definida, o módulo só aparece se o plano incluir. */
  planFeature?: string;
  /** Se true, exige multiCampus no plano (e config ativa). Usado para Campus. */
  requiresMultiCampus?: boolean;
  /** Abre o path num novo separador (ex.: diretório público Comunidade). */
  openInNewTab?: boolean;
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
    labelKey: 'menu.dashboard',
    icon: LayoutDashboard,
    path: '/admin-dashboard', // Path padrão, será substituído dinamicamente
    roles: ['SUPER_ADMIN', 'ADMIN', 'PROFESSOR', 'ALUNO', 'SECRETARIA', 'RESPONSAVEL', 'DIRECAO', 'COORDENADOR', 'RH', 'FINANCEIRO', 'POS', 'AUDITOR'],
    description: 'Hub central com visão geral e acesso rápido',
  },

  // ==================== CENTRO DE AJUDA ====================
  {
    label: 'Centro de Ajuda',
    labelKey: 'menu.helpCenter',
    icon: HelpCircle,
    path: '/ajuda',
    roles: ['SUPER_ADMIN', 'ADMIN', 'SECRETARIA', 'FINANCEIRO', 'PROFESSOR', 'ALUNO', 'RESPONSAVEL', 'DIRECAO', 'COORDENADOR', 'RH', 'POS'],
    description: 'Perguntas frequentes e orientações',
  },

  // ==================== ACADÊMICA ====================
  {
    label: 'Acadêmica',
    labelKey: 'menu.academic',
    icon: GraduationCap,
    path: '/admin-dashboard/gestao-academica',
    roles: ['SUPER_ADMIN', 'ADMIN', 'PROFESSOR', 'SECRETARIA', 'DIRECAO', 'COORDENADOR'],
    description: 'Gestão acadêmica: cursos, disciplinas, turmas, planos de ensino',
  },

  // ==================== PROFESSORES ====================
  // Acesso direto pela sidebar (igual ao Dashboard)
  {
    label: 'Professores',
    labelKey: 'menu.teachers',
    icon: Users,
    path: '/admin-dashboard/gestao-professores',
    roles: ['SUPER_ADMIN', 'ADMIN', 'SECRETARIA', 'DIRECAO', 'COORDENADOR', 'RH'],
    description: 'Gestão de professores: cadastro, atribuição de disciplinas e turmas',
  },

  // ==================== FINANÇAS ====================
  // FINANCEIRO + POS: acesso ao departamento financeiro
  {
    label: 'Finanças',
    labelKey: 'menu.finances',
    icon: DollarSign,
    path: '/admin-dashboard/pagamentos',
    roles: ['SUPER_ADMIN', 'ADMIN', 'SECRETARIA', 'FINANCEIRO', 'POS'],
    description: 'Gestão financeira: pagamentos, bolsas, descontos, contratos',
  },

  // ==================== TAXAS E SERVIÇOS ====================
  {
    label: 'Taxas e Serviços',
    labelKey: 'menu.taxasServicos',
    icon: FileText,
    path: '/admin-dashboard/taxas-servicos',
    roles: ['SUPER_ADMIN', 'ADMIN', 'SECRETARIA', 'FINANCEIRO'],
    tipoInstituicao: ['SUPERIOR', 'SECUNDARIO'],
    description: 'Configurar valores cobráveis: taxa matrícula, mensalidade, bata, passe, emissão declaração e certificado',
  },

  // ==================== RELATÓRIOS FINANCEIROS ====================
  // Fluxo AGT: Pagar mensalidade, Estornar — Relatório Receitas, Mapa Atrasos
  {
    label: 'Relatórios Financeiros',
    labelKey: 'menu.financialReports',
    icon: BarChart3,
    path: '/admin-dashboard/gestao-financeira',
    roles: ['ADMIN', 'SECRETARIA', 'FINANCEIRO'],
    description: 'Pagar/estornar mensalidades, mapa de atrasos, PDFs — Fluxo AGT',
  },

  // ==================== DOCUMENTOS FISCAIS AGT ====================
  // Pró-forma, Guia de Remessa, Nota de Crédito, Fatura a partir de PF
  {
    label: 'Documentos Fiscais',
    labelKey: 'menu.documentosFiscais',
    icon: FileText,
    path: '/admin-dashboard/documentos-fiscais',
    roles: ['ADMIN', 'SECRETARIA', 'SUPER_ADMIN', 'FINANCEIRO'],
    description: 'Pró-forma, guia de remessa, nota de crédito, fatura — conformidade AGT',
  },

  // ==================== EXPORTAR SAFT ====================
  // Exportação fiscal SAFT-AO (conformidade Angola)
  {
    label: 'Exportar SAFT',
    labelKey: 'menu.exportSaft',
    icon: FileText,
    path: '/admin-dashboard/exportar-saft',
    roles: ['ADMIN', 'SUPER_ADMIN'],
    description: 'Exportar arquivo SAFT-AO para conformidade fiscal',
  },

  // ==================== CONTABILIDADE ====================
  // MVP: Plano de contas, lançamentos, balancete
  // Disponível para AMBOS os tipos: Ensino Superior e Ensino Secundário
  {
    label: 'Contabilidade',
    labelKey: 'menu.accounting',
    icon: BookOpen,
    path: '/admin-dashboard/contabilidade',
    roles: ['ADMIN', 'SUPER_ADMIN', 'FINANCEIRO'],
    tipoInstituicao: ['SUPERIOR', 'SECUNDARIO'],
    description: 'Plano de contas, lançamentos contábeis e balancete',
  },

  // ==================== AUDITORIA ====================
  // AUDITOR, DIRECAO, COORDENADOR: acesso direto (ADMIN tem via Sistema)
  {
    label: 'Auditoria',
    labelKey: 'menu.audit',
    icon: Shield,
    path: '/admin-dashboard/auditoria',
    roles: ['AUDITOR', 'DIRECAO', 'COORDENADOR'],
    description: 'Logs de auditoria e rastreabilidade de ações',
  },

  // ==================== RELATÓRIOS OFICIAIS ====================
  // Pauta, Boletim, Histórico - impressão window.print
  {
    label: 'Relatórios Oficiais',
    labelKey: 'menu.officialReports',
    icon: FileText,
    path: '/secretaria-dashboard/relatorios-oficiais',
    roles: ['ADMIN', 'SECRETARIA', 'DIRECAO', 'COORDENADOR'],
    description: 'Pauta, boletim, histórico escolar - impressão e exportação',
  },

  // ==================== PROFESSOR - AULAS E NOTAS ====================
  {
    label: 'Aulas e Presenças',
    labelKey: 'menu.classesAndAttendance',
    icon: ClipboardList,
    path: '/painel-professor/frequencia',
    roles: ['PROFESSOR'],
    description: 'Registrar aulas e marcar presenças',
  },
  {
    label: 'Notas (plano + turma)',
    labelKey: 'menu.launchGrades',
    icon: ClipboardCheck,
    path: '/painel-professor/notas',
    roles: ['PROFESSOR'],
    description: 'Turma e disciplina do seu plano; para criar avaliações use Avaliações e notas (disciplina)',
  },
  {
    label: 'Meus Horários',
    labelKey: 'menu.mySchedule',
    icon: Calendar,
    path: '/painel-professor/horarios',
    roles: ['PROFESSOR'],
    description: 'Visualizar e imprimir sua grade horária',
  },
  // ==================== RELATÓRIOS (PROFESSOR) ====================
  // Pauta, Lista de Alunos, Boletim, Frequência - impressão
  {
    label: 'Relatórios',
    labelKey: 'menu.reports',
    icon: FileText,
    path: '/painel-professor/relatorios',
    roles: ['PROFESSOR'],
    description: 'Pauta, lista de estudantes, boletim e mapa de presenças - impressão',
  },

  // ==================== ALUNO - IMPRESSÃO E DOCUMENTOS ====================
  {
    label: 'Meu Horário',
    labelKey: 'menu.myScheduleStudent',
    icon: Calendar,
    path: '/painel-aluno/horarios',
    roles: ['ALUNO'],
    description: 'Ver e imprimir horário da turma/classe em que está matriculado',
  },
  {
    label: 'Minhas Mensalidades',
    labelKey: 'menu.myTuition',
    icon: Wallet,
    path: '/painel-aluno/mensalidades',
    roles: ['ALUNO'],
    description: 'Extrato financeiro e recibos - imprimir',
  },
  {
    label: 'Boletim',
    labelKey: 'menu.myBulletin',
    icon: Award,
    path: '/painel-aluno/boletim',
    roles: ['ALUNO'],
    description: 'Boletim escolar - imprimir',
  },
  {
    label: 'Histórico Acadêmico',
    labelKey: 'menu.academicHistory',
    icon: History,
    path: '/painel-aluno/historico',
    roles: ['ALUNO'],
    description: 'Histórico escolar - imprimir',
  },

  // ==================== RECURSOS HUMANOS ====================
  // RH: acesso exclusivo ao departamento de RH
  {
    label: 'Recursos Humanos',
    labelKey: 'menu.hr',
    icon: Briefcase,
    path: '/admin-dashboard/recursos-humanos',
    roles: ['SUPER_ADMIN', 'ADMIN', 'SECRETARIA', 'DIRECAO', 'COORDENADOR', 'RH'],
    description: 'RH: funcionários, cargos, departamentos, frequência, folha de pagamento',
  },

  // ==================== ESTUDANTES E MATRÍCULAS ====================
  // Gestão de estudantes, matrículas, documentos (EmitirDocumentoTab: Ficha Cadastral, Declaração)
  {
    label: 'Estudantes e Matrículas',
    labelKey: 'menu.studentsAndEnrollments',
    icon: Building2,
    path: '/admin-dashboard/gestao-alunos',
    roles: ['SUPER_ADMIN', 'ADMIN', 'SECRETARIA', 'DIRECAO', 'COORDENADOR'],
    description: 'Gestão de estudantes, matrículas, documentos e comunicados',
  },
  {
    label: 'Importar estudantes (Excel)',
    icon: FileSpreadsheet,
    path: '/admin-dashboard/importar-estudantes',
    roles: ['ADMIN', 'SECRETARIA', 'DIRECAO', 'COORDENADOR'],
    description: 'Importação em massa (.xlsx), respeitando o tipo de instituição e o limite do plano',
  },

  // ==================== CHAT ====================
  {
    label: 'Chat',
    labelKey: 'menu.chat',
    icon: MessageCircle,
    path: '/chat',
    roles: ['SUPER_ADMIN', 'ADMIN', 'PROFESSOR', 'ALUNO', 'SECRETARIA', 'DIRECAO', 'COORDENADOR', 'RH', 'POS', 'FINANCEIRO'],
    description: 'Conversas por disciplina ou mensagens diretas',
  },
  {
    label: 'Comunidade',
    icon: Globe2,
    path: '/comunidade',
    roles: ['SUPER_ADMIN', 'COMERCIAL', 'ADMIN', 'PROFESSOR', 'ALUNO', 'SECRETARIA', 'DIRECAO', 'COORDENADOR', 'RH', 'POS', 'FINANCEIRO', 'RESPONSAVEL', 'AUDITOR'],
    description: 'Descoberta: lista de instituições e cursos. Totalmente público (nova janela).',
    openInNewTab: true,
  },
  {
    label: 'Social',
    icon: Share2,
    path: '/social',
    roles: ['SUPER_ADMIN', 'COMERCIAL', 'ADMIN', 'PROFESSOR', 'ALUNO', 'SECRETARIA', 'DIRECAO', 'COORDENADOR', 'RH', 'POS', 'FINANCEIRO', 'RESPONSAVEL', 'AUDITOR'],
    description:
      'Interação: posts, comentários e grupos. Abre em nova aba. Público na Comunidade ou privado só à instituição.',
    planFeature: 'comunidade',
    openInNewTab: true,
  },

  // ==================== COMUNICADOS / MURAL ====================
  {
    label: 'Comunicados',
    labelKey: 'menu.communications',
    icon: Megaphone,
    path: '/admin-dashboard/comunicados', // Será substituído dinamicamente por getComunicadosPathForRole
    roles: ['SUPER_ADMIN', 'ADMIN', 'PROFESSOR', 'ALUNO', 'SECRETARIA', 'DIRECAO', 'COORDENADOR', 'RH', 'POS', 'FINANCEIRO', 'RESPONSAVEL'],
    description: 'Mural de avisos e comunicados da instituição',
    planFeature: 'comunicados',
  },

  // ==================== ALOJAMENTOS / MORADIAS ====================
  {
    label: 'Alojamentos',
    labelKey: 'menu.accommodations',
    icon: Home,
    path: '/admin-dashboard/gestao-moradias',
    roles: ['ADMIN'],
    description: 'Gestão de quartos e alocações de estudantes',
    planFeature: 'alojamentos',
  },

  // ==================== VIDEOAULAS ====================
  {
    label: 'Videoaulas',
    labelKey: 'menu.videoLessons',
    icon: Video,
    path: '/video-aulas',
    roles: ['SUPER_ADMIN', 'ADMIN', 'PROFESSOR', 'SECRETARIA', 'DIRECAO', 'COORDENADOR', 'RH', 'POS', 'FINANCEIRO'],
    description: 'Videoaulas de treinamento para aprender a usar o sistema',
  },

  // ==================== SISTEMA ====================
  {
    label: 'Sistema',
    labelKey: 'menu.system',
    icon: Settings,
    path: '/admin-dashboard/configuracoes',
    roles: ['SUPER_ADMIN', 'ADMIN'],
    description: 'Configurações do sistema: backup, auditoria, configurações institucionais',
  },

  // ==================== COMERCIAL ====================
  // Minha Assinatura / Faturamento: disponível para AMBOS os tipos de instituição
  {
    label: 'Comercial',
    labelKey: 'menu.commercial',
    icon: ShoppingCart,
    path: '/admin-dashboard/minha-assinatura',
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCEIRO', 'POS'],
    tipoInstituicao: ['SUPERIOR', 'SECUNDARIO'],
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
    {
      label: 'Exportar SAFT',
      icon: FileText,
      path: '/super-admin/exportar-saft',
      roles: ['SUPER_ADMIN'],
      description: 'Exportar arquivo SAFT-AO para conformidade fiscal',
    },
    {
      label: 'Relatórios Financeiros',
      labelKey: 'menu.financialReports',
      icon: BarChart3,
      path: '/admin-dashboard/gestao-financeira',
      roles: ['SUPER_ADMIN'],
      description: 'Mensalidades, pagar, estornar, mapa de atrasos',
    },
    {
      label: 'Documentos Fiscais',
      labelKey: 'menu.documentosFiscais',
      icon: FileText,
      path: '/admin-dashboard/documentos-fiscais',
      roles: ['SUPER_ADMIN'],
      description: 'Pró-forma, guia de remessa, nota de crédito, fatura — conformidade AGT',
    },
    {
      label: 'Taxas e Serviços',
      labelKey: 'menu.taxasServicos',
      icon: FileText,
      path: '/admin-dashboard/taxas-servicos',
      roles: ['SUPER_ADMIN'],
      description: 'Configurar valores cobráveis: taxa matrícula, mensalidade, bata, passe, emissão declaração e certificado',
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
  if (userRoles.includes('RESPONSAVEL')) return '/painel-responsavel'; // ResponsavelDashboard com tab mensagens
  if (userRoles.includes('SECRETARIA') || userRoles.includes('DIRECAO') || userRoles.includes('COORDENADOR')) return '/secretaria-dashboard/comunicados';
  return '/admin-dashboard/comunicados';
}

/**
 * Obter path de Acadêmica baseado no role (PROFESSOR usa painel próprio)
 */
export function getAcademicaPathForRole(userRoles: string[]): string {
  if (userRoles.includes('PROFESSOR')) return '/painel-professor/turmas';
  return '/admin-dashboard/gestao-academica';
}

/**
 * Obter path do dashboard baseado no role
 * Ordem alinhada à prioridade do AuthContext (role menor = mais prioritário)
 * Usuário com múltiplos roles deve ir ao dashboard do role mais prioritário
 */
const DASHBOARD_PATHS: Array<{ roles: string[]; path: string }> = [
  { roles: ['SUPER_ADMIN'], path: '/super-admin' },
  { roles: ['COMERCIAL'], path: '/super-admin' },
  { roles: ['ADMIN', 'DIRECAO', 'COORDENADOR', 'AUDITOR'], path: '/admin-dashboard' },
  { roles: ['SECRETARIA'], path: '/secretaria-dashboard' },
  { roles: ['PROFESSOR'], path: '/painel-professor' },
  { roles: ['POS'], path: '/ponto-de-venda' },
  { roles: ['RESPONSAVEL'], path: '/painel-responsavel' },
  { roles: ['RH'], path: '/admin-dashboard/recursos-humanos' },
  { roles: ['FINANCEIRO'], path: '/admin-dashboard/pagamentos' },
  { roles: ['ALUNO'], path: '/painel-aluno' },
];

export function getDashboardPathForRole(userRoles: string[]): string {
  for (const { roles, path } of DASHBOARD_PATHS) {
    if (roles.some((r) => userRoles.includes(r))) return path;
  }
  return '/admin-dashboard';
}

