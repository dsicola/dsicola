import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/auth';
import { GraduationCap, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { clearTokens, usersApi, onboardingApi } from '@/services/api';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { user, role, loading, signOut } = useAuth();
  const location = useLocation();
  const [checkingInadimplencia, setCheckingInadimplencia] = useState(true);
  const [isInadimplente, setIsInadimplente] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [onboardingConcluido, setOnboardingConcluido] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true; // Flag para evitar atualizações após desmontagem

    const checkInadimplencia = async () => {
      if (user && role === 'ALUNO') {
        try {
          const userData = await usersApi.getById(user.id);
          if (isMounted) {
            if (userData?.statusAluno === 'Inativo por inadimplência') {
              setIsInadimplente(true);
            } else {
              setIsInadimplente(false);
            }
          }
        } catch (err) {
          console.error('Error checking inadimplencia:', err);
          // Em caso de erro, assumir que não está inadimplente para não bloquear acesso
          if (isMounted) {
            setIsInadimplente(false);
          }
        } finally {
          if (isMounted) {
            setCheckingInadimplencia(false);
          }
        }
      } else {
        if (isMounted) {
          setCheckingInadimplencia(false);
        }
      }
    };

    if (!loading && user) {
      checkInadimplencia().catch((err) => {
        // Tratar qualquer erro não capturado
        console.error('Erro não tratado em checkInadimplencia:', err);
        if (isMounted) {
          setCheckingInadimplencia(false);
          setIsInadimplente(false);
        }
      });
    } else if (!loading) {
      if (isMounted) {
        setCheckingInadimplencia(false);
      }
    }

    // Cleanup: marcar como desmontado
    return () => {
      isMounted = false;
    };
  }, [user, role, loading]);

  // Verificar status do onboarding
  useEffect(() => {
    let isMounted = true;

    const checkOnboarding = async () => {
      // Não verificar onboarding para SUPER_ADMIN ou se já está na rota de onboarding
      if (location.pathname === '/onboarding' || role === 'SUPER_ADMIN') {
        if (isMounted) {
          setCheckingOnboarding(false);
          setOnboardingConcluido(true);
        }
        return;
      }

      if (!loading && user && role) {
        try {
          const status = await onboardingApi.getStatus();
          if (isMounted) {
            setOnboardingConcluido(status.onboardingConcluido || false);
          }
        } catch (err) {
          console.error('Error checking onboarding:', err);
          // Em caso de erro, assumir que está concluído para não bloquear acesso
          if (isMounted) {
            setOnboardingConcluido(true);
          }
        } finally {
          if (isMounted) {
            setCheckingOnboarding(false);
          }
        }
      } else if (!loading) {
        if (isMounted) {
          setCheckingOnboarding(false);
        }
      }
    };

    checkOnboarding();

    return () => {
      isMounted = false;
    };
  }, [user, role, loading, location.pathname]);

  // Verificar permissão de acesso
  useEffect(() => {
    if (!loading && user && role && allowedRoles) {
      if (!allowedRoles.includes(role)) {
        const roleNames: Record<string, string> = {
          'SUPER_ADMIN': 'Super Administrador',
          'ADMIN': 'Administrador',
          'SECRETARIA': 'Secretaria',
          'FUNCIONARIO': 'Funcionário',
          'RH': 'Recursos Humanos',
          'FINANCEIRO': 'Financeiro',
          'COMERCIAL': 'Comercial',
          'PROFESSOR': 'Professor',
          'POS': 'Ponto de Venda',
          'RESPONSAVEL': 'Responsável',
          'ALUNO': 'Aluno',
        };
        const currentRoleName = roleNames[role] || role;
        const allowedRoleNames = allowedRoles.map(r => roleNames[r] || r).join(', ');
        setPermissionError(`Seu perfil (${currentRoleName}) não tem permissão para acessar esta página. Perfis permitidos: ${allowedRoleNames}`);
      } else {
        setPermissionError(null);
      }
    }
  }, [loading, user, role, allowedRoles]);

  if (loading || checkingInadimplencia || checkingOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center">
            <GraduationCap className="h-8 w-8 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Verificar se o usuário não tem role definida
  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Perfil não configurado</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-4">
                Seu usuário não possui um perfil de acesso configurado. 
                Entre em contato com o administrador do sistema para que ele atribua um perfil ao seu usuário.
              </p>
              <Button 
                variant="outline" 
                onClick={async () => {
                  await signOut();
                  window.location.href = '/auth';
                }}
              >
                Voltar para Login
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Check for onboarding - redirect to onboarding if not completed
  // Não bloquear SUPER_ADMIN e não redirecionar se já está na rota de onboarding
  if (
    onboardingConcluido === false && 
    role !== 'SUPER_ADMIN' && 
    location.pathname !== '/onboarding'
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  // Check for inadimplência - redirect to blocked page
  if (role === 'ALUNO' && isInadimplente) {
    return <Navigate to="/inadimplencia" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // Redirecionar para o dashboard apropriado com mensagem
    const dashboardRoutes: Record<string, string> = {
      'SUPER_ADMIN': '/super-admin',
      'ADMIN': '/admin-dashboard',
      'PROFESSOR': '/painel-professor',
      'ALUNO': '/painel-aluno',
      'SECRETARIA': '/secretaria-dashboard',
      'FUNCIONARIO': '/secretaria-dashboard',
      'POS': '/ponto-de-venda',
      'RH': '/admin-dashboard/recursos-humanos',
      'FINANCEIRO': '/admin-dashboard/pagamentos',
      'RESPONSAVEL': '/painel-responsavel',
    };

    const targetRoute = dashboardRoutes[role] || '/auth';
    return <Navigate to={targetRoute} replace />;
  }

  return <>{children}</>;
};
