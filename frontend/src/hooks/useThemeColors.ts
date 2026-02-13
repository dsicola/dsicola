import { useEffect } from 'react';

// Convert hex to HSL values
function hexToHSL(hex: string): { h: number; s: number; l: number } | null {
  hex = hex.replace(/^#/, '');
  if (hex.length !== 6) return null;
  
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function adjustLightness(hsl: { h: number; s: number; l: number }, amount: number) {
  return {
    ...hsl,
    l: Math.max(0, Math.min(100, hsl.l + amount)),
  };
}

const formatHSL = (color: { h: number; s: number; l: number }) => 
  `${color.h} ${color.s}% ${color.l}%`;

export interface ThemeColors {
  primary?: string;
  secondary?: string;
  tertiary?: string;
}

// Function to apply theme colors to CSS variables
export function applyThemeColors(colors: ThemeColors): void {
  const root = document.documentElement;

  // Apply Primary Color
  if (colors.primary) {
    const hsl = hexToHSL(colors.primary);
    if (hsl) {
      const primaryHSL = formatHSL(hsl);
      const lighter10 = adjustLightness(hsl, 10);
      const lighter20 = adjustLightness(hsl, 20);
      const lighter30 = adjustLightness(hsl, 30);
      const lighter50 = adjustLightness(hsl, 50);
      const darker10 = adjustLightness(hsl, -10);
      const darker20 = adjustLightness(hsl, -20);
      const darker30 = adjustLightness(hsl, -30);
      
      // Cor de destaque: versão mais clara e vibrante da primária
      const accentHSL = { 
        h: hsl.h, 
        s: Math.min(100, hsl.s + 10), // Aumentar saturação ligeiramente
        l: Math.min(95, hsl.l + 15) // Mais claro para destaque
      };
      const lightAccent = { h: hsl.h, s: Math.max(20, hsl.s - 20), l: 95 };

      root.style.setProperty('--primary', primaryHSL);
      root.style.setProperty('--primary-foreground', formatHSL(lighter50));
      root.style.setProperty('--ring', primaryHSL);
      root.style.setProperty('--accent', formatHSL(accentHSL));
      root.style.setProperty('--accent-foreground', formatHSL(darker30));
      root.style.setProperty('--sidebar-primary', primaryHSL);
      root.style.setProperty('--sidebar-primary-foreground', formatHSL(lighter50));
      root.style.setProperty('--sidebar-accent', formatHSL(lighter10));
      root.style.setProperty('--sidebar-accent-foreground', formatHSL(darker20));
      root.style.setProperty('--sidebar-ring', primaryHSL);
      root.style.setProperty('--chart-1', primaryHSL);
      root.style.setProperty('--chart-2', formatHSL(lighter20));
      root.style.setProperty('--chart-3', formatHSL(darker10));
      root.style.setProperty('--chart-4', formatHSL(lighter30));
      root.style.setProperty('--chart-5', formatHSL(darker20));
      root.style.setProperty(
        '--gradient-primary',
        `linear-gradient(135deg, hsl(${primaryHSL}) 0%, hsl(${formatHSL(lighter20)}) 100%)`
      );
      root.style.setProperty(
        '--gradient-hero',
        `linear-gradient(135deg, hsl(${formatHSL(darker20)}) 0%, hsl(${primaryHSL}) 50%, hsl(${formatHSL(lighter20)}) 100%)`
      );
      root.style.setProperty('--shadow-glow', `0 0 30px hsl(${primaryHSL} / 0.3)`);
      root.style.setProperty('--shadow-primary', `0 4px 14px 0 hsl(${primaryHSL} / 0.25)`);
    }
  }

  // Apply Secondary Color (text/foreground)
  if (colors.secondary) {
    const hsl = hexToHSL(colors.secondary);
    if (hsl) {
      const secondaryHSL = formatHSL(hsl);
      const lighter20 = adjustLightness(hsl, 20);
      const lighter40 = adjustLightness(hsl, 40);
      const darker20 = adjustLightness(hsl, -20);

      root.style.setProperty('--foreground', secondaryHSL);
      root.style.setProperty('--card-foreground', secondaryHSL);
      root.style.setProperty('--popover-foreground', secondaryHSL);
      root.style.setProperty('--secondary-foreground', secondaryHSL);
      root.style.setProperty('--muted-foreground', formatHSL(lighter20));
      root.style.setProperty('--sidebar-foreground', secondaryHSL);
    }
  }

  // Apply Tertiary Color (background)
  if (colors.tertiary) {
    const hsl = hexToHSL(colors.tertiary);
    if (hsl) {
      const tertiaryHSL = formatHSL(hsl);
      const slightlyDarker = adjustLightness(hsl, -3);
      const darker5 = adjustLightness(hsl, -5);
      const darker10 = adjustLightness(hsl, -10);

      root.style.setProperty('--background', tertiaryHSL);
      root.style.setProperty('--card', formatHSL(slightlyDarker));
      root.style.setProperty('--popover', formatHSL(slightlyDarker));
      root.style.setProperty('--muted', formatHSL(darker5));
      root.style.setProperty('--secondary', formatHSL(darker10));
      root.style.setProperty('--sidebar-background', formatHSL(slightlyDarker));
      root.style.setProperty('--sidebar-border', formatHSL(darker10));
    }
  }
}

// Legacy single-color function for backward compatibility
export function applyThemeColor(hexColor: string): void {
  applyThemeColors({ primary: hexColor });
}

// Function to reset theme colors to defaults
export function resetThemeColors(): void {
  const cssVars = [
    '--primary', '--primary-foreground', '--ring',
    '--accent', '--accent-foreground',
    '--foreground', '--card-foreground', '--popover-foreground',
    '--secondary-foreground', '--muted-foreground',
    '--background', '--card', '--popover', '--muted', '--secondary',
    '--sidebar-primary', '--sidebar-primary-foreground',
    '--sidebar-accent', '--sidebar-accent-foreground', '--sidebar-ring',
    '--sidebar-foreground', '--sidebar-background', '--sidebar-border',
    '--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5',
    '--gradient-primary', '--gradient-hero',
    '--shadow-glow', '--shadow-primary'
  ];
  cssVars.forEach(v => document.documentElement.style.removeProperty(v));
}

// Hook that applies theme based on institution config
export function useThemeColors(colors?: ThemeColors) {
  useEffect(() => {
    if (colors && (colors.primary || colors.secondary || colors.tertiary)) {
      applyThemeColors(colors);
    }

    return () => {
      if (!colors) {
        resetThemeColors();
      }
    };
  }, [colors?.primary, colors?.secondary, colors?.tertiary]);
}
