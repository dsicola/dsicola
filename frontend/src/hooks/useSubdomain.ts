import { useState, useEffect, useRef } from 'react';
import { getPlatformBaseDomain } from '@/utils/platformDomain';

export interface SubdomainInfo {
  subdomain: string | null;
  isMainDomain: boolean;
  isSuperAdmin: boolean;
  /** Portal institucional em hostname próprio (ex.: escola.com), fora de *.plataforma */
  isCustomDomainPortal: boolean;
}

const calculateSubdomainInfo = (): SubdomainInfo => {
  // Verificação de segurança para SSR ou ambientes sem window
  if (typeof window === 'undefined') {
    return {
      subdomain: null,
      isMainDomain: true,
      isSuperAdmin: false,
      isCustomDomainPortal: false,
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
        isCustomDomainPortal: false,
      };
    }
    return {
      subdomain: null,
      isMainDomain: true,
      isSuperAdmin: false,
      isCustomDomainPortal: false,
    };
  }

  // Preview / PaaS (sem tenant por hostname)
  if (
    hostname.includes('.lovable.app') ||
    hostname.includes('.lovableproject.com') ||
    hostname.includes('.vercel.app') ||
    hostname.includes('.netlify.app')
  ) {
    const params = new URLSearchParams(window.location.search);
    const testSubdomain = params.get('subdomain');
    if (testSubdomain) {
      return {
        subdomain: testSubdomain,
        isMainDomain: false,
        isSuperAdmin: testSubdomain === 'admin',
        isCustomDomainPortal: false,
      };
    }
    return {
      subdomain: null,
      isMainDomain: true,
      isSuperAdmin: false,
      isCustomDomainPortal: false,
    };
  }

  const platform = getPlatformBaseDomain();
  const parts = hostname.split('.');

  if (parts.length >= 3 && parts.slice(-2).join('.') === platform) {
    const subdomain = parts[0];

    if (subdomain === 'admin' || subdomain === 'www' || subdomain === 'app') {
      return {
        subdomain: null,
        isMainDomain: true,
        isSuperAdmin: subdomain === 'admin',
        isCustomDomainPortal: false,
      };
    }

    return {
      subdomain,
      isMainDomain: false,
      isSuperAdmin: false,
      isCustomDomainPortal: false,
    };
  }

  if (hostname !== platform && !hostname.endsWith(`.${platform}`)) {
    return {
      subdomain: null,
      isMainDomain: false,
      isSuperAdmin: false,
      isCustomDomainPortal: true,
    };
  }

  return {
    subdomain: null,
    isMainDomain: true,
    isSuperAdmin: false,
    isCustomDomainPortal: false,
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
