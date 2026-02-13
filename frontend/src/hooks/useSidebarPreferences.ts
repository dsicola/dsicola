import { useState, useEffect, useCallback, useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { InstituicaoContext } from '@/contexts/InstituicaoContext';

export type SidebarPosition = 'left' | 'right' | 'top' | 'bottom';
export type SidebarMode = 'fixed' | 'floating';

export interface SidebarPreferences {
  position: SidebarPosition;
  mode: SidebarMode;
}

const DEFAULT_PREFERENCES: SidebarPreferences = {
  position: 'left',
  mode: 'fixed',
};

/**
 * Hook para gerenciar preferências de sidebar com suporte multi-tenant
 * 
 * Prioridade:
 * 1. Preferências do usuário por instituição (localStorage)
 * 2. Configuração da instituição (futuro: backend)
 * 3. Padrão do sistema
 * 
 * Multi-tenant: Cada instituição tem suas próprias preferências
 */
export function useSidebarPreferences() {
  // Usar useContext diretamente para evitar erro se o contexto não estiver disponível
  // Isso permite que o hook funcione mesmo durante a inicialização
  const authContext = useContext(AuthContext);
  const instituicaoContext = useContext(InstituicaoContext);
  
  const user = authContext?.user || null;
  const config = instituicaoContext?.config || null;
  const tipoAcademico = instituicaoContext?.tipoAcademico || null;
  const [preferences, setPreferences] = useState<SidebarPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  // Gerar chave de storage baseada na instituição (multi-tenant)
  const getStorageKey = useCallback(() => {
    const instituicaoId = user?.instituicao_id || config?.instituicao_id || 'default';
    const tipoAcademicoKey = tipoAcademico ? `_${tipoAcademico}` : '';
    return `dsicola_sidebar_preferences_${instituicaoId}${tipoAcademicoKey}`;
  }, [user?.instituicao_id, config?.instituicao_id, tipoAcademico]);

  // Carregar preferências do localStorage (por instituição)
  const loadPreferences = useCallback(() => {
    try {
      const storageKey = getStorageKey();
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as SidebarPreferences;
        // Validar valores
        if (
          ['left', 'right', 'top', 'bottom'].includes(parsed.position) &&
          ['fixed', 'floating'].includes(parsed.mode)
        ) {
          setPreferences(parsed);
          setIsLoading(false);
          return;
        }
      }
    } catch (error) {
      console.warn('[useSidebarPreferences] Erro ao carregar preferências:', error);
    }
    
    // Usar padrão se não houver preferências salvas
    setPreferences(DEFAULT_PREFERENCES);
    setIsLoading(false);
  }, [getStorageKey]);

  // Salvar preferências no localStorage (por instituição)
  const savePreferences = useCallback((newPreferences: SidebarPreferences) => {
    try {
      const storageKey = getStorageKey();
      localStorage.setItem(storageKey, JSON.stringify(newPreferences));
      // Atualizar estado imediatamente para refletir mudanças em tempo real
      setPreferences(newPreferences);
      
      // Disparar evento customizado para notificar outros componentes
      window.dispatchEvent(new CustomEvent('sidebarPreferencesChanged', {
        detail: newPreferences
      }));
      
      // TODO: Salvar no backend quando endpoint estiver disponível
      // if (user?.id && user?.instituicao_id) {
      //   await userApi.updatePreferences({ 
      //     instituicaoId: user.instituicao_id,
      //     sidebar: newPreferences 
      //   });
      // }
    } catch (error) {
      console.error('[useSidebarPreferences] Erro ao salvar preferências:', error);
    }
  }, [getStorageKey]);

  // Atualizar posição (usar função de atualização para evitar closure stale)
  const setPosition = useCallback((position: SidebarPosition) => {
    setPreferences((current) => {
      const newPrefs = { ...current, position };
      // Salvar no localStorage imediatamente
      const storageKey = getStorageKey();
      try {
        localStorage.setItem(storageKey, JSON.stringify(newPrefs));
        // Disparar evento customizado para notificar outros componentes
        window.dispatchEvent(new CustomEvent('sidebarPreferencesChanged', {
          detail: newPrefs
        }));
      } catch (error) {
        console.error('[useSidebarPreferences] Erro ao salvar posição:', error);
      }
      return newPrefs;
    });
  }, [getStorageKey]);

  // Atualizar modo (usar função de atualização para evitar closure stale)
  const setMode = useCallback((mode: SidebarMode) => {
    setPreferences((current) => {
      const newPrefs = { ...current, mode };
      // Salvar no localStorage imediatamente
      try {
        const storageKey = getStorageKey();
        localStorage.setItem(storageKey, JSON.stringify(newPrefs));
        // Disparar evento customizado para notificar outros componentes
        window.dispatchEvent(new CustomEvent('sidebarPreferencesChanged', {
          detail: newPrefs
        }));
      } catch (error) {
        console.error('[useSidebarPreferences] Erro ao salvar modo:', error);
      }
      return newPrefs;
    });
  }, [getStorageKey]);

  // Resetar para padrão
  const resetPreferences = useCallback(() => {
    savePreferences(DEFAULT_PREFERENCES);
  }, [savePreferences]);

  // Carregar preferências na montagem e quando instituição mudar
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences, user?.instituicao_id, tipoAcademico]);

  return {
    preferences,
    isLoading,
    setPosition,
    setMode,
    setPreferences: savePreferences,
    resetPreferences,
  };
}

