import React from 'react';
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  BookOpen,
  Calendar,
  FileText,
  CalendarCheck,
  DollarSign,
  UserCog,
  Building2,
  Database,
  Shield,
  Backup,
  BarChart3,
  Package,
  Mail,
  Megaphone,
  Bell,
  Award,
  ClipboardList,
  Clock,
  FolderOpen,
  CreditCard,
  Receipt,
  Wallet,
  KeyRound,
  Briefcase,
  UserCheck,
  Settings,
  FileCheck,
} from 'lucide-react';

export interface NavSubItem {
  label: string;
  href: string;
  roles?: string[]; // Roles permitidos para este item (opcional - se não especificado, herda do bloco pai)
}

export interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  subItems?: NavSubItem[];
  roles: string[]; // Roles que podem ver este bloco
  domain: 'ACADEMICO' | 'ESTUDANTES' | 'PROFESSORES' | 'FINANCEIRO' | 'RH' | 'COMUNICACAO' | 'SISTEMA' | 'DASHBOARD';
  separator?: boolean; // Adicionar separador visual antes deste bloco
}

/**
 * Configuração centralizada do menu lateral
 * Organizado por domínios institucionais com RBAC estrito
 * Configuração de menu
 * 
 * PRINCÍPIOS ABSOLUTOS:
 * - Sidebar é ESTRUTURAL (não é dashboard)
 * - Usuário só vê o que pode acessar
 * - Itens invisíveis ≠ itens desabilitados
 * - Acadêmico ≠ Financeiro ≠ RH ≠ Sistema
 * - Ano Letivo NÃO bloqueia menus
 * - Sidebar nunca depende de estado temporário
 */
export const MENU_CONFIG: NavItem[] = [
  // ==================== DASHBOARD ====================
  {
    label: 'Dashboard',
    href: '/admin-dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    roles: ['ADMIN', 'SUPER_ADMIN', 'PROFESSOR', 'ALUNO', 'SECRETARIA', 'DIRECAO', 'COORDENADOR', 'RESPONSAVEL'],
    domain: 'DASHBOARD',
  },

  // ==================== 📘 ACADÊMICO ====================
  {
    label: '📘 Acadêmico',
    href: '/admin-dashboard/gestao-academica',
    icon: <GraduationCap className="h-5 w-5" />,
    roles: ['ADMIN', 'SUPER_ADMIN', 'SECRETARIA'],
    domain: 'ACADEMICO',
    separator: true,
    subItems: [
      { label: 'Gestão Acadêmica', href: '/admin-dashboard/gestao-academica' },
      { label: 'Cursos', href: '/admin-dashboard/gestao-academica?tab=cursos' },
      { label: 'Disciplinas', href: '/admin-dashboard/gestao-academica?tab=disciplinas' },
      { label: 'Turmas', href: '/admin-dashboard/gestao-academica?tab=turmas' },
      { label: 'Avaliações', href: '/admin-dashboard/avaliacoes-notas', roles: ['ADMIN'] }, // SUPER_ADMIN não vê operacional
      { label: 'Calendário Acadêmico', href: '/admin-dashboard/calendario' },
      { label: 'Documentos Acadêmicos', href: '/admin-dashboard/certificados' },
    ],
  },

  // ==================== 👨‍🎓 ESTUDANTES ====================
  {
    label: '👨‍🎓 Estudantes',
    href: '/admin-dashboard/gestao-alunos',
    icon: <Users className="h-5 w-5" />,
    roles: ['ADMIN', 'SUPER_ADMIN', 'SECRETARIA', 'DIRECAO', 'COORDENADOR'],
    domain: 'ESTUDANTES',
    subItems: [
      { label: 'Estudantes', href: '/admin-dashboard/gestao-alunos' },
      { label: 'Matrículas', href: '/admin-dashboard/gestao-alunos?tab=matriculas' },
      { label: 'Histórico Acadêmico', href: '/admin-dashboard/gestao-alunos?tab=historico' },
      { label: 'Boletins', href: '/admin-dashboard/certificados' },
      { label: 'Documentos Estudantis', href: '/admin-dashboard/documentos-alunos' },
    ],
  },

  // ==================== 👩‍🏫 PROFESSORES ====================
  {
    label: '👩‍🏫 Professores',
    href: '/admin-dashboard/gestao-professores',
    icon: <UserCog className="h-5 w-5" />,
    roles: ['ADMIN', 'SUPER_ADMIN', 'PROFESSOR'],
    domain: 'PROFESSORES',
    subItems: [
      { label: 'Professores', href: '/admin-dashboard/gestao-professores', roles: ['ADMIN', 'SUPER_ADMIN'] }, // PROFESSOR não vê lista
      { label: 'Planos de Ensino', href: '/admin-dashboard/plano-ensino' },
      { label: 'Aulas', href: '/admin-dashboard/lancamento-aulas', roles: ['ADMIN', 'PROFESSOR'] }, // SUPER_ADMIN não vê operacional
      { label: 'Presenças', href: '/admin-dashboard/presencas', roles: ['ADMIN', 'PROFESSOR'] }, // SUPER_ADMIN não vê operacional
      { label: 'Lançamento de Notas', href: '/admin-dashboard/avaliacoes-notas', roles: ['ADMIN', 'PROFESSOR'] }, // SUPER_ADMIN não vê operacional
    ],
  },

  // ==================== 💰 FINANCEIRO ====================
  {
    label: '💰 Financeiro',
    href: '/admin-dashboard/pagamentos',
    icon: <DollarSign className="h-5 w-5" />,
    roles: ['ADMIN', 'SUPER_ADMIN'],
    domain: 'FINANCEIRO',
    separator: true,
    subItems: [
      { label: 'Pagamentos', href: '/admin-dashboard/pagamentos' },
      { label: 'Bolsas e Descontos', href: '/admin-dashboard/bolsas' },
      { label: 'Multas', href: '/admin-dashboard/configuracao-multas' },
      { label: 'Contratos Financeiros', href: '/admin-dashboard/contratos' },
      { label: 'Exportar SAFT', href: '/super-admin/exportar-saft', roles: ['SUPER_ADMIN'] },
    ],
  },

  // ==================== 👥 RECURSOS HUMANOS ====================
  {
    label: '👥 Recursos Humanos',
    href: '/admin-dashboard/recursos-humanos',
    icon: <Briefcase className="h-5 w-5" />,
    roles: ['ADMIN', 'SUPER_ADMIN', 'SECRETARIA', 'DIRECAO', 'COORDENADOR', 'RH'],
    domain: 'RH',
    subItems: [
      { label: 'Funcionários', href: '/admin-dashboard/recursos-humanos', roles: ['ADMIN', 'SUPER_ADMIN'] },
      { label: 'Cargos', href: '/admin-dashboard/recursos-humanos?tab=cargos', roles: ['ADMIN', 'SUPER_ADMIN'] },
      { label: 'Departamentos', href: '/admin-dashboard/recursos-humanos?tab=departamentos', roles: ['ADMIN', 'SUPER_ADMIN'] },
      { label: 'Frequência', href: '/admin-dashboard/ponto-relatorio' },
      { label: 'Folha de Pagamento', href: '/admin-dashboard/folha-pagamento', roles: ['ADMIN', 'SUPER_ADMIN'] },
      { label: 'Biometria', href: '/admin-dashboard/biometria' },
    ],
  },

  // ==================== 📂 COMUNICAÇÃO ====================
  {
    label: '📂 Comunicação',
    href: '/admin-dashboard/comunicados',
    icon: <Megaphone className="h-5 w-5" />,
    roles: ['ADMIN', 'SUPER_ADMIN', 'PROFESSOR', 'ALUNO', 'SECRETARIA', 'DIRECAO', 'COORDENADOR'],
    domain: 'COMUNICACAO',
    separator: true,
    subItems: [
      { label: 'Comunicados', href: '/admin-dashboard/comunicados' },
      { label: 'Emails Enviados', href: '/admin-dashboard/emails', roles: ['ADMIN', 'SUPER_ADMIN', 'SECRETARIA'] },
      { label: 'Notificações', href: '/admin-dashboard/notificacoes' },
    ],
  },

  // ==================== 📊 SISTEMA ====================
  {
    label: '📊 Sistema',
    href: '/admin-dashboard/backup',
    icon: <Database className="h-5 w-5" />,
    roles: ['ADMIN', 'SUPER_ADMIN'],
    domain: 'SISTEMA',
    subItems: [
      { label: 'Auditoria / Histórico', href: '/admin-dashboard/auditoria' },
      { label: 'Logs de Auditoria', href: '/admin-dashboard/logs' },
      { label: 'Analytics', href: '/admin-dashboard/analytics' },
      { label: 'Backup / Restauração', href: '/admin-dashboard/backup' },
      { label: 'Configurações', href: '/admin-dashboard/configuracoes-instituicao' },
      { label: 'Minha Assinatura', href: '/admin-dashboard/minha-assinatura' },
    ],
  },
];

/**
 * Função para gerar menu SUPER_ADMIN dinamicamente
 * SUPER_ADMIN vê todos os blocos estruturais, mas NÃO vê menus pedagógicos operacionais
 * (Notas, Presenças, Aulas diretas, Avaliações operacionais)
 */
function getSuperAdminMenu(): NavItem[] {
  return [
    {
      label: 'Dashboard',
      href: '/super-admin',
      icon: <LayoutDashboard className="h-5 w-5" />,
      roles: ['SUPER_ADMIN'],
      domain: 'DASHBOARD',
    },
    // SUPER_ADMIN vê todos os blocos estruturais, mas filtra subitens pedagógicos operacionais
    ...MENU_CONFIG.map(item => {
      // Criar cópia profunda do item para não modificar o original
      const itemCopy: NavItem = { 
        ...item,
        subItems: item.subItems ? [...item.subItems] : undefined
      };
      
      // Se for bloco de Professores, remover subitens operacionais
      if (item.domain === 'PROFESSORES' && itemCopy.subItems) {
        itemCopy.subItems = itemCopy.subItems.filter(subItem => 
          subItem.label === 'Professores' || subItem.label === 'Planos de Ensino'
        );
      }
      
      // Se for bloco Acadêmico, remover subitens operacionais (Avaliações operacionais)
      if (item.domain === 'ACADEMICO' && itemCopy.subItems) {
        itemCopy.subItems = itemCopy.subItems.filter(subItem => {
          // SUPER_ADMIN não vê "Avaliações" (é operacional)
          if (subItem.label === 'Avaliações') {
            return false;
          }
          return true;
        });
      }
      
      return itemCopy;
    }),
  ];
}

/**
 * Menu específico para PROFESSOR
 * PROFESSOR vê APENAS:
 * - Professores (somente seus dados)
 * - Planos de Ensino
 * - Aulas
 * - Presenças
 * - Lançamento de Notas
 * - Comunicados
 */
export const PROFESSOR_MENU: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/painel-professor',
    icon: <LayoutDashboard className="h-5 w-5" />,
    roles: ['PROFESSOR'],
    domain: 'DASHBOARD',
  },
  {
    label: '👩‍🏫 Professores',
    href: '/painel-professor/turmas',
    icon: <UserCog className="h-5 w-5" />,
    roles: ['PROFESSOR'],
    domain: 'PROFESSORES',
    separator: true,
    subItems: [
      { label: 'Minhas Turmas', href: '/painel-professor/turmas' },
      { label: 'Planos de Ensino', href: '/painel-professor/plano-ensino' },
      { label: 'Aulas e Presenças', href: '/painel-professor/frequencia' },
      { label: 'Lançamento de Notas', href: '/painel-professor/notas' },
      { label: 'Relatórios', href: '/painel-professor/relatorios' },
    ],
  },
  {
    label: '📂 Comunicação',
    href: '/painel-professor/comunicados',
    icon: <Megaphone className="h-5 w-5" />,
    roles: ['PROFESSOR'],
    domain: 'COMUNICACAO',
    subItems: [
      { label: 'Comunicados', href: '/painel-professor/comunicados' },
    ],
  },
];

/**
 * Menu específico para ALUNO
 * ALUNO vê APENAS:
 * - Boletins
 * - Histórico Acadêmico
 * - Presenças
 * - Comunicados
 * - Documentos Estudantis
 */
export const ALUNO_MENU: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/painel-aluno',
    icon: <LayoutDashboard className="h-5 w-5" />,
    roles: ['ALUNO'],
    domain: 'DASHBOARD',
  },
  {
    label: 'Boletins',
    href: '/painel-aluno/boletim',
    icon: <FileText className="h-5 w-5" />,
    roles: ['ALUNO'],
    domain: 'ESTUDANTES',
    separator: true,
  },
  {
    label: 'Histórico Acadêmico',
    href: '/painel-aluno/historico',
    icon: <FileCheck className="h-5 w-5" />,
    roles: ['ALUNO'],
    domain: 'ESTUDANTES',
  },
  {
    label: 'Presenças',
    href: '/painel-aluno/presencas',
    icon: <CalendarCheck className="h-5 w-5" />,
    roles: ['ALUNO'],
    domain: 'ESTUDANTES',
  },
  {
    label: 'Comunicados',
    href: '/painel-aluno/comunicados',
    icon: <Megaphone className="h-5 w-5" />,
    roles: ['ALUNO'],
    domain: 'COMUNICACAO',
  },
  {
    label: 'Documentos Estudantis',
    href: '/painel-aluno/documentos',
    icon: <FolderOpen className="h-5 w-5" />,
    roles: ['ALUNO'],
    domain: 'ESTUDANTES',
  },
];

/**
 * Menu específico para SECRETARIA
 * SECRETARIA vê:
 * - Estudantes
 * - Matrículas
 * - Turmas
 * - Documentos
 * - Comunicados
 * NÃO vê:
 * - Notas
 * - Aulas
 * - Financeiro sensível
 * - Sistema crítico
 */
export const SECRETARIA_MENU: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/secretaria-dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    roles: ['SECRETARIA'],
    domain: 'DASHBOARD',
  },
  {
    label: '👨‍🎓 Estudantes',
    href: '/secretaria-dashboard/alunos',
    icon: <Users className="h-5 w-5" />,
    roles: ['SECRETARIA'],
    domain: 'ESTUDANTES',
    separator: true,
    subItems: [
      { label: 'Estudantes', href: '/secretaria-dashboard/alunos' },
      { label: 'Matrículas', href: '/secretaria-dashboard/matriculas' },
      { label: 'Documentos Estudantis', href: '/secretaria-dashboard/documentos-alunos' },
    ],
  },
  {
    label: '📘 Acadêmico',
    href: '/admin-dashboard/gestao-academica',
    icon: <GraduationCap className="h-5 w-5" />,
    roles: ['SECRETARIA'],
    domain: 'ACADEMICO',
    subItems: [
      { label: 'Turmas', href: '/admin-dashboard/gestao-academica?tab=turmas' },
      { label: 'Documentos Acadêmicos', href: '/secretaria-dashboard/documentos' },
      { label: 'Relatórios Oficiais', href: '/secretaria-dashboard/relatorios-oficiais' },
      { label: 'Calendário Acadêmico', href: '/admin-dashboard/calendario' },
    ],
  },
  {
    label: '💰 Finanças',
    href: '/admin-dashboard/pagamentos',
    icon: <DollarSign className="h-5 w-5" />,
    roles: ['SECRETARIA'],
    domain: 'FINANCEIRO',
    subItems: [
      { label: 'Pagamentos', href: '/admin-dashboard/pagamentos' },
      { label: 'Bolsas e Descontos', href: '/secretaria-dashboard/bolsas' },
    ],
  },
  {
    label: '📋 Administrativo',
    href: '/admin-dashboard/recursos-humanos',
    icon: <Briefcase className="h-5 w-5" />,
    roles: ['SECRETARIA'],
    domain: 'RH',
    subItems: [
      { label: 'Recursos Humanos', href: '/admin-dashboard/recursos-humanos' },
      { label: 'Configuração Multas', href: '/admin-dashboard/configuracao-multas' },
    ],
  },
  {
    label: '📂 Comunicação',
    href: '/secretaria-dashboard/comunicados',
    icon: <Megaphone className="h-5 w-5" />,
    roles: ['SECRETARIA'],
    domain: 'COMUNICACAO',
    subItems: [
      { label: 'Comunicados', href: '/secretaria-dashboard/comunicados' },
      { label: 'Emails Enviados', href: '/secretaria-dashboard/emails' },
    ],
  },
];

/**
 * Menu específico para RESPONSAVEL
 */
export const RESPONSAVEL_MENU: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/painel-responsavel',
    icon: <LayoutDashboard className="h-5 w-5" />,
    roles: ['RESPONSAVEL'],
    domain: 'DASHBOARD',
  },
  {
    label: 'Meus Educandos',
    href: '/painel-responsavel/educandos',
    icon: <Users className="h-5 w-5" />,
    roles: ['RESPONSAVEL'],
    domain: 'ESTUDANTES',
    separator: true,
  },
  {
    label: 'Notas',
    href: '/painel-responsavel/notas',
    icon: <FileText className="h-5 w-5" />,
    roles: ['RESPONSAVEL'],
    domain: 'ESTUDANTES',
  },
  {
    label: 'Frequência',
    href: '/painel-responsavel/frequencia',
    icon: <CalendarCheck className="h-5 w-5" />,
    roles: ['RESPONSAVEL'],
    domain: 'ESTUDANTES',
  },
  {
    label: 'Mensagens',
    href: '/painel-responsavel/mensagens',
    icon: <Mail className="h-5 w-5" />,
    roles: ['RESPONSAVEL'],
    domain: 'COMUNICACAO',
  },
];

/**
 * Menu específico para POS (Ponto de Venda)
 */
export const POS_MENU: NavItem[] = [
  {
    label: '💳 Ponto de Venda',
    href: '/ponto-de-venda',
    icon: <DollarSign className="h-5 w-5" />,
    roles: ['POS'],
    domain: 'FINANCEIRO',
  },
];

/**
 * Filtrar itens de menu baseado no role do usuário
 * RBAC estrito: usuário só vê o que pode acessar
 * 
 * REGRAS:
 * - SUPER_ADMIN: vê todos os blocos estruturais, mas NÃO vê menus pedagógicos operacionais
 * - ADMIN: vê todos os blocos exceto visão global (backups globais, logs globais)
 * - PROFESSOR: vê apenas seus dados (turmas, planos, aulas, presenças, notas)
 * - ALUNO: vê apenas seus dados (boletins, histórico, presenças, documentos)
 * - SECRETARIA: vê estudantes, matrículas, turmas, documentos, comunicados
 */
export function getMenuItemsForRole(
  userRoles: string[],
  tipoAcademico: 'SECUNDARIO' | 'SUPERIOR' | null = null
): NavItem[] {
  // Determinar role principal (prioridade: SUPER_ADMIN > ADMIN > outros)
  const primaryRole = userRoles.includes('SUPER_ADMIN') 
    ? 'SUPER_ADMIN'
    : userRoles.includes('ADMIN')
    ? 'ADMIN'
    : userRoles.includes('PROFESSOR')
    ? 'PROFESSOR'
    : userRoles.includes('ALUNO')
    ? 'ALUNO'
    : userRoles.includes('SECRETARIA')
    ? 'SECRETARIA'
    : userRoles.includes('DIRECAO')
    ? 'DIRECAO'
    : userRoles.includes('COORDENADOR')
    ? 'COORDENADOR'
    : userRoles.includes('AUDITOR')
    ? 'AUDITOR'
    : userRoles.includes('RESPONSAVEL')
    ? 'RESPONSAVEL'
    : userRoles.includes('POS')
    ? 'POS'
    : null;

  // Retornar menu específico por role
  switch (primaryRole) {
    case 'SUPER_ADMIN':
      return getSuperAdminMenu().map(item => {
        // Criar cópia profunda para não modificar o original
        const itemCopy = { ...item };
        if (itemCopy.subItems) {
          itemCopy.subItems = itemCopy.subItems.filter(subItem => {
            // Filtrar subitens por role específico
            if (subItem.roles && !subItem.roles.includes('SUPER_ADMIN')) {
              return false;
            }
            return true;
          });
        }
        return itemCopy;
      });

    case 'ADMIN':
      return MENU_CONFIG.filter(item => {
        // Verificar se role tem acesso ao bloco
        if (!item.roles.includes('ADMIN')) {
          return false;
        }
        
        // Criar cópia do item para não modificar o original
        const itemCopy = { ...item };
        
        // Filtrar subitens por role e tipo acadêmico
        if (itemCopy.subItems) {
          itemCopy.subItems = itemCopy.subItems.filter(subItem => {
            // Verificar se subitem tem restrição de role
            if (subItem.roles && !subItem.roles.includes('ADMIN')) {
              return false;
            }
            // Filtrar Classes apenas para Secundário (se existir no subitem)
            if (subItem.label === 'Classes (Anos)' && tipoAcademico !== 'SECUNDARIO') {
              return false;
            }
            return true;
          });
        }
        
        // Retornar cópia modificada
        return itemCopy;
      }).map(item => {
        // Garantir que estamos retornando a cópia modificada
        const itemCopy = { ...item };
        if (itemCopy.subItems) {
          itemCopy.subItems = [...itemCopy.subItems];
        }
        return itemCopy;
      });

    case 'PROFESSOR':
      return PROFESSOR_MENU;

    case 'ALUNO':
      return ALUNO_MENU;

    case 'SECRETARIA':
      return SECRETARIA_MENU.map(item => {
        // Criar cópia profunda para não modificar o original
        const itemCopy = { ...item };
        if (itemCopy.subItems) {
          itemCopy.subItems = itemCopy.subItems.filter(subItem => 
            !subItem.roles || subItem.roles.includes(primaryRole)
          );
        }
        return itemCopy;
      });

    case 'RESPONSAVEL':
      return RESPONSAVEL_MENU;

    case 'POS':
      return POS_MENU;

    case 'DIRECAO':
    case 'COORDENADOR':
      return MENU_CONFIG.filter(item => item.roles.some(r => ['ADMIN', 'DIRECAO', 'COORDENADOR'].includes(r))).map(item => ({
        ...item,
        subItems: item.subItems ? item.subItems.filter(s => !s.roles || s.roles.some(r => ['ADMIN', 'DIRECAO', 'COORDENADOR'].includes(r))) : undefined,
      }));

    case 'AUDITOR':
      return [{ label: 'Auditoria', href: '/admin-dashboard/auditoria', icon: <Shield className="h-5 w-5" />, roles: ['AUDITOR'], domain: 'SISTEMA' }];

    default:
      return [];
  }
}
