import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { statsApi, profilesApi, userRolesApi, aulasApi, turmasApi } from '@/services/api';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ResponsiveKPICard } from '@/components/dashboard/ResponsiveKPICard';
import { AnoLetivoContextHeader } from '@/components/dashboard/AnoLetivoContextHeader';
import { ResponsiveQuickActions } from '@/components/dashboard/ResponsiveQuickActions';
import { AdminOnboardingChecklist } from '@/components/dashboard/AdminOnboardingChecklist';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanFeatures } from '@/contexts/PlanFeaturesContext';
import { useAnoLetivoAtivo } from '@/hooks/useAnoLetivoAtivo';
import { gerarManualSistemaPDF } from '@/utils/systemManualGenerator';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PermissoesRolesDialog } from '@/components/admin/PermissoesRolesDialog';
import { UsoPlanoBadge } from '@/components/admin/UsoPlanoBadge';
import { AlunosPorTurnoChart } from '@/components/admin/AlunosPorTurnoChart';
import { LicenseAlert } from '@/components/admin/LicenseAlert';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import {
  Users,
  BookOpen,
  GraduationCap,
  TrendingUp,
  Calendar,
  MoreHorizontal,
  BookOpenCheck,
  Loader2,
  UserX,
  BookX,
  Shield,
  RefreshCw,
  AlertCircle,
  DollarSign,
  Wallet,
  CreditCard,
  Receipt,
  Award,
  Database,
  HardDrive,
  FileCheck,
  BarChart3,
  Package,
  Building2,
  Settings,
  Bell,
  Mail,
  FileText,
  ClipboardList,
  FolderOpen,
  Video,
  UserCog,
  CalendarCheck,
  CalendarRange,
  Clock,
  Home,
  Shirt,
  Info,
} from 'lucide-react';
import { ModuloInstitucional } from '@/components/dashboard/ModuloInstitucional';
import { PagarBataPasseDialog } from '@/components/secretaria/PagarBataPasseDialog';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { getRoleLabel as getRoleLabelUtil } from '@/utils/roleLabels';
import { filterAcademicDashboardItems } from '@/utils/adminDashboardRbac';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const AdminDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { config, instituicao } = useInstituicao();
  const { user, role } = useAuth();
  const { hasAnoLetivoAtivo } = useAnoLetivoAtivo();
  const [generatingManual, setGeneratingManual] = useState(false);
  const [showPermissoesDialog, setShowPermissoesDialog] = useSafeDialog(false);
  const [showBataPasseDialog, setShowBataPasseDialog] = useSafeDialog(false);
  const navigate = useNavigate();
  
  const { instituicaoId, shouldFilter, isSuperAdmin } = useTenantFilter();
  const { hasFeature } = usePlanFeatures();

  // RBAC: Verificar permissões por módulo (multi-tenant: dados filtrados por instituicaoId do JWT)
  const canViewAcademic = role === 'ADMIN' || role === 'SECRETARIA' || role === 'SUPER_ADMIN' || role === 'PROFESSOR' || role === 'ALUNO' || role === 'DIRECAO' || role === 'COORDENADOR';
  const canViewFinancial = role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'SECRETARIA' || role === 'FINANCEIRO';
  const canViewRH = role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'RH' || role === 'DIRECAO' || role === 'COORDENADOR';
  const canViewAdministrativo = role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'SECRETARIA' || role === 'DIRECAO' || role === 'COORDENADOR';
  const canViewSistema = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const canViewComercial = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const canViewConfig = role === 'ADMIN' || role === 'SUPER_ADMIN';

  // Fetch real stats using REST API - Filtrar por ano letivo ativo se existir
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['admin-stats', instituicaoId, hasAnoLetivoAtivo],
    queryFn: async () => {
      try {
        const data = await statsApi.getAdminStats({ instituicaoId: instituicaoId || undefined });
        return data;
      } catch (error) {
        // Fallback: calculate stats from individual APIs
        const [alunosRoles, professoresRoles, cursos, turmas] = await Promise.all([
          userRolesApi.getAll({ instituicaoId: instituicaoId || undefined, role: 'ALUNO' }),
          userRolesApi.getAll({ instituicaoId: instituicaoId || undefined, role: 'PROFESSOR' }),
          import('@/services/api').then(m => m.cursosApi.getAll({ instituicaoId: instituicaoId || undefined })),
          turmasApi.getAll({ instituicaoId: instituicaoId || undefined }),
        ]);
        
        return {
          alunos: alunosRoles?.length || 0,
          professores: professoresRoles?.length || 0,
          cursos: cursos?.length || 0,
          turmas: turmas?.length || 0,
        };
      }
    },
    enabled: !!instituicaoId || isSuperAdmin,
  });

  // Fetch recent users using REST API
  const { data: recentUsers, isLoading: isLoadingRecentUsers } = useQuery({
    queryKey: ['recent-users', instituicaoId],
    queryFn: async () => {
      try {
        const data = await statsApi.getRecentUsers({ 
          instituicaoId: instituicaoId || undefined,
          limit: 5 
        });
        return data;
      } catch (error) {
        // Fallback: use profiles API
        const profiles = await profilesApi.getAll({ instituicaoId: instituicaoId || undefined });
        const sorted = (profiles || [])
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5);
        
        // Get roles for these users
        const userIds = sorted.map((p: any) => p.id);
        if (userIds.length === 0) return [];
        
        const roles = await userRolesApi.getAll({ instituicaoId: instituicaoId || undefined });
        
        return sorted.map((p: any) => ({
          ...p,
          role: roles?.find((r: any) => r.userId === p.id)?.role || 'ALUNO',
        }));
      }
    },
    enabled: !!instituicaoId || isSuperAdmin,
  });

  // Fetch today's classes using REST API - Apenas se houver ano letivo ativo
  const { data: todayClasses, isLoading: isLoadingTodayClasses } = useQuery({
    queryKey: ['today-classes', instituicaoId, hasAnoLetivoAtivo],
    queryFn: async () => {
      if (!hasAnoLetivoAtivo) return [];
      
      try {
        // IMPORTANTE: Não enviar instituicaoId - o backend usa do token JWT
        const data = await statsApi.getTodayClasses();
        return data;
      } catch (error) {
        // Fallback: use aulas API
        const today = new Date().toISOString().split('T')[0];
        const turmas = await turmasApi.getAll({ instituicaoId: instituicaoId || undefined });
        const turmaIds = turmas?.map((t: any) => t.id) || [];
        
        if (turmaIds.length === 0) return [];
        
        const aulas = await aulasApi.getAll({});
        return (aulas || [])
          .filter((a: any) => a.data === today && turmaIds.includes(a.turmaId))
          .slice(0, 5);
      }
    },
    enabled: (!!instituicaoId || isSuperAdmin) && hasAnoLetivoAtivo,
  });

  const handleGenerateManual = async () => {
    setGeneratingManual(true);
    try {
      const tipoAcad = instituicao?.tipo_academico ?? config?.tipo_academico ?? null;
      const tipoInst = instituicao?.tipo_instituicao ?? config?.tipo_instituicao ?? null;
      await gerarManualSistemaPDF({
        instituicao: {
          nome: config?.nome_instituicao || 'Instituição',
          logoUrl: config?.logo_url,
          tipoAcademico: tipoAcad ?? undefined,
          tipoInstituicao: tipoInst ?? undefined,
        },
      });
      toast({
        title: "Manual gerado",
        description: "O manual do sistema foi baixado com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Não foi possível gerar manual",
        description: "Não foi possível gerar o PDF do manual.",
        variant: "destructive",
      });
    } finally {
      setGeneratingManual(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getRoleLabel = (role: string) => getRoleLabelUtil(role);

  // Filtrar ações/acessos baseado em RBAC
  const shouldShowAcademicContent = canViewAcademic;
  const shouldShowFinancialContent = canViewFinancial;
  const shouldShowConfigActions = canViewConfig;
  
  // Definir itens por módulo institucional - Ordem: estrutura → planejamento → execução → resultados
  const moduloAcademica = [
    { label: 'Cursos', href: '/admin-dashboard/gestao-academica', icon: <BookOpen className="h-4 w-4" /> },
    { label: 'Disciplinas', href: '/admin-dashboard/gestao-academica?tab=disciplinas', icon: <FileText className="h-4 w-4" /> },
    { label: 'Turmas', href: '/admin-dashboard/gestao-academica?tab=turmas', icon: <Users className="h-4 w-4" /> },
    { label: 'Matrículas', href: '/admin-dashboard/gestao-alunos', icon: <ClipboardList className="h-4 w-4" /> },
    { label: 'Planos de Ensino', href: '/admin-dashboard/plano-ensino', icon: <BookOpenCheck className="h-4 w-4" /> },
    { label: 'Aulas', href: '/admin-dashboard/lancamento-aulas', icon: <Calendar className="h-4 w-4" /> },
    { label: 'Presenças', href: '/admin-dashboard/presencas', icon: <CalendarCheck className="h-4 w-4" /> },
    { label: 'Avaliações e notas (disciplina)', href: '/admin-dashboard/avaliacoes-notas', icon: <ClipboardList className="h-4 w-4" /> },
    { label: 'Notas e pautas (turma)', href: '/admin-dashboard/gestao-academica?tab=notas', icon: <FileText className="h-4 w-4" /> },
    { label: 'Certificados / Boletins', href: '/admin-dashboard/certificados', icon: <Award className="h-4 w-4" /> },
    { label: 'Relatórios Oficiais (impressão)', href: '/secretaria-dashboard/relatorios-oficiais', icon: <FileText className="h-4 w-4" /> },
    { label: 'Histórico Acadêmico', href: '/admin-dashboard/gestao-alunos', icon: <FileText className="h-4 w-4" /> },
    { label: 'Biblioteca', href: '/admin-dashboard/biblioteca', icon: <BookOpen className="h-4 w-4" /> },
    { label: 'Videoaulas', href: '/video-aulas', icon: <Video className="h-4 w-4" /> },
  ];

  // ==================== 💰 FINANÇAS ====================
  // Apenas itens financeiros: receitas, despesas, mensalidades, multas, bolsas, fornecedores, contratos
  const moduloFinancas = [
    { label: 'Mensalidades / Propinas', href: '/admin-dashboard/pagamentos', icon: <CreditCard className="h-4 w-4" /> },
    { label: 'Taxas e Serviços', href: '/admin-dashboard/taxas-servicos', icon: <Settings className="h-4 w-4" /> },
    { label: 'Relatórios Financeiros', href: '/admin-dashboard/gestao-financeira', icon: <BarChart3 className="h-4 w-4" /> },
    { label: 'Faturas e Pagamentos', href: '/admin-dashboard/faturas-pagamentos', icon: <Receipt className="h-4 w-4" /> },
    { label: 'Exportar SAFT', href: '/admin-dashboard/exportar-saft', icon: <FileText className="h-4 w-4" /> },
    { label: 'Multas', href: '/admin-dashboard/configuracao-multas', icon: <AlertCircle className="h-4 w-4" /> },
    { label: 'Bolsas e Descontos', href: '/admin-dashboard/bolsas', icon: <Award className="h-4 w-4" /> },
    { label: 'Fornecedores', href: '/admin-dashboard/recursos-humanos?tab=fornecedores', icon: <Building2 className="h-4 w-4" /> },
    { label: 'Contratos', href: '/admin-dashboard/contratos', icon: <FileText className="h-4 w-4" /> },
    { label: 'Auditoria Financeira', href: '/admin-dashboard/auditoria?tipo=financeiro', icon: <Shield className="h-4 w-4" /> },
  ];

  // ==================== 👥 RECURSOS HUMANOS ====================
  // Gestão de pessoas: funcionários, professores, cargos, departamentos, permissões
  const moduloRH = [
    { label: 'Funcionários', href: '/admin-dashboard/recursos-humanos', icon: <Users className="h-4 w-4" /> },
    { label: 'Professores', href: '/admin-dashboard/gestao-professores', icon: <GraduationCap className="h-4 w-4" /> },
    { label: 'Cargos', href: '/admin-dashboard/recursos-humanos?tab=cargos', icon: <UserCog className="h-4 w-4" /> },
    { label: 'Departamentos', href: '/admin-dashboard/recursos-humanos?tab=departamentos', icon: <Building2 className="h-4 w-4" /> },
    { label: 'Permissões (RBAC)', href: '/admin-dashboard/recursos-humanos?tab=permissoes', icon: <Shield className="h-4 w-4" /> },
  ];

  // ==================== 🏢 ADMINISTRATIVO ====================
  // Ordem: fundamentos → calendário/períodos → ciclo de vida → eventos/auditoria
  const moduloAdministrativoBase = [
    { label: 'Instituição', href: '/admin-dashboard/configuracoes', icon: <Building2 className="h-4 w-4" /> },
    { label: 'Intervalos e Horários', href: '/admin-dashboard/configuracoes?tab=horarios', icon: <Clock className="h-4 w-4" /> },
    { label: 'Ano Letivo', href: '/admin-dashboard/configuracao-ensino?tab=anos-letivos', icon: <Calendar className="h-4 w-4" /> },
    { label: 'Calendário Acadêmico', href: '/admin-dashboard/calendario', icon: <Calendar className="h-4 w-4" /> },
    { label: 'Períodos de Lançamento', href: '/admin-dashboard/configuracao-ensino?tab=periodos-lancamento-notas', icon: <CalendarRange className="h-4 w-4" /> },
    { label: 'Encerramento de Ano Letivo', href: '/admin-dashboard/configuracao-ensino?tab=encerramentos', icon: <FileText className="h-4 w-4" /> },
    { label: 'Reabertura Excepcional', href: '/admin-dashboard/configuracao-ensino?tab=reabertura-ano-letivo', icon: <RefreshCw className="h-4 w-4" /> },
    { label: 'Eventos Governamentais', href: '/admin-dashboard/eventos-governamentais', icon: <Building2 className="h-4 w-4" /> },
    { label: 'Auditorias Administrativas', href: '/admin-dashboard/auditoria', icon: <Shield className="h-4 w-4" /> },
  ];
  const moduloAdministrativo = [
    ...moduloAdministrativoBase,
    ...(hasFeature('alojamentos') ? [{ label: 'Alojamentos', href: '/admin-dashboard/gestao-moradias', icon: <Home className="h-4 w-4" /> }] : []),
  ];

  // ==================== 📦 SISTEMA ====================
  // Operações de sistema: backups, logs, auditoria, integrações, notificações, termos
  const moduloSistemaBase = [
    { label: 'Backups', href: '/admin-dashboard/backup', icon: <HardDrive className="h-4 w-4" /> },
    { label: 'Restauração', href: '/admin-dashboard/backup', icon: <Database className="h-4 w-4" /> },
    { label: 'Logs', href: '/admin-dashboard/logs', icon: <FileText className="h-4 w-4" /> },
    { label: 'Auditoria Geral', href: '/admin-dashboard/auditoria', icon: <Shield className="h-4 w-4" /> },
    { label: 'Analytics', href: '/admin-dashboard/analytics', icon: <BarChart3 className="h-4 w-4" /> },
    { label: 'Integrações', href: '/admin-dashboard/integracoes', icon: <Settings className="h-4 w-4" /> },
    { label: 'Notificações', href: '/admin-dashboard/notificacoes', icon: <Bell className="h-4 w-4" /> },
    { label: 'E-mails', href: '/admin-dashboard/emails', icon: <Mail className="h-4 w-4" /> },
    { label: 'Termos Legais e Aceite', href: '/admin-dashboard/termos-legais', icon: <FileCheck className="h-4 w-4" /> },
  ];
  const moduloSistema = moduloSistemaBase.filter(
    (item) => item.label !== 'Analytics' || hasFeature('analytics')
  );

  // ==================== 📊 COMERCIAL ====================
  // Gestão comercial: plano, assinatura, licença, faturamento da instituição
  const nomeInstituicao = config?.nome_instituicao || instituicao?.nome || 'Instituição';
  const moduloComercial = [
    { label: 'Plano da Instituição', href: '/admin-dashboard/minha-assinatura', icon: <Package className="h-4 w-4" /> },
    { label: 'Status da Licença', href: '/admin-dashboard/minha-assinatura', icon: <Shield className="h-4 w-4" /> },
    { label: `Faturamento ${nomeInstituicao}`, href: '/admin-dashboard/minha-assinatura', icon: <CreditCard className="h-4 w-4" /> },
  ];

  const moduloAcademicaVisivel = filterAcademicDashboardItems(role, moduloAcademica);

  return (
    <DashboardLayout>
      <div className="w-full max-w-full space-y-4 sm:space-y-5 md:space-y-6">
        {/* License Alert */}
        {canViewConfig && (
          <LicenseAlert 
            instituicaoId={
              // Apenas passar instituicaoId se for SUPER_ADMIN
              // Para outros usuários, o LicenseAlert usa /current automaticamente
              role === 'SUPER_ADMIN' ? (user?.instituicao_id || undefined) : undefined
            } 
          />
        )}
        
        {/* HEADER: Ano Letivo como Eixo Central - Opcional (badge já está no header) */}
        <AnoLetivoContextHeader showBannerWhenInactive={true} />

        {role === 'SUPER_ADMIN' && (
          <Alert className="border-amber-500/40 bg-amber-500/5">
            <Info className="h-4 w-4 text-amber-700 dark:text-amber-500" />
            <AlertTitle className="text-amber-900 dark:text-amber-100">Super Admin no painel da instituição</AlertTitle>
            <AlertDescription className="text-amber-900/90 dark:text-amber-50/90 space-y-2">
              <p>
                A gestão global da plataforma (instituições, planos, equipa) está no painel Super Admin. Aqui, atalhos para operações pedagógicas do dia a dia foram ocultados para alinhar com o menu lateral.
              </p>
              <Button type="button" variant="outline" size="sm" className="border-amber-600/50" onClick={() => navigate('/super-admin')}>
                Abrir Super Admin
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {role === 'ADMIN' && (
          <AdminOnboardingChecklist
            checklistRole="ADMIN"
            instituicaoId={instituicaoId}
            instituicaoNome={config?.nome_instituicao || instituicao?.nome}
            hasAnoLetivoAtivo={hasAnoLetivoAtivo}
            stats={stats ?? undefined}
            isLoadingStats={isLoadingStats}
          />
        )}

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">
              {t('dashboard.adminPanel')}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              {t('dashboard.overviewInstitution')}
            </p>
          </div>
          
          {/* Action Buttons - Responsive */}
          {(shouldShowConfigActions || shouldShowFinancialContent) && (
            <div className="flex flex-wrap gap-2 shrink-0">
              {shouldShowFinancialContent && (
                <Button 
                  onClick={() => setShowBataPasseDialog(true)} 
                  variant="outline"
                  size="sm"
                  className="text-xs sm:text-sm"
                >
                  <Shirt className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Pagar Bata/Passe</span>
                  <span className="sm:hidden">Bata/Passe</span>
                </Button>
              )}
              {shouldShowConfigActions && (
                <>
              <Button 
                onClick={() => setShowPermissoesDialog(true)} 
                variant="outline"
                size="sm"
                className="text-xs sm:text-sm"
              >
                <Shield className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Permissões</span>
                <span className="sm:hidden">Perm.</span>
              </Button>
              <Button 
                onClick={handleGenerateManual} 
                variant="default"
                size="sm"
                className="text-xs sm:text-sm"
                disabled={generatingManual}
              >
                {generatingManual ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <BookOpenCheck className="mr-2 h-4 w-4" />
                )}
                <span className="hidden sm:inline">Manual</span>
                <span className="sm:hidden">PDF</span>
              </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Quick Actions - Responsive */}
        {shouldShowAcademicContent && <ResponsiveQuickActions />}

        {/* KPIs - Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full max-w-full">
          <ResponsiveKPICard
            title="Total de Estudantes"
            value={stats?.alunos?.toString() || '0'}
            description={hasAnoLetivoAtivo ? "Matriculados no ano letivo ativo" : "Cadastrados no sistema"}
            icon={<Users className="h-5 w-5 sm:h-6 sm:w-6" />}
            isLoading={isLoadingStats}
            emptyMessage={hasAnoLetivoAtivo ? "Nenhum estudante matriculado neste Ano Letivo" : "Nenhum estudante cadastrado"}
          />
          <ResponsiveKPICard
            title="Professores"
            value={stats?.professores?.toString() || '0'}
            description="Cadastrados"
            icon={<GraduationCap className="h-5 w-5 sm:h-6 sm:w-6" />}
            isLoading={isLoadingStats}
            emptyMessage="Nenhum professor cadastrado"
            onClick={() => navigate('/admin-dashboard/gestao-professores')}
          />
          {shouldShowAcademicContent && (
            <>
              <ResponsiveKPICard
                title="Cursos"
                value={stats?.cursos?.toString() || '0'}
                description={hasAnoLetivoAtivo ? "Disponíveis no ano letivo ativo" : "Disponíveis"}
                icon={<BookOpen className="h-5 w-5 sm:h-6 sm:w-6" />}
                isLoading={isLoadingStats}
                emptyMessage={hasAnoLetivoAtivo ? "Nenhum curso configurado para este Ano Letivo" : "Nenhum curso cadastrado"}
              />
              <ResponsiveKPICard
                title="Turmas"
                value={stats?.turmas?.toString() || '0'}
                description={hasAnoLetivoAtivo ? "Ativas no ano letivo ativo" : "Ativas"}
                icon={<TrendingUp className="h-5 w-5 sm:h-6 sm:w-6" />}
                isLoading={isLoadingStats}
                emptyMessage={hasAnoLetivoAtivo ? "Nenhuma turma ativa neste Ano Letivo" : "Nenhuma turma cadastrada"}
              />
            </>
          )}
        </div>

        {/* Chart Row - Responsive */}
        {shouldShowAcademicContent && hasAnoLetivoAtivo && (
          <div className="w-full max-w-full min-w-0">
            <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
              <AlunosPorTurnoChart />
            </div>
          </div>
        )}

        {/* Cards Informativos - Priorizados antes dos módulos */}
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2 xl:grid-cols-3 w-full max-w-full">
          {shouldShowConfigActions && (
            <div className="lg:col-span-1">
              <UsoPlanoBadge />
            </div>
          )}
          {shouldShowAcademicContent && (
            <Card className="lg:col-span-1">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base sm:text-lg truncate">Usuários Recentes</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Últimos cadastros no sistema</CardDescription>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate('/admin-dashboard/gestao-alunos')}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {isLoadingRecentUsers ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : recentUsers && recentUsers.length > 0 ? (
                  <div className="space-y-3 sm:space-y-4">
                    {recentUsers.map((recentUser: any) => (
                      <div key={recentUser.id} className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-9 w-9 sm:h-10 sm:w-10 shrink-0">
                          <AvatarImage src={recentUser.avatarUrl || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs sm:text-sm">
                            {getInitials(recentUser.nomeCompleto || recentUser.nome_completo || '')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{recentUser.nomeCompleto || recentUser.nome_completo}</p>
                          <p className="text-xs text-muted-foreground truncate">{recentUser.email}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant={recentUser.role === 'PROFESSOR' ? 'default' : 'secondary'} className="text-[10px] sm:text-xs">
                            {getRoleLabel(recentUser.role)}
                          </Badge>
                          <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(recentUser.createdAt || recentUser.created_at), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <UserX className="h-10 w-10 sm:h-12 sm:w-12 mb-3 opacity-50 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground mb-1">Nenhum usuário cadastrado</p>
                    <p className="text-xs text-muted-foreground">Os usuários aparecerão aqui quando forem cadastrados</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          {shouldShowAcademicContent && hasAnoLetivoAtivo && (
            <Card className="lg:col-span-1">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base sm:text-lg truncate">Aulas de Hoje</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Aulas programadas para hoje</CardDescription>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate('/admin-dashboard/gestao-academica')}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {isLoadingTodayClasses ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : todayClasses && todayClasses.length > 0 ? (
                  <div className="space-y-3 sm:space-y-4">
                    {todayClasses.map((aula: any) => (
                      <div key={aula.id} className="flex items-center gap-3 p-2 sm:p-3 rounded-lg bg-muted/50 min-w-0">
                        <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold text-xs sm:text-sm shrink-0">
                          {aula.turma?.horario || '--:--'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{aula.turma?.nome || 'Turma'}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {aula.turma?.professor?.nomeCompleto || aula.turma?.professor?.nome_completo || 'Professor não definido'}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px] sm:text-xs shrink-0">{aula.turma?.sala || 'S/Sala'}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <BookX className="h-10 w-10 sm:h-12 sm:w-12 mb-3 opacity-50 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground mb-1">Nenhuma aula programada para hoje</p>
                    <p className="text-xs text-muted-foreground">
                      {hasAnoLetivoAtivo ? "As aulas do ano letivo ativo aparecerão aqui quando forem lançadas" : "É necessário um Ano Letivo ativo para lançar aulas"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Módulos Institucionais - Organizados por Domínio (colapsáveis) */}
        <div className="space-y-6 w-full max-w-full">
          {/* 🏫 ACADÊMICA */}
          {canViewAcademic && moduloAcademicaVisivel.length > 0 && (
            <ModuloInstitucional
              title="🏫 Acadêmica"
              description="Gestão acadêmica completa: cursos, turmas, matrículas, aulas, presenças, avaliações e notas"
              icon={<GraduationCap className="h-6 w-6 text-white" />}
              items={moduloAcademicaVisivel}
              color="bg-blue-500"
              collapsible
              defaultOpen
            />
          )}

          {/* 💰 FINANÇAS */}
          {canViewFinancial && (
            <ModuloInstitucional
              title="💰 Finanças"
              description="Gestão financeira institucional: mensalidades, multas, bolsas, descontos e relatórios"
              icon={<DollarSign className="h-6 w-6 text-white" />}
              items={moduloFinancas}
              color="bg-green-500"
              collapsible
              defaultOpen
            />
          )}

          {/* 👥 RECURSOS HUMANOS */}
          {canViewRH && (
            <ModuloInstitucional
              title="👥 Recursos Humanos"
              description="Gestão de pessoas: funcionários, professores e permissões (RBAC)"
              icon={<Users className="h-6 w-6 text-white" />}
              items={moduloRH}
              color="bg-purple-500"
              collapsible
              defaultOpen={false}
            />
          )}

          {/* 🏢 CONFIGURAÇÕES INSTITUCIONAIS */}
          {canViewAdministrativo && (
            <ModuloInstitucional
              title="🏢 Configurações Institucionais"
              description="Instituição, ano letivo, calendário, períodos e auditorias"
              icon={<Building2 className="h-6 w-6 text-white" />}
              items={moduloAdministrativo}
              color="bg-orange-500"
              collapsible
              defaultOpen={false}
            />
          )}

          {/* 📦 SISTEMA */}
          {canViewSistema && (
            <ModuloInstitucional
              title="📦 Sistema"
              description="Operações de sistema: backups, restauração, logs, auditoria, notificações e e-mails"
              icon={<Database className="h-6 w-6 text-white" />}
              items={moduloSistema}
              color="bg-slate-500"
              collapsible
              defaultOpen={false}
            />
          )}

          {/* 📊 COMERCIAL */}
          {canViewComercial && (
            <ModuloInstitucional
              title="📊 Comercial"
              description={`Gestão comercial: plano da instituição, assinatura, licença e faturamento ${nomeInstituicao}`}
              icon={<Package className="h-6 w-6 text-white" />}
              items={moduloComercial}
              color="bg-amber-500"
              collapsible
              defaultOpen={false}
            />
          )}
        </div>
      </div>

      <PermissoesRolesDialog 
        open={showPermissoesDialog} 
        onOpenChange={setShowPermissoesDialog} 
      />

      <PagarBataPasseDialog
        open={showBataPasseDialog}
        onOpenChange={setShowBataPasseDialog}
        config={config}
        instituicao={instituicao}
      />
    </DashboardLayout>
  );
};

export default AdminDashboard;
