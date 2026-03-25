import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanFeatures } from '@/contexts/PlanFeaturesContext';
import { getDashboardPathForRole } from '@/components/layout/sidebar.modules';

/**
 * Gate do módulo **Social** (interação). A chave de plano mantém-se `comunidade` por compatibilidade.
 * Comunidade (descoberta em /comunidade) é pública e não passa por este gate.
 */
export const ComunidadeFeatureGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role, loading: authLoading } = useAuth();
  const { hasFeature, isLoading } = usePlanFeatures();

  if (authLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="animate-spin h-10 w-10 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (role === 'SUPER_ADMIN' || role === 'COMERCIAL') {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="animate-spin h-10 w-10 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!hasFeature('comunidade')) {
    const rawRoles = (user as { roles?: string[] }).roles;
    const userRoles = Array.isArray(rawRoles) ? rawRoles : role ? [role] : [];
    const path = getDashboardPathForRole(userRoles);
    return <Navigate to={path} replace />;
  }

  return <>{children}</>;
};
