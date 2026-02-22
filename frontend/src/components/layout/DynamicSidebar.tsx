import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useSidebarPreferences, SidebarPosition, SidebarMode } from '@/hooks/useSidebarPreferences';
import { getSidebarModulesForRole, getDashboardPathForRole, getComunicadosPathForRole, getAcademicaPathForRole, SidebarModule } from './sidebar.modules';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { Move, X, Pin, ArrowLeft, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarSettings } from './SidebarSettings';

interface DynamicSidebarProps {
  userRoles: string[];
  isOpen: boolean;
  onClose: () => void;
  institutionName?: string | null;
  roleLabel: string;
  logoUrl?: string | null;
  userSection: React.ReactNode;
}

/**
 * Sidebar dinâmica com suporte a posições e modo flutuante
 * 
 * Modos:
 * - fixed: Sidebar fixa nas bordas (left, right, top, bottom)
 * - floating: Sidebar flutuante com drag (apenas desktop)
 */
export const DynamicSidebar: React.FC<DynamicSidebarProps> = ({
  userRoles,
  isOpen,
  onClose,
  institutionName,
  roleLabel,
  logoUrl,
  userSection,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { preferences, setMode, setPosition } = useSidebarPreferences();
  const { tipoAcademico } = useInstituicao();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  // Inicializar como false (desktop) para garantir renderização imediata
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024;
    }
    return false;
  });

  // Obter path do dashboard baseado no role (HUB dinâmico)
  // Se não houver roles, usar path padrão
  const dashboardPath = userRoles.length > 0 
    ? getDashboardPathForRole(userRoles)
    : '/admin-dashboard';
  
  // Obter módulos filtrados por role e tipoInstituicao
  let sidebarModules = getSidebarModulesForRole(userRoles, tipoAcademico || null);
  
  // Debug módulos (apenas em desenvolvimento)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[DynamicSidebar] 🔍 Debug módulos:', {
        userRoles,
        tipoAcademico,
        modulesCount: sidebarModules.length,
        modules: sidebarModules.map(m => ({ 
          label: m.label, 
          path: m.path,
          roles: m.roles,
          tipoInstituicao: m.tipoInstituicao || 'TODOS',
          description: m.description 
        })),
        dashboardPath,
        hasDashboard: sidebarModules.some(m => m.label === 'Dashboard'),
      });
    }
  }, [userRoles?.join(','), tipoAcademico, sidebarModules.length, dashboardPath]);
  
  // GARANTIR que Dashboard sempre apareça (fallback de segurança)
  const hasDashboard = sidebarModules.some(m => m.label === 'Dashboard');
  if (!hasDashboard && userRoles.length > 0) {
    console.warn('[DynamicSidebar] ⚠️ Dashboard não encontrado, adicionando fallback. UserRoles:', userRoles);
    sidebarModules = [
      {
        label: 'Dashboard',
        icon: LayoutDashboard,
        path: dashboardPath,
        roles: userRoles,
        description: 'Hub central com visão geral e acesso rápido',
      },
      ...sidebarModules,
    ];
  }
  
  // Ajustar path do Dashboard, Comunicados e Acadêmica baseado no role do usuário
  const comunicadosPath = getComunicadosPathForRole(userRoles);
  const academicaPath = getAcademicaPathForRole(userRoles);
  sidebarModules = sidebarModules.map(module => {
    if (module.label === 'Dashboard') {
      return { ...module, path: dashboardPath };
    }
    if (module.label === 'Comunicados') {
      return { ...module, path: comunicadosPath };
    }
    if (module.label === 'Acadêmica') {
      return { ...module, path: academicaPath };
    }
    return module;
  });
  
  // Debug removido - já está no useEffect anterior

  // Verificar se está no dashboard principal (HUB central)
  const dashboardPaths = [
    '/admin-dashboard',
    '/super-admin',
    '/painel-professor',
    '/painel-aluno',
    '/secretaria-dashboard',
    '/painel-responsavel'
  ];
  const isOnDashboard = dashboardPaths.some(path => {
    const exactMatch = location.pathname === path || location.pathname === path + '/';
    // Para /admin-dashboard, verificar se não tem subpath (apenas dashboard raiz)
    if (path === '/admin-dashboard') {
      return exactMatch || (location.pathname === '/admin-dashboard' && !location.pathname.includes('/admin-dashboard/'));
    }
    return exactMatch;
  });
  
  // Verificar se está dentro de um módulo (não no dashboard)
  // Considera qualquer path que tenha subpath após o dashboard
  const isInsideModule = !isOnDashboard && (
    (location.pathname.startsWith('/admin-dashboard/') && location.pathname !== '/admin-dashboard' && location.pathname !== '/admin-dashboard/') ||
    (location.pathname.startsWith('/super-admin/') && location.pathname !== '/super-admin' && location.pathname !== '/super-admin/') ||
    (location.pathname.startsWith('/painel-professor/') && location.pathname !== '/painel-professor' && location.pathname !== '/painel-professor/') ||
    (location.pathname.startsWith('/painel-aluno/') && location.pathname !== '/painel-aluno' && location.pathname !== '/painel-aluno/') ||
    (location.pathname.startsWith('/secretaria-dashboard/') && location.pathname !== '/secretaria-dashboard' && location.pathname !== '/secretaria-dashboard/') ||
    (location.pathname.startsWith('/painel-responsavel/') && location.pathname !== '/painel-responsavel' && location.pathname !== '/painel-responsavel/')
  );

  // Desabilitar modo flutuante no mobile
  // Usar useMemo para recalcular quando preferences mudar (TEMPO REAL)
  const effectiveMode: SidebarMode = useMemo(() => {
    return isMobile ? 'fixed' : preferences.mode;
  }, [isMobile, preferences.mode]);
  
  const effectivePosition: SidebarPosition = useMemo(() => {
    return isMobile ? 'left' : preferences.position;
  }, [isMobile, preferences.position]);
  
  // Forçar re-render quando preferências mudarem (tempo real)
  const [, forceUpdate] = useState({});
  useEffect(() => {
    const handlePreferencesChange = () => {
      forceUpdate({});
    };
    window.addEventListener('sidebarPreferencesChanged', handlePreferencesChange);
    return () => window.removeEventListener('sidebarPreferencesChanged', handlePreferencesChange);
  }, []);

  // Detectar mobile
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      // Debug: verificar estado (apenas em desenvolvimento)
      if (process.env.NODE_ENV === 'development') {
        console.log('[DynamicSidebar] Mobile:', mobile, 'isOpen:', isOpen, 'effectiveMode:', effectiveMode);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [isOpen, effectiveMode]);

  // Drag handlers (apenas modo flutuante)
  const dragHandleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (effectiveMode !== 'floating' || isMobile || !isOpen || !sidebarRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !sidebarRef.current) return;

      const x = e.clientX - dragOffset.x;
      const y = e.clientY - dragOffset.y;

      // Limitar dentro da viewport
      const maxX = window.innerWidth - sidebarRef.current.offsetWidth;
      const maxY = window.innerHeight - sidebarRef.current.offsetHeight;

      const clampedX = Math.max(0, Math.min(x, maxX));
      const clampedY = Math.max(0, Math.min(y, maxY));

      sidebarRef.current.style.left = `${clampedX}px`;
      sidebarRef.current.style.top = `${clampedY}px`;
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, effectiveMode, isMobile, isOpen]);

  // Snap automático para bordas (modo flutuante)
  useEffect(() => {
    if (effectiveMode !== 'floating' || isMobile || !sidebarRef.current) return;

    const handleMouseUp = () => {
      if (!sidebarRef.current) return;
      const rect = sidebarRef.current.getBoundingClientRect();
      const snapThreshold = 50;

      // Snap para bordas
      if (rect.left < snapThreshold) {
        sidebarRef.current.style.left = '0px';
      } else if (rect.right > window.innerWidth - snapThreshold) {
        sidebarRef.current.style.left = `${window.innerWidth - rect.width}px`;
      }

      if (rect.top < snapThreshold) {
        sidebarRef.current.style.top = '0px';
      } else if (rect.bottom > window.innerHeight - snapThreshold) {
        sidebarRef.current.style.top = `${window.innerHeight - rect.height}px`;
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [effectiveMode, isMobile]);

  // Classes base para sidebar - GARANTIR VISIBILIDADE
  // Usar useMemo para recalcular quando preferences mudar (TEMPO REAL)
  const sidebarClasses = useMemo(() => {
    const baseClasses = 'bg-sidebar border border-sidebar-border z-50 transition-all duration-300 flex';
    
    if (effectiveMode === 'floating' && !isMobile) {
      return cn(
        baseClasses,
        'fixed rounded-lg shadow-lg',
        'w-64 h-[600px] max-h-[90vh]',
        isDragging && 'cursor-grabbing select-none',
        !isDragging && 'cursor-default'
      );
    }

    // Modo fixo - GARANTIR VISIBILIDADE
    // Adaptar layout baseado na posição
    const positionClasses = {
      left: 'fixed inset-y-0 left-0 w-64 z-50',
      right: 'fixed inset-y-0 right-0 w-64 z-50',
      top: 'fixed inset-x-0 top-0 h-auto max-h-[400px] z-50',
      bottom: 'fixed inset-x-0 bottom-0 h-auto max-h-[400px] z-50',
    };

    // No desktop modo fixo, sempre visível. No mobile, usar transform
    const transformClasses = isMobile
      ? {
          left: isOpen ? 'translate-x-0' : '-translate-x-full',
          right: isOpen ? 'translate-x-0' : 'translate-x-full',
          top: isOpen ? 'translate-y-0' : '-translate-y-full',
          bottom: isOpen ? 'translate-y-0' : 'translate-y-full',
        }
      : {
          left: 'translate-x-0',
          right: 'translate-x-0',
          top: 'translate-y-0',
          bottom: 'translate-y-0',
        };
    
    // Garantir que no desktop o sidebar sempre apareça (persistente)
    // Forçar visibilidade com !important através de classes específicas
    const visibilityClass = isMobile 
      ? '' 
      : 'opacity-100 visible block !z-50';

    return cn(
      baseClasses,
      positionClasses[effectivePosition],
      transformClasses[effectivePosition],
      visibilityClass
    );
  }, [effectiveMode, effectivePosition, isMobile, isOpen, isDragging, preferences.position, preferences.mode]);

  // Classes para conteúdo principal (ajustar margem quando sidebar fixa)
  const getMainContentClasses = () => {
    if (effectiveMode === 'floating' || isMobile) {
      return '';
    }

    const marginClasses = {
      left: 'lg:ml-64',
      right: 'lg:mr-64',
      top: 'lg:mt-64',
      bottom: 'lg:mb-64',
    };

    return marginClasses[effectivePosition];
  };

  // Debug: Verificar se sidebar está sendo renderizada (apenas em desenvolvimento)
  // IMPORTANTE: Este hook deve ser chamado SEMPRE (antes de qualquer return condicional)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && !isMobile && sidebarRef.current) {
      console.log('[DynamicSidebar] ✅ Sidebar renderizada no desktop:', {
        isMobile,
        isOpen,
        effectiveMode,
        effectivePosition,
        modulesCount: sidebarModules.length,
        elementVisible: sidebarRef.current.offsetWidth > 0,
        computedStyle: window.getComputedStyle(sidebarRef.current).display,
      });
    }
  }, [isMobile, isOpen, effectiveMode, effectivePosition, sidebarModules.length]);

  // Lógica de renderização:
  // - Desktop: SEMPRE renderizar (sidebar persistente)
  // - Mobile: renderizar apenas se aberto (overlay)
  // Nota: O return null deve vir DEPOIS de todos os hooks para não violar as regras dos Hooks
  if (isMobile && !isOpen) {
    return null;
  }

  return (
    <>
      {/* Overlay para mobile */}
      {isOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar - FORÇAR VISIBILIDADE NO DESKTOP */}
      <aside
        ref={sidebarRef}
        key={`sidebar-${effectivePosition}-${effectiveMode}`}
        className={sidebarClasses}
        style={{
          ...(effectiveMode === 'floating' && !isMobile
            ? {
                left: '20px',
                top: '20px',
              }
            : {}),
          // Garantir que sidebar seja sempre visível no desktop
          ...(isMobile ? {} : { display: 'flex', visibility: 'visible', opacity: 1 }),
        }}
      >
        {/* Container adaptável: vertical para left/right, horizontal para top/bottom */}
        <div className={cn(
          'flex',
          (effectivePosition === 'top' || effectivePosition === 'bottom') 
            ? 'flex-row items-center w-full h-full' 
            : 'flex-col h-full w-full'
        )}>
          {/* Header compacto - Adaptável */}
          <div className={cn(
            'flex items-center gap-2 px-4 border-sidebar-border relative',
            (effectivePosition === 'top' || effectivePosition === 'bottom')
              ? 'h-full border-r flex-shrink-0 min-w-[200px]'
              : 'h-14 border-b w-full'
          )}>
            {effectiveMode === 'floating' && !isMobile && (
              <div
                ref={dragHandleRef}
                className="absolute left-0 top-0 bottom-0 w-8 cursor-grab active:cursor-grabbing flex items-center justify-center hover:bg-sidebar-accent/50 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (sidebarRef.current) {
                    const rect = sidebarRef.current.getBoundingClientRect();
                    setIsDragging(true);
                    setDragOffset({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                    });
                  }
                }}
              >
                <Move className="h-4 w-4 text-sidebar-foreground/40" />
              </div>
            )}

            {/* Logo */}
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={institutionName || 'DSICOLA'}
                className="h-8 w-8 sm:h-10 sm:w-10 object-contain rounded-xl"
              />
            ) : (
              <div className="h-8 w-8 sm:h-10 sm:w-10 bg-sidebar-primary rounded-lg flex items-center justify-center">
                <span className="text-sidebar-primary-foreground font-bold text-sm">D</span>
              </div>
            )}

            <div className={cn(
              'min-w-0',
              (effectivePosition === 'top' || effectivePosition === 'bottom')
                ? 'flex-1'
                : 'flex-1'
            )}>
              <h1 className={cn(
                'font-semibold text-sidebar-foreground truncate',
                (effectivePosition === 'top' || effectivePosition === 'bottom')
                  ? 'text-xs'
                  : 'text-sm'
              )}>{institutionName || 'DSICOLA'}</h1>
              {(effectivePosition === 'left' || effectivePosition === 'right') && (
                <p className="text-[10px] text-sidebar-foreground/60 truncate">{roleLabel}</p>
              )}
            </div>

            {/* Configurações da Sidebar - Desktop (Multi-tenant) */}
            {!isMobile && (
              <SidebarSettings className="text-sidebar-foreground/70 hover:text-sidebar-foreground ml-auto" />
            )}

            {/* Botão fechar (mobile) */}
            {isMobile && (
              <button
                onClick={onClose}
                className="lg:hidden p-1.5 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Navigation - Módulos de Alto Nível - Adaptável */}
          <nav className={cn(
            'overflow-auto p-2',
            (effectivePosition === 'top' || effectivePosition === 'bottom')
              ? 'flex-1 flex flex-row items-center gap-1 overflow-x-auto overflow-y-hidden'
              : 'flex-1 flex flex-col'
          )}>
            {/* Botão Voltar ao Dashboard - Mostrar quando estiver dentro de módulo - Adaptável */}
            {isInsideModule && (
              <button
                onClick={() => {
                  navigate(dashboardPath);
                  if (isMobile) onClose();
                }}
                className={cn(
                  'flex items-center gap-2 rounded-md transition-all duration-150',
                  'hover:bg-sidebar-accent/50 active:scale-[0.98]',
                  'text-sidebar-foreground/80 hover:text-sidebar-foreground font-medium border border-sidebar-border/50',
                  (effectivePosition === 'top' || effectivePosition === 'bottom')
                    ? 'px-2 py-1 text-xs whitespace-nowrap mb-0'
                    : 'w-full gap-2.5 px-2.5 py-2 text-sm mb-2'
                )}
              >
                <ArrowLeft className={cn(
                  'shrink-0 text-sidebar-foreground/70',
                  (effectivePosition === 'top' || effectivePosition === 'bottom')
                    ? 'h-3 w-3'
                    : 'h-4 w-4'
                )} />
                <span className={cn(
                  'truncate',
                  (effectivePosition === 'top' || effectivePosition === 'bottom')
                    ? 'text-left'
                    : 'text-left'
                )}>Voltar</span>
              </button>
            )}
            
            {sidebarModules.length === 0 ? (
              <div className={cn(
                'text-sidebar-foreground/60 text-xs p-4',
                (effectivePosition === 'top' || effectivePosition === 'bottom')
                  ? 'text-center whitespace-nowrap'
                  : 'text-center'
              )}>
                Nenhum módulo disponível
              </div>
            ) : (
              <div className={cn(
                (effectivePosition === 'top' || effectivePosition === 'bottom')
                  ? 'flex flex-row items-center gap-1'
                  : 'space-y-0.5'
              )}>
                {sidebarModules.map((module) => {
                  const Icon = module.icon;
                  // Verificar se está ativo: path exato ou dentro do módulo
                  // Para SUPER_ADMIN, verificar também query params (tab)
                  const modulePath = module.path.split('?')[0];
                  const moduleSearch = module.path.includes('?') ? module.path.split('?')[1] : '';
                  const isActive =
                    location.pathname === modulePath &&
                    (moduleSearch ? location.search.includes(moduleSearch) : true) ||
                    (module.label !== 'Dashboard' && location.pathname.startsWith(modulePath + '/')) ||
                    (module.label === 'Dashboard' && isOnDashboard);

                  const isHorizontal = effectivePosition === 'top' || effectivePosition === 'bottom';

                  return (
                    <button
                      key={module.path}
                      onClick={() => {
                        navigate(module.path);
                        if (isMobile) onClose();
                      }}
                      title={module.description || module.label}
                      className={cn(
                        'flex items-center gap-2 rounded-md transition-all duration-150',
                        'hover:bg-sidebar-accent/50 active:scale-[0.98]',
                        isHorizontal
                          ? 'flex-row px-3 py-1.5 text-xs whitespace-nowrap'
                          : 'flex-row w-full gap-2.5 px-2.5 py-2 text-sm',
                        isActive
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm font-semibold'
                          : 'text-sidebar-foreground/80 hover:text-sidebar-foreground font-medium'
                      )}
                    >
                      <Icon className={cn(
                        'shrink-0',
                        isHorizontal ? 'h-3.5 w-3.5' : 'h-4 w-4',
                        isActive ? 'text-sidebar-primary-foreground' : 'text-sidebar-foreground/70'
                      )} />
                      <span className={cn(
                        'truncate',
                        isHorizontal ? 'text-left' : 'text-left'
                      )}>{module.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </nav>

          {/* User section - Compacto - Adaptável */}
          <div className={cn(
            'border-sidebar-border p-2',
            (effectivePosition === 'top' || effectivePosition === 'bottom')
              ? 'border-l flex-shrink-0 h-full flex items-center'
              : 'border-t w-full'
          )}>
            {(effectivePosition === 'top' || effectivePosition === 'bottom') ? (
              <div className="flex items-center gap-2">
                {userSection}
              </div>
            ) : (
              userSection
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

