import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useMemo } from 'react';

interface TenantFilter {
  instituicaoId: string | null;
  shouldFilter: boolean;
  isSuperAdmin: boolean;
  addFilter: <T extends Record<string, any>>(query: T) => T;
}

/**
 * Hook to get tenant filtering information for queries
 * - SUPER_ADMIN: No filtering, sees all data
 * - ADMIN/others: Filter by their instituicao_id
 */
export const useTenantFilter = (): TenantFilter => {
  const { user, role } = useAuth();
  const { instituicao, isMainDomain } = useTenant();

  return useMemo(() => {
    const isSuperAdmin = role === 'SUPER_ADMIN';
    
    // Get instituicao_id strictly from the authenticated user's profile
    // (tenant branding/subdomain should not dictate data access)
    const instituicaoId = (user as any)?.instituicao_id || null;
    
    // SUPER_ADMIN doesn't need filtering
    const shouldFilter = !isSuperAdmin && !!instituicaoId;

    // Helper function to add filter to Supabase query builder
    const addFilter = <T extends Record<string, any>>(query: T): T => {
      if (shouldFilter && instituicaoId) {
        return (query as any).eq('instituicao_id', instituicaoId);
      }
      return query;
    };

    return {
      instituicaoId,
      shouldFilter,
      isSuperAdmin,
      addFilter,
    };
  }, [user, role, instituicao, isMainDomain]);
};

/**
 * Hook to get the current user's instituicao_id for inserts
 */
export const useCurrentInstituicaoId = (): string | null => {
  const { user } = useAuth();

  return (user as any)?.instituicao_id || null;
};
