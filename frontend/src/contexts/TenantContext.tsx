import React, { createContext, useContext, useEffect, useState } from 'react';
import { instituicoesApi } from '@/services/api';
import { useSubdomain } from '@/hooks/useSubdomain';

interface Instituicao {
  id: string;
  nome: string;
  subdominio: string;
  logoUrl: string | null;
  emailContato: string | null;
  telefone: string | null;
  endereco: string | null;
  status: string;
  // Compatibility with snake_case references in components
  logo_url?: string | null;
  email_contato?: string | null;
}

interface ConfiguracaoPublica {
  logo_url?: string | null;
  imagem_capa_login_url?: string | null;
  imagemCapaLoginUrl?: string | null;
  nome_instituicao?: string | null;
  nomeInstituicao?: string | null;
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
  const { subdomain, isMainDomain, isSuperAdmin } = useSubdomain();
  const [instituicao, setInstituicao] = useState<Instituicao | null>(null);
  const [configuracao, setConfiguracao] = useState<ConfiguracaoPublica | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInstituicao = async () => {
      // If main domain or super admin, no need to fetch institution
      if (isMainDomain || isSuperAdmin || !subdomain) {
        setLoading(false);
        return;
      }

      try {
        const data = await instituicoesApi.getBySubdominio(subdomain);

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
          logoUrl: data.logoUrl,
          emailContato: data.emailContato,
          telefone: data.telefone,
          endereco: data.endereco,
          status: data.status,
          // Compatibility aliases
          logo_url: data.logoUrl,
          email_contato: data.emailContato,
        };

        setInstituicao(mappedInstituicao);

        // Extrair configurações públicas (se disponíveis)
        if (data.configuracao) {
          setConfiguracao({
            logo_url: data.configuracao.logoUrl || data.configuracao.logo_url,
            imagem_capa_login_url: data.configuracao.imagemCapaLoginUrl || data.configuracao.imagem_capa_login_url,
            imagemCapaLoginUrl: data.configuracao.imagemCapaLoginUrl || data.configuracao.imagem_capa_login_url,
            nome_instituicao: data.configuracao.nomeInstituicao || data.configuracao.nome_instituicao,
            nomeInstituicao: data.configuracao.nomeInstituicao || data.configuracao.nome_instituicao,
          });
        } else {
          setConfiguracao(null);
        }
      } catch (err: any) {
        console.error('Error fetching instituicao:', err);
        if (err.response?.status === 404) {
          setError('Instituição não encontrada');
        } else {
          setError('Erro ao carregar dados da instituição');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchInstituicao();
  }, [subdomain, isMainDomain, isSuperAdmin]);

  return (
    <TenantContext.Provider value={{ instituicao, configuracao, loading, error, isMainDomain, isSuperAdmin }}>
      {children}
    </TenantContext.Provider>
  );
};
