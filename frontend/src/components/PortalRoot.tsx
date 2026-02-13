import * as React from 'react';
import { useEffect } from 'react';

/**
 * PortalRoot - Container único e estável para todos os portals da aplicação
 * 
 * REGRAS ABSOLUTAS:
 * - Deve existir UMA ÚNICA VEZ no topo da aplicação
 * - NUNCA pode estar dentro de páginas, layouts, rotas, providers ou condicionais
 * - NUNCA pode ser desmontado
 * - Garante que o container portal-root existe e está acessível
 * - 100% idempotente - seguro para qualquer cenário de montagem
 * 
 * Este componente não renderiza nada - apenas garante que o container existe
 * e inicializa a referência para uso pelos componentes de UI.
 * 
 * NOTA: StrictMode foi removido do projeto para evitar double-mount que causava
 * erros Node.removeChild. Esta alteração é segura pois StrictMode não existe em produção.
 */

// Flag global para garantir inicialização única
// Usa variável de módulo (não ref) para persistir entre re-montagens
let globalPortalRootInitialized = false;

export const PortalRoot: React.FC = () => {
  useEffect(() => {
    // Garantir que o container portal-root existe (100% idempotente)
    // Flag global previne re-execução mesmo em qualquer cenário de montagem
    if (typeof document !== 'undefined' && !globalPortalRootInitialized) {
      let container = document.getElementById('portal-root');
      
      // Se não existe, criar (fallback de segurança)
      // O container já deve existir no index.html, mas garantimos aqui
      if (!container) {
        container = document.createElement('div');
        container.id = 'portal-root';
        document.body.appendChild(container);
      }
      
      // Marcar como inicializado globalmente (evita re-execução)
      globalPortalRootInitialized = true;
    }

    // Cleanup: NÃO fazer nada - o container deve persistir permanentemente
    // Este componente nunca deve ser desmontado, mas se for, o container permanece
    // NÃO resetar flag global - deve permanecer inicializado
    return () => {
      // Container permanece no DOM - NUNCA remover
      // Flag global permanece true - não resetar
    };
  }, []); // Array vazio - executa apenas uma vez por montagem

  // Componente não renderiza nada - apenas garante inicialização
  return null;
};

/**
 * Hook para obter o container portal-root de forma segura e SÍNCRONA
 * Usado pelos componentes de UI para configurar seus portals
 * 
 * IMPORTANTE: Retorna o container de forma síncrona para evitar problemas
 * de timing com Radix UI que precisa do container imediatamente.
 * 
 * @returns HTMLElement | null - Container portal-root ou null se não disponível
 */
export const usePortalContainer = (): HTMLElement | null => {
  // Usar estado para garantir que o container seja obtido de forma síncrona
  const [container, setContainer] = React.useState<HTMLElement | null>(() => {
    // Inicialização síncrona - buscar container imediatamente
    if (typeof document !== 'undefined') {
      let portalContainer = document.getElementById('portal-root');
      
      // Se não existe, criar imediatamente (fallback de segurança)
      if (!portalContainer) {
        portalContainer = document.createElement('div');
        portalContainer.id = 'portal-root';
        document.body.appendChild(portalContainer);
      }
      
      return portalContainer;
    }
    return null;
  });

  useEffect(() => {
    // Garantir que o container existe após mount
    if (typeof document !== 'undefined') {
      let portalContainer = document.getElementById('portal-root');
      
      if (!portalContainer) {
        portalContainer = document.createElement('div');
        portalContainer.id = 'portal-root';
        document.body.appendChild(portalContainer);
      }
      
      // Atualizar estado apenas se mudou (evita re-renders desnecessários)
      if (portalContainer !== container) {
        setContainer(portalContainer);
      }
    }
  }, [container]);

  // Retornar container de forma síncrona
  return container;
};
