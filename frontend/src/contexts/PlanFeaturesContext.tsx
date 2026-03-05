import React, { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { statsApi } from '@/services/api';

export interface PlanFeatures {
  funcionalidades: string[];
  multiCampus: boolean;
  planoNome: string;
  isLoading: boolean;
}

interface PlanFeaturesContextType extends PlanFeatures {
  /** Verifica se o plano inclui a funcionalidade (case-insensitive) */
  hasFeature: (key: string) => boolean;
  /** Verifica se o plano inclui multiCampus (plano + config) */
  hasMultiCampus: boolean;
}

const PlanFeaturesContext = createContext<PlanFeaturesContextType | undefined>(undefined);

export const usePlanFeatures = () => {
  const context = useContext(PlanFeaturesContext);
  if (!context) {
    throw new Error('usePlanFeatures must be used within PlanFeaturesProvider');
  }
  return context;
};

/** Hook seguro: retorna null se fora do provider ou SUPER_ADMIN (não precisa de features) */
export const usePlanFeaturesOptional = () => {
  const context = useContext(PlanFeaturesContext);
  return context ?? null;
};

interface PlanFeaturesProviderProps {
  children: React.ReactNode;
}

/**
 * Provider de funcionalidades do plano da instituição.
 * - SUPER_ADMIN: não busca (vê tudo)
 * - Sem instituição: valores vazios
 * - ADMIN/outros: busca via /stats/uso-instituicao
 */
export const PlanFeaturesProvider: React.FC<PlanFeaturesProviderProps> = ({ children }) => {
  const { user, role } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['plan-features', 'uso-instituicao'],
    queryFn: async () => {
      const res = await statsApi.getUsoInstituicao();
      return res as {
        funcionalidades?: string[];
        multiCampus?: boolean;
        plano_nome?: string;
      };
    },
    staleTime: 60_000, // 1 min
    retry: 1,
    // Apenas quando autenticado e não SUPER_ADMIN (sidebar usa getSuperAdminModules)
    enabled: !!user && role !== 'SUPER_ADMIN' && role !== 'COMERCIAL',
  });

  const value = useMemo<PlanFeaturesContextType>(() => {
    const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'COMERCIAL';
    const funcionalidades = Array.isArray(data?.funcionalidades)
      ? data.funcionalidades.map((f) => String(f).toLowerCase())
      : [];
    const multiCampus = Boolean(data?.multiCampus);

    const hasFeature = (key: string): boolean => {
      if (isSuperAdmin) return true;
      return funcionalidades.includes(key.toLowerCase());
    };

    return {
      funcionalidades,
      multiCampus,
      planoNome: data?.plano_nome ?? 'Sem plano',
      isLoading: isLoading ?? false,
      hasFeature,
      hasMultiCampus: isSuperAdmin || multiCampus,
    };
  }, [data, isLoading, role]);

  return (
    <PlanFeaturesContext.Provider value={value}>
      {children}
    </PlanFeaturesContext.Provider>
  );
};
