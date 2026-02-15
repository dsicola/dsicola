import { useEffect } from 'react';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { API_URL } from '@/services/api';

/**
 * Hook para aplicar dinamicamente o favicon da instituição no <head> do HTML
 * Respeita isolamento multi-tenant - cada instituição tem seu próprio favicon
 * Trata erros de carregamento para evitar ERR_CONNECTION_REFUSED no console
 * URLs relativas (ex: /uploads/...) são convertidas para absolutas com a API
 */
export function useFavicon() {
  const { config } = useInstituicao();

  useEffect(() => {
    let faviconUrl = config?.favicon_url || config?.faviconUrl;
    // Converter URL relativa em absoluta (uploads estão no backend)
    if (faviconUrl && typeof faviconUrl === 'string' && faviconUrl.startsWith('/')) {
      faviconUrl = `${API_URL.replace(/\/$/, '')}${faviconUrl}`;
    }

    // Buscar todos os links de favicon existentes
    const existingLinks = document.querySelectorAll("link[rel*='icon']");
    
    // Remover links existentes para evitar duplicatas
    existingLinks.forEach((link) => {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
    });

    // Se não houver favicon configurado, não criar link
    // Isso evita tentar carregar /favicon.ico que pode não existir
    if (!faviconUrl) {
      return;
    }

    // Criar novo link para o favicon da instituição
    const link = document.createElement('link');
    link.rel = 'icon';
    
    // Determinar o tipo MIME baseado na extensão
    if (faviconUrl.endsWith('.svg')) {
      link.type = 'image/svg+xml';
    } else if (faviconUrl.endsWith('.ico')) {
      link.type = 'image/x-icon';
    } else {
      link.type = 'image/png';
    }
    
    link.href = faviconUrl;
    
    // Handler silencioso para erros de carregamento
    // Remove o link se houver erro para evitar mensagens no console
    const handleError = () => {
      if (link && link.parentNode) {
        link.parentNode.removeChild(link);
      }
    };
    
    link.addEventListener('error', handleError);
    document.head.appendChild(link);

    // Cleanup: remover link e listener ao desmontar ou quando mudar
    return () => {
      link.removeEventListener('error', handleError);
      if (link && link.parentNode) {
        link.parentNode.removeChild(link);
      }
    };
  }, [config?.favicon_url, config?.faviconUrl]);
}

