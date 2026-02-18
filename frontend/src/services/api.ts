import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Tipos para listagens paginadas (estudantes, professores, funcionários)
export interface ListQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: string;
  from?: string;
  to?: string;
  anoLetivoId?: string;
  cursoId?: string;
  turmaId?: string;
  classeId?: string;
  cargoId?: string;
  departamentoId?: string;
  instituicaoId?: string; // Ignorado — NUNCA enviar do frontend
}
export interface ListResponse<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

const resolveApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (envUrl && envUrl.trim()) return envUrl.trim().replace(/\/+$/, '');

  // Allow overriding in preview/testing without rebuilding
  const apiParam = new URLSearchParams(window.location.search).get('api');
  if (apiParam && apiParam.trim()) return apiParam.trim().replace(/\/$/, '');

  const { hostname, protocol } = window.location;

  // Local dev default - backend está na porta 3001 por padrão
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Backend padrão está na porta 3001 (ou usar VITE_API_PORT se definido)
    const port = import.meta.env.VITE_API_PORT || '3001';
    return `${protocol}//${hostname}:${port}`;
  }

  // Same-origin deployments (reverse proxy)
  return `${window.location.origin}`;
};

export const API_URL = resolveApiUrl();

// Debug: Log API URL in development
if (import.meta.env.DEV) {
  console.log('[API] Using API URL:', API_URL);
  console.log('[API] VITE_API_URL from env:', import.meta.env.VITE_API_URL);
}

// Create axios instance
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds timeout
  withCredentials: true, // Important for CORS with credentials
});

// Token management
let accessToken: string | null = null;
let refreshToken: string | null = null;

export const setTokens = (access: string, refresh: string) => {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('accessToken', access);
  localStorage.setItem('refreshToken', refresh);
};

export const getAccessToken = (): string | null => {
  // Always check localStorage first to ensure we have the latest token
  const storedToken = localStorage.getItem('accessToken');
  if (storedToken) {
    accessToken = storedToken;
  }
  return accessToken || storedToken;
};

export const getRefreshToken = (): string | null => {
  if (!refreshToken) {
    refreshToken = localStorage.getItem('refreshToken');
  }
  return refreshToken;
};

export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Se for FormData, remover Content-Type para o navegador definir automaticamente com boundary
    if (config.data instanceof FormData && config.headers) {
      delete config.headers['Content-Type'];
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh and connection errors
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Enhanced error logging for debugging
    if (import.meta.env.DEV) {
      const errorData = error.response?.data as any;
      const requestUrl = error.config?.url || '';
      const status = error.response?.status;
      const errorMessage = errorData?.message || error.message || '';
      
      // Não logar erros 400/403 esperados em endpoints que tratam silenciosamente
      // (UUID inválido, acesso negado em contextos esperados)
      const isExpectedError = 
        (status === 400 || status === 403) && 
        (requestUrl.includes('/instituicoes/') || 
         requestUrl.includes('/configuracoes-instituicao/')) &&
        (errorMessage.includes('UUID') || 
         errorMessage.includes('inválido') || 
         errorMessage.includes('Acesso negado') ||
         errorMessage.includes('não autenticado') ||
         errorData?.error === 'Dados inválidos');
      
      if (!isExpectedError) {
        console.error('[API Error]', {
          code: error.code,
          message: errorMessage,
          status: status,
          statusText: error.response?.statusText,
          reason: errorData?.reason,
          error: errorData?.error,
          url: requestUrl,
          method: error.config?.method,
          baseURL: error.config?.baseURL,
          fullURL: `${error.config?.baseURL}${requestUrl}`,
          hasAuth: !!error.config?.headers?.Authorization,
        });
      }
    }

    // Handle network errors (connection failures, CORS, etc.)
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED' || error.message.includes('Network Error')) {
      const diagnosticInfo = {
        apiUrl: API_URL,
        viteApiUrl: import.meta.env.VITE_API_URL,
        currentOrigin: window.location.origin,
        errorCode: error.code,
        errorMessage: error.message,
      };
      
      console.error('[API Connection Error]', diagnosticInfo);
      
      // Enhance error with diagnostic info
      const enhancedError = new Error(
        `Não foi possível conectar ao servidor. URL da API: ${API_URL}. Verifique se o backend está rodando e se VITE_API_URL está configurado corretamente.`
      ) as any;
      enhancedError.code = error.code;
      enhancedError.diagnostic = diagnosticInfo;
      return Promise.reject(enhancedError);
    }

    // Handle 401 Unauthorized - Token missing/invalid/expired
    if (error.response?.status === 401 && !originalRequest._retry) {
      const errorData = error.response?.data as any;
      const requestUrl = originalRequest?.url || '';
      
      // Don't handle token refresh/redirect for auth endpoints (login, register, etc.)
      // These endpoints can legitimately return 401 (invalid credentials)
      const isAuthEndpoint = requestUrl.includes('/auth/login') || 
                            requestUrl.includes('/auth/register') ||
                            requestUrl.includes('/auth/reset-password') ||
                            requestUrl.includes('/auth/forgot-password') ||
                            requestUrl.includes('/auth/password') ||
                            requestUrl.includes('/auth/confirm-reset-password') ||
                            requestUrl.includes('/auth/change-password-required');
      
      // For auth endpoints, just reject the error without handling token refresh
      if (isAuthEndpoint) {
        return Promise.reject(error);
      }
      
      // Don't redirect if we're already on the auth page
      const isOnAuthPage = window.location.pathname.startsWith('/auth');
      
      // Try to refresh token if we have one
      const refresh = getRefreshToken();
      if (refresh && (errorData?.reason === 'TOKEN_EXPIRED' || !errorData?.reason)) {
        originalRequest._retry = true;

        try {
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken: refresh,
          });

          const { accessToken: newAccess, refreshToken: newRefresh } = response.data;
          setTokens(newAccess, newRefresh);

          // Retry original request
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newAccess}`;
          }
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed, clear tokens and redirect to login (only if not on auth page)
          if (import.meta.env.DEV) {
            console.error('[API] Refresh token failed, redirecting to login');
          }
          clearTokens();
          if (!isOnAuthPage) {
            window.location.href = '/auth';
          }
          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token or token is invalid (not expired)
        // Tratamento específico para erro de instituicaoId inválido
        const isInvalidInstituicaoId = errorData?.reason === 'INVALID_TOKEN_INSTITUICAO_ID' ||
          errorData?.reason === 'INVALID_TOKEN_MISSING_INSTITUICAO_ID' ||
          errorData?.message?.includes('instituição inválido') ||
          errorData?.message?.includes('ID de instituição inválido') ||
          errorData?.message?.includes('instituição não identificada');
        
        if (isInvalidInstituicaoId) {
          // Forçar logout imediato quando instituicaoId inválido
          if (import.meta.env.DEV) {
            console.error('[API] InstituicaoId inválido, forçando logout');
          }
          clearTokens();
          // Limpar todo o storage
          localStorage.clear();
          sessionStorage.clear();
          // Redirecionar para login
          if (!isOnAuthPage) {
            window.location.href = '/auth';
          }
          return Promise.reject(error);
        }
        
        if (import.meta.env.DEV) {
          console.error('[API] 401 Unauthorized - redirecting to login', {
            reason: errorData?.reason,
            hasRefreshToken: !!refresh,
            isOnAuthPage,
            requestUrl,
            isInvalidInstituicaoId,
          });
        }
        
        // Limpar tokens e storage completamente
        clearTokens();
        localStorage.clear();
        sessionStorage.clear();
        
        // Only redirect if not already on auth page
        if (!isOnAuthPage) {
          // Forçar logout completo e redirecionar para login
          window.location.href = '/auth?reason=invalid_token';
        }
        return Promise.reject(error);
      }
    }

    // Handle 403 Forbidden - Permission/license denied
    if (error.response?.status === 403) {
      const errorData = error.response?.data as any;
      const reason = errorData?.reason || 'UNKNOWN';
      const errorMessage = errorData?.error || errorData?.message || 'Acesso negado';
      
      // ============================================================
      // POLÍTICA DE SEGURANÇA: Preservar erro MUST_CHANGE_PASSWORD
      // ============================================================
      // Não modificar erros de MUST_CHANGE_PASSWORD - deixar passar direto
      // para que LoginForm e AuthContext possam interceptar corretamente
      if (errorMessage === 'MUST_CHANGE_PASSWORD' || errorData?.error === 'MUST_CHANGE_PASSWORD' || errorData?.message === 'MUST_CHANGE_PASSWORD') {
        // Preservar estrutura original do erro para tratamento específico
        return Promise.reject(error);
      }

      // Não logar erros de escopo de instituição para notificações (Super Admin sem instituição)
      const isNotificationEndpoint = error.config?.url?.includes('/notificacoes');
      const isInstitutionScopeError = errorMessage.includes('escopo de instituição') || 
                                     errorMessage.includes('Operação requer escopo');
      
      if (isNotificationEndpoint && isInstitutionScopeError) {
        // Silenciar este erro específico - Super Admin sem instituição é esperado
        const silentError = new Error('Operação requer escopo de instituição') as any;
        silentError.response = error.response;
        silentError.config = error.config;
        silentError.code = error.code;
        silentError.reason = 'INSTITUTION_SCOPE_REQUIRED';
        silentError.status = 403;
        silentError.silent = true; // Flag para componentes ignorarem
        return Promise.reject(silentError);
      }

      // Silenciar erros 403 relacionados a "Configuração de Ensinos" para professores
      // Professores não têm permissão para acessar este módulo (esperado)
      const isConfiguracaoEnsinoError = errorMessage.includes('Configuração de Ensinos') ||
                                       errorMessage.includes('Acesso restrito à Administração Acadêmica');
      
      if (isConfiguracaoEnsinoError) {
        // Silenciar este erro - professor tentando acessar recurso restrito é comportamento esperado
        const silentError = new Error(errorMessage) as any;
        silentError.response = error.response;
        silentError.config = error.config;
        silentError.code = error.code;
        silentError.reason = 'INSUFFICIENT_PERMISSIONS';
        silentError.status = 403;
        silentError.silent = true; // Flag para componentes ignorarem
        return Promise.reject(silentError);
      }

      // Enhance error message for license-related issues
      if (reason.startsWith('LICENSE') || reason === 'TRIAL_EXPIRED') {
        if (import.meta.env.DEV) {
          console.error('[API] 403 Forbidden - License issue', {
            reason,
            message: errorMessage,
            route: error.config?.url,
          });
        }
        // Don't show generic error - let the component handle the specific message
        // The error will be enhanced below
      } else if (reason === 'INSUFFICIENT_PERMISSIONS' || reason === 'NO_ROLES') {
        if (import.meta.env.DEV) {
          console.error('[API] 403 Forbidden - Permission issue', {
            reason,
            message: errorMessage,
            route: error.config?.url,
          });
        }
      }

      // Enhance error with reason and better message
      const enhancedError = new Error(errorMessage) as any;
      enhancedError.response = error.response;
      enhancedError.config = error.config;
      enhancedError.code = error.code;
      enhancedError.reason = reason;
      enhancedError.status = 403;
      
      return Promise.reject(enhancedError);
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  getAuthConfig: async (): Promise<{ oidcEnabled: boolean; oidcProviderName?: string }> => {
    const response = await api.get('/auth/config');
    return response.data;
  },

  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  register: async (email: string, password: string, nomeCompleto: string, instituicaoId?: string) => {
    const response = await api.post('/auth/register', { 
      email, 
      password, 
      nomeCompleto,
      instituicaoId 
    });
    return response.data;
  },

  logout: async () => {
    const refresh = getRefreshToken();
    if (refresh) {
      try {
        await api.post('/auth/logout', { refreshToken: refresh });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    clearTokens();
  },

  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  },

  /** Busca perfil com token explícito - usado no callback OIDC para evitar race com interceptor */
  getProfileWithToken: async (accessToken: string) => {
    const response = await api.get('/auth/profile', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.data;
  },

  refreshToken: async () => {
    const refresh = getRefreshToken();
    if (!refresh) throw new Error('No refresh token');
    
    const response = await api.post('/auth/refresh', { refreshToken: refresh });
    return response.data;
  },

  resetPassword: async (email: string) => {
    const response = await api.post('/auth/reset-password', { email });
    return response.data;
  },

  updatePassword: async (currentPassword: string, newPassword: string) => {
    const response = await api.put('/auth/password', { currentPassword, newPassword });
    return response.data;
  },

  confirmResetPassword: async (token: string, newPassword: string, confirmPassword: string) => {
    const response = await api.post('/auth/confirm-reset-password', { token, newPassword, confirmPassword });
    return response.data;
  },

  resetUserPassword: async (userId: string, newPassword: string, sendEmail?: boolean) => {
    const response = await api.post('/auth/reset-user-password', { userId, newPassword, sendEmail });
    return response.data;
  },

  changePasswordRequired: async (newPassword: string, confirmPassword: string) => {
    const response = await api.post('/auth/change-password-required', { newPassword, confirmPassword });
    return response.data;
  },

  changePasswordRequiredWithCredentials: async (email: string, currentPassword: string, newPassword: string, confirmPassword: string) => {
    const response = await api.post('/auth/change-password-required-with-credentials', { 
      email, 
      currentPassword, 
      newPassword, 
      confirmPassword 
    });
    return response.data;
  },

  // 2FA Login Step 2: Verificar código 2FA
  loginStep2: async (userId: string, token: string) => {
    const response = await api.post('/auth/login-step2', { userId, token });
    return response.data;
  },
};

// Two Factor Authentication API
export const twoFactorApi = {
  // Setup: Gerar secret e QR code
  setup: async () => {
    const response = await api.post('/two-factor/setup');
    return response.data;
  },

  // Verificar código e ativar 2FA
  verifyAndEnable: async (token: string, secret: string) => {
    const response = await api.post('/two-factor/verify', { token, secret });
    return response.data;
  },

  // Desativar 2FA
  disable: async () => {
    const response = await api.post('/two-factor/disable');
    return response.data;
  },

  // Resetar 2FA (apenas ADMIN/SUPER_ADMIN)
  reset: async (userId: string) => {
    const response = await api.post('/two-factor/reset', { userId });
    return response.data;
  },

  // Verificar status de 2FA
  getStatus: async () => {
    const response = await api.get('/two-factor/status');
    return response.data;
  },
};

// Users API
export const usersApi = {
  getAll: async (params?: { role?: string; instituicaoId?: string }) => {
    // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
    // O backend usa req.user.instituicaoId do JWT token automaticamente
    // Apenas SUPER_ADMIN pode especificar instituicaoId (backend valida)
    const { instituicaoId, ...safeParams } = params || {};
    const response = await api.get('/users', { params: safeParams });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  create: async (data: {
    email: string;
    password: string;
    nomeCompleto: string;
    role: string;
    // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
    // O backend usa req.user.instituicaoId do JWT token automaticamente
    // Apenas SUPER_ADMIN pode especificar instituicaoId (backend valida e aceita)
    instituicaoId?: string; // Apenas para SUPER_ADMIN - backend valida
  }) => {
    // IMPORTANTE: Multi-tenant - remover instituicaoId se não for SUPER_ADMIN
    // O backend valida se o usuário é SUPER_ADMIN antes de aceitar instituicaoId
    const response = await api.post('/users', data);
    return response.data;
  },

  update: async (id: string, data: Partial<{
    nomeCompleto: string;
    email?: string; // Apenas ADMIN/SUPER_ADMIN podem atualizar email
    telefone: string;
    numeroIdentificacao: string;
    dataNascimento: string;
    genero: string;
    morada: string;
    status: string;
  }>) => {
    const response = await api.put(`/users/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },

  updateRole: async (userId: string, role: string) => {
    const response = await api.put(`/users/${userId}/role`, { role });
    return response.data;
  },
};

// Instituições API
export const instituicoesApi = {
  getAll: async (params?: { status?: string }) => {
    const response = await api.get('/instituicoes', { params });
    return response.data;
  },

  // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
  // O backend usa req.user.instituicaoId do JWT token automaticamente
  getMe: async () => {
    const response = await api.get('/instituicoes/me');
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/instituicoes/${id}`);
    return response.data;
  },

  getBySubdominio: async (subdominio: string) => {
    const response = await api.get(`/instituicoes/subdominio/${subdominio}`);
    return response.data;
  },

  /** Público - cursos (Superior) ou classes (Secundário) para inscrição */
  getOpcoesInscricao: async (subdominio: string) => {
    const response = await api.get(`/instituicoes/subdominio/${subdominio}/opcoes-inscricao`);
    return response.data as { tipoAcademico: 'SUPERIOR' | 'SECUNDARIO'; opcoes: Array<{ id: string; nome: string; codigo: string }> };
  },

  create: async (data: {
    nome: string;
    subdominio: string;
    tipoInstituicao?: string; // Opcional - será identificado automaticamente
    emailContato?: string;
    telefone?: string;
    endereco?: string;
  }) => {
    const response = await api.post('/instituicoes', data);
    return response.data;
  },

  update: async (id: string, data: Partial<{
    nome: string;
    subdominio: string;
    tipoInstituicao?: string; // Não pode ser alterado manualmente
    emailContato: string;
    telefone: string;
    endereco: string;
    status: string;
    logoUrl: string;
    multaPercentual: number;
    jurosDia: number;
  }>) => {
    const response = await api.put(`/instituicoes/${id}`, data);
    return response.data;
  },

  // Ativar/Desativar 2FA para a instituição
  toggleTwoFactor: async (id: string, enabled: boolean) => {
    const response = await api.put(`/instituicoes/${id}/two-factor`, { enabled });
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/instituicoes/${id}`);
    return response.data;
  },
};

// Cursos API (apenas para Ensino Superior)
export const cursosApi = {
  getAll: async (params?: { tipo?: string; ativo?: boolean; excludeTipo?: string; instituicaoId?: string }) => {
    // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
    // O backend usa req.user.instituicaoId do JWT token automaticamente
    const { instituicaoId, ...safeParams } = params || {};
    const response = await api.get('/cursos', { params: safeParams });
    // Axios retorna response.data, que já é o array de cursos
    return response.data || [];
  },

  getById: async (id: string) => {
    const response = await api.get(`/cursos/${id}`);
    return response.data;
  },

  create: async (data: {
    nome: string;
    codigo: string;
    cargaHoraria?: number;
    valorMensalidade?: number;
    descricao?: string | null;
    duracao?: string;
    grau?: string;
    tipo?: string;
    ativo?: boolean;
  }) => {
    const response = await api.post('/cursos', data);
    return response.data;
  },

  update: async (id: string, data: Partial<{
    nome: string;
    codigo: string;
    cargaHoraria: number;
    valorMensalidade: number;
    descricao: string | null;
    duracao: string;
    grau: string;
    tipo: string;
    ativo: boolean;
  }>) => {
    const response = await api.put(`/cursos/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/cursos/${id}`);
    return response.data;
  },

  // ============== VÍNCULOS CURSO-DISCIPLINA ==============
  // Vincular disciplina a curso
  vincularDisciplina: async (cursoId: string, data: {
    disciplinaId: string;
    semestre?: number; // Opcional (para Ensino Superior: 1 ou 2)
    trimestre?: number; // Opcional (para Ensino Secundário: 1, 2 ou 3)
    cargaHoraria?: number; // Opcional (usa da disciplina se não fornecido)
    obrigatoria?: boolean; // Opcional (padrão: true)
  }) => {
    // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
    // O backend usa req.user.instituicaoId do JWT token automaticamente
    const response = await api.post(`/cursos/${cursoId}/disciplinas`, data);
    return response.data;
  },

  // Listar disciplinas de um curso
  listarDisciplinas: async (cursoId: string) => {
    // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
    // O backend usa req.user.instituicaoId do JWT token automaticamente
    const response = await api.get(`/cursos/${cursoId}/disciplinas`);
    return response.data || [];
  },

  // Desvincular disciplina de um curso
  desvincularDisciplina: async (cursoId: string, disciplinaId: string) => {
    // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
    // O backend usa req.user.instituicaoId do JWT token automaticamente
    const response = await api.delete(`/cursos/${cursoId}/disciplinas/${disciplinaId}`);
    return response.data;
  },
};

// Classes API (apenas para Ensino Secundário)
export const classesApi = {
  getAll: async (params?: { instituicaoId?: string; ativo?: boolean }) => {
    // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
    // O backend usa req.user.instituicaoId do JWT token automaticamente
    const { instituicaoId, ...safeParams } = params || {};
    const response = await api.get('/classes', { params: safeParams });
    return response.data || [];
  },

  getById: async (id: string) => {
    const response = await api.get(`/classes/${id}`);
    return response.data;
  },

  create: async (data: {
    nome: string;
    codigo: string;
    cargaHoraria: number;
    valorMensalidade: number; // OBRIGATÓRIO para Ensino Secundário
    descricao?: string | null;
    ativo?: boolean;
  }) => {
    const response = await api.post('/classes', data);
    return response.data;
  },

  update: async (id: string, data: Partial<{
    nome: string;
    codigo: string;
    cargaHoraria: number;
    valorMensalidade: number; // OBRIGATÓRIO para Ensino Secundário
    descricao: string | null;
    ativo: boolean;
  }>) => {
    const response = await api.put(`/classes/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/classes/${id}`);
    return response.data;
  },
};

// Disciplinas API
export const disciplinasApi = {
  getAll: async (params?: { cursoId?: string; tipo?: string; instituicaoId?: string }) => {
    // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
    // O backend usa req.user.instituicaoId do JWT token automaticamente
    const { instituicaoId, ...safeParams } = params || {};
    const response = await api.get('/disciplinas', { params: safeParams });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/disciplinas/${id}`);
    return response.data;
  },

  create: async (data: {
    nome: string;
    cursoId?: string;
    classeId?: string | null;
    // semestre NÃO pertence à Disciplina - pertence ao PlanoEnsino
    // Removido: semestre: number;
    cargaHoraria?: number;
    obrigatoria?: boolean;
    tipoDisciplina?: string;
    trimestresOferecidos?: number[];
    // Multi-tenant: NUNCA enviar instituicaoId - o backend usa o do token JWT
  }) => {
    const response = await api.post('/disciplinas', data);
    return response.data;
  },

  update: async (id: string, data: Partial<{
    nome: string;
    // semestre NÃO pertence à Disciplina - pertence ao PlanoEnsino
    // Removido: semestre: number;
    cargaHoraria: number;
    obrigatoria: boolean;
    tipoDisciplina: string;
    trimestresOferecidos: number[];
  }>) => {
    const response = await api.put(`/disciplinas/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/disciplinas/${id}`);
    return response.data;
  },
};

// Turmas API
export const turmasApi = {
  // REGRA ABSOLUTA: Método para professores - NÃO aceita professorId
  // O backend extrai professorId automaticamente do JWT (req.user.userId)
  getTurmasProfessor: async (params?: { incluirPendentes?: boolean; anoLetivoId?: string }) => {
    // REGRA ABSOLUTA: NÃO enviar professorId - o backend extrai do JWT
    // Passar apenas parâmetros opcionais (incluirPendentes, anoLetivoId)
    const queryParams: any = {};
    if (params?.incluirPendentes) {
      queryParams.incluirPendentes = 'true';
    }
    if (params?.anoLetivoId) {
      queryParams.anoLetivoId = params.anoLetivoId;
    }
    
    // Usar rota especial /turmas/professor que não requer Configuração de Ensinos
    // Esta rota extrai professorId automaticamente do JWT (req.user.userId)
    const response = await api.get('/turmas/professor', { 
      params: queryParams
    });
    
    return response.data;
  },

  getAll: async (params?: { cursoId?: string; professorId?: string; ano?: number; instituicaoId?: string; incluirPendentes?: boolean; anoLetivoId?: string; useRegularEndpoint?: boolean }) => {
    // Multi-tenant: instituicaoId vem do JWT, não do frontend
    const { instituicaoId, ...restParams } = params || {};
    const queryParams = { ...restParams };

    // P0: Se professorId foi passado, usar GET /turmas (backend aceita professores.id ou users.id)
    // Caso contrário, professor usa getTurmasProfessor() -> /turmas/professor
    const response = await api.get('/turmas', { params: queryParams });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/turmas/${id}`);
    return response.data;
  },

  create: async (data: {
    nome: string;
    cursoId?: string;
    classeId?: string;
    classe?: string;
    anoLetivoId: string;
    ano: number;
    semestre?: number | null;
    horario?: string | null;
    sala?: string | null;
    turnoId?: string | null;
    capacidade?: number;
    // Multi-tenant: NUNCA enviar instituicaoId - o backend usa o do token JWT
  }) => {
    // IMPORTANTE: Multi-tenant - remover instituicaoId se presente
    const { instituicaoId, ...safeData } = data as any;
    const response = await api.post('/turmas', safeData);
    return response.data;
  },

  update: async (id: string, data: Partial<{
    nome: string;
    cursoId?: string;
    classeId?: string | null;
    classe?: string | null;
    anoLetivoId?: string;
    ano: number;
    semestre?: number | null;
    horario?: string | null;
    sala?: string | null;
    turnoId?: string | null;
    capacidade?: number;
  }>) => {
    const response = await api.put(`/turmas/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/turmas/${id}`);
    return response.data;
  },
};

// Turnos API
export const turnosApi = {
  getAll: async (params?: { instituicaoId?: string; ativo?: boolean }) => {
    // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
    // O backend usa req.user.instituicaoId do JWT token automaticamente
    const { instituicaoId, ...safeParams } = params || {};
    const response = await api.get('/turnos', { params: safeParams });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/turnos/${id}`);
    return response.data;
  },

  create: async (data: {
    nome: string;
    horaInicio?: string | null;
    horaFim?: string | null;
  }) => {
    const response = await api.post('/turnos', data);
    return response.data;
  },

  update: async (id: string, data: Partial<{
    nome: string;
    horaInicio: string | null;
    horaFim: string | null;
  }>) => {
    const response = await api.put(`/turnos/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/turnos/${id}`);
    return response.data;
  },
};

// Matrículas API
export const matriculasApi = {
  getAll: async (params?: { alunoId?: string; turmaId?: string; status?: string }) => {
    const response = await api.get('/matriculas', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/matriculas/${id}`);
    return response.data;
  },

  getByAlunoId: async (alunoId: string) => {
    const response = await api.get('/matriculas', { params: { alunoId } });
    return response.data;
  },

  getMinhasMatriculas: async () => {
    const response = await api.get('/matriculas/aluno');
    return response.data;
  },

  getAlunosByTurmaProfessor: async (turmaId: string) => {
    const response = await api.get(`/matriculas/professor/turma/${turmaId}/alunos`);
    return response.data;
  },

  create: async (data: {
    alunoId: string;
    turmaId: string;
    status?: string;
  }) => {
    const response = await api.post('/matriculas', data);
    return response.data;
  },

  update: async (id: string, data: Partial<{
    status: string;
    turmaId: string;
  }>) => {
    const response = await api.put(`/matriculas/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/matriculas/${id}`);
    return response.data;
  },
};

// Notas API
export const notasApi = {
  getAll: async (params?: { exameId?: string; alunoId?: string; turmaId?: string; matriculaId?: string }) => {
    // Handle matriculaId for backwards compatibility - convert to turmaId
    if (params?.matriculaId) {
      // Get turmaId from matricula first if needed
      const response = await api.get('/notas', { params: { alunoId: params.alunoId } });
      return response.data;
    }
    const response = await api.get('/notas', { params });
    return response.data;
  },

  getByTurma: async (turmaId: string) => {
    const response = await api.get('/notas', { params: { turmaId } });
    return response.data;
  },

  getByMatriculaIds: async (matriculaIds: string[]) => {
    // For backwards compatibility, get notas by turma instead
    // The frontend components will need to be gradually migrated
    const response = await api.get('/notas');
    return response.data;
  },

  getAlunosNotasByTurma: async (turmaId: string) => {
    const response = await api.get('/notas/turma/alunos', { params: { turmaId } });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/notas/${id}`);
    return response.data;
  },

  getByAluno: async () => {
    const response = await api.get('/notas/aluno');
    return response.data;
  },

  create: async (data: {
    alunoId?: string;
    exameId?: string;
    matriculaId?: string;
    tipo?: string;
    valor: number;
    peso?: number;
    observacoes?: string;
  }) => {
    // Map old format to new format
    const payload = {
      alunoId: data.alunoId,
      exameId: data.exameId,
      valor: data.valor,
      observacoes: data.observacoes
    };
    const response = await api.post('/notas', payload);
    return response.data;
  },

  createBatch: async (notas: Array<{
    alunoId?: string;
    exameId?: string;
    matriculaId?: string;
    tipo?: string;
    valor: number;
    peso?: number;
    observacoes?: string;
  }>) => {
    const response = await api.post('/notas/batch', { notas });
    return response.data;
  },

  update: async (id: string, data: Partial<{
    observacoes: string;
  }>) => {
    // REGRA: updateNota NÃO permite mudança de valor
    // Use corrigir() para mudanças de valor (exige motivo obrigatório)
    const response = await api.put(`/notas/${id}`, data);
    return response.data;
  },

  corrigir: async (id: string, data: {
    valor: number;
    motivo: string; // OBRIGATÓRIO: Motivo da correção
    observacoes?: string;
  }) => {
    const response = await api.put(`/notas/${id}/corrigir`, data);
    return response.data;
  },

  getHistorico: async (id: string) => {
    const response = await api.get(`/notas/${id}/historico`);
    return response.data;
  },

  // DEPRECATED: DELETE bloqueado no backend - usar corrigir() em vez disso
  delete: async (id: string) => {
    const response = await api.delete(`/notas/${id}`);
    return response.data;
  },
};

// Frequências API
export const frequenciasApi = {
  getAll: async (params?: { aulaId?: string; alunoId?: string }) => {
    const response = await api.get('/frequencias', { params });
    return response.data;
  },

  getByAula: async (aulaId: string) => {
    const response = await api.get('/frequencias', { params: { aulaId } });
    return response.data;
  },

  getByAluno: async (alunoId: string) => {
    const response = await api.get('/frequencias', { params: { alunoId } });
    return response.data;
  },

  create: async (data: {
    aulaId: string;
    alunoId: string;
    presente: boolean;
    justificativa?: string;
  }) => {
    const response = await api.post('/frequencias', data);
    return response.data;
  },

  update: async (id: string, data: Partial<{
    presente: boolean;
    justificativa: string;
  }>) => {
    const response = await api.put(`/frequencias/${id}`, data);
    return response.data;
  },
};

// Aulas API
export const aulasApi = {
  getAll: async (params?: { turmaId?: string }) => {
    const response = await api.get('/aulas', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/aulas/${id}`);
    return response.data;
  },

  create: async (data: {
    turmaId: string;
    data: string;
    conteudo?: string;
    observacoes?: string;
  }) => {
    const response = await api.post('/aulas', data);
    return response.data;
  },

  update: async (id: string, data: Partial<{
    data: string;
    conteudo: string;
    observacoes: string;
  }>) => {
    const response = await api.put(`/aulas/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/aulas/${id}`);
    return response.data;
  },
};

// Mensalidades API
export const mensalidadesApi = {
  getAll: async (params?: { 
    alunoId?: string; 
    status?: string; 
    // NOTE: instituicaoId should NOT be sent from frontend - it comes from token
    dataInicio?: string; 
    dataFim?: string;
    mesReferencia?: number;
    anoReferencia?: number;
  }) => {
    // Remove instituicaoId if accidentally provided - security: it must come from token
    const safeParams = { ...params };
    delete (safeParams as any).instituicaoId;
    const response = await api.get('/mensalidades', { params: safeParams });
    return response.data;
  },

  getByAluno: async (alunoId: string) => {
    const response = await api.get('/mensalidades', { params: { alunoId } });
    return response.data;
  },

  // Get mensalidades for the current authenticated student
  getMinhasMensalidades: async () => {
    const response = await api.get('/mensalidades/aluno');
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/mensalidades/${id}`);
    return response.data;
  },

  create: async (data: {
    alunoId: string;
    valor: number;
    mesReferencia: number;
    anoReferencia: number;
    dataVencimento: string;
    // NOTE: instituicaoId should NOT be sent - it comes from token
  }) => {
    // Remove instituicaoId if provided - security: it must come from token
    const safeData = { ...data };
    delete (safeData as any).instituicaoId;
    const response = await api.post('/mensalidades', safeData);
    return response.data;
  },

  createBatch: async (data: {
    alunoIds: string[];
    valor: number;
    mesReferencia: number;
    anoReferencia: number;
    dataVencimento: string;
    percentualMulta?: number;
  }) => {
    const response = await api.post('/mensalidades/lote', data);
    return response.data;
  },

  gerarParaTodos: async (data: {
    mesReferencia: number;
    anoReferencia: number;
    dataVencimento: string;
    valorPadrao?: number; // Opcional - usado apenas se aluno não tiver curso
    percentualMulta?: number;
  }) => {
    const response = await api.post('/mensalidades/gerar', data);
    return response.data;
  },

  update: async (id: string, data: Partial<{
    status: string;
    dataPagamento: string;
    formaPagamento: string;
    reciboNumero: string;
    observacoes: string;
  }>) => {
    const response = await api.put(`/mensalidades/${id}`, data);
    return response.data;
  },

  registrarPagamento: async (id: string, data: {
    valor: number;
    formaPagamento: string;
    dataPagamento: string;
    observacoes?: string;
  }) => {
    // Mapear formaPagamento para metodoPagamento (backend espera metodoPagamento)
    const requestData = {
      valor: data.valor,
      metodoPagamento: data.formaPagamento,
      dataPagamento: data.dataPagamento, // Backend aceita dataPagamento opcional
      observacoes: data.observacoes,
    };
    const response = await api.post(`/pagamentos/mensalidade/${id}/registrar`, requestData);
    return response.data;
  },

  aplicarMultas: async () => {
    // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
    // O backend usa req.user.instituicaoId do JWT token automaticamente
    const response = await api.post('/mensalidades/aplicar-multas', {});
    return response.data;
  },

  enviarLembretes: async () => {
    // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
    // O backend usa req.user.instituicaoId do JWT token automaticamente
    const response = await api.post('/mensalidades/enviar-lembretes', {});
    return response.data;
  },
};

// Comunicados API
export const comunicadosApi = {
  getAll: async (params?: { instituicaoId?: string; destinatarios?: string }) => {
    const response = await api.get('/comunicados', { params });
    return response.data;
  },

  /** Upload de anexo (imagem, PDF, vídeo, áudio) - multi-tenant via JWT */
  uploadAnexo: async (file: File): Promise<{ filename: string; type: string; name: string; size: number }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/comunicados/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /** URL para download de anexo (utilizar no frontend) */
  getDownloadUrl: (comunicadoId: string, filename: string): string => {
    return `${API_URL}/comunicados/${comunicadoId}/anexo/${encodeURIComponent(filename)}`;
  },

  /** Download de anexo com credenciais (para links "Baixar") */
  downloadAnexo: async (comunicadoId: string, filename: string, displayName?: string) => {
    const res = await api.get(`/comunicados/${comunicadoId}/anexo/${encodeURIComponent(filename)}`, { responseType: 'blob' });
    const blob = new Blob([res.data]);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = displayName || filename;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  // Get comunicados for the current user (filtered by role/turma/curso)
  getUserComunicados: async () => {
    const response = await api.get('/comunicados/publicos');
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/comunicados/${id}`);
    return response.data;
  },

  create: async (data: {
    titulo: string;
    conteudo: string;
    destinatarios?: string;
    tipo?: string;
    tipoEnvio?: 'GERAL' | 'ROLE' | 'ALUNO' | 'TURMA' | 'CURSO';
    destinatariosDetalhe?: Array<{
      tipo: 'ROLE' | 'ALUNO' | 'TURMA' | 'CURSO';
      referenciaId?: string;
    }>;
    dataExpiracao?: string;
    anexos?: Array<{ filename: string; type: string; name: string; size?: number }>;
  }) => {
    const response = await api.post('/comunicados', data);
    return response.data;
  },

  update: async (id: string, data: Partial<{
    titulo: string;
    conteudo: string;
    destinatarios: string;
    tipo: string;
    tipoEnvio?: 'GERAL' | 'ROLE' | 'ALUNO' | 'TURMA' | 'CURSO';
    destinatariosDetalhe?: Array<{
      tipo: 'ROLE' | 'ALUNO' | 'TURMA' | 'CURSO';
      referenciaId?: string;
    }>;
    dataExpiracao: string;
    ativo: boolean;
  }>) => {
    const response = await api.put(`/comunicados/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/comunicados/${id}`);
    return response.data;
  },

  markAsRead: async (id: string) => {
    const response = await api.post(`/comunicados/${id}/marcar-lido`);
    return response.data;
  },

  sendEmail: async (data: {
    comunicadoId: string;
    destinatarios: string;
    titulo: string;
    conteudo: string;
    instituicaoNome: string;
    instituicaoId?: string;
  }) => {
    const response = await api.post('/comunicados/send-email', data);
    return response.data;
  },
};

// Alunos API (profiles com role ALUNO)
export const alunosApi = {
  getAll: async (params?: { status?: string; instituicaoId?: string }) => {
    // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
    // O backend usa req.user.instituicaoId do JWT token automaticamente
    const { instituicaoId, ...safeParams } = params || {};
    const response = await api.get('/users', { params: { ...safeParams, role: 'ALUNO' } });
    return response.data;
  },

  /** Listagem paginada (GET /estudantes) — NUNCA enviar instituicaoId */
  getList: async (params?: ListQueryParams) => {
    const { instituicaoId, ...safeParams } = params || {};
    const response = await api.get('/estudantes', { params: safeParams });
    return response.data as ListResponse<unknown>;
  },

  getById: async (id: string) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  create: async (data: {
    email: string;
    password?: string;
    nomeCompleto: string;
    telefone?: string | null;
    numeroIdentificacao?: string | null;
    dataNascimento?: string | null;
    genero?: string;
    morada?: string | null;
    cidade?: string | null;
    pais?: string | null;
    codigoPostal?: string | null;
    nomePai?: string | null;
    nomeMae?: string | null;
    statusAluno?: string;
    turmaId?: string | null;
    profissao?: string | null;
    senha?: string | null;
    tipoSanguineo?: string | null;
    instituicaoId?: string;
  }) => {
    // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
    // O backend usa req.user.instituicaoId do JWT token automaticamente
    const { instituicaoId, ...dataToSend } = data;
    const response = await api.post('/users', { 
      ...dataToSend, 
      role: 'ALUNO',
      // Se senha fornecida, enviar como password (backend aceita ambos)
      password: data.senha || undefined
    });
    return response.data;
  },

  update: async (id: string, data: Partial<{
    nomeCompleto: string;
    telefone: string;
    numeroIdentificacao: string;
    dataNascimento: string;
    genero: string;
    morada: string;
    cidade: string;
    pais: string;
    nomePai: string;
    nomeMae: string;
    statusAluno: string;
  }>) => {
    const response = await api.put(`/users/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },

  deactivate: async (id: string) => {
    const response = await api.put(`/users/${id}`, { statusAluno: 'Inativo' });
    return response.data;
  },
};

// Professores API (profiles com role PROFESSOR)
export const professoresApi = {
  getAll: async (params?: { instituicaoId?: string }) => {
    const response = await api.get('/users', { params: { ...params, role: 'PROFESSOR' } });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  create: async (data: {
    email: string;
    password?: string;
    nomeCompleto: string;
    telefone?: string;
    numeroIdentificacao?: string;
    instituicaoId: string;
  }) => {
    const response = await api.post('/users', { ...data, role: 'PROFESSOR' });
    return response.data;
  },

  update: async (id: string, data: Partial<{
    nomeCompleto: string;
    telefone: string;
    numeroIdentificacao: string;
    qualificacao: string;
    cargoAtual: string;
    avatarUrl: string;
  }>) => {
    const response = await api.put(`/users/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },

  getComprovativo: async (id: string) => {
    const response = await api.get(`/users/${id}/comprovativo`);
    return response.data;
  },

  // Criar registro Professor (tabela professores) para user com role PROFESSOR
  // Usar para corrigir professores criados antes do fix P0 (que não tinham professor record)
  // Backend: POST /users/:id/professor - id deve ser users.id
  createProfessor: async (userId: string) => {
    const response = await api.post(`/users/${userId}/professor`);
    return response.data;
  },
};

// Candidaturas API
export const candidaturasApi = {
  getAll: async (params?: { instituicaoId?: string; status?: string }) => {
    const response = await api.get('/candidaturas', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/candidaturas/${id}`);
    return response.data;
  },

  create: async (data: {
    nomeCompleto: string;
    email: string;
    telefone?: string | null;
    numeroIdentificacao: string;
    dataNascimento?: string | null;
    genero?: string | null;
    morada?: string | null;
    cidade?: string | null;
    pais?: string;
    cursoPretendido?: string | null;
    classePretendida?: string | null;  // Secundário: 10ª, 11ª, etc
    turnoPreferido?: string | null;
    instituicaoId?: string | null;
    status?: string;
    documentosUrl?: string[];
  }) => {
    const response = await api.post('/candidaturas', data);
    return response.data;
  },

  update: async (id: string, data: Partial<{
    status: string;
    observacoes: string;
  }>) => {
    const response = await api.put(`/candidaturas/${id}`, data);
    return response.data;
  },

  aprovar: async (id: string) => {
    const response = await api.post(`/candidaturas/${id}/aprovar`);
    return response.data;
  },

  rejeitar: async (id: string, observacoes?: string) => {
    const response = await api.post(`/candidaturas/${id}/rejeitar`, { observacoes });
    return response.data;
  },
};

// Horários API (Módulo Completo - multi-tenant, RBAC)
export const horariosApi = {
  getAll: async (params?: {
    turmaId?: string;
    anoLetivoId?: string;
    professorId?: string;
    diaSemana?: number;
    status?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const response = await api.get('/horarios', { params });
    return response.data as ListResponse<any> | any[];
  },

  create: async (data: {
    planoEnsinoId?: string;
    turmaId?: string;
    disciplinaId?: string;
    diaSemana: number;
    horaInicio: string;
    horaFim: string;
    sala?: string;
  }) => {
    const response = await api.post('/horarios', data);
    return response.data;
  },

  update: async (id: string, data: Partial<{
    diaSemana: number;
    horaInicio: string;
    horaFim: string;
    sala: string;
  }>) => {
    const response = await api.put(`/horarios/${id}`, data);
    return response.data;
  },

  aprovar: async (id: string) => {
    const response = await api.patch(`/horarios/${id}/aprovar`);
    return response.data;
  },

  delete: async (id: string) => {
    await api.delete(`/horarios/${id}`);
  },

  getGradeTurma: async (turmaId: string) => {
    const response = await api.get(`/horarios/grade/turma/${turmaId}`);
    return response.data;
  },

  getGradeProfessor: async (professorId: string) => {
    const response = await api.get(`/horarios/grade/professor/${professorId}`);
    return response.data;
  },

  /** Imprimir horário da turma - retorna blob PDF */
  imprimirTurma: async (turmaId: string): Promise<Blob> => {
    const response = await api.get(`/horarios/turma/${turmaId}/imprimir`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /** Imprimir horário do professor - retorna blob PDF */
  imprimirProfessor: async (professorId: string): Promise<Blob> => {
    const response = await api.get(`/horarios/professor/${professorId}/imprimir`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /** Imprimir horário por ID - GET /horarios/:id/imprimir?tipo=turma|professor */
  imprimirPorId: async (id: string, tipo: 'turma' | 'professor'): Promise<Blob> => {
    const response = await api.get(`/horarios/${id}/imprimir`, {
      params: { tipo },
      responseType: 'blob',
    });
    return response.data;
  },
};

// Exames API
export const examesApi = {
  getAll: async (params?: { turmaId?: string; status?: string }) => {
    const response = await api.get('/exames', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/exames/${id}`);
    return response.data;
  },

  create: async (data: {
    nome: string;
    turmaId: string;
    dataExame: string;
    tipo?: string;
    peso?: number;
    horaInicio?: string;
    horaFim?: string;
    sala?: string;
    observacoes?: string;
  }) => {
    const response = await api.post('/exames', data);
    return response.data;
  },

  update: async (id: string, data: Partial<{
    nome: string;
    dataExame: string;
    tipo: string;
    peso: number;
    horaInicio: string;
    horaFim: string;
    sala: string;
    observacoes: string;
    status: string;
  }>) => {
    const response = await api.put(`/exames/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/exames/${id}`);
    return response.data;
  },
};

// Eventos Calendário API
export const eventosApi = {
  getAll: async (params?: { instituicaoId?: string; tipo?: string }) => {
    const response = await api.get('/eventos', { params });
    return response.data;
  },

  create: async (data: {
    titulo: string;
    descricao?: string;
    dataInicio: string;
    dataFim?: string;
    horaInicio?: string;
    horaFim?: string;
    tipo?: string;
    cor?: string;
    // instituicaoId NÃO deve vir do frontend - vem do JWT
  }) => {
    const response = await api.post('/eventos', data);
    return response.data;
  },

  update: async (id: string, data: Partial<{
    titulo: string;
    descricao: string;
    dataInicio: string;
    dataFim: string;
    horaInicio: string;
    horaFim: string;
    tipo: string;
    cor: string;
  }>) => {
    const response = await api.put(`/eventos/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/eventos/${id}`);
    return response.data;
  },
};

// Aluno Disciplinas API
// API para listagem geral de matrículas em disciplinas (tabelas e dashboards)
export const matriculasDisciplinasApi = {
  /**
   * Busca todas as matrículas em disciplinas usando a rota v2
   * @param params - Filtros opcionais: aluno_id, turma_id, curso_id, ano_letivo, status
   */
  getAll: async (params?: { alunoId?: string; aluno_id?: string; turmaId?: string; turma_id?: string; cursoId?: string; curso_id?: string; ano_letivo?: number; anoLetivo?: number; status?: string }) => {
    // Normalizar parâmetros (suporta ambos os formatos: camelCase e snake_case)
    const cleanParams: Record<string, string | number> = {};
    
    if (params) {
      // Mapear para snake_case (formato esperado pelo backend v2)
      if (params.alunoId || params.aluno_id) {
        cleanParams.aluno_id = String(params.alunoId || params.aluno_id);
      }
      if (params.turmaId || params.turma_id) {
        cleanParams.turma_id = String(params.turmaId || params.turma_id);
      }
      if (params.cursoId || params.curso_id) {
        cleanParams.curso_id = String(params.cursoId || params.curso_id);
      }
      if (params.ano_letivo || params.anoLetivo) {
        cleanParams.ano_letivo = Number(params.ano_letivo || params.anoLetivo);
      }
      if (params.status) {
        cleanParams.status = String(params.status);
      }
    }
    
    // Usar a rota v2 (mais robusta)
    const response = await api.get('/v2/matriculas-disciplinas', { 
      params: Object.keys(cleanParams).length > 0 ? cleanParams : undefined 
    });
    return response.data;
  },
};

// API para detalhe de matrículas por aluno (exige aluno_id e ano_letivo)
export const alunoDisciplinasApi = {
  /**
   * @deprecated Use matriculasDisciplinasApi.getAll() para listagem geral
   * Esta função será removida em versões futuras
   */
  getAll: async (params?: { alunoId?: string; disciplinaId?: string; turmaId?: string }) => {
    // Redirecionar para o novo endpoint para manter compatibilidade
    const response = await api.get('/matriculas-disciplinas', { params });
    return response.data;
  },

  /**
   * Busca matrículas de um aluno em um ano letivo específico
   * @param alunoId - ID do aluno (obrigatório)
   * @param anoLetivo - Ano letivo (obrigatório)
   * @param params - Parâmetros opcionais (disciplinaId, turmaId)
   */
  getByAluno: async (
    alunoId: string, 
    anoLetivo: number,
    params?: { disciplinaId?: string; turmaId?: string }
  ) => {
    if (!alunoId || alunoId.trim() === '') {
      throw new Error('aluno_id é obrigatório');
    }
    if (!anoLetivo || isNaN(anoLetivo)) {
      throw new Error('ano_letivo é obrigatório');
    }
    const response = await api.get('/aluno-disciplinas', { 
      params: { 
        aluno_id: alunoId, 
        ano_letivo: anoLetivo,
        ...params 
      } 
    });
    return response.data;
  },

  create: async (data: {
    alunoId: string;
    disciplinaId: string;
    turmaId?: string;
    ano: number;
    semestre: string;
    status?: string;
  }) => {
    const response = await api.post('/aluno-disciplinas', data);
    return response.data;
  },

  createBulk: async (data: {
    alunoId: string;
    ano: number;
    semestre: string;
    status?: string;
    disciplinaIds?: string[];
  }) => {
    const response = await api.post('/aluno-disciplinas/bulk', data);
    return response.data;
  },

  update: async (id: string, data: Partial<{
    status: string;
  }>) => {
    const response = await api.put(`/aluno-disciplinas/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/aluno-disciplinas/${id}`);
    return response.data;
  },
};

// Matrícula Anual API
export const matriculasAnuaisApi = {
  getAll: async (params?: { alunoId?: string; anoLetivo?: number; status?: string }) => {
    const response = await api.get('/matriculas-anuais', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/matriculas-anuais/${id}`);
    return response.data;
  },

  getByAluno: async (alunoId: string) => {
    const response = await api.get(`/matriculas-anuais/aluno/${alunoId}`);
    return response.data;
  },

  getAtivaByAluno: async (alunoId: string) => {
    const response = await api.get(`/matriculas-anuais/aluno/${alunoId}/ativa`);
    return response.data;
  },

  getMeusAnosLetivos: async () => {
    const response = await api.get('/matriculas-anuais/meus-anos-letivos');
    return response.data;
  },

  getSugestaoClasse: async (alunoId: string, anoLetivo?: number) => {
    const response = await api.get(`/matriculas-anuais/sugestao/${alunoId}`, {
      params: anoLetivo ? { anoLetivo } : undefined,
    });
    return response.data;
  },

  create: async (data: {
    alunoId: string;
    anoLetivo?: number;
    anoLetivoId?: string;
    nivelEnsino: 'SECUNDARIO' | 'SUPERIOR';
    classeOuAnoCurso: string;
    cursoId?: string;
    overrideReprovado?: boolean;
  }) => {
    const response = await api.post('/matriculas-anuais', data);
    return response.data;
  },

  update: async (id: string, data: Partial<{
    status?: 'ATIVA' | 'CONCLUIDA' | 'CANCELADA';
    classeOuAnoCurso?: string;
    cursoId?: string | null;
    overrideReprovado?: boolean;
  }>) => {
    const response = await api.put(`/matriculas-anuais/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/matriculas-anuais/${id}`);
    return response.data;
  },
};

// Notas Histórico API
export const notasHistoricoApi = {
  getAll: async (params?: { notaId?: string; matriculaId?: string }) => {
    const response = await api.get('/notas-historico', { params });
    return response.data;
  },
};

// Trimestres Fechados API
export const trimestresFechadosApi = {
  getAll: async (params?: { instituicaoId?: string; anoLetivo?: number }) => {
    const response = await api.get('/trimestres-fechados', { params });
    return response.data;
  },

  fechar: async (data: {
    instituicaoId: string;
    anoLetivo: number;
    trimestre: number;
  }) => {
    const response = await api.post('/trimestres-fechados/fechar', data);
    return response.data;
  },

  reabrir: async (data: {
    instituicaoId: string;
    anoLetivo: number;
    trimestre: number;
  }) => {
    const response = await api.post('/trimestres-fechados/reabrir', data);
    return response.data;
  },
};

// Documentos Aluno API
export const documentosAlunoApi = {
  getAll: async (params?: { alunoId?: string }) => {
    const response = await api.get('/documentos-aluno', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/documentos-aluno/${id}`);
    return response.data;
  },

  getByAlunoId: async (alunoId: string) => {
    const response = await api.get('/documentos-aluno', { params: { alunoId } });
    return response.data;
  },

  create: async (data: {
    alunoId: string;
    nomeArquivo: string;
    tipoDocumento: string;
    descricao?: string | null;
    arquivoUrl: string;
    tamanhoBytes?: number;
  }) => {
    const response = await api.post('/documentos-aluno', data);
    return response.data;
  },

  upload: async (data: FormData) => {
    const response = await api.post('/documentos-aluno/upload', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/documentos-aluno/${id}`);
    return response.data;
  },

  getArquivoUrl: async (id: string): Promise<string> => {
    // Get signed URL from the specific endpoint which includes permission checks
    const response = await api.get(`/documentos-aluno/${id}/arquivo/signed-url`);
    return response.data.url;
  },
  
  getArquivoDownloadUrl: async (id: string): Promise<string> => {
    // Get signed URL for download
    const response = await api.get(`/documentos-aluno/${id}/arquivo/signed-url`);
    const baseUrl = response.data.url;
    // Add download parameter to force download
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}download=true`;
  },
};

// Planos API
export const planosApi = {
  getAll: async (params?: { ativo?: boolean; tipoAcademico?: 'SECUNDARIO' | 'SUPERIOR' }) => {
    const response = await api.get('/planos', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/planos/${id}`);
    return response.data;
  },

  create: async (data: {
    nome: string;
    descricao?: string;
    tipoAcademico?: 'SECUNDARIO' | 'SUPERIOR' | null;
    precoMensal: number;
    valorAnual?: number | null;
    valorSemestral?: number | null;
    precoSecundario: number;
    precoUniversitario: number;
    limiteAlunos?: number;
    limiteProfessores?: number;
    limiteCursos?: number;
    funcionalidades?: any;
    ativo?: boolean;
  }) => {
    const response = await api.post('/planos', data);
    return response.data;
  },

  update: async (id: string, data: Partial<{
    nome: string;
    descricao: string;
    tipoAcademico: 'SECUNDARIO' | 'SUPERIOR' | null;
    precoMensal: number;
    valorAnual: number | null;
    valorSemestral: number | null;
    precoSecundario: number;
    precoUniversitario: number;
    limiteAlunos: number;
    limiteProfessores: number;
    limiteCursos: number;
    funcionalidades: any;
    ativo: boolean;
  }>) => {
    const response = await api.put(`/planos/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/planos/${id}`);
    return response.data;
  },

  /** Sincroniza os 3 planos estratégicos da landing para a tabela Plano (para onboarding) */
  syncFromLanding: async (planos: Array<{
    id: string;
    nome: string;
    tagline: string;
    precoMensal: number;
    precoAnual: number;
    limiteAlunos: number | null;
    cta: string;
    microtexto: string;
    popular: boolean;
  }>) => {
    const response = await api.post('/planos/sync-from-landing', { planos });
    return response.data;
  },
};

// Planos Preços API (Fonte da Verdade de Preços)
export const planosPrecosApi = {
  // Buscar preço por tipo de instituição e plano
  getPreco: async (params: {
    planoId: string;
    tipoInstituicao: 'SECUNDARIO' | 'SUPERIOR';
  }) => {
    const response = await api.get('/planos-precos', { params });
    return response.data;
  },

  // Listar preços de um plano
  getPrecosByPlano: async (planoId: string) => {
    const response = await api.get(`/planos-precos/plano/${planoId}`);
    return response.data;
  },

  // Criar ou atualizar preço (apenas SUPER_ADMIN)
  createOrUpdate: async (data: {
    planoId: string;
    tipoInstituicao: 'SECUNDARIO' | 'SUPERIOR';
    valorMensal: number;
    moeda?: string;
    ativo?: boolean;
  }) => {
    const response = await api.post('/planos-precos', data);
    return response.data;
  },
};

// Bolsas e Descontos API
export const bolsasApi = {
  getAll: async (params?: { ativo?: boolean }) => {
    const response = await api.get('/bolsas', { params });
    return response.data;
  },

  create: async (data: {
    nome: string;
    tipo: 'PERCENTUAL' | 'VALOR';
    valor: number;
    descricao?: string | null;
    ativo?: boolean;
  }) => {
    const response = await api.post('/bolsas', data);
    return response.data;
  },

  update: async (id: string, data: Partial<{
    nome: string;
    tipo: 'PERCENTUAL' | 'VALOR';
    valor: number;
    descricao?: string | null;
    ativo?: boolean;
  }>) => {
    const response = await api.put(`/bolsas/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/bolsas/${id}`);
    return response.data;
  },
};

// Aluno Bolsas API
export const alunoBolsasApi = {
  getAll: async (params?: { alunoId?: string; bolsaId?: string }) => {
    const response = await api.get('/aluno-bolsas', { params });
    return response.data;
  },

  create: async (data: {
    alunoId: string;
    bolsaId: string;
    dataInicio: string;
    dataFim?: string;
    observacao?: string;
    ativo?: boolean;
  }) => {
    const response = await api.post('/aluno-bolsas', data);
    return response.data;
  },

  update: async (id: string, data: Partial<{
    dataFim: string;
    observacao: string;
    ativo: boolean;
  }>) => {
    const response = await api.put(`/aluno-bolsas/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/aluno-bolsas/${id}`);
    return response.data;
  },
};

// Dashboard Stats API
export const statsApi = {
  // IMPORTANTE: Multi-tenant - instituicaoId vem APENAS do JWT (req.user.instituicaoId)
  // SUPER_ADMIN pode usar query param opcional, mas por padrão usa do token
  getAdminStats: async (params?: { instituicaoId?: string }) => {
    // Remover instituicaoId se presente - backend usa do token (SUPER_ADMIN pode passar via query)
    const { instituicaoId, ...safeParams } = params || {};
    const finalParams = params?.instituicaoId ? { instituicaoId } : safeParams;
    const response = await api.get('/stats/admin', { params: finalParams });
    return response.data;
  },

  getSuperAdminStats: async () => {
    const response = await api.get('/stats/super-admin');
    return response.data;
  },

  // IMPORTANTE: Multi-tenant - instituicaoId vem APENAS do JWT via addInstitutionFilter
  getRecentUsers: async (params?: { limit?: number; instituicaoId?: string }) => {
    const { instituicaoId, ...safeParams } = params || {};
    const response = await api.get('/stats/recent-users', { params: safeParams });
    return response.data;
  },

  getTodayClasses: async () => {
    // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
    // O backend usa req.user.instituicaoId do JWT token automaticamente via addInstitutionFilter
    const response = await api.get('/stats/today-classes');
    return response.data;
  },

  getUsoInstituicao: async () => {
    // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
    // O backend usa req.user.instituicaoId do JWT token automaticamente
    const response = await api.get('/stats/uso-instituicao');
    return response.data;
  },
};

// User Roles API
export const userRolesApi = {
  getAll: async (params?: { userId?: string; instituicaoId?: string; role?: string }) => {
    const response = await api.get('/user-roles', { params });
    return response.data;
  },

  getByRole: async (role: string, instituicaoId?: string) => {
    const response = await api.get('/user-roles', { params: { role, instituicaoId } });
    return response.data;
  },

  create: async (data: {
    userId: string;
    role: string;
    instituicaoId?: string;
  }) => {
    const response = await api.post('/user-roles', data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/user-roles/${id}`);
    return response.data;
  },
};

// Profiles API
export const profilesApi = {
  getAll: async (params?: { instituicaoId?: string; role?: string; search?: string; status?: string }) => {
    const response = await api.get('/profiles', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/profiles/${id}`);
    return response.data;
  },

  getByIds: async (ids: string[]) => {
    const response = await api.post('/profiles/by-ids', { ids });
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.put(`/profiles/${id}`, data);
    return response.data;
  },
};

// Funcionários API
export const funcionariosApi = {
  getAll: async (params?: { status?: string; cargoId?: string; departamentoId?: string; instituicaoId?: string }) => {
    // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
    const { instituicaoId, ...safeParams } = params || {};
    const response = await api.get('/funcionarios', { params: { ...safeParams, pageSize: 1000 } });
    const body = response.data;
    return (Array.isArray(body) ? body : body?.data ?? []) as unknown[];
  },
  /** Listagem paginada — NUNCA enviar instituicaoId */
  getList: async (params?: ListQueryParams) => {
    const { instituicaoId, ...safeParams } = params || {};
    const response = await api.get('/funcionarios', { params: safeParams });
    return response.data as ListResponse<unknown>;
  },

  getById: async (id: string) => {
    const response = await api.get(`/funcionarios/${id}`);
    return response.data;
  },

  create: async (data: {
    userId?: string;
    nomeCompleto?: string;
    email?: string;
    telefone?: string;
    numeroIdentificacao?: string;
    departamentoId?: string;
    cargoId?: string;
    salario?: number;
    dataAdmissao?: string;
    status?: string;
  }) => {
    const response = await api.post('/funcionarios', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.put(`/funcionarios/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/funcionarios/${id}`);
    return response.data;
  },

  /** Imprimir Comprovante de Admissão - retorna blob PDF */
  imprimirAdmissao: async (id: string): Promise<Blob> => {
    const response = await api.get(`/rh/funcionarios/${id}/admissao/imprimir`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

// Departamentos API
export const departamentosApi = {
  getAll: async (params?: { instituicaoId?: string; ativo?: boolean }) => {
    const response = await api.get('/departamentos', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/departamentos/${id}`);
    return response.data;
  },

  create: async (data: { nome: string; descricao?: string | null; instituicao_id?: string | null; ativo?: boolean }) => {
    const response = await api.post('/departamentos', data);
    return response.data;
  },

  update: async (id: string, data: { nome?: string; descricao?: string | null; ativo?: boolean }) => {
    const response = await api.put(`/departamentos/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/departamentos/${id}`);
    return response.data;
  },
};

// Fornecedores API
export const fornecedoresApi = {
  getAll: async (params?: { instituicaoId?: string; status?: 'ATIVO' | 'INATIVO' | 'SUSPENSO'; tipoServico?: string; search?: string }) => {
    const response = await api.get('/fornecedores', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/fornecedores/${id}`);
    return response.data;
  },

  create: async (data: {
    razaoSocial: string;
    nif?: string;
    tipoServico: 'SEGURANCA' | 'LIMPEZA' | 'TI' | 'CANTINA' | 'MANUTENCAO' | 'OUTRO';
    contato?: string;
    email?: string;
    telefone?: string;
    endereco?: string;
    cidade?: string;
    pais?: string;
    inicioContrato: string;
    fimContrato?: string;
    observacoes?: string;
  }) => {
    const response = await api.post('/fornecedores', data);
    return response.data;
  },

  update: async (id: string, data: {
    razaoSocial?: string;
    nif?: string;
    tipoServico?: 'SEGURANCA' | 'LIMPEZA' | 'TI' | 'CANTINA' | 'MANUTENCAO' | 'OUTRO';
    contato?: string;
    email?: string;
    telefone?: string;
    endereco?: string;
    cidade?: string;
    pais?: string;
    inicioContrato?: string;
    fimContrato?: string;
    status?: 'ATIVO' | 'INATIVO' | 'SUSPENSO';
    observacoes?: string;
  }) => {
    const response = await api.put(`/fornecedores/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/fornecedores/${id}`);
    return response.data;
  },
};

// Cargos API
export const cargosApi = {
  getAll: async (params?: { instituicaoId?: string; ativo?: boolean }) => {
    const response = await api.get('/cargos', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/cargos/${id}`);
    return response.data;
  },

  create: async (data: { nome: string; descricao?: string | null; salario_base?: number; instituicao_id?: string | null; ativo?: boolean }) => {
    const response = await api.post('/cargos', data);
    return response.data;
  },

  update: async (id: string, data: { nome?: string; descricao?: string | null; salario_base?: number; ativo?: boolean }) => {
    const response = await api.put(`/cargos/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/cargos/${id}`);
    return response.data;
  },
};

// Folha de Pagamento API
export const folhaPagamentoApi = {
  getAll: async (params?: { funcionarioId?: string; mes?: number; ano?: number; status?: string }) => {
    const response = await api.get('/folha-pagamento', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/folha-pagamento/${id}`);
    return response.data;
  },

  getSalarioBase: async (funcionarioId: string) => {
    const response = await api.get(`/folha-pagamento/salario-base/${funcionarioId}`);
    return response.data;
  },

  calcularDescontos: async (funcionarioId: string, mes: number, ano: number) => {
    const response = await api.get('/folha-pagamento/calcular-descontos', {
      params: { funcionarioId, mes, ano },
    });
    return response.data;
  },

  calcularAutomatico: async (data: {
    funcionarioId: string;
    mes: string | number; // "YYYY-MM" ou número 1-12
  }) => {
    const response = await api.post('/folha-pagamento/calcular-automatico', data);
    return response.data;
  },

  create: async (data: {
    funcionarioId: string;
    mes: number;
    ano: number;
    salarioBase: number;
    descontosFaltas?: number;
    horasExtras?: number;
    valorHorasExtras?: number;
    bonus?: number;
    beneficioTransporte?: number;
    beneficioAlimentacao?: number;
    outrosBeneficios?: number;
    outrosDescontos?: number;
    inss?: number;
    irt?: number;
    // salarioLiquido é calculado no backend automaticamente
    observacoes?: string;
  }) => {
    const response = await api.post('/folha-pagamento', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.put(`/folha-pagamento/${id}`, data);
    return response.data;
  },

  aprovar: async (id: string) => {
    const response = await api.put(`/folha-pagamento/${id}/aprovar`);
    return response.data;
  },

  fechar: async (id: string) => {
    const response = await api.post(`/folha-pagamento/${id}/fechar`);
    return response.data;
  },

  reabrir: async (id: string, justificativa: string) => {
    const response = await api.post(`/folha-pagamento/${id}/reabrir`, { justificativa });
    return response.data;
  },

  pagar: async (id: string, data: {
    metodoPagamento: 'TRANSFERENCIA' | 'CASH' | 'MOBILE_MONEY' | 'CHEQUE';
    referencia?: string;
    observacaoPagamento?: string;
  }) => {
    const response = await api.post(`/folha-pagamento/${id}/pagar`, data);
    return response.data;
  },

  reverterPagamento: async (id: string, justificativa: string) => {
    const response = await api.post(`/folha-pagamento/${id}/reverter-pagamento`, { justificativa });
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/folha-pagamento/${id}`);
    return response.data;
  },
};

// Frequência Funcionários API
export const frequenciaFuncionariosApi = {
  getAll: async (params?: { funcionarioId?: string; dataInicio?: string; dataFim?: string; tipo?: string }) => {
    const response = await api.get('/funcionario-frequencias', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/funcionario-frequencias/${id}`);
    return response.data;
  },

  create: async (data: {
    funcionarioId: string;
    data: string;
    tipo?: string;
    horaEntrada?: string;
    horaSaida?: string;
    horasTrabalhadas?: number;
    observacoes?: string;
  }) => {
    const response = await api.post('/funcionario-frequencias', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.put(`/funcionario-frequencias/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/funcionario-frequencias/${id}`);
    return response.data;
  },
};

// Contratos Funcionário API
export const contratosFuncionarioApi = {
  getAll: async (params?: { funcionarioId?: string; status?: string }) => {
    const response = await api.get('/contratos-funcionario', { params });
    return response.data;
  },

  getByFuncionarioIds: async (funcionarioIds: string[]) => {
    const response = await api.post('/contratos-funcionario/by-funcionarios', { funcionarioIds });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/contratos-funcionario/${id}`);
    return response.data;
  },

  create: async (data: {
    funcionario_id: string;
    tipo_contrato: string;
    data_inicio: string;
    data_fim?: string | null;
    salario: number;
    carga_horaria?: string;
    arquivo_url?: string | null;
    nome_arquivo?: string | null;
    observacoes?: string | null;
    status?: string;
    renovado_de?: string | null;
  }) => {
    const response = await api.post('/contratos-funcionario', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.put(`/contratos-funcionario/${id}`, data);
    return response.data;
  },

  encerrar: async (id: string, data?: { data_fim?: string; observacoes?: string }) => {
    const response = await api.patch(`/contratos-funcionario/${id}/encerrar`, data || {});
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/contratos-funcionario/${id}`);
    return response.data;
  },
};

// Storage API (for file uploads)
export const storageApi = {
  upload: async (bucket: string, path: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucket', bucket);
    formData.append('path', path);
    
    const response = await api.post('/storage/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  uploadDocument: async (entityId: string, file: File, bucket: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucket', bucket);
    formData.append('path', `${entityId}/${Date.now()}_${file.name}`);
    
    const response = await api.post('/storage/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.path || response.data.url;
  },

  uploadAvatar: async (userId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucket', 'avatars');
    formData.append('path', `${userId}/avatar.${file.name.split('.').pop()}`);
    
    const response = await api.post('/storage/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.url || response.data.path;
  },

  delete: async (bucket: string, path: string) => {
    const response = await api.delete('/storage', { data: { bucket, path } });
    return response.data;
  },

  deleteFile: async (path: string, bucket: string) => {
    const response = await api.delete('/storage', { data: { bucket, path } });
    return response.data;
  },

  getPublicUrl: (bucket: string, path: string) => {
    return `${import.meta.env.VITE_API_URL}/storage/${bucket}/${path}`;
  },

  getSignedUrl: async (path: string, bucket: string) => {
    const response = await api.get('/storage/signed-url', { params: { bucket, path } });
    return response.data.url;
  },
};

// Metas Financeiras API
export const metasFinanceirasApi = {
  getAll: async (params?: { ano?: number; instituicaoId?: string }) => {
    const response = await api.get('/metas-financeiras', { params });
    return response.data;
  },

  create: async (data: { mes: number; ano: number; valorMeta: number }) => {
    const response = await api.post('/metas-financeiras', data);
    return response.data;
  },

  update: async (id: string, data: { valorMeta: number }) => {
    const response = await api.put(`/metas-financeiras/${id}`, data);
    return response.data;
  },
};

// Documentos Funcionário API
export const documentosFuncionarioApi = {
  getAll: async (params?: { funcionarioId?: string }) => {
    const response = await api.get('/documentos-funcionario', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/documentos-funcionario/${id}`);
    return response.data;
  },

  upload: async (data: FormData) => {
    const response = await api.post('/documentos-funcionario/upload', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/documentos-funcionario/${id}`);
    return response.data;
  },
};

// Alojamentos API
export const alojamentosApi = {
  getAll: async (params?: { instituicaoId?: string; status?: string }) => {
    const response = await api.get('/alojamentos', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/alojamentos/${id}`);
    return response.data;
  },

  create: async (data: {
    nomeBloco: string;
    numeroQuarto: string;
    tipoQuarto: string;
    capacidade: number;
    genero: string;
    status?: string;
    instituicaoId?: string;
  }) => {
    const response = await api.post('/alojamentos', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.put(`/alojamentos/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/alojamentos/${id}`);
    return response.data;
  },
};

// Alocações Alojamento API
export const alocacoesAlojamentoApi = {
  getAll: async (params?: { alunoId?: string; alojamentoId?: string; status?: string; instituicaoId?: string }) => {
    const response = await api.get('/alocacoes-alojamento', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/alocacoes-alojamento/${id}`);
    return response.data;
  },

  create: async (data: {
    alunoId: string;
    alojamentoId: string;
    dataEntrada: string;
    status?: string;
  }) => {
    const response = await api.post('/alocacoes-alojamento', data);
    return response.data;
  },

  update: async (id: string, data: { status?: string; dataSaida?: string }) => {
    const response = await api.put(`/alocacoes-alojamento/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/alocacoes-alojamento/${id}`);
    return response.data;
  },
};

// Emails Enviados API
export const emailsEnviadosApi = {
  getAll: async (params?: { instituicaoId?: string; status?: string; limit?: number }) => {
    const response = await api.get('/emails-enviados', { params });
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/emails-enviados/${id}`);
    return response.data;
  },

  deleteAllFailed: async (params?: { instituicaoId?: string }) => {
    const response = await api.delete('/emails-enviados/failed', { params });
    return response.data;
  },
};

// Tipos Documento API
export const tiposDocumentoApi = {
  getAll: async () => {
    const response = await api.get('/tipos-documento');
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/tipos-documento/${id}`);
    return response.data;
  },

  getByCodigo: async (codigo: string) => {
    const response = await api.get(`/tipos-documento/codigo/${codigo}`);
    return response.data;
  },

  create: async (data: {
    nome: string;
    codigo: string;
    descricao?: string;
    templateHtml?: string;
    requerAssinatura?: boolean;
    taxa?: number;
  }) => {
    const response = await api.post('/tipos-documento', data);
    return response.data;
  },
};

// Documentos Oficiais API (Declarações, Histórico, Certificado)
export const documentosOficialApi = {
  listar: async (params?: { estudanteId?: string }) => {
    const response = await api.get('/documentos', { params });
    return response.data;
  },
  getById: async (id: string) => {
    const response = await api.get(`/documentos/${id}`);
    return response.data;
  },
  emitir: async (data: { tipoDocumento: string; estudanteId: string; matriculaId?: string; anoLetivoId?: string; observacao?: string }) => {
    const response = await api.post('/documentos/emitir-json', data);
    return response.data;
  },
  emitirPdf: async (data: { tipoDocumento: string; estudanteId: string; matriculaId?: string; anoLetivoId?: string; observacao?: string }) => {
    const response = await api.post('/documentos/emitir', data, { responseType: 'blob' });
    return response.data;
  },
  preValidar: async (params: { tipoDocumento: string; estudanteId: string; anoLetivoId?: string }) => {
    const response = await api.get('/documentos/pre-validar', { params });
    return response.data;
  },
  downloadPdf: async (id: string) => {
    const response = await api.get(`/documentos/${id}/pdf`, { responseType: 'blob' });
    return response.data;
  },
  anular: async (id: string, motivo?: string) => {
    const response = await api.post(`/documentos/${id}/anular`, { motivo });
    return response.data;
  },
  verificar: async (codigo: string) => {
    const response = await api.get('/documentos/verificar', { params: { codigo } });
    return response.data;
  },
};

// Documentos Emitidos API (legado - documentos-emitidos)
export const documentosEmitidosApi = {
  getAll: async (params?: { alunoId?: string; tipoDocumentoId?: string; instituicaoId?: string }) => {
    const response = await api.get('/documentos-emitidos', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/documentos-emitidos/${id}`);
    return response.data;
  },

  create: async (data: {
    numeroDocumento?: string;
    tipoDocumentoId: string;
    alunoId: string;
    emitidoPor?: string;
    observacoes?: string;
    dadosAdicionais?: any;
  }) => {
    const response = await api.post('/documentos-emitidos', data);
    return response.data;
  },

  gerarNumero: async () => {
    const response = await api.post('/documentos-emitidos/gerar-numero');
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/documentos-emitidos/${id}`);
    return response.data;
  },
};

// Professores API (entidade acadêmica - tabela professores)
// Fonte para selects de Plano de Ensino - NUNCA usar /users?role=PROFESSOR
export const professorsApi = {
  getAll: async () => {
    const response = await api.get('/professores', { params: { pageSize: 500 } });
    const body = response.data;
    return (Array.isArray(body) ? body : body?.data ?? []) as unknown[];
  },
  /** Listagem paginada — NUNCA enviar instituicaoId */
  getList: async (params?: ListQueryParams) => {
    const { instituicaoId, ...safeParams } = params || {};
    const response = await api.get('/professores', { params: safeParams });
    return response.data as ListResponse<unknown>;
  },
  /** Comprovativo — aceita professores.id (evita 400 ao usar professor.id da lista) */
  getComprovativo: async (professorId: string) => {
    const response = await api.get(`/professores/${professorId}/comprovativo`);
    return response.data;
  },
};

// Professor Disciplinas API (atribuições)
export const professorDisciplinasApi = {
  getAll: async (params?: { professorId?: string; disciplinaId?: string; ano?: number; semestre?: string; instituicaoId?: string }) => {
    // IMPORTANTE: instituicaoId via query é permitido APENAS para SUPER_ADMIN
    // O backend usa addInstitutionFilter que valida isso
    const response = await api.get('/professor-disciplinas', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/professor-disciplinas/${id}`);
    return response.data;
  },

  getByProfessor: async (professorId: string) => {
    const response = await api.get(`/professor-disciplinas/professor/${professorId}`);
    return response.data;
  },
  // Professor obtém suas próprias atribuições via /me (usa req.professor.id)
  // NUNCA usar getByProfessor(user.id) - user.id é users.id, não professores.id
  getMyDisciplinas: async () => {
    const response = await api.get('/professor-disciplinas/me');
    return response.data;
  },

  create: async (data: {
    professorId: string;
    disciplinaId: string;
    ano: number;
    semestre: string;
    trimestres?: number[];
  }) => {
    const response = await api.post('/professor-disciplinas', data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/professor-disciplinas/${id}`);
    return response.data;
  },
};

// Responsavel Alunos API (vínculos responsável-aluno)
export const responsavelAlunosApi = {
  getAll: async (params?: { responsavelId?: string; alunoId?: string }) => {
    const response = await api.get('/responsavel-alunos', { params });
    return response.data;
  },

  getAlunosVinculados: async (responsavelId: string) => {
    const response = await api.get(`/responsavel-alunos/responsavel/${responsavelId}`);
    return response.data;
  },

  create: async (data: {
    responsavelId: string;
    alunoId: string;
    parentesco: string;
  }) => {
    const response = await api.post('/responsavel-alunos', data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/responsavel-alunos/${id}`);
    return response.data;
  },
};

// Logs Auditoria API
export const logsAuditoriaApi = {
  getAll: async (params?: { 
    instituicaoId?: string; // Apenas para SUPER_ADMIN - backend valida via addInstitutionFilter
    modulo?: string;
    acao?: string; 
    entidade?: string;
    entidadeId?: string;
    tabela?: string; // Compatibilidade
    registroId?: string; // Compatibilidade
    userId?: string;
    dataInicio?: string;
    dataFim?: string;
    limit?: number;
    dominio?: 'ACADEMICO' | 'FINANCEIRO' | 'ADMINISTRATIVO' | 'SEGURANCA';
  }) => {
    // IMPORTANTE: instituicaoId via query é permitido APENAS para SUPER_ADMIN
    // O backend usa addInstitutionFilter que valida isso
    const response = await api.get('/logs-auditoria', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/logs-auditoria/${id}`);
    return response.data;
  },

  getDetalhes: async (id: string) => {
    const response = await api.get(`/logs-auditoria/${id}/detalhes`);
    return response.data;
  },

  getStats: async (params?: {
    dataInicio?: string;
    dataFim?: string;
  }) => {
    const response = await api.get('/logs-auditoria/stats', { params });
    return response.data;
  },

  // NOTA: Logs não podem ser criados manualmente - apenas via AuditService no backend
  // Este método está DEPRECATED e retornará erro 403
  create: async (data: {
    acao: string;
    tabela?: string;
    registroId?: string;
    dadosAnteriores?: any;
    dadosNovos?: any;
  }) => {
    const response = await api.post('/logs-auditoria', data);
    return response.data;
  },
};

// Configurações Landing API
export const configuracoesLandingApi = {
  getAll: async () => {
    const response = await api.get('/configuracoes-landing');
    return response.data;
  },

  getByChave: async (chave: string) => {
    const response = await api.get(`/configuracoes-landing/${chave}`);
    return response.data;
  },

  update: async (chave: string, data: { valor: string }) => {
    const response = await api.put(`/configuracoes-landing/${chave}`, data);
    return response.data;
  },
};

// Leads Comerciais API
export const leadsApi = {
  getAll: async (params?: { status?: string; limit?: number }) => {
    const response = await api.get('/leads', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/leads/${id}`);
    return response.data;
  },

  create: async (data: {
    nomeInstituicao: string;
    nomeResponsavel: string;
    email: string;
    telefone: string;
    cidade?: string;
    mensagem?: string;
    planoInteresse?: string;
    tipoInstituicao?: string;
  }) => {
    const response = await api.post('/leads', data);
    return response.data;
  },

  update: async (id: string, data: { status?: string; notas?: string }) => {
    const response = await api.put(`/leads/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/leads/${id}`);
    return response.data;
  },

  notifyLead: async (data: {
    nomeInstituicao: string;
    nomeResponsavel: string;
    email: string;
    telefone: string;
    cidade?: string;
    mensagem?: string;
  }) => {
    const response = await api.post('/leads/notify', data);
    return response.data;
  },
};

// Configuração Multa API
export const configuracaoMultaApi = {
  get: async () => {
    const response = await api.get('/configuracao-multa');
    return response.data;
  },

  update: async (data: {
    multa_percentual?: number;
    juros_dia_percentual?: number;
    dias_tolerancia?: number;
  }) => {
    const response = await api.put('/configuracao-multa', data);
    return response.data;
  },
};

// Plano de Ensino API
export const planoEnsinoApi = {
  // Criar ou buscar plano de ensino
  // cargaHorariaPlanejada NÃO pode ser enviado - é calculado automaticamente
  // cargaHorariaTotal NÃO pode ser enviado - sempre vem da Disciplina
  // professorId é OBRIGATÓRIO para ADMIN criar plano para outro professor
  // Backend exige professorId = professores.id (NUNCA users.id) - fonte: GET /professores
  createOrGet: async (data: {
    cursoId?: string;
    classeId?: string;
    disciplinaId: string;
    professorId: string; // OBRIGATÓRIO - professores.id (valor do select de GET /professores)
    anoLetivo?: number;
    anoLetivoId: string; // OBRIGATÓRIO
    turmaId?: string;
    semestre?: number; // OBRIGATÓRIO apenas se tipoInstituicao = Ensino Superior (1 ou 2)
    classeOuAno?: string; // OBRIGATÓRIO apenas se tipoInstituicao = Ensino Secundário
    metodologia?: string;
    objetivos?: string;
    conteudoProgramatico?: string;
    criteriosAvaliacao?: string;
  }) => {
    // professorId deve ser professores.id (GET /professores) - backend valida pertence ao tenant
    const response = await api.post('/plano-ensino', data);
    return response.data;
  },

  // Buscar todos os planos de ensino (para professor ver seus planos atribuídos)
  // turmaId: buscar planos da turma (para horários)
  getAll: async (params?: { professorId?: string; anoLetivo?: number; anoLetivoId?: string; turmaId?: string }) => {
    const response = await api.get('/plano-ensino', { params });
    // Se retornar um único objeto, converter para array
    return Array.isArray(response.data) ? response.data : [response.data].filter(Boolean);
  },

  // Buscar plano de ensino por contexto
  // Se disciplinaId for fornecido, retorna um único plano
  // Se disciplinaId não for fornecido, retorna uma lista de planos (filtrado por professorId e anoLetivoId)
  getByContext: async (params: {
    cursoId?: string;
    classeId?: string;
    disciplinaId?: string; // Opcional: se não fornecido, retorna lista
    professorId?: string; // Opcional: não necessário quando buscar por turmaId
    anoLetivo?: number;
    anoLetivoId?: string; // Pode usar anoLetivoId ao invés de anoLetivo
    turmaId?: string; // Se fornecido, busca planos de ensino daquela turma diretamente
    semestre?: number; // OBRIGATÓRIO apenas se tipoInstituicao = Ensino Superior
    classeOuAno?: string; // OBRIGATÓRIO apenas se tipoInstituicao = Ensino Secundário
  }) => {
    const response = await api.get('/plano-ensino', { params });
    return response.data;
  },

  // Calcular estatísticas de carga horária
  getStats: async (planoEnsinoId: string) => {
    const response = await api.get(`/plano-ensino/${planoEnsinoId}/stats`);
    return response.data;
  },

  // Obter carga horária detalhada
  getCargaHoraria: async (planoEnsinoId: string) => {
    const response = await api.get(`/plano-ensino/${planoEnsinoId}/carga-horaria`);
    return response.data;
  },

  // Buscar contexto para criação de Plano de Ensino
  getContexto: async () => {
    const response = await api.get('/plano-ensino/contexto');
    return response.data;
  },

  // Atualizar dados gerais do plano (Apresentação)
  // cargaHorariaTotal NÃO pode ser editada - sempre vem da Disciplina
  // cargaHorariaPlanejada NÃO pode ser editada - é calculada automaticamente
  update: async (planoEnsinoId: string, data: {
    ementa?: string;
    objetivos?: string;
    metodologia?: string;
    criteriosAvaliacao?: string;
    conteudoProgramatico?: string;
    semestre?: number;
    classeOuAno?: string;
  }) => {
    const response = await api.put(`/plano-ensino/${planoEnsinoId}`, data);
    return response.data;
  },

  // Ajustar carga horária automaticamente
  ajustarCargaHorariaAutomatico: async (planoEnsinoId: string) => {
    const response = await api.post(`/plano-ensino/${planoEnsinoId}/ajustar-carga-horaria`);
    return response.data;
  },

  // Aulas
  // trimestre/semestre NÃO é enviado - é herdado automaticamente do Plano de Ensino
  createAula: async (planoEnsinoId: string, data: {
    titulo: string;
    descricao?: string;
    tipo?: 'TEORICA' | 'PRATICA';
    quantidadeAulas: number;
  }) => {
    const response = await api.post(`/plano-ensino/${planoEnsinoId}/aulas`, data);
    return response.data;
  },

  // trimestre/semestre NÃO é enviado - é herdado automaticamente do Plano de Ensino
  updateAula: async (aulaId: string, data: {
    titulo?: string;
    descricao?: string;
    tipo?: 'TEORICA' | 'PRATICA';
    quantidadeAulas?: number;
  }) => {
    const response = await api.put(`/plano-ensino/aulas/${aulaId}`, data);
    return response.data;
  },

  deleteAula: async (aulaId: string) => {
    const response = await api.delete(`/plano-ensino/aulas/${aulaId}`);
    return response.data;
  },

  reordenarAulas: async (planoEnsinoId: string, ordemAulas: string[]) => {
    const response = await api.put(`/plano-ensino/${planoEnsinoId}/aulas/reordenar`, { ordemAulas });
    return response.data;
  },

  marcarAulaMinistrada: async (aulaId: string, dataMinistrada?: string) => {
    const response = await api.put(`/plano-ensino/aulas/${aulaId}/ministrada`, { dataMinistrada });
    return response.data;
  },

  desmarcarAulaMinistrada: async (aulaId: string) => {
    const response = await api.put(`/plano-ensino/aulas/${aulaId}/nao-ministrada`);
    return response.data;
  },

  // Bibliografias
  addBibliografia: async (planoEnsinoId: string, data: {
    titulo: string;
    autor?: string;
    editora?: string;
    ano?: number;
    isbn?: string;
    tipo?: 'BIBLIOGRAFIA_BASICA' | 'BIBLIOGRAFIA_COMPLEMENTAR';
    observacoes?: string;
  }) => {
    const response = await api.post(`/plano-ensino/${planoEnsinoId}/bibliografias`, data);
    return response.data;
  },

  removeBibliografia: async (bibliografiaId: string) => {
    const response = await api.delete(`/plano-ensino/bibliografias/${bibliografiaId}`);
    return response.data;
  },

  // Bloquear/Desbloquear
  bloquearPlano: async (planoEnsinoId: string) => {
    const response = await api.put(`/plano-ensino/${planoEnsinoId}/bloquear`);
    return response.data;
  },

  desbloquearPlano: async (planoEnsinoId: string) => {
    const response = await api.put(`/plano-ensino/${planoEnsinoId}/desbloquear`);
    return response.data;
  },

  // Copiar plano
  copiarPlano: async (planoEnsinoId: string, novoAnoLetivo: number) => {
    const response = await api.post(`/plano-ensino/${planoEnsinoId}/copiar`, { novoAnoLetivo });
    return response.data;
  },

  // Deletar plano de ensino
  delete: async (planoEnsinoId: string) => {
    const response = await api.delete(`/plano-ensino/${planoEnsinoId}`);
    return response.data;
  },
};

// Aulas Lançadas API
export const aulasLancadasApi = {
  // Listar aulas planejadas (filtradas por contexto)
  // professorId: OBRIGATÓRIO para ADMIN (professores.id). Para PROFESSOR, backend usa req.professor.id
  getAulasPlanejadas: async (params: {
    cursoId?: string;
    classeId?: string;
    disciplinaId: string;
    professorId?: string; // OBRIGATÓRIO para ADMIN - professors.id. PROFESSOR: backend resolve do JWT
    anoLetivo: number;
    turmaId?: string;
  }) => {
    const response = await api.get('/aulas-planejadas', { params });
    return response.data;
  },

  // Listar aulas lançadas (filtradas por contexto)
  // professorId é opcional - o backend resolve automaticamente via middleware resolveProfessor
  getAll: async (params?: {
    planoAulaId?: string;
    cursoId?: string;
    classeId?: string;
    disciplinaId?: string;
    professorId?: string; // Opcional - backend resolve automaticamente do JWT
    anoLetivo?: number;
    turmaId?: string;
    dataInicio?: string;
    dataFim?: string;
  }) => {
    // Remover professorId se fornecido - backend resolve automaticamente
    const { professorId, ...safeParams } = params || {};
    const response = await api.get('/aulas-lancadas', { params: safeParams });
    return response.data;
  },

  // Criar lançamento de aula
  create: async (data: {
    planoAulaId: string;
    data: string;
    horaInicio?: string; // Formato HH:mm
    horaFim?: string; // Formato HH:mm
    cargaHoraria?: number;
    conteudoMinistrado?: string;
    observacoes?: string;
  }) => {
    const response = await api.post('/aulas-lancadas', data);
    return response.data;
  },

  // Remover lançamento
  delete: async (lancamentoId: string) => {
    const response = await api.delete(`/aulas-lancadas/${lancamentoId}`);
    return response.data;
  },
};

// Presenças API
export const presencasApi = {
  // Buscar presenças de uma aula lançada
  getByAula: async (aulaId: string) => {
    const response = await api.get(`/presencas/aula/${aulaId}`);
    return response.data;
  },

  // Criar ou atualizar presenças em lote
  createOrUpdate: async (data: {
    aulaLancadaId: string;
    presencas: Array<{
      alunoId: string;
      status: 'PRESENTE' | 'AUSENTE' | 'JUSTIFICADO';
      observacoes?: string;
    }>;
  }) => {
    const response = await api.post('/presencas', data);
    return response.data;
  },

  // Buscar frequência de um aluno
  getFrequenciaAluno: async (params: {
    alunoId: string;
    disciplinaId: string;
    anoLetivo?: number;
    turmaId?: string;
  }) => {
    const response = await api.get('/frequencia/aluno', { params });
    return response.data;
  },
};

// Distribuição de Aulas API
export const distribuicaoAulasApi = {
  // Gerar distribuição automática de aulas
  gerarDistribuicao: async (data: {
    planoEnsinoId: string;
    dataInicio: string;
    diasSemana: number[];
  }) => {
    const response = await api.post('/distribuicao-aulas/gerar', data);
    return response.data;
  },

  // Buscar distribuição por plano de ensino
  getByPlano: async (planoEnsinoId: string) => {
    const response = await api.get(`/distribuicao-aulas/plano/${planoEnsinoId}`);
    return response.data;
  },

  // Remover distribuição
  delete: async (planoEnsinoId: string) => {
    const response = await api.delete(`/distribuicao-aulas/plano/${planoEnsinoId}`);
    return response.data;
  },
};

// Documentos Fiscais API
export const documentoFiscalApi = {
  // Buscar documento fiscal por pagamento
  getByPagamento: async (pagamentoId: string) => {
    const response = await api.get(`/documentos-fiscais/pagamento/${pagamentoId}`);
    return response.data;
  },

  // Listar documentos fiscais
  getAll: async () => {
    const response = await api.get('/documentos-fiscais');
    return response.data;
  },
};

// Recibos API (gerados pelo módulo FINANCEIRO)
export const recibosApi = {
  getById: async (id: string) => {
    const response = await api.get(`/recibos/${id}`);
    return response.data;
  },
  getAll: async (params?: { matriculaId?: string }) => {
    const response = await api.get('/recibos', { params });
    return response.data;
  },
};

// Pagamentos de Licença API
export const pagamentoLicencaApi = {
  // Criar pagamento de licença manual
  // FASE 3: Aceitar planoId (preferido) ou plano (nome) para compatibilidade
  criar: async (data: {
    planoId?: string; // ID do plano (PREFERIDO - fonte única de verdade)
    plano?: 'BASIC' | 'PRO' | 'ENTERPRISE'; // Nome do plano (compatibilidade retroativa)
    periodo: 'MENSAL' | 'ANUAL';
    metodo?: 'TRANSFERENCIA' | 'DEPOSITO' | 'MULTICAIXA' | 'AIRTM' | 'RODETPAY' | 'CASH' | 'MOBILE_MONEY';
    referencia?: string;
    comprovativoUrl?: string;
    observacoes?: string;
  }) => {
    const response = await api.post('/licenca/pagamento/criar', data);
    return response.data;
  },

  // Criar pagamento online (via gateway)
  criarOnline: async (data: {
    plano: 'BASIC' | 'PRO' | 'ENTERPRISE';
    periodo: 'MENSAL' | 'ANUAL';
    gateway: 'STRIPE' | 'PAYPAL' | 'TAZAPAY';
  }) => {
    const response = await api.post('/licenca/pagamento/online', data);
    return response.data;
  },

  // Confirmar pagamento manual (apenas SUPER_ADMIN)
  confirmar: async (pagamentoId: string, observacoes?: string) => {
    const response = await api.post(`/licenca/pagamento/${pagamentoId}/confirmar`, { observacoes });
    return response.data;
  },

  // Cancelar pagamento
  cancelar: async (pagamentoId: string, motivo?: string) => {
    const response = await api.post(`/licenca/pagamento/${pagamentoId}/cancelar`, { motivo });
    return response.data;
  },

  // Buscar histórico de pagamentos
  getHistorico: async (params?: {
    status?: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';
    instituicaoId?: string;
  }) => {
    const response = await api.get('/licenca/pagamento/historico', { params });
    return response.data;
  },

  // Buscar pagamento por ID
  getById: async (pagamentoId: string) => {
    const response = await api.get(`/licenca/pagamento/${pagamentoId}`);
    return response.data;
  },
};

// Relatórios de Ponto API
export const pontoRelatorioApi = {
  // Gerar relatório diário
  gerarDiario: async (data: { data: string }) => {
    const response = await api.post('/relatorios-ponto/diario', data);
    return response.data;
  },

  // Gerar relatório mensal
  gerarMensal: async (data: { mes: number; ano: number }) => {
    const response = await api.post('/relatorios-ponto/mensal', data);
    return response.data;
  },

  // Gerar relatório individual
  gerarIndividual: async (data: {
    funcionarioId: string;
    dataInicio: string;
    dataFim: string;
  }) => {
    const response = await api.post('/relatorios-ponto/individual', data);
    return response.data;
  },

  // Verificar integridade
  verificarIntegridade: async (relatorioId: string) => {
    const response = await api.get(`/relatorios-ponto/${relatorioId}/verificar-integridade`);
    return response.data;
  },
};

// Relatórios Oficiais API
export const relatoriosApi = {
  // Gerar relatório
  gerar: async (data: {
    tipoRelatorio: string;
    referenciaId: string;
    anoLetivo?: number;
    turmaId?: string;
    disciplinaId?: string;
    alunoId?: string;
    trimestre?: number;
  }) => {
    const response = await api.post('/relatorios/gerar', data);
    return response.data;
  },

  // Gerar Pauta Final (endpoint específico)
  gerarPautaFinal: async (data: {
    turmaId: string;
    disciplinaId: string;
    semestreId?: string;
    anoLetivo: number;
    trimestre?: number;
  }) => {
    const response = await api.post('/relatorios/pauta-final', data, {
      responseType: 'blob',
    });
    // Criar URL do blob e fazer download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `pauta-final-${data.turmaId}-${Date.now()}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return response.data;
  },

  // Listar relatórios
  getAll: async (params?: {
    tipoRelatorio?: string;
    referenciaId?: string;
    anoLetivo?: number;
    dataInicio?: string;
    dataFim?: string;
  }) => {
    const response = await api.get('/relatorios', { params });
    return response.data;
  },

  // Buscar relatório por ID
  getById: async (id: string) => {
    const response = await api.get(`/relatorios/${id}`);
    return response.data;
  },

  // Download relatório
  download: async (id: string) => {
    const response = await api.get(`/relatorios/${id}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Visualizar relatório
  visualizar: async (id: string) => {
    const response = await api.get(`/relatorios/${id}/visualizar`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Buscar dados da Pauta por Plano de Ensino
  getPautaPlanoEnsino: async (planoEnsinoId: string) => {
    const response = await api.get(`/relatorios/pauta/${planoEnsinoId}`);
    return response.data;
  },

  // Buscar dados do Boletim por Aluno
  getBoletimAluno: async (alunoId: string, params?: { anoLetivoId?: string; anoLetivo?: number }) => {
    const response = await api.get(`/relatorios/boletim/${alunoId}`, { params });
    return response.data;
  },

  // Buscar dados do Histórico Escolar por Aluno
  getHistoricoEscolar: async (alunoId: string) => {
    const response = await api.get(`/relatorios/historico/${alunoId}`);
    return response.data;
  },

  // Imprimir Lista de Estudantes Admitidos (PDF) - abre em nova aba para impressão
  imprimirListaAdmitidos: async (params: {
    anoLetivoId: string;
    turmaId: string;
    cursoId?: string;
    classeId?: string;
  }) => {
    const response = await api.get('/relatorios/admitidos/imprimir', {
      params,
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    window.open(url, '_blank', 'noopener,noreferrer');
    return response.data;
  },
};

// Encerramentos Académicos API
export const encerramentosApi = {
  // Obter status de encerramentos
  getStatus: async (params?: { anoLetivo?: number }) => {
    const response = await api.get('/encerramentos/status', { params });
    return response.data;
  },

  // Iniciar processo de encerramento
  iniciar: async (data: {
    anoLetivo: number;
    periodo: 'TRIMESTRE_1' | 'TRIMESTRE_2' | 'TRIMESTRE_3' | 'SEMESTRE_1' | 'SEMESTRE_2' | 'ANO';
  }) => {
    const response = await api.post('/encerramentos/iniciar', data);
    return response.data;
  },

  // Encerrar período
  encerrar: async (data: {
    anoLetivo: number;
    periodo: 'TRIMESTRE_1' | 'TRIMESTRE_2' | 'TRIMESTRE_3' | 'SEMESTRE_1' | 'SEMESTRE_2' | 'ANO';
    justificativa?: string;
  }) => {
    const response = await api.post('/encerramentos/encerrar', data);
    return response.data;
  },

  // Reabrir período
  reabrir: async (data: {
    anoLetivo: number;
    periodo: 'TRIMESTRE_1' | 'TRIMESTRE_2' | 'TRIMESTRE_3' | 'SEMESTRE_1' | 'SEMESTRE_2' | 'ANO';
    justificativaReabertura: string;
  }) => {
    const response = await api.post('/encerramentos/reabrir', data);
    return response.data;
  },
};

// Reabertura Excepcional do Ano Letivo API
export const reaberturaAnoLetivoApi = {
  // Criar reabertura excepcional
  criar: async (data: {
    anoLetivoId: string;
    motivo: string;
    escopo: 'NOTAS' | 'PRESENCAS' | 'AVALIACOES' | 'MATRICULAS' | 'GERAL';
    dataInicio: string;
    dataFim: string;
    observacoes?: string;
  }) => {
    const response = await api.post('/reaberturas-ano-letivo', data);
    return response.data;
  },

  // Listar reaberturas
  listar: async (params?: { anoLetivoId?: string; ativo?: boolean }) => {
    const response = await api.get('/reaberturas-ano-letivo', { params });
    return response.data;
  },

  // Obter reabertura por ID
  obter: async (id: string) => {
    const response = await api.get(`/reaberturas-ano-letivo/${id}`);
    return response.data;
  },

  // Encerrar reabertura manualmente
  encerrar: async (id: string, data?: { observacoes?: string }) => {
    const response = await api.post(`/reaberturas-ano-letivo/${id}/encerrar`, data);
    return response.data;
  },
};

// Workflow API
export const workflowApi = {
  // Submeter para aprovação
  submeter: async (data: {
    entidade: 'EventoCalendario' | 'PlanoEnsino' | 'Avaliacao';
    entidadeId: string;
  }) => {
    const response = await api.post('/workflow/submeter', data);
    return response.data;
  },

  // Aprovar
  aprovar: async (data: {
    entidade: 'EventoCalendario' | 'PlanoEnsino' | 'Avaliacao';
    entidadeId: string;
    observacao?: string;
  }) => {
    const response = await api.post('/workflow/aprovar', data);
    return response.data;
  },

  // Rejeitar
  rejeitar: async (data: {
    entidade: 'EventoCalendario' | 'PlanoEnsino' | 'Avaliacao';
    entidadeId: string;
    observacao: string;
  }) => {
    const response = await api.post('/workflow/rejeitar', data);
    return response.data;
  },

  // Bloquear
  bloquear: async (data: {
    entidade: 'EventoCalendario' | 'PlanoEnsino' | 'Avaliacao';
    entidadeId: string;
    observacao?: string;
  }) => {
    const response = await api.post('/workflow/bloquear', data);
    return response.data;
  },

  // Obter histórico
  getHistorico: async (params: {
    entidade: 'EventoCalendario' | 'PlanoEnsino' | 'Avaliacao';
    entidadeId: string;
  }) => {
    const response = await api.get('/workflow/historico', { params });
    return response.data;
  },
};

// Dispositivos Biométricos API
export const dispositivosBiometricosApi = {
  getAll: async (params?: { ativo?: boolean }) => {
    const response = await api.get('/dispositivos-biometricos', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/dispositivos-biometricos/${id}`);
    return response.data;
  },

  create: async (data: {
    nome: string;
    tipo: 'ZKTECO' | 'HIKVISION' | 'SUPREMA';
    ip: string;
    porta?: number;
    ipsPermitidos?: string[];
    observacoes?: string;
  }) => {
    const response = await api.post('/dispositivos-biometricos', data);
    return response.data;
  },

  update: async (id: string, data: {
    nome?: string;
    tipo?: 'ZKTECO' | 'HIKVISION' | 'SUPREMA';
    ip?: string;
    porta?: number;
    ipsPermitidos?: string[];
    ativo?: boolean;
    observacoes?: string;
  }) => {
    const response = await api.put(`/dispositivos-biometricos/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/dispositivos-biometricos/${id}`);
    return response.data;
  },

  regenerateToken: async (id: string) => {
    const response = await api.post(`/dispositivos-biometricos/${id}/regenerate-token`);
    return response.data;
  },

  testConnection: async (id: string) => {
    const response = await api.post(`/dispositivos-biometricos/${id}/test-connection`);
    return response.data;
  },
};

// Biometria / Presença / Justificativas API
export const biometriaApi = {
  processarPresencasDia: async (data: { data?: string; horarioPadraoEntrada?: string }) => {
    const response = await api.post('/biometria/presencas/processar', data);
    return response.data;
  },
  getJustificativas: async (params?: { status?: string; funcionarioId?: string }) => {
    const response = await api.get('/biometria/justificativas', { params });
    return response.data;
  },
  criarJustificativa: async (data: { frequenciaId: string; motivo: string; documentoUrl?: string }) => {
    const response = await api.post('/biometria/justificativas', data);
    return response.data;
  },
  aprovarJustificativa: async (justificativaId: string, data?: { observacoes?: string }) => {
    const response = await api.post(`/biometria/justificativas/${justificativaId}/aprovar`, data || {});
    return response.data;
  },
  rejeitarJustificativa: async (justificativaId: string, data: { observacoes: string }) => {
    const response = await api.post(`/biometria/justificativas/${justificativaId}/rejeitar`, data);
    return response.data;
  },
};

// ZKTeco API específica
export const zktecoApi = {
  // Testar conexão
  testarConexao: async (id: string) => {
    const response = await api.post(`/zkteco/${id}/testar`);
    return response.data;
  },

  // Sincronizar funcionários
  sincronizarFuncionarios: async (id: string) => {
    const response = await api.post(`/zkteco/${id}/sincronizar-funcionarios`);
    return response.data;
  },

  // Sincronizar logs
  sincronizarLogs: async (id: string, dataInicio?: string, dataFim?: string) => {
    const response = await api.post(`/zkteco/${id}/sincronizar-logs`, null, {
      params: {
        dataInicio,
        dataFim,
      },
    });
    return response.data;
  },

  // Obter informações do dispositivo
  getDeviceInfo: async (id: string) => {
    const response = await api.get(`/zkteco/${id}/info`);
    return response.data;
  },
};

// Configurações Instituição API
export const configuracoesInstituicaoApi = {
  get: async (instituicaoIdForScope?: string) => {
    // Multi-tenant: ADMIN usa token. SUPER_ADMIN pode passar ?instituicaoId=xxx para escopo.
    const params = instituicaoIdForScope ? { instituicaoId: instituicaoIdForScope } : undefined;
    const response = await api.get('/configuracoes-instituicao', { params });
    return response.data;
  },

  update: async (data: {
    nomeInstituicao?: string;
    tipoInstituicao?: string; // Não pode ser alterado manualmente - será ignorado
    descricao?: string;
    email?: string;
    telefone?: string;
    endereco?: string;
    logoUrl?: string;
    imagemCapaLoginUrl?: string;
    faviconUrl?: string;
    corPrimaria?: string;
    corSecundaria?: string;
    corTerciaria?: string;
    // Dados Gerais
    pais?: string;
    moedaPadrao?: string;
    idioma?: string;
    // Dados Fiscais
    nomeFiscal?: string;
    emailFiscal?: string;
    telefoneFiscal?: string;
    enderecoFiscal?: string;
    cidadeFiscal?: string;
    provinciaFiscal?: string;
    paisFiscal?: string;
    codigoPostalFiscal?: string;
    // Identificação Fiscal por País
    nif?: string;
    cnpj?: string;
    inscricaoEstadual?: string;
    codigoServicoFinancas?: string;
    identificacaoFiscalGenerica?: string;
    // Configurações de Faturação
    regimeFiscal?: string;
    serieDocumentos?: string;
    numeracaoAutomatica?: boolean;
    moedaFaturacao?: string;
    percentualImpostoPadrao?: number;
  }) => {
    // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
    // O backend usa req.user.instituicaoId do JWT token automaticamente
    const response = await api.put('/configuracoes-instituicao', data);
    return response.data;
  },
};

// Parâmetros Sistema API
export const parametrosSistemaApi = {
  get: async () => {
    // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
    // O backend usa req.user.instituicaoId do JWT token automaticamente
    const response = await api.get('/parametros-sistema');
    return response.data;
  },

  update: async (data: {
    quantidadeSemestresPorAno?: number | null;
    permitirReprovacaoDisciplina?: boolean;
    permitirDependencia?: boolean;
    permitirMatriculaForaPeriodo?: boolean;
    bloquearMatriculaDivida?: boolean;
    permitirTransferenciaTurma?: boolean;
    permitirMatriculaSemDocumentos?: boolean;
    tipoMedia?: 'simples' | 'ponderada';
    permitirExameRecurso?: boolean;
    percentualMinimoAprovacao?: number;
    perfisAlterarNotas?: string[];
    perfisCancelarMatricula?: string[];
    ativarLogsAcademicos?: boolean;
  }) => {
    // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
    // O backend usa req.user.instituicaoId do JWT token automaticamente
    const response = await api.put('/parametros-sistema', data);
    return response.data;
  },
};

// Videoaulas API
export const videoAulasApi = {
  getAll: async () => {
    const response = await api.get('/video-aulas');
    return response.data;
  },

  getAllAdmin: async () => {
    const response = await api.get('/video-aulas/admin');
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/video-aulas/${id}`);
    return response.data;
  },

  create: async (data: {
    titulo: string;
    descricao?: string;
    urlVideo: string;
    tipoVideo: 'YOUTUBE' | 'VIMEO' | 'UPLOAD';
    modulo: 'ACADEMICO' | 'FINANCEIRO' | 'CONFIGURACOES' | 'GERAL';
    perfilAlvo: string;
    tipoInstituicao?: 'SECUNDARIO' | 'SUPERIOR' | null;
    ordem?: number;
    ativo?: boolean;
  }) => {
    const response = await api.post('/video-aulas', data);
    return response.data;
  },

  update: async (id: string, data: {
    titulo?: string;
    descricao?: string;
    urlVideo?: string;
    tipoVideo?: 'YOUTUBE' | 'VIMEO' | 'UPLOAD';
    modulo?: 'ACADEMICO' | 'FINANCEIRO' | 'CONFIGURACOES' | 'GERAL';
    perfilAlvo?: string;
    tipoInstituicao?: 'SECUNDARIO' | 'SUPERIOR' | null;
    ordem?: number;
    ativo?: boolean;
  }) => {
    const response = await api.put(`/video-aulas/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/video-aulas/${id}`);
    return response.data;
  },

  getSignedUrl: async (id: string) => {
    const response = await api.get(`/video-aulas/${id}/signed-url`);
    return response.data.url;
  },

  // Progresso
  getProgress: async () => {
    const response = await api.get('/video-aulas/progresso');
    return response.data;
  },

  updateProgress: async (videoAulaId: string, percentualAssistido: number) => {
    const response = await api.post(`/video-aulas/${videoAulaId}/progresso`, {
      percentualAssistido
    });
    return response.data;
  },
};

// Treinamento e Onboarding API
export const treinamentoApi = {
  getTrilhaAtual: async () => {
    const response = await api.get('/treinamento/trilha-atual');
    return response.data;
  },
};

export const onboardingApi = {
  getStatus: async () => {
    const response = await api.get('/onboarding/status');
    return response.data;
  },
  finalizar: async () => {
    const response = await api.post('/onboarding/finalizar');
    return response.data;
  },
  criarInstituicao: async (data: {
    nomeInstituicao: string;
    subdominio: string;
    tipoInstituicao?: string; // Optional - será identificado automaticamente
    tipoAcademico?: 'SECUNDARIO' | 'SUPERIOR'; // Opcional - pode ser definido na criação
    emailContato?: string;
    telefone?: string;
    endereco?: string;
    logoUrl?: string;
    emailAdmin: string;
    senhaAdmin: string;
    nomeAdmin: string;
    planoId?: string;
  }) => {
    const response = await api.post('/onboarding/instituicao', data);
    return response.data;
  },
  criarAdminInstituicao: async (data: {
    instituicaoId: string;
    emailAdmin: string;
    senhaAdmin: string;
    nomeAdmin: string;
  }) => {
    const response = await api.post('/onboarding/instituicao/admin', data);
    return response.data;
  },
};

// Estatísticas API
export const estatisticasApi = {
  getAlunoEstatisticas: async (alunoId: string) => {
    const response = await api.get(`/estatisticas/aluno/${alunoId}`);
    return response.data;
  },

  getInstituicaoEstatisticas: async (instituicaoId: string) => {
    const response = await api.get(`/estatisticas/instituicao/${instituicaoId}`);
    return response.data;
  },
};

// Notificações API
export const notificacoesApi = {
  getAll: async (params?: { userId?: string; limit?: number }) => {
    const response = await api.get('/notificacoes', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/notificacoes/${id}`);
    return response.data;
  },

  create: async (data: {
    userId: string;
    titulo: string;
    mensagem: string;
    tipo?: string;
    link?: string;
  }) => {
    const response = await api.post('/notificacoes', data);
    return response.data;
  },

  update: async (id: string, data: { lida?: boolean }) => {
    const response = await api.put(`/notificacoes/${id}`, data);
    return response.data;
  },

  marcarTodasLidas: async (userId: string) => {
    const response = await api.put(`/notificacoes/marcar-lidas/${userId}`);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/notificacoes/${id}`);
    return response.data;
  },
};

// Chat API - Multi-tenant (instituicaoId via JWT)
export const chatApi = {
  getThreads: async () => {
    const response = await api.get('/chat/threads');
    return response.data;
  },

  createThread: async (data: { tipo: 'DISCIPLINA' | 'DIRECT'; disciplinaId?: string; targetUserId?: string }) => {
    const response = await api.post('/chat/threads', data);
    return response.data;
  },

  getMessages: async (threadId: string, params?: { cursor?: string; limit?: number }) => {
    const response = await api.get(`/chat/threads/${threadId}/messages`, { params });
    return response.data;
  },

  sendMessage: async (threadId: string, data: { content: string; attachments?: Array<{ url: string; type?: string; name?: string; size?: number }> }) => {
    const response = await api.post(`/chat/threads/${threadId}/messages`, data);
    return response.data;
  },

  uploadAttachment: async (file: File): Promise<{ url: string; type?: string; name?: string; size?: number }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/chat/upload', formData);
    return response.data;
  },

  markAsRead: async (threadId: string) => {
    const response = await api.patch(`/chat/threads/${threadId}/read`);
    return response.data;
  },

  getUnreadCount: async () => {
    const response = await api.get('/chat/unread-count');
    return response.data;
  },

  getAvailableContacts: async () => {
    const response = await api.get('/chat/available-contacts');
    return response.data;
  },
};

// Assinaturas API
export const assinaturasApi = {
  getAll: async (params?: { instituicaoId?: string; status?: string }) => {
    const response = await api.get('/assinaturas', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/assinaturas/${id}`);
    return response.data;
  },

  getByInstituicao: async (instituicaoId?: string, isSuperAdmin?: boolean) => {
    // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend para usuários normais
    // O backend usa req.user.instituicaoId do JWT token automaticamente
    // SUPER_ADMIN pode especificar instituicaoId via parâmetro (ação excepcional)
    if (isSuperAdmin && instituicaoId) {
      // Apenas para SUPER_ADMIN - usar rota com parâmetro
      const response = await api.get(`/assinaturas/instituicao/${instituicaoId}`);
      return response.data;
    } else {
      // Usuários normais - usar rota sem parâmetro (backend usa token)
      const response = await api.get('/assinaturas/instituicao/current');
      return response.data;
    }
  },

  create: async (data: {
    instituicaoId: string; // Apenas para SUPER_ADMIN - backend valida
    planoId: string;
    dataInicio?: string;
    tipoPeriodo?: string;
    valorAtual?: number;
    status?: string;
  }) => {
    // IMPORTANTE: Esta rota é APENAS para SUPER_ADMIN
    // O backend valida se o usuário é SUPER_ADMIN antes de aceitar instituicaoId
    const response = await api.post('/assinaturas', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.put(`/assinaturas/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/assinaturas/${id}`);
    return response.data;
  },
};

// Backup API
// Termos Legais API
export const termoLegalApi = {
  // Verificar se termo precisa ser aceito
  verificar: async (tipoAcao: string) => {
    const response = await api.get(`/termos-legais/verificar/${tipoAcao}`);
    return response.data;
  },

  // Aceitar termo legal
  aceitar: async (termoId: string) => {
    const response = await api.post('/termos-legais/aceitar', { termoId });
    return response.data;
  },

  // Obter termo legal ativo
  obter: async (tipoAcao: string) => {
    const response = await api.get(`/termos-legais/${tipoAcao}`);
    return response.data;
  },
};

export const backupApi = {
  // CRÍTICO: NÃO enviar instituicaoId - vem do JWT
  getHistory: async (params?: { limit?: number }) => {
    const response = await api.get('/backup/history', { params });
    return response.data;
  },

  // CRÍTICO: NÃO enviar instituicaoId - vem do JWT
  getSchedules: async () => {
    const response = await api.get('/backup/schedules');
    return response.data;
  },

  // CRÍTICO: NÃO enviar instituicaoId - vem do JWT
  createSchedule: async (data: {
    frequencia: string;
    horaExecucao?: string;
    diaSemana?: number;
    diaMes?: number;
    tipoBackup?: string;
    ativo?: boolean;
  }) => {
    // Remover instituicaoId se foi enviado acidentalmente
    const { instituicaoId, ...cleanData } = data as any;
    const response = await api.post('/backup/schedules', cleanData);
    return response.data;
  },

  updateSchedule: async (id: string, data: any) => {
    // Remover instituicaoId se foi enviado acidentalmente
    const { instituicaoId, ...cleanData } = data;
    const response = await api.put(`/backup/schedules/${id}`, cleanData);
    return response.data;
  },

  deleteSchedule: async (id: string) => {
    const response = await api.delete(`/backup/schedules/${id}`);
    return response.data;
  },

  // CRÍTICO: NÃO enviar instituicaoId - vem do JWT
  generate: async (data: { tipo?: string }) => {
    // Remover instituicaoId se foi enviado acidentalmente
    const { instituicaoId, ...cleanData } = data as any;
    const response = await api.post('/backup/generate', cleanData);
    return response.data;
  },

  restore: async (data: { backupData: any; options?: { overwrite?: boolean; skipExisting?: boolean } }) => {
    const response = await api.post('/backup/restore', data);
    return response.data;
  },

  // Download backup file (usa credenciais do axios)
  download: async (id: string, filename?: string) => {
    const response = await api.get(`/backup/${id}/download`, { responseType: 'blob' });
    const contentDisposition = response.headers?.['content-disposition'];
    let downloadFilename = filename;
    if (!downloadFilename && contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      if (match) downloadFilename = match[1];
    }
    const blob = new Blob([response.data]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadFilename || `backup_${id.substring(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // SUPER_ADMIN - Ações Excepcionais
  // Listar backups de todas as instituições (somente leitura)
  getGlobalBackups: async (params?: { instituicaoId?: string; limit?: number }) => {
    const response = await api.get('/admin/backups', { params });
    return response.data;
  },

  // Forçar backup para uma instituição específica
  forcarBackup: async (data: { instituicaoId: string; tipo?: string; justificativa: string }) => {
    const response = await api.post('/admin/backups/forcar', data);
    return response.data;
  },

  // Restaurar backup específico (ação excepcional)
  restaurarBackupExcepcional: async (id: string, data: { justificativa: string }) => {
    const response = await api.post(`/admin/backups/${id}/restaurar`, data);
    return response.data;
  },
};

// Historico RH API
export const historicoRhApi = {
  getAll: async (params?: { funcionarioId?: string; tipoAlteracao?: string }) => {
    const response = await api.get('/historico-rh', { params });
    return response.data;
  },

  create: async (data: {
    funcionarioId: string;
    tipoAlteracao: string;
    campoAlterado?: string;
    valorAnterior?: string;
    valorNovo?: string;
    observacao?: string;
  }) => {
    const response = await api.post('/historico-rh', data);
    return response.data;
  },
};

// Mensagens Responsavel API
export const mensagensResponsavelApi = {
  getAll: async (params?: { responsavelId?: string; professorId?: string; alunoId?: string }) => {
    const response = await api.get('/mensagens-responsavel', { params });
    return response.data;
  },

  create: async (data: {
    responsavelId: string;
    professorId: string;
    alunoId: string;
    assunto: string;
    mensagem: string;
  }) => {
    const response = await api.post('/mensagens-responsavel', data);
    return response.data;
  },

  responder: async (id: string, data: { resposta: string }) => {
    const response = await api.put(`/mensagens-responsavel/${id}/responder`, data);
    return response.data;
  },

  marcarLida: async (id: string) => {
    const response = await api.put(`/mensagens-responsavel/${id}/marcar-lida`);
    return response.data;
  },
};

// Utilidades - verificações de inadimplência
export const utilsApi = {
  verificarInadimplencia: async (alunoId: string) => {
    const response = await api.get(`/utils/verificar-inadimplencia/${alunoId}`);
    return response.data;
  },

  // IMPORTANTE: Multi-tenant - instituicaoId vem APENAS do JWT, não do path
  verificarAssinaturaExpirada: async () => {
    const response = await api.get('/utils/verificar-assinatura');
    return response.data;
  },
};

// Pautas/Boletins API
export const pautasApi = {
  getNotas: async (params: { turmaId?: string; alunoId?: string; ano?: number; semestre?: string }) => {
    const response = await api.get('/pautas/notas', { params });
    return response.data;
  },

  getFrequencias: async (params: { turmaId?: string; alunoId?: string; ano?: number }) => {
    const response = await api.get('/pautas/frequencias', { params });
    return response.data;
  },

  getBoletim: async (alunoId: string, params?: { ano?: number; semestre?: string }) => {
    const response = await api.get(`/pautas/boletim/${alunoId}`, { params });
    return response.data;
  },

  // Imprimir Pauta (Provisória ou Definitiva) - PDF, abre em nova aba
  imprimirPauta: async (planoEnsinoId: string, tipo: 'PROVISORIA' | 'DEFINITIVA' = 'PROVISORIA') => {
    const response = await api.get(`/pautas/${planoEnsinoId}/imprimir`, {
      params: { tipo },
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    window.open(url, '_blank', 'noopener,noreferrer');
    return response.data;
  },

  // Fechar Pauta como Definitiva (Admin/Secretaria)
  fecharPauta: async (planoEnsinoId: string) => {
    const response = await api.patch(`/pautas/${planoEnsinoId}/fechar`);
    return response.data;
  },

  // Marcar Pauta como Provisória (Professor ou Admin/Secretaria)
  gerarProvisoria: async (planoEnsinoId: string) => {
    const response = await api.patch(`/pautas/${planoEnsinoId}/provisoria`);
    return response.data;
  },
};

// Logs Redefinição Senha API
export const logsRedefinicaoSenhaApi = {
  getAll: async (params?: { instituicaoId?: string; limit?: number }) => {
    const response = await api.get('/logs-redefinicao-senha', { params });
    return response.data;
  },

  getRecent: async (userId: string) => {
    const response = await api.get('/logs-redefinicao-senha/recent', { params: { userId } });
    return response.data;
  },

  create: async (data: {
    redefinidoPorId: string;
    redefinidoPorEmail: string;
    redefinidoPorNome: string;
    usuarioAfetadoId: string;
    usuarioAfetadoEmail: string;
    usuarioAfetadoNome: string;
    enviadoPorEmail?: boolean;
    ipAddress?: string;
  }) => {
    const response = await api.post('/logs-redefinicao-senha', data);
    return response.data;
  },
};

// Pagamentos API (pagamentos de mensalidades)
export const pagamentosApi = {
  getAll: async (params?: {
    mensalidadeId?: string;
    alunoId?: string;
    dataInicio?: string;
    dataFim?: string;
  }) => {
    const response = await api.get('/pagamentos', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/pagamentos/${id}`);
    return response.data;
  },

  getByMensalidade: async (mensalidadeId: string) => {
    const response = await api.get(`/pagamentos/mensalidade/${mensalidadeId}`);
    return response.data;
  },

  registrarPagamento: async (mensalidadeId: string, data: {
    valor: number;
    metodoPagamento: string;
    observacoes?: string;
  }) => {
    const response = await api.post(`/pagamentos/mensalidade/${mensalidadeId}/registrar`, data);
    return response.data;
  },

  estornar: async (id: string, observacoes?: string) => {
    const response = await api.post(`/pagamentos/${id}/estornar`, { observacoes });
    return response.data;
  },

  // DEPRECATED: DELETE bloqueado no backend - usar estornar() em vez disso
  delete: async (id: string) => {
    const response = await api.delete(`/pagamentos/${id}`);
    return response.data;
  },
};

// Contratos Fornecedor API
export const contratosFornecedorApi = {
  getAll: async (params?: { fornecedorId?: string; status?: string; tipoContrato?: string }) => {
    const response = await api.get('/contratos-fornecedor', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/contratos-fornecedor/${id}`);
    return response.data;
  },

  create: async (data: {
    fornecedorId: string;
    tipoContrato: 'MENSAL' | 'ANUAL' | 'EVENTUAL';
    valor: number;
    dataInicio: string;
    dataFim?: string;
    observacoes?: string;
  }) => {
    const response = await api.post('/contratos-fornecedor', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.put(`/contratos-fornecedor/${id}`, data);
    return response.data;
  },
};

// Pagamentos Fornecedor API
export const pagamentosFornecedorApi = {
  getAll: async (params?: {
    fornecedorId?: string;
    contratoId?: string;
    status?: string;
    dataInicio?: string;
    dataFim?: string;
  }) => {
    const response = await api.get('/pagamentos-fornecedor', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/pagamentos-fornecedor/${id}`);
    return response.data;
  },

  create: async (data: {
    fornecedorId: string;
    contratoId?: string;
    valor: number;
    dataPagamento: string;
    metodo: 'TRANSFERENCIA' | 'CASH' | 'CHEQUE' | 'MOBILE_MONEY' | 'OUTRO';
    referencia?: string;
    observacoes?: string;
  }) => {
    const response = await api.post('/pagamentos-fornecedor', data);
    return response.data;
  },

  autorizarEPagar: async (id: string) => {
    const response = await api.post(`/pagamentos-fornecedor/${id}/autorizar`);
    return response.data;
  },

  cancelar: async (id: string, motivo?: string) => {
    const response = await api.post(`/pagamentos-fornecedor/${id}/cancelar`, { motivo });
    return response.data;
  },
};

// Eventos Governamentais API
export const eventosGovernamentaisApi = {
  getAll: async (params?: {
    tipoEvento?: 'MATRICULA' | 'CONCLUSAO' | 'DIPLOMA' | 'TRANSFERENCIA' | 'CANCELAMENTO_MATRICULA';
    status?: 'PENDENTE' | 'ENVIADO' | 'ERRO' | 'CANCELADO';
    dataInicio?: string;
    dataFim?: string;
  }) => {
    const response = await api.get('/eventos-governamentais', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/eventos-governamentais/${id}`);
    return response.data;
  },

  criar: async (data: {
    tipoEvento: 'MATRICULA' | 'CONCLUSAO' | 'DIPLOMA' | 'TRANSFERENCIA' | 'CANCELAMENTO_MATRICULA';
    payloadJson: any;
    observacoes?: string;
  }) => {
    const response = await api.post('/eventos-governamentais', data);
    return response.data;
  },

  enviar: async (id: string, forcarEnvio?: boolean) => {
    const response = await api.post(`/eventos-governamentais/${id}/enviar`, { forcarEnvio });
    return response.data;
  },

  cancelar: async (id: string, motivo: string) => {
    const response = await api.post(`/eventos-governamentais/${id}/cancelar`, { motivo });
    return response.data;
  },

  obterEstatisticas: async () => {
    const response = await api.get('/eventos-governamentais/estatisticas');
    return response.data;
  },

  verificarStatusIntegracao: async () => {
    const response = await api.get('/eventos-governamentais/status-integracao');
    return response.data;
  },
};

// Pagamentos Instituição API (pagamentos de assinatura)
export const pagamentosInstituicaoApi = {
  getAll: async (params?: { status?: string; dataInicio?: string; dataFim?: string; instituicaoId?: string }) => {
    // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
    // O backend usa req.user.instituicaoId do JWT token automaticamente
    const { instituicaoId, ...safeParams } = params || {};
    const response = await api.get('/pagamentos-instituicao', { params: safeParams });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/pagamentos-instituicao/${id}`);
    return response.data;
  },

  getByInstituicao: async () => {
    // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
    // O backend usa req.user.instituicaoId do JWT token automaticamente
    // Use getAll() que já filtra pela instituição do token
    const response = await api.get('/pagamentos-instituicao');
    return response.data;
  },

  create: async (data: {
    assinatura_id?: string;
    valor: number;
    data_vencimento?: string;
    forma_pagamento?: string;
    status?: string;
    comprovativo_texto?: string | null;
    comprovativo_url?: string | null;
    telefone_contato?: string | null;
    observacoes?: string | null;
  }) => {
    // IMPORTANTE: Multi-tenant - NUNCA enviar instituicao_id do frontend
    // O backend usa req.user.instituicaoId do JWT token automaticamente
    const { instituicao_id, ...safeData } = data as any;
    const response = await api.post('/pagamentos-instituicao', safeData);
    return response.data;
  },

  update: async (id: string, data: { status?: string; observacoes?: string }) => {
    const response = await api.put(`/pagamentos-instituicao/${id}`, data);
    return response.data;
  },
};

// Equivalências API
export const equivalenciasApi = {
  getAll: async (params?: {
    alunoId?: string;
    deferido?: boolean;
    disciplinaDestinoId?: string;
  }) => {
    const response = await api.get('/equivalencias', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/equivalencias/${id}`);
    return response.data;
  },

  getByAluno: async (alunoId: string) => {
    const response = await api.get(`/equivalencias/aluno/${alunoId}`);
    return response.data;
  },

  create: async (data: {
    alunoId: string;
    cursoOrigemId?: string;
    disciplinaOrigemId?: string;
    disciplinaOrigemNome?: string;
    instituicaoOrigemNome?: string;
    cargaHorariaOrigem: number;
    notaOrigem?: number;
    cursoDestinoId: string;
    disciplinaDestinoId: string;
    cargaHorariaEquivalente: number;
    criterio?: 'EQUIVALENCIA' | 'DISPENSA';
    observacao?: string;
  }) => {
    const response = await api.post('/equivalencias', data);
    return response.data;
  },

  update: async (id: string, data: {
    cursoOrigemId?: string;
    disciplinaOrigemId?: string;
    disciplinaOrigemNome?: string;
    instituicaoOrigemNome?: string;
    cargaHorariaOrigem?: number;
    notaOrigem?: number;
    cursoDestinoId?: string;
    disciplinaDestinoId?: string;
    cargaHorariaEquivalente?: number;
    criterio?: 'EQUIVALENCIA' | 'DISPENSA';
    observacao?: string;
  }) => {
    const response = await api.put(`/equivalencias/${id}`, data);
    return response.data;
  },

  deferir: async (id: string, observacao?: string) => {
    const response = await api.post(`/equivalencias/${id}/deferir`, { observacao });
    return response.data;
  },

  indeferir: async (id: string, motivo: string) => {
    const response = await api.post(`/equivalencias/${id}/indeferir`, { motivo });
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/equivalencias/${id}`);
    return response.data;
  },
};

// SAFT Exports API
export const saftExportsApi = {
  getAll: async (params?: { instituicaoId?: string }) => {
    const response = await api.get('/saft-exports', { params });
    return response.data;
  },

  create: async (
    data: {
      usuario_id?: string;
      usuario_nome?: string;
      usuario_email?: string;
      periodo_inicio: string;
      periodo_fim: string;
      arquivo_nome?: string;
      total_clientes?: number;
      total_produtos?: number;
      total_faturas?: number;
      total_documentos?: number;
      total_valor?: number;
      valor_total?: number;
      status?: string;
    },
    /** Apenas SUPER_ADMIN: instituicaoId para escopo (query param). ADMIN usa token. */
    instituicaoIdForScope?: string
  ) => {
    const config: { params?: { instituicaoId?: string } } = {};
    if (instituicaoIdForScope) config.params = { instituicaoId: instituicaoIdForScope };
    const response = await api.post('/saft-exports', data, config);
    return response.data;
  },

  generate: async (data: {
    instituicaoId: string;
    dataInicio: string;
    dataFim: string;
    tipoExportacao?: string;
  }) => {
    const response = await api.post('/saft-exports/generate', data);
    return response.data;
  },

  download: async (id: string) => {
    const response = await api.get(`/saft-exports/${id}/download`, { responseType: 'blob' });
    return response.data;
  },
};

// Avaliações API
export const avaliacoesApi = {
  getAll: async (params?: { turmaId?: string; trimestre?: number; tipo?: string; planoEnsinoId?: string }) => {
    const response = await api.get('/avaliacoes', { params });
    return response.data;
  },

  getByTurma: async (turmaId: string) => {
    const response = await api.get('/avaliacoes', { params: { turmaId } });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/avaliacoes/${id}`);
    return response.data;
  },

  create: async (data: {
    planoEnsinoId: string; // OBRIGATÓRIO: Avaliação sempre vinculada ao Plano de Ensino
    turmaId: string;
    tipo: 'PROVA' | 'TESTE' | 'TRABALHO' | 'PROVA_FINAL' | 'RECUPERACAO';
    trimestre?: number | null; // Obrigatório apenas para Ensino Secundário
    trimestreId?: string | null; // FK para Trimestre (SECUNDARIO)
    semestreId?: string | null; // FK para Semestre (SUPERIOR) - OBRIGATÓRIO para Ensino Superior
    peso?: number;
    data: string;
    nome?: string;
    descricao?: string;
    // DEPRECATED: Não enviar professorId ou disciplinaId - são derivados do Plano de Ensino
  }) => {
    // Garantir que campos deprecated não sejam enviados
    const cleanData: any = { ...data };
    delete cleanData.professorId;
    delete cleanData.disciplinaId;
    const response = await api.post('/avaliacoes', cleanData);
    return response.data;
  },

  update: async (id: string, data: {
    tipo?: 'PROVA' | 'TESTE' | 'TRABALHO' | 'PROVA_FINAL' | 'RECUPERACAO';
    trimestre?: number | null;
    trimestreId?: string | null; // FK para Trimestre (SECUNDARIO)
    semestreId?: string | null; // FK para Semestre (SUPERIOR)
    peso?: number;
    data?: string;
    nome?: string;
    descricao?: string;
    // DEPRECATED: Não enviar professorId, disciplinaId, planoEnsinoId ou turmaId em update
  }) => {
    // Garantir que campos deprecated não sejam enviados
    const cleanData: any = { ...data };
    delete cleanData.professorId;
    delete cleanData.disciplinaId;
    delete cleanData.planoEnsinoId;
    delete cleanData.turmaId;
    const response = await api.put(`/avaliacoes/${id}`, cleanData);
    return response.data;
  },

  fechar: async (id: string) => {
    const response = await api.post(`/avaliacoes/${id}/fechar`);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/avaliacoes/${id}`);
    return response.data;
  },
};

// Notas - Avaliações API
// Biblioteca API
export const bibliotecaApi = {
  // Itens
  getItens: async (params?: { tipo?: string; categoria?: string; busca?: string }) => {
    const response = await api.get('/biblioteca/itens', { params });
    return response.data;
  },

  getItemById: async (id: string) => {
    const response = await api.get(`/biblioteca/itens/${id}`);
    return response.data;
  },

  createItem: async (data: FormData | {
    titulo: string;
    autor?: string;
    isbn?: string;
    tipo: 'FISICO' | 'DIGITAL';
    categoria?: string;
    quantidade?: number;
    localizacao?: string;
    arquivoUrl?: string;
    descricao?: string;
    editora?: string;
    anoPublicacao?: number;
    edicao?: string;
  }) => {
    // Se for FormData, axios automaticamente define Content-Type com boundary
    // Não precisamos definir manualmente
    const response = await api.post('/biblioteca/itens', data, {
      headers: data instanceof FormData ? {} : {
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  },

  downloadArquivo: async (id: string) => {
    const response = await api.get(`/biblioteca/itens/${id}/download`, {
      responseType: 'blob',
    });
    // Criar URL do blob e fazer download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `livro-${id}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return response.data;
  },

  updateItem: async (id: string, data: FormData | {
    titulo?: string;
    autor?: string;
    isbn?: string;
    tipo?: 'FISICO' | 'DIGITAL';
    categoria?: string;
    quantidade?: number;
    localizacao?: string;
    arquivoUrl?: string;
    descricao?: string;
    editora?: string;
    anoPublicacao?: number;
    edicao?: string;
  }) => {
    // Se for FormData, axios automaticamente define Content-Type com boundary
    const response = await api.put(`/biblioteca/itens/${id}`, data, {
      headers: data instanceof FormData ? {} : {
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  },

  deleteItem: async (id: string) => {
    const response = await api.delete(`/biblioteca/itens/${id}`);
    return response.data;
  },

  // Empréstimos
  createEmprestimo: async (data: {
    itemId: string;
    usuarioId?: string;
    dataPrevista: string;
    observacoes?: string;
  }) => {
    const response = await api.post('/biblioteca/emprestimos', data);
    return response.data;
  },

  devolverEmprestimo: async (id: string) => {
    const response = await api.put(`/biblioteca/emprestimos/${id}/devolucao`);
    return response.data;
  },

  getEmprestimos: async (params?: { status?: string; usuarioId?: string }) => {
    const response = await api.get('/biblioteca/emprestimos', { params });
    return response.data;
  },

  getMeusEmprestimos: async (params?: { status?: string }) => {
    const response = await api.get('/biblioteca/meus-emprestimos', { params });
    return response.data;
  },

  getPessoasParaEmprestimo: async (params?: { tipo?: string; busca?: string }) => {
    const response = await api.get('/biblioteca/pessoas', { params });
    return response.data;
  },

  renovarEmprestimo: async (id: string, data: { dataPrevista?: string }) => {
    const response = await api.put(`/biblioteca/emprestimos/${id}/renovar`, data);
    return response.data;
  },
};

export const notasAvaliacaoApi = {
  getAlunosParaLancar: async (avaliacaoId: string) => {
    const response = await api.get(`/notas/avaliacao/${avaliacaoId}/alunos`);
    return response.data;
  },

  createLote: async (data: {
    avaliacaoId: string;
    notas: Array<{
      alunoId: string;
      valor: number;
      observacoes?: string;
    }>;
  }) => {
    const response = await api.post('/notas/avaliacao/lote', data);
    return response.data;
  },

  getBoletimAluno: async (alunoId: string, params?: { planoEnsinoId?: string; anoLetivo?: number }) => {
    const response = await api.get(`/notas/boletim/aluno/${alunoId}`, { params });
    return response.data;
  },
};

// Estrutura Organizacional API
export const estruturaOrganizacionalApi = {
  getEstrutura: async () => {
    const response = await api.get('/rh/estrutura-organizacional');
    return response.data;
  },
};

// Semestre API
export const semestreApi = {
  // Listar semestres
  getAll: async (params?: { anoLetivo?: number; anoLetivoId?: string }) => {
    const response = await api.get('/semestres', { params });
    return response.data;
  },

  // Buscar semestre por ano letivo e número
  get: async (params: { anoLetivo: number; numero: number }) => {
    const response = await api.get('/semestres/buscar', { params });
    return response.data;
  },

  // Buscar semestre atual (mais recente) por ano letivo
  getAtual: async (anoLetivo: number) => {
    const response = await api.get('/semestres/atual', { params: { anoLetivo } });
    return response.data;
  },

  // Criar semestre
  create: async (data: {
    anoLetivo?: number;
    anoLetivoId?: string;
    numero: number;
    dataInicio: string;
    dataFim?: string;
    observacoes?: string;
  }) => {
    const response = await api.post('/semestres', data);
    return response.data;
  },

  // Atualizar semestre
  update: async (id: string, data: {
    dataInicio?: string;
    dataFim?: string;
    observacoes?: string;
  }) => {
    const response = await api.put(`/semestres/${id}`, data);
    return response.data;
  },

  // Ativar semestre manualmente
  ativar: async (data: { semestreId?: string; anoLetivo?: number; numero?: number }) => {
    const response = await api.post('/semestres/ativar', data);
    return response.data;
  },
};

export const trimestreApi = {
  // Listar trimestres
  getAll: async (params?: { anoLetivo?: number; anoLetivoId?: string }) => {
    const response = await api.get('/trimestres', { params });
    return response.data;
  },

  // Buscar trimestre por ano letivo e número
  get: async (params: { anoLetivo: number; numero: number }) => {
    const response = await api.get('/trimestres/buscar', { params });
    return response.data;
  },

  // Buscar trimestre atual (mais recente) por ano letivo
  getAtual: async (anoLetivo: number) => {
    const response = await api.get('/trimestres/atual', { params: { anoLetivo } });
    return response.data;
  },

  // Criar trimestre
  create: async (data: {
    anoLetivo?: number;
    anoLetivoId?: string;
    numero: number;
    dataInicio: string;
    dataFim?: string;
    observacoes?: string;
  }) => {
    const response = await api.post('/trimestres', data);
    return response.data;
  },

  // Atualizar trimestre
  update: async (id: string, data: {
    dataInicio?: string;
    dataFim?: string;
    observacoes?: string;
  }) => {
    const response = await api.put(`/trimestres/${id}`, data);
    return response.data;
  },

  // Ativar trimestre manualmente
  ativar: async (data: { trimestreId?: string; anoLetivo?: number; numero?: number }) => {
    const response = await api.post('/trimestres/ativar', data);
    return response.data;
  },
};

export const anoLetivoApi = {
  // Listar anos letivos
  getAll: async () => {
    const response = await api.get('/anos-letivos');
    return response.data;
  },

  // Buscar ano letivo por ano
  get: async (ano: number) => {
    const response = await api.get('/anos-letivos/buscar', { params: { ano } });
    return response.data;
  },

  // Verificar se ano letivo está encerrado
  verificarEncerrado: async (anoLetivoId?: string | null) => {
    const response = await api.get('/anos-letivos/verificar-encerrado', { 
      params: anoLetivoId ? { anoLetivoId } : {} 
    });
    return response.data;
  },

  // Criar ano letivo
  create: async (data: {
    ano: number;
    dataInicio: string;
    dataFim: string;
    observacoes?: string;
  }) => {
    const response = await api.post('/anos-letivos', data);
    return response.data;
  },

  // Atualizar ano letivo
  update: async (id: string, data: {
    dataInicio?: string;
    dataFim?: string;
    observacoes?: string;
  }) => {
    const response = await api.put(`/anos-letivos/${id}`, data);
    return response.data;
  },

  // Ativar ano letivo
  ativar: async (data: { anoLetivoId: string }) => {
    const response = await api.post('/anos-letivos/ativar', data);
    return response.data;
  },

  // Encerrar ano letivo
  encerrar: async (data: { anoLetivoId: string; justificativa?: string }) => {
    const response = await api.post('/anos-letivos/encerrar', data);
    return response.data;
  },

  // Buscar ano letivo ativo
  getAtivo: async () => {
    const response = await api.get('/anos-letivos/ativo');
    return response.data;
  },
};

// Conclusão de Curso API
export const conclusaoCursoApi = {
  // Validar requisitos para conclusão
  validarRequisitos: async (params: { alunoId: string; cursoId?: string; classeId?: string }) => {
    const response = await api.get('/conclusoes-cursos/validar', { params });
    return response.data;
  },

  // Listar conclusões
  getAll: async (params?: { alunoId?: string; cursoId?: string; classeId?: string; status?: string }) => {
    const response = await api.get('/conclusoes-cursos', { params });
    return response.data;
  },

  // Buscar conclusão por ID
  getById: async (id: string) => {
    const response = await api.get(`/conclusoes-cursos/${id}`);
    return response.data;
  },

  // Criar solicitação de conclusão
  criarSolicitacao: async (data: {
    alunoId: string;
    cursoId?: string;
    classeId?: string;
    tipoConclusao?: 'CONCLUIDO' | 'APROVEITAMENTO' | 'CERTIFICACAO';
    observacoes?: string;
  }) => {
    const response = await api.post('/conclusoes-cursos', data);
    return response.data;
  },

  // Concluir curso oficialmente
  concluirCurso: async (id: string, data?: { numeroAto?: string; observacoes?: string }) => {
    const response = await api.post(`/conclusoes-cursos/${id}/concluir`, data);
    return response.data;
  },

  // Criar colação de grau (Ensino Superior)
  criarColacaoGrau: async (id: string, data: {
    dataColacao?: string;
    numeroAta?: string;
    localColacao?: string;
    observacoes?: string;
  }) => {
    const response = await api.post(`/conclusoes-cursos/${id}/colacao`, data);
    return response.data;
  },

  // Criar certificado (Ensino Secundário)
  criarCertificado: async (id: string, data: {
    numeroCertificado: string;
    livro?: string;
    folha?: string;
    observacoes?: string;
  }) => {
    const response = await api.post(`/conclusoes-cursos/${id}/certificado`, data);
    return response.data;
  },
};

// Integração Governamental API
export const governoApi = {
  // Verificar status da integração
  verificarStatus: async () => {
    const response = await api.get('/governo/status');
    return response.data;
  },

  // Listar eventos governamentais
  listarEventos: async (params?: {
    tipoEvento?: string;
    status?: string;
    dataInicio?: string;
    dataFim?: string;
  }) => {
    const response = await api.get('/governo/eventos', { params });
    return response.data;
  },

  // Obter evento por ID
  obterEvento: async (id: string) => {
    const response = await api.get(`/governo/eventos/${id}`);
    return response.data;
  },

  // Criar evento governamental
  criarEvento: async (data: {
    tipoEvento: 'MATRICULA' | 'CONCLUSAO' | 'DIPLOMA' | 'TRANSFERENCIA' | 'CANCELAMENTO_MATRICULA';
    payload: any;
    observacoes?: string;
  }) => {
    const response = await api.post('/governo/eventos', data);
    return response.data;
  },

  // Reenviar evento
  reenviarEvento: async (id: string) => {
    const response = await api.post(`/governo/eventos/${id}/reenviar`);
    return response.data;
  },

  // Cancelar evento
  cancelarEvento: async (id: string, observacoes?: string) => {
    const response = await api.post(`/governo/eventos/${id}/cancelar`, { observacoes });
    return response.data;
  },
};

/**
 * API para Relatórios Oficiais
 * REGRA ABSOLUTA: Relatórios são SOMENTE leitura e derivados
 */
export const relatoriosOficiaisApi = {
  // Gerar Histórico Acadêmico
  gerarHistoricoAcademico: async (alunoId: string) => {
    const response = await api.get(`/relatorios-oficiais/historico/${alunoId}`);
    return response.data;
  },

  // Gerar Boletim do Aluno (documento somente leitura, derivado de dados reais)
  gerarBoletimAluno: async (alunoId: string, params?: { anoLetivoId?: string }) => {
    const response = await api.get(`/relatorios-oficiais/boletim/${alunoId}`, { params });
    return response.data;
  },

  // Gerar Pauta (apenas após fechamento do plano de ensino)
  gerarPauta: async (planoEnsinoId: string) => {
    const response = await api.get(`/relatorios-oficiais/pauta/${planoEnsinoId}`);
    return response.data;
  },

  // Gerar Certificado (com verificação de bloqueio acadêmico)
  gerarCertificado: async (alunoId: string, cursoId: string) => {
    const response = await api.post('/relatorios-oficiais/certificado', {
      alunoId,
      cursoId,
    });
    return response.data;
  },

  // Verificar bloqueio acadêmico do aluno
  verificarBloqueio: async (alunoId: string, tipoOperacao?: string) => {
    const params = tipoOperacao ? { tipoOperacao } : {};
    const response = await api.get(`/relatorios-oficiais/bloqueio/${alunoId}`, { params });
    return response.data;
  },

  // Obter situação financeira do aluno
  obterSituacaoFinanceira: async (alunoId: string) => {
    const response = await api.get(`/relatorios-oficiais/situacao-financeira/${alunoId}`);
    return response.data;
  },
};

/**
 * API para Bloqueio Acadêmico
 * REGRA: Configurações avançadas por instituição
 */
export const bloqueioAcademicoApi = {
  // Obter configuração de bloqueio acadêmico
  obterConfiguracao: async () => {
    const response = await api.get('/bloqueio-academico/configuracao');
    return response.data;
  },

  // Atualizar configuração de bloqueio acadêmico (apenas administradores)
  atualizarConfiguracao: async (configuracao: {
    bloquearMatriculaPorFinanceiro?: boolean;
    bloquearDocumentosPorFinanceiro?: boolean;
    bloquearCertificadosPorFinanceiro?: boolean;
    permitirAulasComBloqueioFinanceiro?: boolean;
    permitirAvaliacoesComBloqueioFinanceiro?: boolean;
    mensagemBloqueioMatricula?: string;
    mensagemBloqueioDocumentos?: string;
    mensagemBloqueioCertificados?: string;
  }) => {
    const response = await api.put('/bloqueio-academico/configuracao', configuracao);
    return response.data;
  },

  // Verificar bloqueio para operação específica
  verificarBloqueioOperacao: async (alunoId: string, tipoOperacao: string) => {
    const response = await api.post('/bloqueio-academico/verificar', {
      alunoId,
      tipoOperacao,
    });
    return response.data;
  },
};

/**
 * API para Segurança e Auditoria
 * Painel de segurança institucional (somente leitura para ADMIN)
 */
export const segurancaApi = {
  // Obter tentativas de login
  getLoginAttempts: async (params?: {
    email?: string;
    dataInicio?: string;
    dataFim?: string;
    bloqueado?: boolean;
    limit?: number;
  }) => {
    const response = await api.get('/seguranca/login-attempts', { params });
    return response.data;
  },

  // Obter resets de senha
  getPasswordResets: async (params?: {
    userId?: string;
    usado?: boolean;
    dataInicio?: string;
    dataFim?: string;
    limit?: number;
  }) => {
    const response = await api.get('/seguranca/password-resets', { params });
    return response.data;
  },

  // Obter painel de segurança consolidado
  getDashboard: async (params?: {
    dataInicio?: string;
    dataFim?: string;
  }) => {
    const response = await api.get('/seguranca/dashboard', { params });
    return response.data;
  },
};

export default api;
