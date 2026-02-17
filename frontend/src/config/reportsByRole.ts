/**
 * Mapeamento de Relatórios por Perfil Institucional
 * Padrão SIGA / SIGAA / SIGAE
 * 
 * REGRA-MÃE:
 * - Dashboard = O QUE EU ACOMPANHO
 * - Relatórios = O QUE EU FORMALIZO / IMPRIMO
 * 
 * Se algo aparece no Dashboard,
 * DEVE existir relatório correspondente (se aplicável).
 * Se um relatório existe,
 * DEVE ser acessível a partir de um contexto do Dashboard.
 */

import { FileText, ClipboardList, Award, GraduationCap, DollarSign, Users, Building2, Shield, Calendar } from 'lucide-react';
import type { UserRole } from '@/types/auth';
export type { UserRole };

export type ReportDomain = 'ACADEMICO' | 'FINANCEIRO' | 'RH' | 'ADMINISTRATIVO' | 'SISTEMA';

export interface ReportConfig {
  id: string;
  label: string;
  description: string;
  domain: ReportDomain;
  icon: typeof FileText;
  roles: UserRole[];
  endpoint: string;
  requiresAnoLetivo?: boolean;
  requiresTurma?: boolean;
  requiresAluno?: boolean;
  requiresDisciplina?: boolean;
  dashboardOrigin?: {
    path: string;
    card?: string;
    action?: string;
  };
  tipoInstituicao?: 'ENSINO_SUPERIOR' | 'ENSINO_SECUNDARIO' | 'AMBOS';
}

/**
 * Configuração completa de relatórios por perfil
 */
export const REPORTS_BY_ROLE: Record<UserRole, ReportConfig[]> = {
  /**
   * SUPER_ADMIN
   * - Visão global por instituição
   * - Indicadores macro
   * - Auditorias
   * - Backups
   * - Licenças
   */
  SUPER_ADMIN: [
    {
      id: 'AUDITORIA_GERAL',
      label: 'Auditoria Geral',
      description: 'Logs de auditoria de todas as instituições',
      domain: 'SISTEMA',
      icon: Shield,
      roles: ['SUPER_ADMIN'],
      endpoint: '/admin/backups/audit/export',
      dashboardOrigin: {
        path: '/super-admin',
        card: 'Auditorias',
        action: 'Exportar Relatório de Auditoria',
      },
    },
    {
      id: 'LOGS_ACESSO',
      label: 'Logs de Acesso',
      description: 'Registros de acesso ao sistema por instituição',
      domain: 'SISTEMA',
      icon: FileText,
      roles: ['SUPER_ADMIN'],
      endpoint: '/admin/logs',
      dashboardOrigin: {
        path: '/super-admin',
        card: 'Sistema',
        action: 'Ver Logs de Acesso',
      },
    },
    {
      id: 'BACKUPS_RESTAURACOES',
      label: 'Backups e Restaurações',
      description: 'Histórico de backups e restaurações por instituição',
      domain: 'SISTEMA',
      icon: FileText,
      roles: ['SUPER_ADMIN'],
      endpoint: '/admin/backups',
      dashboardOrigin: {
        path: '/super-admin',
        card: 'Backups',
        action: 'Ver Histórico',
      },
    },
    {
      id: 'ESTATISTICAS_INSTITUICOES',
      label: 'Estatísticas por Instituição',
      description: 'Indicadores consolidados por instituição',
      domain: 'SISTEMA',
      icon: Building2,
      roles: ['SUPER_ADMIN'],
      endpoint: '/admin/estatisticas',
      dashboardOrigin: {
        path: '/super-admin',
        card: 'Indicadores',
        action: 'Ver Estatísticas',
      },
    },
  ],

  /**
   * ADMIN (INSTITUIÇÃO)
   * - Indicadores acadêmicos
   * - Indicadores financeiros
   * - RH
   * - Situação do Ano Letivo
   */
  ADMIN: [
    // Relatórios Acadêmicos
    {
      id: 'PAUTA_FINAL',
      label: 'Pauta Final',
      description: 'Pauta oficial com notas finais por turma e disciplina',
      domain: 'ACADEMICO',
      icon: ClipboardList,
      roles: ['ADMIN', 'SECRETARIA'],
      endpoint: '/relatorios/pauta-final',
      requiresAnoLetivo: true,
      requiresTurma: true,
      requiresDisciplina: true,
      dashboardOrigin: {
        path: '/admin-dashboard',
        card: 'Acadêmico',
        action: 'Gerar Pauta Final',
      },
      tipoInstituicao: 'AMBOS',
    },
    {
      id: 'PLANO_ENSINO_OFICIAL',
      label: 'Plano de Ensino Oficial',
      description: 'Plano de ensino aprovado com conteúdo, carga horária e assinaturas',
      domain: 'ACADEMICO',
      icon: FileText,
      roles: ['ADMIN', 'PROFESSOR', 'SECRETARIA'],
      endpoint: '/relatorios/gerar',
      requiresAnoLetivo: true,
      requiresDisciplina: true,
      dashboardOrigin: {
        path: '/admin-dashboard',
        card: 'Acadêmico',
        action: 'Gerar Plano de Ensino',
      },
      tipoInstituicao: 'AMBOS',
    },
    {
      id: 'MAPA_AULAS_MINISTRADAS',
      label: 'Mapa de Aulas Ministradas',
      description: 'Aulas planejadas vs ministradas com percentual de cumprimento',
      domain: 'ACADEMICO',
      icon: Calendar,
      roles: ['ADMIN', 'PROFESSOR', 'SECRETARIA'],
      endpoint: '/relatorios/gerar',
      requiresAnoLetivo: true,
      requiresTurma: true,
      dashboardOrigin: {
        path: '/admin-dashboard',
        card: 'Acadêmico',
        action: 'Gerar Mapa de Aulas',
      },
      tipoInstituicao: 'AMBOS',
    },
    {
      id: 'MAPA_PRESENCAS',
      label: 'Mapa de Presenças',
      description: 'Frequência por aluno com percentual final e situação',
      domain: 'ACADEMICO',
      icon: Users,
      roles: ['ADMIN', 'PROFESSOR', 'SECRETARIA'],
      endpoint: '/relatorios/gerar',
      requiresAnoLetivo: true,
      requiresTurma: true,
      dashboardOrigin: {
        path: '/admin-dashboard',
        card: 'Acadêmico',
        action: 'Gerar Mapa de Presenças',
      },
      tipoInstituicao: 'AMBOS',
    },
    {
      id: 'ATA_AVALIACOES',
      label: 'Ata de Avaliações',
      description: 'Avaliações e notas por trimestre encerrado',
      domain: 'ACADEMICO',
      icon: FileText,
      roles: ['ADMIN', 'PROFESSOR', 'SECRETARIA'],
      endpoint: '/relatorios/gerar',
      requiresAnoLetivo: true,
      requiresTurma: true,
      requiresDisciplina: true,
      dashboardOrigin: {
        path: '/admin-dashboard',
        card: 'Acadêmico',
        action: 'Gerar Ata de Avaliações',
      },
      tipoInstituicao: 'AMBOS',
    },
    {
      id: 'BOLETIM_ALUNO',
      label: 'Boletim do Aluno',
      description: 'Notas finais, frequência e situação acadêmica',
      domain: 'ACADEMICO',
      icon: FileText,
      roles: ['ADMIN', 'PROFESSOR', 'SECRETARIA', 'ALUNO'],
      endpoint: '/relatorios/boletim',
      requiresAnoLetivo: true,
      requiresAluno: true,
      dashboardOrigin: {
        path: '/admin-dashboard',
        card: 'Acadêmico',
        action: 'Gerar Boletim',
      },
      tipoInstituicao: 'AMBOS',
    },
    {
      id: 'HISTORICO_ESCOLAR',
      label: 'Histórico Escolar',
      description: 'Histórico acadêmico completo do aluno',
      domain: 'ACADEMICO',
      icon: GraduationCap,
      roles: ['ADMIN', 'PROFESSOR', 'SECRETARIA', 'ALUNO'],
      endpoint: '/relatorios/historico',
      requiresAluno: true,
      dashboardOrigin: {
        path: '/admin-dashboard',
        card: 'Acadêmico',
        action: 'Gerar Histórico Escolar',
      },
      tipoInstituicao: 'AMBOS',
    },
    {
      id: 'RELATORIO_FINAL_ANO_LETIVO',
      label: 'Relatório Final do Ano Letivo',
      description: 'Resumo institucional com indicadores acadêmicos',
      domain: 'ACADEMICO',
      icon: FileText,
      roles: ['ADMIN', 'SECRETARIA'],
      endpoint: '/relatorios/gerar',
      requiresAnoLetivo: true,
      dashboardOrigin: {
        path: '/admin-dashboard',
        card: 'Acadêmico',
        action: 'Gerar Relatório Final',
      },
      tipoInstituicao: 'AMBOS',
    },
    // Relatórios Financeiros
    {
      id: 'PAGAMENTOS',
      label: 'Relatório de Pagamentos',
      description: 'Pagamentos recebidos por período',
      domain: 'FINANCEIRO',
      icon: DollarSign,
      roles: ['ADMIN'],
      endpoint: '/relatorios/pagamentos',
      dashboardOrigin: {
        path: '/admin-dashboard',
        card: 'Financeiro',
        action: 'Gerar Relatório de Pagamentos',
      },
      tipoInstituicao: 'AMBOS',
    },
    {
      id: 'BOLSAS_DESCONTOS',
      label: 'Relatório de Bolsas e Descontos',
      description: 'Bolsas e descontos concedidos',
      domain: 'FINANCEIRO',
      icon: DollarSign,
      roles: ['ADMIN'],
      endpoint: '/relatorios/bolsas',
      dashboardOrigin: {
        path: '/admin-dashboard',
        card: 'Financeiro',
        action: 'Gerar Relatório de Bolsas',
      },
      tipoInstituicao: 'AMBOS',
    },
    {
      id: 'MULTAS',
      label: 'Relatório de Multas',
      description: 'Multas aplicadas e pagas',
      domain: 'FINANCEIRO',
      icon: DollarSign,
      roles: ['ADMIN'],
      endpoint: '/relatorios/multas',
      dashboardOrigin: {
        path: '/admin-dashboard',
        card: 'Financeiro',
        action: 'Gerar Relatório de Multas',
      },
      tipoInstituicao: 'AMBOS',
    },
    // Relatórios Administrativos
    {
      id: 'MATRICULAS',
      label: 'Relatório de Matrículas',
      description: 'Matrículas por período e curso',
      domain: 'ADMINISTRATIVO',
      icon: Users,
      roles: ['ADMIN', 'SECRETARIA'],
      endpoint: '/relatorios/matriculas',
      requiresAnoLetivo: true,
      dashboardOrigin: {
        path: '/admin-dashboard',
        card: 'Administrativo',
        action: 'Gerar Relatório de Matrículas',
      },
      tipoInstituicao: 'AMBOS',
    },
    {
      id: 'TRANSFERENCIAS',
      label: 'Relatório de Transferências',
      description: 'Transferências de alunos',
      domain: 'ADMINISTRATIVO',
      icon: Users,
      roles: ['ADMIN', 'SECRETARIA'],
      endpoint: '/relatorios/transferencias',
      dashboardOrigin: {
        path: '/admin-dashboard',
        card: 'Administrativo',
        action: 'Gerar Relatório de Transferências',
      },
      tipoInstituicao: 'AMBOS',
    },
    {
      id: 'CONCLUSAO_CURSO',
      label: 'Relatório de Conclusões',
      description: 'Alunos que concluíram cursos',
      domain: 'ADMINISTRATIVO',
      icon: GraduationCap,
      roles: ['ADMIN', 'SECRETARIA'],
      endpoint: '/relatorios/conclusoes',
      dashboardOrigin: {
        path: '/admin-dashboard',
        card: 'Administrativo',
        action: 'Gerar Relatório de Conclusões',
      },
      tipoInstituicao: 'AMBOS',
    },
  ],

  /**
   * PROFESSOR
   * - Minhas Turmas
   * - Minhas Aulas
   * - Pendências de Notas
   * - Frequência
   */
  PROFESSOR: [
    {
      id: 'PAUTA_MINHA_TURMA',
      label: 'Pauta da Minha Turma',
      description: 'Pauta com notas dos meus alunos',
      domain: 'ACADEMICO',
      icon: ClipboardList,
      roles: ['PROFESSOR'],
      endpoint: '/relatorios/pauta',
      requiresAnoLetivo: true,
      requiresTurma: true,
      requiresDisciplina: true,
      dashboardOrigin: {
        path: '/painel-professor',
        card: 'Minhas Turmas',
        action: 'Gerar Pauta',
      },
      tipoInstituicao: 'AMBOS',
    },
    {
      id: 'LISTA_PRESENCA',
      label: 'Lista de Presença',
      description: 'Frequência dos meus alunos',
      domain: 'ACADEMICO',
      icon: Users,
      roles: ['PROFESSOR'],
      endpoint: '/relatorios/presenca',
      requiresAnoLetivo: true,
      requiresTurma: true,
      dashboardOrigin: {
        path: '/painel-professor',
        card: 'Frequência',
        action: 'Gerar Lista de Presença',
      },
      tipoInstituicao: 'AMBOS',
    },
    {
      id: 'AVALIACOES_LANCADAS',
      label: 'Avaliações Lançadas',
      description: 'Relatório de avaliações que lancei',
      domain: 'ACADEMICO',
      icon: FileText,
      roles: ['PROFESSOR'],
      endpoint: '/relatorios/avaliacoes',
      requiresAnoLetivo: true,
      requiresTurma: true,
      dashboardOrigin: {
        path: '/painel-professor',
        card: 'Avaliações',
        action: 'Ver Avaliações Lançadas',
      },
      tipoInstituicao: 'AMBOS',
    },
  ],

  /**
   * ALUNO
   * - Minhas Notas
   * - Frequência
   * - Situação acadêmica
   */
  ALUNO: [
    {
      id: 'BOLETIM_MEU',
      label: 'Meu Boletim',
      description: 'Boletim com minhas notas e frequência',
      domain: 'ACADEMICO',
      icon: FileText,
      roles: ['ALUNO'],
      endpoint: '/relatorios/boletim',
      requiresAnoLetivo: true,
      dashboardOrigin: {
        path: '/painel-aluno',
        card: 'Minhas Notas',
        action: 'Ver Boletim',
      },
      tipoInstituicao: 'AMBOS',
    },
    {
      id: 'HISTORICO_MEU',
      label: 'Meu Histórico Acadêmico',
      description: 'Histórico acadêmico completo',
      domain: 'ACADEMICO',
      icon: GraduationCap,
      roles: ['ALUNO'],
      endpoint: '/relatorios/historico',
      dashboardOrigin: {
        path: '/painel-aluno',
        card: 'Situação Acadêmica',
        action: 'Ver Histórico',
      },
      tipoInstituicao: 'AMBOS',
    },
  ],

  /**
   * SECRETARIA
   * - Matrículas
   * - Pagamentos
   * - Pendências administrativas
   */
  SECRETARIA: [
    {
      id: 'MATRICULAS_PERIODO',
      label: 'Matrículas por Período',
      description: 'Matrículas realizadas em um período',
      domain: 'ADMINISTRATIVO',
      icon: Users,
      roles: ['SECRETARIA'],
      endpoint: '/relatorios/matriculas',
      requiresAnoLetivo: true,
      dashboardOrigin: {
        path: '/secretaria-dashboard',
        card: 'Matrículas',
        action: 'Gerar Relatório de Matrículas',
      },
      tipoInstituicao: 'AMBOS',
    },
    {
      id: 'PAGAMENTOS_RECEBIDOS',
      label: 'Pagamentos Recebidos',
      description: 'Pagamentos recebidos por período',
      domain: 'FINANCEIRO',
      icon: DollarSign,
      roles: ['SECRETARIA'],
      endpoint: '/relatorios/pagamentos',
      dashboardOrigin: {
        path: '/secretaria-dashboard',
        card: 'Pagamentos',
        action: 'Gerar Relatório de Pagamentos',
      },
      tipoInstituicao: 'AMBOS',
    },
    {
      id: 'DECLARACOES_ADMINISTRATIVAS',
      label: 'Declarações Administrativas',
      description: 'Declarações e documentos administrativos',
      domain: 'ADMINISTRATIVO',
      icon: FileText,
      roles: ['SECRETARIA'],
      endpoint: '/relatorios/declaracoes',
      dashboardOrigin: {
        path: '/secretaria-dashboard',
        card: 'Documentos',
        action: 'Gerar Declarações',
      },
      tipoInstituicao: 'AMBOS',
    },
  ],

  POS: [
    {
      id: 'MATRICULAS_PERIODO',
      label: 'Matrículas por Período',
      description: 'Matrículas realizadas em um período',
      domain: 'ADMINISTRATIVO',
      icon: Users,
      roles: ['POS'],
      endpoint: '/relatorios/matriculas',
      requiresAnoLetivo: true,
      dashboardOrigin: {
        path: '/pos-dashboard',
        card: 'Matrículas',
        action: 'Gerar Relatório de Matrículas',
      },
      tipoInstituicao: 'AMBOS',
    },
    {
      id: 'PAGAMENTOS_RECEBIDOS',
      label: 'Pagamentos Recebidos',
      description: 'Pagamentos recebidos por período',
      domain: 'FINANCEIRO',
      icon: DollarSign,
      roles: ['POS'],
      endpoint: '/relatorios/pagamentos',
      dashboardOrigin: {
        path: '/pos-dashboard',
        card: 'Pagamentos',
        action: 'Gerar Relatório de Pagamentos',
      },
      tipoInstituicao: 'AMBOS',
    },
  ],

  /** COMERCIAL - equipe comercial, não acessa relatórios acadêmicos */
  COMERCIAL: [],

  /** DIRECAO - direção institucional, pode herdar relatórios do ADMIN se necessário */
  DIRECAO: [],

  /** COORDENADOR - coordenação pedagógica */
  COORDENADOR: [],

  /** AUDITOR - auditoria, logs e conformidade */
  AUDITOR: [
    {
      id: 'AUDITORIA_INSTITUICAO',
      label: 'Auditoria da Instituição',
      description: 'Logs de auditoria e alterações',
      domain: 'SISTEMA',
      icon: Shield,
      roles: ['AUDITOR'],
      endpoint: '/admin-dashboard/auditoria',
      dashboardOrigin: {
        path: '/admin-dashboard/auditoria',
        card: 'Auditoria',
        action: 'Ver Logs',
      },
      tipoInstituicao: 'AMBOS',
    },
  ],

  /** RESPONSAVEL - pais/responsáveis de alunos */
  RESPONSAVEL: [],

  /** RH - recursos humanos */
  RH: [],

  /** FINANCEIRO - área financeira */
  FINANCEIRO: [
    {
      id: 'RECIBOS',
      label: 'Recibos de Pagamento',
      description: 'Recibos de mensalidades e pagamentos',
      domain: 'FINANCEIRO',
      icon: DollarSign,
      roles: ['FINANCEIRO'],
      endpoint: '/recibos',
      dashboardOrigin: {
        path: '/admin-dashboard/pagamentos',
        card: 'Pagamentos',
        action: 'Ver Recibos',
      },
      tipoInstituicao: 'AMBOS',
    },
    {
      id: 'PAGAMENTOS_RECEBIDOS',
      label: 'Pagamentos Recebidos',
      description: 'Histórico de pagamentos por período',
      domain: 'FINANCEIRO',
      icon: DollarSign,
      roles: ['FINANCEIRO'],
      endpoint: '/pagamentos',
      dashboardOrigin: {
        path: '/admin-dashboard/pagamentos',
        card: 'Pagamentos',
        action: 'Ver Pagamentos',
      },
      tipoInstituicao: 'AMBOS',
    },
  ],
};

/**
 * Obter relatórios disponíveis para um perfil
 */
export function getReportsByRole(role: UserRole): ReportConfig[] {
  return REPORTS_BY_ROLE[role] || [];
}

/**
 * Obter relatórios por domínio
 */
export function getReportsByDomain(role: UserRole, domain: ReportDomain): ReportConfig[] {
  return getReportsByRole(role).filter(r => r.domain === domain);
}

/**
 * Verificar se um relatório está disponível para um perfil
 */
export function canAccessReport(role: UserRole, reportId: string): boolean {
  const reports = getReportsByRole(role);
  return reports.some(r => r.id === reportId && r.roles.includes(role));
}

/**
 * Obter relatório por ID
 */
export function getReportById(reportId: string): ReportConfig | undefined {
  for (const role in REPORTS_BY_ROLE) {
    const report = REPORTS_BY_ROLE[role as UserRole].find(r => r.id === reportId);
    if (report) return report;
  }
  return undefined;
}

