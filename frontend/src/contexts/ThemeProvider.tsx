import React, { createContext, useContext, useEffect } from 'react';
import { useInstituicao } from './InstituicaoContext';
import { applyThemeColors, resetThemeColors } from '@/hooks/useThemeColors';
import { getDefaultColorsByTipoAcademico } from '@/utils/defaultColors';

interface ThemeContextType {
  // Context apenas para acesso, as cores são aplicadas automaticamente
  primaryColor: string | null;
  secondaryColor: string | null;
  tertiaryColor: string | null;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

/**
 * ThemeProvider - Aplica cores da instituição globalmente
 * 
 * Este provider:
 * 1. Busca cores da instituição do contexto InstituicaoContext
 * 2. Aplica cores personalizadas se existirem
 * 3. Caso contrário, aplica cores padrão baseadas no tipo acadêmico
 * 4. Aplica as cores globalmente via CSS variables
 * 5. Reaplica quando a instituição ou cores mudam
 * 6. Atualiza imediatamente sem necessidade de refresh
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { config, tipoAcademico, loading } = useInstituicao();

  useEffect(() => {
    // Não aplicar cores enquanto está carregando
    if (loading) {
      return;
    }

    // Obter cores padrão baseadas no tipo acadêmico
    const defaultColors = getDefaultColorsByTipoAcademico(tipoAcademico || null);

    // Priorizar cores personalizadas, caso contrário usar padrão
    // Se config existe mas não tem cores, usar padrão do tipo acadêmico
    const primaryColor = config?.cor_primaria || defaultColors.cor_primaria;
    const secondaryColor = config?.cor_secundaria || defaultColors.cor_secundaria;
    const tertiaryColor = config?.cor_terciaria || defaultColors.cor_terciaria;

    // Aplicar cores globalmente - sempre aplicar, mesmo que sejam padrão
    // Isso garante que as cores sejam aplicadas imediatamente
    applyThemeColors({
      primary: primaryColor,
      secondary: secondaryColor,
      tertiary: tertiaryColor,
    });

    // Forçar re-render de componentes que dependem das cores
    // Disparando um evento customizado para notificar mudanças de tema
    window.dispatchEvent(new CustomEvent('theme-colors-updated', {
      detail: { primaryColor, secondaryColor, tertiaryColor }
    }));
  }, [config?.cor_primaria, config?.cor_secundaria, config?.cor_terciaria, tipoAcademico, loading]);

  // Resetar cores se não houver instituição configurada
  useEffect(() => {
    if (!loading && !config && !tipoAcademico) {
      resetThemeColors();
    }
  }, [loading, config, tipoAcademico]);

  const value: ThemeContextType = {
    primaryColor: config?.cor_primaria || null,
    secondaryColor: config?.cor_secundaria || null,
    tertiaryColor: config?.cor_terciaria || null,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

