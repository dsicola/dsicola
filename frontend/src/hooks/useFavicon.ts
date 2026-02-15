import { useEffect } from 'react';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { useTenant } from '@/contexts/TenantContext';
import { API_URL } from '@/services/api';

/** Favicon padrão DSICOLA (profissional) - usado no domínio principal e como fallback */
const DEFAULT_FAVICON = '/favicon.svg';

/**
 * Hook para aplicar dinamicamente o favicon no <head> do HTML
 * - Domínio principal (dsicola.com): favicon DSICOLA profissional
 * - Subdomínio instituição: favicon da instituição (se configurado) ou fallback DSICOLA
 * Respeita isolamento multi-tenant - cada instituição pode ter seu próprio favicon
 * O favicon da instituição é carregado mesmo antes do login (via API pública por subdomínio)
 */
export function useFavicon() {
  const { config } = useInstituicao();
  const { configuracao } = useTenant();

  useEffect(() => {
    // Prioridade: config da instituição (logado) > configuracao pública (subdomínio) > default DSICOLA
    let faviconUrl =
      config?.favicon_url ||
      config?.faviconUrl ||
      configuracao?.favicon_url ||
      configuracao?.faviconUrl ||
      null;

    // Converter URL relativa em absoluta (uploads estão no backend)
    if (faviconUrl && typeof faviconUrl === 'string' && faviconUrl.startsWith('/')) {
      faviconUrl = `${API_URL.replace(/\/$/, '')}${faviconUrl}`;
    }

    // Fallback: favicon profissional DSICOLA (evita Lovable ou ícone genérico)
    if (!faviconUrl) {
      faviconUrl = DEFAULT_FAVICON;
    }

    // Buscar e remover links de favicon existentes
    const existingLinks = document.querySelectorAll("link[rel*='icon']");
    existingLinks.forEach((link) => {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
    });

    // Criar novo link para o favicon
    const link = document.createElement('link');
    link.rel = 'icon';

    // Determinar o tipo MIME baseado na extensão ou URL
    if (faviconUrl.endsWith('.svg')) {
      link.type = 'image/svg+xml';
    } else if (faviconUrl.endsWith('.ico')) {
      link.type = 'image/x-icon';
    } else {
      link.type = 'image/png';
    }

    link.href = faviconUrl;

    // Handler silencioso para erros: ao falhar, restaurar favicon DSICOLA
    const handleError = () => {
      if (link && link.parentNode) {
        link.parentNode.removeChild(link);
      }
      // Restaurar favicon padrão se o da instituição falhou
      if (faviconUrl && faviconUrl !== DEFAULT_FAVICON) {
        const fallbackLink = document.createElement('link');
        fallbackLink.rel = 'icon';
        fallbackLink.type = 'image/svg+xml';
        fallbackLink.href = DEFAULT_FAVICON;
        document.head.appendChild(fallbackLink);
      }
    };

    link.addEventListener('error', handleError);
    document.head.appendChild(link);

    return () => {
      link.removeEventListener('error', handleError);
      if (link && link.parentNode) {
        link.parentNode.removeChild(link);
      }
    };
  }, [
    config?.favicon_url,
    config?.faviconUrl,
    configuracao?.favicon_url,
    configuracao?.faviconUrl,
  ]);
}
