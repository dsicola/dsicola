import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { useTenant } from '@/contexts/TenantContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { KeyRound, Shield, Video, ArrowLeft } from 'lucide-react';
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  BookOpen,
  Calendar,
  FileText,
  CalendarCheck,
  LogOut,
  User,
  Settings,
  Bell,
  Home,
  DollarSign,
  UserCog,
  ChevronDown,
  ClipboardList,
  Clock,
  BookMarked,
  Megaphone,
  Mail,
  FolderOpen,
  Building2,
  Globe,
  AlertCircle,
  Wallet,
  CreditCard,
  Receipt,
  Award,
  Database,
  Shield,
  HardDrive,
  FileCheck,
  BarChart3,
  Package,
  KeyRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getRoleLabel } from '@/utils/roleLabels';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { ProfileSettings } from '@/components/profile/ProfileSettings';
import { AssistenteIA } from '@/components/ai/AssistenteIA';
import { AnoLetivoBadge } from '@/components/dashboard/AnoLetivoBadge';
// Theme is now applied globally via ThemeProvider
// No need to apply colors here anymore
import dsicolaLogo from '@/assets/logo-dsicola.png';
import { getSidebarItemsForRole } from './sidebar.config';
import { DynamicSidebar } from './DynamicSidebar';
import { useSidebarPreferences } from '@/hooks/useSidebarPreferences';
import { getDashboardPathForRole } from './sidebar.modules';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user, role, signOut, loading: authLoading } = useAuth();
  
  // Obter roles do usuário: garantir que seja array (backend pode retornar string em edge cases)
  const rawRoles = (user as any)?.roles ?? (role ? [role] : []);
  const userRoles = Array.isArray(rawRoles) ? rawRoles : (typeof rawRoles === 'string' ? [rawRoles] : []);
  const { config, isSecundario, tipoAcademico } = useInstituicao();
  const { instituicao, isMainDomain, isSuperAdmin } = useTenant();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const openingProfileRef = useRef(false);
  
  // Theme is now applied globally via ThemeProvider in App.tsx
  // No need to apply colors here anymore

  // Prefer the authenticated user's institution (config) over tenant branding
  const institutionName = config?.nome_instituicao || instituicao?.nome || null;

  // Obter itens de menu baseado no role do usuário (configuração centralizada)
  const sidebarSections = getSidebarItemsForRole(userRoles);

  const roleLabel = getRoleLabel(role);

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate('/auth');
  }, [signOut, navigate]);

  const getInitials = (name: string | null | undefined) => {
    const s = String(name ?? '').trim();
    if (!s) return 'U';
    return s
      .split(/\s+/)
      .map((n) => (String(n)[0] || ''))
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';
  };

  // Usar useSidebarPreferences - agora é resiliente a contexto não disponível
  const { preferences } = useSidebarPreferences();
  
  // Mostrar loading se o contexto ainda estiver carregando
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Forçar re-render quando preferências mudarem (tempo real)
  const [, forceUpdate] = useState({});
  useEffect(() => {
    const handlePreferencesChange = () => {
      forceUpdate({});
    };
    window.addEventListener('sidebarPreferencesChanged', handlePreferencesChange);
    return () => window.removeEventListener('sidebarPreferencesChanged', handlePreferencesChange);
  }, []);
  
  // No desktop modo fixo, sidebar sempre visível (não precisa controlar estado)
  // No mobile ou modo flutuante, controlar estado normalmente
  const [isMobileState, setIsMobileState] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileState(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // No desktop, sempre considerar sidebar aberta (fixo ou flutuante)
  // No mobile, usar estado controlado
  const isDesktop = !isMobileState;
  const isDesktopFixed = isDesktop && preferences.mode === 'fixed';
  const effectiveSidebarOpen = isDesktop ? true : sidebarOpen;
  
  // Inicializar sidebar como aberta no desktop quando montar
  useEffect(() => {
    if (isDesktop && !sidebarOpen) {
      setSidebarOpen(true);
    }
  }, [isDesktop, sidebarOpen]);
  
  // Debug (apenas em desenvolvimento)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[DashboardLayout] Sidebar state:', {
        isDesktop,
        isMobileState,
        sidebarOpen,
        effectiveSidebarOpen,
        mode: preferences.mode,
        position: preferences.position,
      });
    }
  }, [isDesktop, isMobileState, sidebarOpen, effectiveSidebarOpen, preferences]);

  // Verificar se está no dashboard ou dentro de módulo
  const dashboardPaths = [
    '/admin-dashboard',
    '/super-admin',
    '/painel-professor',
    '/painel-aluno',
    '/secretaria-dashboard',
    '/painel-responsavel'
  ];
  const isOnDashboard = dashboardPaths.some(path => 
    location.pathname === path || 
    location.pathname === path + '/'
  );
  const isInsideModule = !isOnDashboard && (
    location.pathname.startsWith('/admin-dashboard/') ||
    location.pathname.startsWith('/super-admin/') ||
    location.pathname.startsWith('/painel-professor/') ||
    location.pathname.startsWith('/painel-aluno/') ||
    location.pathname.startsWith('/secretaria-dashboard/') ||
    location.pathname.startsWith('/painel-responsavel/')
  );
  const dashboardPath = getDashboardPathForRole(userRoles);

  // Calcular classes do main content baseado na posição da sidebar
  // Usar useMemo para recalcular quando preferences mudar (tempo real)
  const mainContentClasses = useMemo(() => {
    // No mobile, sempre sem margem (sidebar é overlay)
    const baseClasses = 'flex-1 flex flex-col min-h-screen';
    
    // No desktop, ajustar margem baseado na posição (apenas modo fixo)
    if (preferences.mode === 'floating') {
      return baseClasses;
    }

    // Ajustar margens baseado na posição da sidebar
    // Para topo/fundo: usar padding-top/bottom ao invés de margin
    const marginClasses = {
      left: 'lg:ml-64',
      right: 'lg:mr-64',
      top: 'lg:pt-16', // Altura da sidebar horizontal
      bottom: 'lg:pb-16', // Altura da sidebar horizontal
    };

    return cn(baseClasses, marginClasses[preferences.position]);
  }, [preferences.mode, preferences.position]);

  // User section component - memoizado para evitar re-renders que causam perda de foco no dropdown
  const userSection = useMemo(() => (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button className={cn(
          'flex items-center gap-2 rounded-lg p-2 hover:bg-sidebar-accent transition-colors',
          (preferences.position === 'top' || preferences.position === 'bottom')
            ? 'flex-row'
            : 'w-full flex-row'
        )}>
          <Avatar className={cn(
            (preferences.position === 'top' || preferences.position === 'bottom')
              ? 'h-7 w-7'
              : 'h-9 w-9'
          )}>
            <AvatarImage src={user?.avatar_url || undefined} />
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm">
              {user?.nome_completo ? getInitials(user.nome_completo) : 'U'}
            </AvatarFallback>
          </Avatar>
          {(preferences.position === 'left' || preferences.position === 'right') && (
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user?.nome_completo || 'Usuário'}
              </p>
              <p className="text-xs text-sidebar-foreground/60 truncate">
                {user?.email}
              </p>
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56"
        onCloseAutoFocus={(e) => {
          if (openingProfileRef.current) {
            e.preventDefault();
            openingProfileRef.current = false;
          }
        }}
      >
        <DropdownMenuItem
          onSelect={() => {
            openingProfileRef.current = true;
            setTimeout(() => setProfileOpen(true), 100);
          }}
        >
          <User className="mr-2 h-4 w-4" />
          Minha conta
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ), [user?.avatar_url, user?.nome_completo, user?.email, preferences.position, handleSignOut]);
  
  return (
    <div className={cn("min-h-screen flex flex-col bg-background w-full overflow-x-hidden", isSecundario && "theme-secundario")}>
      {/* Dynamic Sidebar */}
      <DynamicSidebar
        userRoles={userRoles}
        isOpen={effectiveSidebarOpen}
        onClose={() => setSidebarOpen(false)}
        institutionName={institutionName}
        roleLabel={roleLabel}
        logoUrl={config?.logo_url || null}
        userSection={userSection}
      />

      {/* Profile Settings Dialog */}
      <ProfileSettings open={profileOpen} onOpenChange={setProfileOpen} />

      {/* Main content */}
      <main className={mainContentClasses}>
        {/* Top bar - Header fixo com Ano Letivo visível */}
        <header className="sticky top-0 z-50 h-auto border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          {/* Primeira linha: Navegação e notificações */}
          <div className="flex h-14 sm:h-16 items-center justify-between gap-2 sm:gap-3 px-3 sm:px-4 md:px-6 overflow-visible">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              {/* Mobile menu button */}
              <button 
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-muted transition-colors shrink-0"
                aria-label="Abrir menu"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              
              {/* Botão Voltar ao Dashboard - Mostrar quando estiver dentro de módulo */}
              {isInsideModule && (
                <button
                  onClick={() => navigate(dashboardPath)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted transition-colors shrink-0 text-sm font-medium"
                  title="Voltar ao Dashboard"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Voltar</span>
                </button>
              )}
              
              <h2 className="text-sm sm:text-base md:text-lg font-semibold truncate min-w-0">
                <span className="hidden md:inline">Bem-vindo(a), </span>{user?.nome_completo?.split(' ')[0] || 'Usuário'}
              </h2>
              
              {/* Role badge - sempre visível */}
              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
                {roleLabel}
              </span>
              
              {/* Institution Indicator - tablet+ */}
              {institutionName && (
                <div className="hidden md:flex items-center gap-1.5 px-2 sm:px-3 py-1 text-xs font-medium rounded-full bg-secondary text-secondary-foreground border border-border shrink-0">
                  <Building2 className="h-3.5 w-3.5" />
                  <span className="max-w-[120px] lg:max-w-[180px] truncate">{institutionName}</span>
                </div>
              )}
              
              {/* Super Admin badge - desktop only */}
              {isSuperAdmin && isMainDomain && (
                <div className="hidden xl:flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 shrink-0">
                  <Globe className="h-3.5 w-3.5" />
                  <span>Super Admin</span>
                </div>
              )}
            </div>
            
            {/* Ano Letivo Badge - VISÍVEL NO HEADER (antes das notificações) */}
            <div className="shrink-0">
              <AnoLetivoBadge variant="compact" />
            </div>
            
            {/* Meu Perfil + Notifications - sempre à direita */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0 relative z-[60]">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setProfileOpen(true);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm font-medium cursor-pointer min-h-[44px] min-w-[44px] sm:min-w-0 touch-manipulation"
                title="Minha conta - Alterar senha e foto"
              >
                <User className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Meu Perfil</span>
              </button>
              <NotificationBell />
            </div>
          </div>
          
          {/* Segunda linha: Ano Letivo completo (desktop) */}
          <div className="hidden lg:block border-t border-border/50 px-4 md:px-6 py-2">
            <AnoLetivoBadge variant="full" />
          </div>
        </header>

        {/* Page content - Container responsivo sem overflow desnecessário */}
        <div className="flex-1 w-full">
          <div className="p-3 sm:p-4 md:p-6 w-full max-w-full">
            {children}
          </div>
        </div>
      </main>
      
      {/* Assistente IA flutuante */}
      <AssistenteIA />
    </div>
  );
};
