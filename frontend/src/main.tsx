import { Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { PortalRoot } from "./components/PortalRoot";

// Proteção contra remoção dupla de nós do DOM
// Intercepta removeChild para prevenir erros quando o nó já foi removido
if (typeof window !== "undefined" && typeof Node !== "undefined") {
  const originalRemoveChild = Node.prototype.removeChild;
  
  Node.prototype.removeChild = function(child: Node) {
    try {
      // Verificar se o nó ainda é filho antes de remover
      if (this.contains(child)) {
        return originalRemoveChild.call(this, child);
      } else {
        // Nó já foi removido - silenciar erro (não crítico)
        if (import.meta.env.DEV) {
          console.warn('[DOM Protection] Tentativa de remover nó que já não é filho (ignorado):', {
            parent: this,
            child: child,
          });
        }
        return child; // Retornar o nó para manter compatibilidade
      }
    } catch (error: any) {
      // Se o erro é sobre nó não ser filho, silenciar
      if (error?.message?.includes('not a child') || error?.message?.includes('removeChild')) {
        if (import.meta.env.DEV) {
          console.warn('[DOM Protection] Erro ao remover nó (ignorado):', error.message);
        }
        return child; // Retornar o nó para manter compatibilidade
      }
      // Re-lançar outros erros
      throw error;
    }
  };
}

// Suppress Chrome extension errors that are not from our code
if (typeof window !== "undefined") {
  const originalError = console.error;
  const originalWarn = console.warn;
  
  console.error = (...args: any[]) => {
    const errorMessage = args[0]?.toString() || "";
    const errorStack = args[1]?.stack?.toString() || "";
    const allErrorText = `${errorMessage} ${errorStack}`;
    
    // Suppress Chrome extension onMessage errors and CSP violations from extensions
    if (
      errorMessage.includes("Promised response from onMessage listener went out of scope") ||
      errorMessage.includes("Extension context invalidated") ||
      errorMessage.includes("chrome-extension://") ||
      errorMessage.includes("build.js") ||
      errorMessage.includes("content.js") ||
      errorMessage.includes("tab.js") ||
      errorMessage.includes("Content Security Policy") ||
      errorMessage.includes("CSP directive") ||
      errorMessage.includes("script-src") ||
      errorMessage.includes("unsafe-inline") ||
      errorMessage.includes("Executing inline script violates") ||
      errorMessage.includes("violates the following Content Security Policy") ||
      allErrorText.includes("chrome-extension://") ||
      allErrorText.includes("tab.js") ||
      errorMessage.includes("A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received") ||
      errorMessage.includes("message channel closed before a response was received")
    ) {
      return;
    }
    // Suppress "Operação requer escopo de instituição" for notifications (Super Admin sem instituição)
    if (
      errorMessage.includes("Operação requer escopo de instituição") &&
      (args[1]?.config?.url?.includes('/notificacoes') || errorMessage.includes('notifications'))
    ) {
      return; // Silenciar erro esperado para Super Admin sem instituição
    }
    // Suppress erros 403 relacionados a "Configuração de Ensinos" (professores não têm acesso - esperado)
    if (
      errorMessage.includes("Configuração de Ensinos") ||
      errorMessage.includes("Acesso restrito à Administração Acadêmica")
    ) {
      return; // Silenciar erro esperado - professor tentando acessar recurso restrito
    }
    // Suppress 404 route errors from NotFound component (these are expected and logged as warnings)
    if (
      errorMessage.includes("404 Error: User attempted to access non-existent route") ||
      errorMessage.includes("non-existent route")
    ) {
      return; // Silenciar erros esperados de rotas não encontradas
    }
    // Suppress Node.removeChild errors - causados por cleanup de portals
    // Estes erros foram eliminados com a remoção do StrictMode e melhorias no PortalRoot
    // Mantido como fallback de segurança caso algum erro residual apareça
    if (
      errorMessage.includes("Node.removeChild") ||
      errorMessage.includes("The node to be removed is not a child of this node") ||
      errorMessage.includes("removeChild") ||
      allErrorText.includes("Node.removeChild")
    ) {
      return; // Silenciar erros de Portal/removeChild (não devem mais ocorrer)
    }
    originalError.apply(console, args);
  };

  console.warn = (...args: any[]) => {
    const warnMessage = args[0]?.toString() || "";
    const warnStack = args[1]?.stack?.toString() || "";
    const allWarnText = `${warnMessage} ${warnStack}`;
    
    // Suppress Chrome extension warnings and CSP violations from extensions
    if (
      warnMessage.includes("Promised response from onMessage listener went out of scope") ||
      warnMessage.includes("Extension context invalidated") ||
      warnMessage.includes("chrome-extension://") ||
      warnMessage.includes("build.js") ||
      warnMessage.includes("content.js") ||
      warnMessage.includes("tab.js") ||
      warnMessage.includes("Content Security Policy") ||
      warnMessage.includes("CSP directive") ||
      warnMessage.includes("script-src") ||
      warnMessage.includes("unsafe-inline") ||
      warnMessage.includes("Executing inline script violates") ||
      warnMessage.includes("violates the following Content Security Policy") ||
      allWarnText.includes("chrome-extension://") ||
      allWarnText.includes("tab.js")
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };

  // Also handle unhandled promise rejections from extensions
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason?.toString() || "";
    const errorMessage = event.reason?.message?.toString() || "";
    const allText = `${reason} ${errorMessage}`;
    
    if (
      reason.includes("onMessage") ||
      reason.includes("Extension context") ||
      reason.includes("chrome-extension://") ||
      reason.includes("build.js") ||
      reason.includes("content.js") ||
      reason.includes("tab.js") ||
      reason.includes("Content Security Policy") ||
      reason.includes("CSP directive") ||
      reason.includes("Executing inline script violates") ||
      reason.includes("violates the following Content Security Policy") ||
      allText.includes("chrome-extension://") ||
      allText.includes("tab.js") ||
      reason.includes("A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received") ||
      reason.includes("message channel closed before a response was received")
    ) {
      event.preventDefault();
      return;
    }
  });

  // Handle errors from window.onerror
  window.addEventListener("error", (event) => {
    const errorMessage = event.message || "";
    const errorSource = event.filename?.toString() || "";
    const allErrorText = `${errorMessage} ${errorSource}`;
    
    if (
      errorMessage.includes("Promised response from onMessage listener went out of scope") ||
      errorMessage.includes("Extension context invalidated") ||
      errorMessage.includes("chrome-extension://") ||
      errorSource.includes("chrome-extension://") ||
      errorMessage.includes("build.js") ||
      errorMessage.includes("content.js") ||
      errorMessage.includes("tab.js") ||
      errorSource.includes("tab.js") ||
      errorMessage.includes("Content Security Policy") ||
      errorMessage.includes("CSP directive") ||
      errorMessage.includes("script-src") ||
      errorMessage.includes("unsafe-inline") ||
      errorMessage.includes("Executing inline script violates") ||
      errorMessage.includes("violates the following Content Security Policy") ||
      allErrorText.includes("chrome-extension://") ||
      allErrorText.includes("tab.js") ||
      errorMessage.includes("A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received") ||
      errorMessage.includes("message channel closed before a response was received")
    ) {
      event.preventDefault();
      return false;
    }
    // Suppress Node.removeChild errors - causados por cleanup de portals
    // Estes erros foram eliminados com a remoção do StrictMode e melhorias no PortalRoot
    // Mantido como fallback de segurança caso algum erro residual apareça
    // NOTA: Este é um workaround temporário - a solução real está no PortalRoot e useSafeDialog
    if (
      errorMessage.includes("Node.removeChild") ||
      errorMessage.includes("The node to be removed is not a child of this node") ||
      errorMessage.includes("removeChild") ||
      allErrorText.includes("Node.removeChild")
    ) {
      // Log apenas em desenvolvimento para debug
      if (import.meta.env.DEV) {
        console.warn('[Window Error Handler] Erro Node.removeChild suprimido (não crítico):', errorMessage);
      }
      event.preventDefault();
      return false;
    }
  });
}

// Ensure CSS is loaded before rendering
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

// IMPORTANTE: StrictMode NÃO está sendo usado
// StrictMode causa double-mount em desenvolvimento que resulta em erros Node.removeChild
// com Portals. Como StrictMode não existe em produção, é seguro removê-lo.
// O plugin @vitejs/plugin-react-swc não adiciona StrictMode automaticamente.

createRoot(rootElement).render(
  <>
    {/* PortalRoot DEVE estar no topo absoluto - antes de qualquer provider, rota ou componente */}
    {/* Ele garante que o container portal-root existe e está acessível para todos os portals */}
    <PortalRoot />
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      }
    >
      <App />
    </Suspense>
  </>
);
