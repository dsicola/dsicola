import { useFavicon } from '@/hooks/useFavicon';

/**
 * Componente invisível que aplica o favicon dinamicamente:
 * - Domínio principal: favicon DSICOLA profissional
 * - Subdomínio instituição: favicon da instituição (se configurado) ou fallback DSICOLA
 * Deve ser renderizado dentro de TenantProvider e InstituicaoProvider
 */
export function FaviconUpdater() {
  useFavicon();
  return null;
}

