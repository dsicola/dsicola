import React, { createContext, useContext, useEffect, useState } from 'react';
import { instituicoesApi } from '@/services/api';
import { useSubdomain } from '@/hooks/useSubdomain';

interface Instituicao {
  id: string;
  nome: string;
  subdominio: string;
  dominioCustomizado?: string | null;
  logoUrl: string | null;
  emailContato: string | null;
  telefone: string | null;
  endereco: string | null;
  status: string;
  /** Diferenciação Secundário vs Superior - essencial para fluxos distintos */
  tipoAcademico?: 'SUPERIOR' | 'SECUNDARIO' | null;
  // Compatibility with snake_case references in components
  logo_url?: string | null;
  email_contato?: string | null;
}

interface ConfiguracaoPublica {
  logo_url?: string | null;
  logoUrl?: string | null;
  imagem_capa_login_url?: string | null;
  imagemCapaLoginUrl?: string | null;
  nome_instituicao?: string | null;
  nomeInstituicao?: string | null;
  favicon_url?: string | null;
  faviconUrl?: string | null;
  cor_primaria?: string | null;
  corPrimaria?: string | null;
  cor_secundaria?: string | null;
  corSecundaria?: string | null;
  cor_terciaria?: string | null;
  corTerciaria?: string | null;
  descricao?: string | null;
  email?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  landingPublico?: unknown;
  landing_publico?: unknown;
}

interface TenantContextType {
  instituicao: Instituicao | null;
  configuracao: ConfiguracaoPublica | null;
  loading: boolean;
  error: string | null;
  isMainDomain: boolean;
  isSuperAdmin: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return context;
};

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { subdomain, isMainDomain, isSuperAdmin, isCustomDomainPortal } = useSubdomain();
  const [instituicao, setInstituicao] = useState<Instituicao | null>(null);
  const [configuracao, setConfiguracao] = useState<ConfiguracaoPublica | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInstituicao = async () => {
      // If main domain or super admin, no need to fetch institution
      if (isMainDomain || isSuperAdmin || (!subdomain && !isCustomDomainPortal)) {
        setLoading(false);
        return;
      }

      try {
        const data =
          isCustomDomainPortal && typeof window !== 'undefined'
            ? await instituicoesApi.getPublicByHost(window.location.hostname)
            : await instituicoesApi.getBySubdominio(subdomain!);

        if (!data) {
          setError('Instituição não encontrada');
          return;
        }

        if (data.status !== 'ativa') {
          setError('Instituição não está ativa');
          return;
        }

        // Map to both camelCase and snake_case for compatibility
        const mappedInstituicao: Instituicao = {
          id: data.id,
          nome: data.nome,
          subdominio: data.subdominio,
          dominioCustomizado: data.dominioCustomizado ?? null,
          logoUrl: data.logoUrl,
          emailContato: data.emailContato,
          telefone: data.telefone,
          endereco: data.endereco,
          status: data.status,
          tipoAcademico: data.tipoAcademico ?? null,
          // Compatibility aliases
          logo_url: data.logoUrl,
          email_contato: data.emailContato,
        };

        setInstituicao(mappedInstituicao);

        // Extrair configurações públicas (se disponíveis)
        if (data.configuracao) {
          const c = data.configuracao as Record<string, unknown>;
          setConfiguracao({
            logo_url: data.configuracao.logoUrl || data.configuracao.logo_url,
            logoUrl: data.configuracao.logoUrl || data.configuracao.logo_url,
            imagem_capa_login_url: data.configuracao.imagemCapaLoginUrl || data.configuracao.imagem_capa_login_url,
            imagemCapaLoginUrl: data.configuracao.imagemCapaLoginUrl || data.configuracao.imagem_capa_login_url,
            nome_instituicao: data.configuracao.nomeInstituicao || data.configuracao.nome_instituicao,
            nomeInstituicao: data.configuracao.nomeInstituicao || data.configuracao.nome_instituicao,
            favicon_url: data.configuracao.faviconUrl || data.configuracao.favicon_url,
            faviconUrl: data.configuracao.faviconUrl || data.configuracao.favicon_url,
            cor_primaria: (c.corPrimaria || c.cor_primaria) as string | null | undefined,
            corPrimaria: (c.corPrimaria || c.cor_primaria) as string | null | undefined,
            cor_secundaria: (c.corSecundaria || c.cor_secundaria) as string | null | undefined,
            corSecundaria: (c.corSecundaria || c.cor_secundaria) as string | null | undefined,
            cor_terciaria: (c.corTerciaria || c.cor_terciaria) as string | null | undefined,
            corTerciaria: (c.corTerciaria || c.cor_terciaria) as string | null | undefined,
            descricao: (c.descricao as string) ?? null,
            email: (c.email as string) ?? null,
            telefone: (c.telefone as string) ?? null,
            endereco: (c.endereco as string) ?? null,
            landingPublico: c.landingPublico ?? c.landing_publico,
            landing_publico: c.landing_publico ?? c.landingPublico,
          });
        } else {
          setConfiguracao(null);
        }
      } catch (err: any) {
        console.error('Error fetching instituicao:', err);
        if (err.response?.status === 404) {
          setError('Instituição não encontrada');
        } else {
          setError('Não foi possível carregar os dados da instituição. Verifique a conexão e tente novamente.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchInstituicao();
  }, [subdomain, isMainDomain, isSuperAdmin, isCustomDomainPortal]);

  return (
    <TenantContext.Provider value={{ instituicao, configuracao, loading, error, isMainDomain, isSuperAdmin }}>
      {children}
    </TenantContext.Provider>
  );
};
