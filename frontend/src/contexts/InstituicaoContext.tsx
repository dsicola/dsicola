import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { instituicoesApi, configuracoesInstituicaoApi, getAccessToken } from '@/services/api';
import { UserRole } from '@/types/auth';
import { getDefaultColorsByTipoAcademico } from '@/utils/defaultColors';
import { decodeJWT } from '@/utils/jwt';

interface Instituicao {
  id: string;
  nome: string;
  subdominio: string;
  logo_url: string | null;
  email_contato: string | null;
  telefone: string | null;
  endereco: string | null;
  status: string;
  tipo_instituicao: 'UNIVERSIDADE' | 'ENSINO_MEDIO' | 'MISTA' | 'EM_CONFIGURACAO';
  tipo_academico?: 'SECUNDARIO' | 'SUPERIOR' | null;
}

// Legacy interface for backwards compatibility
interface ConfiguracoesInstituicao {
  id: string;
  nome_instituicao: string;
  logo_url: string | null;
  imagem_capa_login_url: string | null;
  favicon_url?: string | null;
  faviconUrl?: string | null;
  cor_primaria: string | null;
  cor_secundaria: string | null;
  cor_terciaria: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  descricao: string | null;
  tipo_instituicao: 'UNIVERSIDADE' | 'ENSINO_MEDIO' | 'MISTA' | 'EM_CONFIGURACAO';
  tipo_academico?: 'SECUNDARIO' | 'SUPERIOR' | null;
  taxaMatriculaPadrao?: number | null;
  mensalidadePadrao?: number | null;
}

interface InstituicaoContextType {
  instituicao: Instituicao | null;
  instituicaoId: string | null;
  // Legacy property for backwards compatibility
  config: ConfiguracoesInstituicao | null;
  loading: boolean;
  refetch: () => Promise<void>;
  isUniversidade: boolean;
  isEnsinoMedio: boolean;
  tipoAcademico: 'SECUNDARIO' | 'SUPERIOR' | null;
  isSuperior: boolean;
  isSecundario: boolean;
}

export const InstituicaoContext = createContext<InstituicaoContextType | undefined>(undefined);

export const useInstituicao = () => {
  const context = useContext(InstituicaoContext);
  if (!context) {
    throw new Error('useInstituicao must be used within InstituicaoProvider');
  }
  return context;
};

export const InstituicaoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role } = useAuth();
  const [instituicao, setInstituicao] = useState<Instituicao | null>(null);
  const [instituicaoId, setInstituicaoId] = useState<string | null>(null);
  const [configData, setConfigData] = useState<ConfiguracoesInstituicao | null>(null);
  const [loading, setLoading] = useState(true);
  
  // CRÍTICO: Extrair tipoAcademico do token JWT automaticamente
  const [tipoAcademicoFromToken, setTipoAcademicoFromToken] = useState<'SUPERIOR' | 'SECUNDARIO' | null>(null);

  /**
   * Verifica se o usuário tem permissão para acessar dados da instituição (config, logo, etc.)
   * ADMIN e SUPER_ADMIN: acesso total.
   * DIRECAO, COORDENADOR: Config. Ensinos e operações acadêmicas.
   * SECRETARIA, POS, FINANCEIRO, RH: impressão de recibos, ano letivo, estrutura organizacional.
   * PROFESSOR: documentos acadêmicos (boletim, pauta) com branding.
   */
  const hasInstitutionalPermission = (userRole: UserRole | null): boolean => {
    return (
      userRole === 'ADMIN' ||
      userRole === 'SUPER_ADMIN' ||
      userRole === 'DIRECAO' ||
      userRole === 'COORDENADOR' ||
      userRole === 'SECRETARIA' ||
      userRole === 'POS' ||
      userRole === 'FINANCEIRO' ||
      userRole === 'RH' ||
      userRole === 'PROFESSOR'
    );
  };

  /**
   * Trata erro 403 como comportamento normal (sem permissão)
   * Não loga como erro crítico, apenas silencia
   */
  const isForbiddenError = (error: any): boolean => {
    return error?.response?.status === 403 || error?.status === 403;
  };

  /**
   * Trata erro 400 como UUID inválido (não loga como erro crítico)
   */
  const isBadRequestError = (error: any): boolean => {
    return error?.response?.status === 400 || error?.status === 400;
  };

  /**
   * Valida se o ID é um UUID válido
   */
  const isValidUUID = (id: any): id is string => {
    if (!id || typeof id !== 'string') {
      return false;
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id.trim());
  };

  const fetchInstituicao = async () => {
    try {
      if (!user) {
        setInstituicao(null);
        setInstituicaoId(null);
        setConfigData(null);
        setLoading(false);
        return;
      }

      const userInstituicaoId = (user as any).instituicao_id ?? (user as any).instituicaoId ?? null;
      setInstituicaoId(userInstituicaoId);

      // Verificar se o usuário tem permissão para acessar dados da instituição
      const canAccessInstitution = hasInstitutionalPermission(role);

      // Se não tem permissão, não fazer chamadas e finalizar
      if (!canAccessInstitution) {
        setConfigData(null);
        setInstituicao(null);
        setLoading(false);
        return;
      }

      // Fetch configuracoes_instituicao filtered by user's instituicao_id
      // Apenas para perfis com permissão (ADMIN, SUPER_ADMIN)
      // IMPORTANTE: Multi-tenant - instituicaoId vem do JWT token, não do frontend
      if (userInstituicaoId && isValidUUID(userInstituicaoId)) {
        try {
          const configResult = await configuracoesInstituicaoApi.get();
          if (configResult) {
            setConfigData({
              id: configResult.id,
              nome_instituicao: configResult.nomeInstituicao || configResult.nome_instituicao,
              logo_url: configResult.logoUrl || configResult.logo_url,
              imagem_capa_login_url: configResult.imagemCapaLoginUrl || configResult.imagem_capa_login_url,
              favicon_url: configResult.faviconUrl || configResult.favicon_url,
              faviconUrl: configResult.faviconUrl || configResult.favicon_url,
              cor_primaria: configResult.corPrimaria || configResult.cor_primaria,
              cor_secundaria: configResult.corSecundaria || configResult.cor_secundaria,
              cor_terciaria: configResult.corTerciaria || configResult.cor_terciaria,
              email: configResult.email,
              telefone: configResult.telefone,
              endereco: configResult.endereco,
              descricao: configResult.descricao,
              tipo_instituicao: configResult.tipoInstituicao || configResult.tipo_instituicao || 'EM_CONFIGURACAO',
              tipo_academico: configResult.tipoAcademico || configResult.tipo_academico || null,
              taxaMatriculaPadrao: configResult.taxaMatriculaPadrao ?? configResult.taxa_matricula_padrao ?? null,
              mensalidadePadrao: configResult.mensalidadePadrao ?? configResult.mensalidade_padrao ?? null,
            });
          }
        } catch (err: any) {
          // Tratar 403 como comportamento normal (sem permissão)
          // Tratar 400 como UUID inválido (não logar como erro crítico)
          if (!isForbiddenError(err) && !isBadRequestError(err)) {
            console.error('Error fetching config:', err);
          }
          // Silenciosamente não definir configData se for 403 ou 400
        }

        // Fetch institution data
        // Apenas para perfis com permissão (ADMIN, SUPER_ADMIN)
        // IMPORTANTE: Multi-tenant - usar getMe() que extrai instituicaoId do JWT
        // Não enviar instituicaoId do frontend
        try {
          const instituicaoData = await instituicoesApi.getMe();
          if (instituicaoData) {
            setInstituicao({
              id: instituicaoData.id,
              nome: instituicaoData.nome,
              subdominio: instituicaoData.subdominio,
              logo_url: instituicaoData.logoUrl || instituicaoData.logo_url,
              email_contato: instituicaoData.emailContato || instituicaoData.email_contato,
              telefone: instituicaoData.telefone,
              endereco: instituicaoData.endereco,
              status: instituicaoData.status,
              tipo_instituicao: (instituicaoData.tipoInstituicao || instituicaoData.tipo_instituicao || 'EM_CONFIGURACAO') as 'UNIVERSIDADE' | 'ENSINO_MEDIO' | 'MISTA' | 'EM_CONFIGURACAO',
              tipo_academico: (instituicaoData.tipoAcademico || instituicaoData.tipo_academico || null) as 'SECUNDARIO' | 'SUPERIOR' | null
            });
          }
        } catch (err: any) {
          // Tratar 403 como comportamento normal (sem permissão)
          // Tratar 400 como erro de validação (não logar como erro crítico)
          if (!isForbiddenError(err) && !isBadRequestError(err)) {
            console.error('Error fetching institution:', err);
          }
          // Silenciosamente não definir instituicao se for 403 ou 400
        }
      } else {
        setConfigData(null);
        setInstituicao(null);
      }
    } catch (err: any) {
      // Tratar 403 como comportamento normal (sem permissão)
      // Tratar 400 como UUID inválido (não logar como erro crítico)
      if (!isForbiddenError(err) && !isBadRequestError(err)) {
        console.error('Error:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstituicao();
  }, [user, role]);

  // CRÍTICO: Extrair tipoAcademico do token JWT automaticamente (fonte mais confiável)
  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      const decoded = decodeJWT(token);
      if (decoded?.tipoAcademico) {
        setTipoAcademicoFromToken(decoded.tipoAcademico);
      }
    }
  }, [user]);

  // Tipo acadêmico (prioridade: 1) Token JWT, 2) Instituição, 3) Config)
  // IMPORTANTE: Token JWT tem prioridade máxima (vem automaticamente do backend)
  const tipoAcademico = tipoAcademicoFromToken || instituicao?.tipo_academico || instituicao?.tipoAcademico || configData?.tipo_academico || configData?.tipoAcademico || null;

  // Aplicar cores padrão dinamicamente baseadas no tipo acadêmico
  // Se não há configData OU se há configData mas sem cores personalizadas
  const temCoresPersonalizadas = configData?.cor_primaria && configData?.cor_secundaria && configData?.cor_terciaria;
  const defaultColors = useMemo(() => getDefaultColorsByTipoAcademico(tipoAcademico), [tipoAcademico]);

  // Use configData if available, otherwise create legacy config from instituicao
  // O backend já aplica cores padrão quando necessário, mas garantimos no frontend também
  const config: ConfiguracoesInstituicao | null = useMemo(() => {
    if (configData) {
      // Se há configData mas não tem cores personalizadas, aplicar cores padrão dinamicamente
      if (!temCoresPersonalizadas) {
        return {
          ...configData,
          cor_primaria: defaultColors.cor_primaria,
          cor_secundaria: defaultColors.cor_secundaria,
          cor_terciaria: defaultColors.cor_terciaria,
        };
      }
      return configData;
    }
    
    if (instituicao) {
      // Se não há configData, criar config com cores padrão baseadas no tipo acadêmico
      return {
        id: instituicao.id,
        nome_instituicao: instituicao.nome,
        logo_url: instituicao.logo_url,
        imagem_capa_login_url: null,
        cor_primaria: defaultColors.cor_primaria,
        cor_secundaria: defaultColors.cor_secundaria,
        cor_terciaria: defaultColors.cor_terciaria,
        email: instituicao.email_contato,
        telefone: instituicao.telefone,
        endereco: instituicao.endereco,
        descricao: null,
        tipo_instituicao: instituicao.tipo_instituicao || 'EM_CONFIGURACAO',
        tipo_academico: instituicao.tipo_academico || null,
      };
    }
    
    return null;
  }, [configData, instituicao, temCoresPersonalizadas, defaultColors]);

  const isSuperior = tipoAcademico === 'SUPERIOR';
  const isSecundario = tipoAcademico === 'SECUNDARIO';
  
  // IMPORTANTE: Priorizar tipoAcademico sobre tipo_instituicao para garantir consistência
  // Se tipoAcademico está disponível, usar ele para determinar tipoInstituicao
  // Caso contrário, usar tipo_instituicao da tabela instituicoes
  let tipoInstituicao: string;
  if (tipoAcademico === 'SUPERIOR') {
    tipoInstituicao = 'UNIVERSIDADE';
  } else if (tipoAcademico === 'SECUNDARIO') {
    tipoInstituicao = 'ENSINO_MEDIO';
  } else {
    tipoInstituicao = instituicao?.tipo_instituicao || instituicao?.tipoInstituicao || config?.tipo_instituicao || 'EM_CONFIGURACAO';
  }
  
  const isUniversidade = tipoInstituicao === 'UNIVERSIDADE' || tipoInstituicao === 'MISTA';
  const isEnsinoMedio = tipoInstituicao === 'ENSINO_MEDIO' || tipoInstituicao === 'MISTA';

  return (
    <InstituicaoContext.Provider value={{ 
      instituicao, 
      instituicaoId, 
      config, 
      loading, 
      refetch: fetchInstituicao,
      isUniversidade,
      isEnsinoMedio,
      tipoAcademico,
      isSuperior,
      isSecundario
    }}>
      {children}
    </InstituicaoContext.Provider>
  );
};
