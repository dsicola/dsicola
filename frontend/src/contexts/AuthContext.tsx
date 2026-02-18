import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi, setTokens, clearTokens, getAccessToken } from '@/services/api';
import { AuthContextType, UserProfile, UserRole } from '@/types/auth';
import { toast } from 'sonner';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

// Prioridade de roles - quanto menor, mais prioritária (alinhada ao backend UserRole)
const rolePriority: Record<string, number> = {
  'SUPER_ADMIN': 1,
  'COMERCIAL': 2,
  'ADMIN': 3,
  'DIRECAO': 4,
  'COORDENADOR': 5,
  'SECRETARIA': 6,
  'PROFESSOR': 7,
  'AUDITOR': 8,
  'POS': 9,
  'RESPONSAVEL': 10,
  'RH': 11,
  'FINANCEIRO': 12,
  'ALUNO': 13,
};

const getHighestPriorityRole = (roles: string[]): UserRole | null => {
  if (!roles || roles.length === 0) return null;
  
  const sortedRoles = [...roles].sort((a, b) => 
    (rolePriority[a] || 99) - (rolePriority[b] || 99)
  );
  
  return sortedRoles[0] as UserRole;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async () => {
    try {
      const data = await authApi.getProfile();
      
      const userProfile: UserProfile = {
        id: data.id,
        email: data.email,
        nome_completo: data.nomeCompleto || data.nome_completo || '',
        avatar_url: data.avatarUrl || data.avatar_url || null,
        telefone: data.telefone || null,
        numero_identificacao: data.numeroIdentificacao || data.numero_identificacao || null,
        numero_identificacao_publica: data.numeroIdentificacaoPublica || data.numero_identificacao_publica || null,
        data_nascimento: data.dataNascimento ? (typeof data.dataNascimento === 'string' ? data.dataNascimento : data.dataNascimento.toISOString().split('T')[0]) : null,
        genero: data.genero || null,
        morada: data.morada || null,
        status_aluno: data.statusAluno || data.status_aluno || null,
        instituicao_id: data.instituicaoId || data.instituicao_id || null,
        created_at: data.createdAt ? (typeof data.createdAt === 'string' ? data.createdAt : data.createdAt.toISOString()) : undefined,
        updated_at: data.updatedAt ? (typeof data.updatedAt === 'string' ? data.updatedAt : data.updatedAt.toISOString()) : undefined,
      };
      
      // Armazenar roles e professorId no user object (extendendo UserProfile)
      (userProfile as any).roles = data.roles || [];
      if (data.professorId) (userProfile as any).professorId = data.professorId;

      setUser(userProfile);
      setRole(getHighestPriorityRole(data.roles || []));
      
      return true;
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
      clearTokens();
      setUser(null);
      setRole(null);
      return false;
    }
  };

  useEffect(() => {
    let isMounted = true; // Flag para evitar atualizações após desmontagem

    const initAuth = async () => {
      try {
        const token = getAccessToken();
        
        if (token) {
          await fetchUserProfile();
        }
        
        if (isMounted) {
          setLoading(false);
        }
      } catch (error) {
        console.error('Erro ao inicializar autenticação:', error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initAuth().catch((err) => {
      // Tratar qualquer erro não capturado
      console.error('Erro não tratado em initAuth:', err);
      if (isMounted) {
        setLoading(false);
      }
    });

    // Cleanup: marcar como desmontado
    return () => {
      isMounted = false;
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const data = await authApi.login(email, password);
      
      setTokens(data.accessToken, data.refreshToken);
      
      // Garantir que temos roles do login
      const loginRoles = data.user?.roles || [];
      if (loginRoles.length === 0) {
        console.error('Login retornou sem roles. Dados:', data);
        setLoading(false);
        return { error: { message: 'Usuário sem perfil configurado. Entre em contato com o administrador.' } };
      }
      
      // Buscar perfil completo após login bem-sucedido
      try {
        const profileData = await authApi.getProfile();
        
        const userProfile: UserProfile = {
          id: profileData.id,
          email: profileData.email,
          nome_completo: profileData.nomeCompleto || profileData.nome_completo || '',
          avatar_url: profileData.avatarUrl || profileData.avatar_url || null,
          telefone: profileData.telefone || null,
          numero_identificacao: profileData.numeroIdentificacao || profileData.numero_identificacao || null,
          numero_identificacao_publica: profileData.numeroIdentificacaoPublica || profileData.numero_identificacao_publica || null,
          data_nascimento: profileData.dataNascimento ? (typeof profileData.dataNascimento === 'string' ? profileData.dataNascimento : profileData.dataNascimento.toISOString().split('T')[0]) : null,
          genero: profileData.genero || null,
          morada: profileData.morada || null,
          status_aluno: profileData.statusAluno || profileData.status_aluno || null,
          instituicao_id: profileData.instituicaoId || profileData.instituicao_id || null,
          created_at: profileData.createdAt ? (typeof profileData.createdAt === 'string' ? profileData.createdAt : profileData.createdAt.toISOString()) : undefined,
          updated_at: profileData.updatedAt ? (typeof profileData.updatedAt === 'string' ? profileData.updatedAt : profileData.updatedAt.toISOString()) : undefined,
        };
        
        // Usar roles do profile se disponível, senão usar do login
        const rolesToUse = profileData.roles && profileData.roles.length > 0 
          ? profileData.roles 
          : loginRoles;
        
        // Armazenar roles no user object
        (userProfile as any).roles = rolesToUse;
        
        const userRole = getHighestPriorityRole(rolesToUse);
        
        if (!userRole) {
          console.error('Nenhuma role válida encontrada. Profile roles:', profileData.roles, 'Login roles:', loginRoles);
          setLoading(false);
          return { error: { message: 'Usuário sem perfil válido. Entre em contato com o administrador.' } };
        }
        
        setUser(userProfile);
        setRole(userRole);
        setLoading(false);
        
        return { error: null };
      } catch (profileError: any) {
        // Se falhar ao buscar perfil, usar dados básicos do login
        console.warn('Erro ao buscar perfil completo, usando dados básicos do login:', profileError);
        
        // Garantir que temos roles do login
        if (loginRoles.length === 0) {
          console.error('Erro ao buscar perfil e login não retornou roles');
          setLoading(false);
          return { error: { message: 'Erro ao carregar perfil do usuário. Tente novamente.' } };
        }
        
        const userProfile: UserProfile = {
          id: data.user.id,
          email: data.user.email,
          nome_completo: data.user.nomeCompleto || data.user.nome_completo || '',
          avatar_url: data.user.avatarUrl || data.user.avatar_url || null,
          instituicao_id: data.user.instituicaoId || data.user.instituicao_id || null,
        };
        
        // Armazenar roles no user object
        (userProfile as any).roles = loginRoles;
        
        const userRole = getHighestPriorityRole(loginRoles);
        
        if (!userRole) {
          console.error('Nenhuma role válida encontrada nos dados do login. Roles:', loginRoles);
          setLoading(false);
          return { error: { message: 'Usuário sem perfil válido. Entre em contato com o administrador.' } };
        }
        
        setUser(userProfile);
        setRole(userRole);
        setLoading(false);
        
        return { error: null };
      }
    } catch (error: any) {
      // ============================================================
      // POLÍTICA DE SEGURANÇA: Interceptar MUST_CHANGE_PASSWORD
      // ============================================================
      const isMustChangePassword = 
        error?.response?.status === 403 && (
          error?.response?.data?.message === 'MUST_CHANGE_PASSWORD' ||
          error?.response?.data?.error === 'MUST_CHANGE_PASSWORD' ||
          error?.error === 'MUST_CHANGE_PASSWORD' ||
          error?.message === 'MUST_CHANGE_PASSWORD'
        ) || (
          error?.status === 403 && (
            error?.error === 'MUST_CHANGE_PASSWORD' ||
            error?.message === 'MUST_CHANGE_PASSWORD'
          )
        );
      
      if (isMustChangePassword) {
        // Retornar erro especial para o componente de login interceptar
        setLoading(false);
        return { 
          error: { 
            message: 'MUST_CHANGE_PASSWORD',
            code: 'MUST_CHANGE_PASSWORD'
          } 
        };
      }
      
      let message = 'Erro ao fazer login';
      
      // Priorizar mensagem do backend (response.data.message ou response.data.error)
      if (error?.response?.data) {
        const responseData = error.response.data;
        // Tentar extrair mensagem em ordem de prioridade
        if (responseData.message && typeof responseData.message === 'string') {
          message = responseData.message;
        } else if (responseData.error && typeof responseData.error === 'string') {
          message = responseData.error;
        }
      }
      
      // Handle 401 Unauthorized specifically
      if (error?.response?.status === 401) {
        // Se não conseguiu extrair mensagem do backend, usar mensagem padrão
        if (message === 'Erro ao fazer login') {
          message = 'Email ou senha inválidos';
        }
        
        // Tratar caso específico de ERR_BAD_REQUEST com 401 (credenciais inválidas)
        if (error?.code === 'ERR_BAD_REQUEST' && error?.response?.status === 401) {
          // A mensagem do backend já foi extraída acima, apenas garantir que não seja genérica
          if (!error?.response?.data?.message && !error?.response?.data?.error) {
            message = 'Email ou senha inválidos';
          }
        }
      }
      
      // Enhanced error messages for connection issues
      if (error?.code === 'ERR_NETWORK' || error?.code === 'ECONNREFUSED' || error?.message?.includes('Network Error')) {
        const apiUrl = error?.diagnostic?.apiUrl || 'não configurado';
        message = `Não foi possível conectar ao servidor. URL da API: ${apiUrl}. Verifique: 1) Se o backend está rodando na porta 3001, 2) Se VITE_API_URL está configurado no frontend, 3) Se FRONTEND_URL está configurado no backend.`;
      } else if (error?.code === 'ERR_CANCELED') {
        message = 'Requisição cancelada. Verifique sua conexão com a internet.';
      } else if (error?.code === 'ETIMEDOUT' || error?.message?.includes('timeout')) {
        message = 'Tempo de espera esgotado. O servidor pode estar sobrecarregado ou inacessível.';
      }
      
      // Log error details in development mode only (mais limpo e informativo)
      if (import.meta.env.DEV) {
        const errorInfo: any = {
          status: error?.response?.status,
          statusText: error?.response?.statusText,
          url: error?.config?.url || '/auth/login',
          message: message, // Mensagem que será exibida ao usuário
        };
        
        // Adicionar detalhes técnicos apenas se relevantes
        if (error?.code && error.code !== 'ERR_BAD_REQUEST') {
          errorInfo.code = error.code;
        }
        
        if (error?.response?.data) {
          errorInfo.backendResponse = error.response.data;
        }
        
        if (error?.diagnostic) {
          errorInfo.diagnostic = error.diagnostic;
        }
        
        console.error('[Auth Error]', errorInfo);
      }
      
      setLoading(false);
      return { error: { message } };
    }
  };

  const signInWithTokens = async (accessToken: string, refreshToken: string) => {
    try {
      setTokens(accessToken, refreshToken);
      const success = await fetchUserProfile();
      if (!success) {
        clearTokens();
        return { error: { message: 'Erro ao carregar perfil. Tente novamente.' } };
      }
      return { error: null };
    } catch (error: any) {
      clearTokens();
      const message = error?.response?.data?.message || error?.message || 'Erro ao completar login';
      return { error: { message } };
    }
  };

  const signUp = async (email: string, password: string, nomeCompleto: string) => {
    try {
      await authApi.register(email, password, nomeCompleto);
      return { error: null };
    } catch (error: any) {
      const message = error.response?.data?.message || 'Erro ao registrar';
      return { error: { message } };
    }
  };

  const signOut = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    } finally {
      clearTokens();
      setUser(null);
      setRole(null);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await authApi.resetPassword(email);
      return { error: null };
    } catch (error: any) {
      const message = error.response?.data?.message || 'Erro ao redefinir senha';
      return { error: { message } };
    }
  };

  const updatePassword = async (currentPassword: string, newPassword: string) => {
    try {
      await authApi.updatePassword(currentPassword, newPassword);
      return { error: null };
    } catch (error: any) {
      const message = error.response?.data?.message || 'Erro ao atualizar senha';
      return { error: { message } };
    }
  };

  const changePasswordRequired = async (newPassword: string, confirmPassword: string) => {
    try {
      await authApi.changePasswordRequired(newPassword, confirmPassword);
      // Após alterar senha obrigatória, buscar perfil novamente
      await fetchUserProfile();
      return { error: null };
    } catch (error: any) {
      const message = error.response?.data?.message || 'Erro ao alterar senha';
      return { error: { message } };
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, signIn, signInWithTokens, signUp, signOut, resetPassword, updatePassword, changePasswordRequired, refreshUser: fetchUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
