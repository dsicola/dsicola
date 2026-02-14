import { useEffect } from 'react';

/**
 * Componente de segurança que monitora e remove conteúdo promocional injetado
 * 
 * Detecta e remove elementos que contenham mensagens promocionais indevidas
 * como "DISCOUNT", "STOCK", "LIMITED", etc.
 */
export const PromotionalContentGuard = () => {
  useEffect(() => {
    // Palavras-chave suspeitas que indicam conteúdo promocional
    const promotionalKeywords = [
      'DISCOUNT',
      'STOCK',
      'LIMITED',
      'OFFER',
      'PROMOTION',
      'DEAL',
      'SAVE',
      'COUPON',
      'VOUCHER',
      '56%',
      '% OFF',
      'TODAY ONLY',
      'LIMITED TIME',
      'EXCLUSIVE OFFER',
      'SPECIAL PRICE',
    ];

    // Função para verificar se um elemento é do Radix UI (legítimo)
    const isRadixUIElement = (element: Element): boolean => {
      // Verificar se o elemento ou seus ancestrais têm IDs do Radix UI
      let current: Element | null = element;
      while (current) {
        const id = current.id?.toLowerCase() || '';
        if (id.startsWith('radix-')) {
          return true;
        }
        current = current.parentElement;
      }
      return false;
    };

    // Overlay legítimo do Dialog/Sheet (Radix + shadcn): fixed inset-0 z-50 bg-black, data-state
    const isLegitimateDialogOverlay = (element: Element): boolean => {
      if (element.nodeName !== 'DIV') return false;
      const cn = element.className?.toString() || '';
      const hasOverlayPattern = cn.includes('fixed') && cn.includes('inset-0') && (cn.includes('bg-black') || cn.includes('bg-black/'));
      const hasDataState = element.hasAttribute('data-state');
      return hasOverlayPattern && hasDataState;
    };

    // Função para verificar se um elemento contém conteúdo promocional
    const containsPromotionalContent = (element: Element): boolean => {
      const text = element.textContent?.toUpperCase() || '';
      const innerHTML = element.innerHTML?.toUpperCase() || '';
      
      // Verificar se o texto ou HTML contém palavras-chave promocionais
      return promotionalKeywords.some(keyword => 
        text.includes(keyword) || innerHTML.includes(keyword)
      );
    };

    // Função para verificar se um elemento é suspeito (banner, overlay, popup)
    const isSuspiciousElement = (element: Element): boolean => {
      const style = window.getComputedStyle(element);
      const id = element.id?.toLowerCase() || '';
      const className = element.className?.toString().toLowerCase() || '';
      
      // Verificar estilos suspeitos (banners fixos, overlays, z-index alto)
      const zIndexValue = parseInt(style.zIndex);
      const hasHighZIndex = !isNaN(zIndexValue) && zIndexValue > 1000;
      const isFixed = style.position === 'fixed';
      const isAbsolute = style.position === 'absolute';
      const isTopPositioned = isFixed || (isAbsolute && (
        style.top === '0px' || 
        style.top.includes('0') ||
        parseFloat(style.top) < 100
      ));
      
      // Verificar classes/ids suspeitos
      // NOTA: evitar "ad" isolado - dá match em "data-", "gradient", etc.
      const suspiciousClasses = [
        'promo',
        'discount',
        'banner',
        'popup',
        'advertisement',
        'offer',
        'deal',
        'coupon',
      ];
      // "overlay" e "ad" apenas como palavras inteiras para não atingir data-[state], etc.
      const hasSuspiciousClass = suspiciousClasses.some(sus => 
        className.includes(sus) || id.includes(sus)
      ) || /\boverlay\b/.test(className) || /\bad\b/.test(className);
      
      return (hasHighZIndex && (isFixed || isTopPositioned)) || hasSuspiciousClass;
    };

    // Elementos protegidos: #root (app principal) e #portal-root (modais, dialogs, sheets)
    const isAppElement = (el: Element) => el.closest('#root') || el.closest('#portal-root');

    // Função para remover elementos promocionais
    const removePromotionalElements = () => {
      // Buscar todos os elementos no body (exceto #root que é do React)
      const allElements = document.body.querySelectorAll('*:not(#root):not(script):not(style)');
      
      allElements.forEach((element) => {
        // Pular elementos do app (root + portal-root onde ficam modais/dialogs)
        if (isAppElement(element)) {
          return;
        }
        
        // Pular elementos do Radix UI (legítimos)
        if (isRadixUIElement(element)) {
          return;
        }
        // Pular overlay legítimo do Dialog/Sheet
        if (isLegitimateDialogOverlay(element)) {
          return;
        }
        
        // Verificar se contém conteúdo promocional
        if (containsPromotionalContent(element) || isSuspiciousElement(element)) {
          const isLegitimateElement = isAppElement(element) ||
            element.getAttribute('data-dsicola') ||
            element.getAttribute('data-legitimate');
          
          if (!isLegitimateElement) {
            console.warn('[PromotionalContentGuard] Removendo elemento promocional:', element);
            try {
              element.remove();
            } catch (error) {
              console.error('[PromotionalContentGuard] Erro ao remover elemento:', error);
            }
          }
        }
      });
    };

    // Remover elementos existentes imediatamente
    removePromotionalElements();

    // Configurar MutationObserver para monitorar adições ao DOM
    const observer = new MutationObserver((mutations) => {
      let shouldRemove = false;
      
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            
            // Pular elementos do app (root + portal-root onde ficam modais)
            if (isAppElement(element)) return;
            // Pular elementos do Radix UI (legítimos)
            if (isRadixUIElement(element)) return;
            // Pular overlay legítimo do Dialog/Sheet
            if (isLegitimateDialogOverlay(element)) return;
            
            // Verificar se o elemento adicionado é promocional
            if (containsPromotionalContent(element) || isSuspiciousElement(element)) {
              if (!element.getAttribute('data-dsicola') && !element.getAttribute('data-legitimate')) {
                shouldRemove = true;
              }
            }
            
            // Verificar elementos filhos
            const children = element.querySelectorAll('*');
            children.forEach((child) => {
              if (isAppElement(child)) return;
              // Pular elementos do Radix UI (legítimos)
              if (isRadixUIElement(child)) return;
              // Pular overlay legítimo do Dialog/Sheet
              if (isLegitimateDialogOverlay(child)) return;
              
              if (containsPromotionalContent(child) || isSuspiciousElement(child)) {
                if (!child.getAttribute('data-dsicola') && !child.getAttribute('data-legitimate')) {
                  shouldRemove = true;
                }
              }
            });
          }
        });
      });
      
      if (shouldRemove) {
        // Usar setTimeout para evitar remoções durante renderização
        setTimeout(() => {
          removePromotionalElements();
        }, 100);
      }
    });

    // Iniciar observação do DOM
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false,
    });

    // Remover elementos periodicamente (backup)
    const intervalId = setInterval(() => {
      removePromotionalElements();
    }, 2000);

    // Cleanup
    return () => {
      observer.disconnect();
      clearInterval(intervalId);
    };
  }, []);

  // Este componente não renderiza nada
  return null;
};
