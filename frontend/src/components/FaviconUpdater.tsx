import { useFavicon } from '@/hooks/useFavicon';

/**
 * Componente invisível que aplica o favicon da instituição
 * Deve ser renderizado dentro do InstituicaoProvider
 */
export function FaviconUpdater() {
  useFavicon();
  return null;
}

