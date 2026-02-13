import { useState, useEffect, useRef } from 'react';

export interface SubdomainInfo {
  subdomain: string | null;
  isMainDomain: boolean;
  isSuperAdmin: boolean;
}

const calculateSubdomainInfo = (): SubdomainInfo => {
  // Verificação de segurança para SSR ou ambientes sem window
  if (typeof window === 'undefined') {
    return {
      subdomain: null,
      isMainDomain: true,
      isSuperAdmin: false,
    };
  }
  
  const hostname = window.location.hostname;
  
  // Local development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Check URL params for testing subdomains locally
    const params = new URLSearchParams(window.location.search);
    const testSubdomain = params.get('subdomain');
    if (testSubdomain) {
      return {
        subdomain: testSubdomain,
        isMainDomain: false,
        isSuperAdmin: testSubdomain === 'admin',
      };
    }
    return {
      subdomain: null,
      isMainDomain: true,
      isSuperAdmin: false,
    };
  }

  // Check for Lovable preview domains
  if (hostname.includes('.lovable.app') || hostname.includes('.lovableproject.com')) {
    const params = new URLSearchParams(window.location.search);
    const testSubdomain = params.get('subdomain');
    if (testSubdomain) {
      return {
        subdomain: testSubdomain,
        isMainDomain: false,
        isSuperAdmin: testSubdomain === 'admin',
      };
    }
    return {
      subdomain: null,
      isMainDomain: true,
      isSuperAdmin: false,
    };
  }

  // Production: subdomain.dsicola.com
  const parts = hostname.split('.');
  
  // Check if it's a subdomain of dsicola.com
  if (parts.length >= 3 && parts.slice(-2).join('.') === 'dsicola.com') {
    const subdomain = parts[0];
    
    // Main admin portal
    if (subdomain === 'admin' || subdomain === 'www' || subdomain === 'app') {
      return {
        subdomain: null,
        isMainDomain: true,
        isSuperAdmin: subdomain === 'admin',
      };
    }
    
    return {
      subdomain,
      isMainDomain: false,
      isSuperAdmin: false,
    };
  }

  // Default: main domain
  return {
    subdomain: null,
    isMainDomain: true,
    isSuperAdmin: false,
  };
};

export const useSubdomain = (): SubdomainInfo => {
  const [subdomainInfo, setSubdomainInfo] = useState<SubdomainInfo>(() => calculateSubdomainInfo());
  const isMountedRef = useRef(true);

  useEffect(() => {
    // Verificação de segurança
    if (typeof window === 'undefined') {
      return;
    }
    
    isMountedRef.current = true;
    
    // Recalculate when location changes (e.g., navigation)
    const updateSubdomainInfo = () => {
      // Verificar se o componente ainda está montado antes de atualizar
      if (isMountedRef.current) {
        setSubdomainInfo(calculateSubdomainInfo());
      }
    };
    
    // Atualizar imediatamente
    updateSubdomainInfo();
    
    // Escutar mudanças na URL (popstate para navegação do browser)
    window.addEventListener('popstate', updateSubdomainInfo);
    
    // Cleanup
    return () => {
      isMountedRef.current = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('popstate', updateSubdomainInfo);
      }
    };
  }, []);

  return subdomainInfo;
};
