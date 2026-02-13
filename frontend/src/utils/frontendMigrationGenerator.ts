import jsPDF from 'jspdf';

// ============================================================
// GERADOR DE FRONTEND COMPLETO - REACT + VITE (SEM SUPABASE)
// ============================================================

export const generateFrontendMigrationPDF = () => {
  const doc = new jsPDF();
  let yPos = 20;
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15;
  const maxWidth = pageWidth - 2 * margin;

  const addPage = () => {
    doc.addPage();
    yPos = 20;
  };

  const checkPageBreak = (height: number = 10) => {
    if (yPos + height > pageHeight - 20) {
      addPage();
    }
  };

  const addTitle = (text: string, size: number = 16) => {
    checkPageBreak(20);
    doc.setFontSize(size);
    doc.setFont('helvetica', 'bold');
    doc.text(text, margin, yPos);
    yPos += size / 2 + 5;
  };

  const addCode = (code: string, fontSize: number = 7) => {
    doc.setFontSize(fontSize);
    doc.setFont('courier', 'normal');
    const lines = code.split('\n');
    lines.forEach((line) => {
      checkPageBreak();
      const truncatedLine = line.length > 120 ? line.substring(0, 117) + '...' : line;
      doc.text(truncatedLine, margin, yPos);
      yPos += 4;
    });
    yPos += 3;
  };

  const addSection = (title: string, code: string) => {
    addTitle(title, 12);
    addCode(code);
  };

  // ============================================================
  // CAPA
  // ============================================================
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('DSICOLA - FRONTEND COMPLETO', pageWidth / 2, 40, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('React + Vite + TypeScript', pageWidth / 2, 55, { align: 'center' });
  doc.text('Integrado com Backend Express/PostgreSQL', pageWidth / 2, 65, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth / 2, 85, { align: 'center' });

  // ============================================================
  // ESTRUTURA DO PROJETO FRONTEND
  // ============================================================
  addPage();
  addTitle('ESTRUTURA DO PROJETO FRONTEND', 16);
  addCode(`
dsicola-frontend/
├── public/
│   └── favicon.ico
├── src/
│   ├── api/
│   │   └── client.ts              # Cliente HTTP para API
│   ├── contexts/
│   │   └── AuthContext.tsx        # Contexto de autenticação
│   ├── hooks/
│   │   └── useAuth.ts             # Hook de autenticação
│   ├── pages/
│   │   ├── Auth.tsx               # Página de login/registro
│   │   └── Dashboard.tsx          # Dashboard principal
│   ├── components/
│   │   └── ProtectedRoute.tsx     # Proteção de rotas
│   ├── types/
│   │   └── index.ts               # Tipos TypeScript
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── .env.example
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
`);

  // ============================================================
  // COMANDOS DE INSTALAÇÃO
  // ============================================================
  addTitle('COMANDOS DE INSTALAÇÃO', 14);
  addCode(`
# 1. Criar projeto
npm create vite@latest dsicola-frontend -- --template react-ts
cd dsicola-frontend

# 2. Instalar dependências
npm install react-router-dom axios @tanstack/react-query
npm install tailwindcss postcss autoprefixer
npm install @radix-ui/react-dialog @radix-ui/react-tabs
npm install lucide-react sonner class-variance-authority clsx
npm install tailwind-merge zod react-hook-form @hookform/resolvers

# 3. Inicializar Tailwind
npx tailwindcss init -p

# 4. Configurar .env
cp .env.example .env

# 5. Iniciar desenvolvimento
npm run dev
`);

  // ============================================================
  // ARQUIVO: .env.example
  // ============================================================
  addPage();
  addSection('ARQUIVO: .env.example', `
# URL do Backend Express
VITE_API_URL=http://localhost:3001/api
`);

  // ============================================================
  // ARQUIVO: package.json
  // ============================================================
  addSection('ARQUIVO: package.json', `
{
  "name": "dsicola-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.3.4",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-label": "^2.0.2",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-slot": "^1.0.2",
    "@radix-ui/react-tabs": "^1.0.4",
    "@tanstack/react-query": "^5.18.1",
    "axios": "^1.6.7",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "lucide-react": "^0.323.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-hook-form": "^7.50.1",
    "react-router-dom": "^6.22.0",
    "sonner": "^1.4.0",
    "tailwind-merge": "^2.2.1",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/react": "^18.2.55",
    "@types/react-dom": "^18.2.19",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.3.3",
    "vite": "^5.1.0"
  }
}
`);

  // ============================================================
  // ARQUIVO: vite.config.ts
  // ============================================================
  addSection('ARQUIVO: vite.config.ts', `
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
`);

  // ============================================================
  // ARQUIVO: src/api/client.ts - CLIENTE HTTP
  // ============================================================
  addPage();
  addTitle('ARQUIVO: src/api/client.ts', 14);
  addCode(`
// ============================================================
// CLIENTE HTTP - SUBSTITUI SUPABASE CLIENT
// ============================================================

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Tipos
interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

interface User {
  id: string;
  email: string;
  nome_completo: string;
  roles: string[];
  instituicao_id?: string;
}

// Cliente Axios configurado
const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Interceptor para adicionar token JWT
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = \`Bearer \${token}\`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para refresh token automático
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }
        
        const response = await axios.post<TokenResponse>(
          \`\${API_URL}/auth/refresh\`,
          { refreshToken }
        );
        
        const { accessToken, refreshToken: newRefreshToken } = response.data;
        
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);
        
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = \`Bearer \${accessToken}\`;
        }
        
        return apiClient(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/auth';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// ============================================================
// FUNÇÕES DE AUTENTICAÇÃO
// ============================================================

export const authApi = {
  async login(email: string, password: string): Promise<TokenResponse> {
    const response = await apiClient.post<TokenResponse>('/auth/login', {
      email,
      senha: password,
    });
    
    const { accessToken, refreshToken, user } = response.data;
    
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    
    return response.data;
  },

  async register(data: {
    email: string;
    password: string;
    nome_completo: string;
  }): Promise<TokenResponse> {
    const response = await apiClient.post<TokenResponse>('/auth/register', {
      email: data.email,
      senha: data.password,
      nome_completo: data.nome_completo,
    });
    
    return response.data;
  },

  async logout(): Promise<void> {
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (refreshToken) {
      try {
        await apiClient.post('/auth/logout', { refreshToken });
      } catch (error) {
        console.error('Erro ao fazer logout no servidor:', error);
      }
    }
    
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  },

  async forgotPassword(email: string): Promise<void> {
    await apiClient.post('/auth/forgot-password', { email });
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await apiClient.post('/auth/reset-password', { token, senha: newPassword });
  },

  getStoredUser(): User | null {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('accessToken');
  },
};

// ============================================================
// FUNÇÕES DE API - CRUD GENÉRICO
// ============================================================

export const api = {
  // GET genérico
  async get<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    const response = await apiClient.get<T>(endpoint, { params });
    return response.data;
  },

  // POST genérico
  async post<T>(endpoint: string, data: unknown): Promise<T> {
    const response = await apiClient.post<T>(endpoint, data);
    return response.data;
  },

  // PUT genérico
  async put<T>(endpoint: string, data: unknown): Promise<T> {
    const response = await apiClient.put<T>(endpoint, data);
    return response.data;
  },

  // PATCH genérico
  async patch<T>(endpoint: string, data: unknown): Promise<T> {
    const response = await apiClient.patch<T>(endpoint, data);
    return response.data;
  },

  // DELETE genérico
  async delete<T>(endpoint: string): Promise<T> {
    const response = await apiClient.delete<T>(endpoint);
    return response.data;
  },
};

// ============================================================
// APIs ESPECÍFICAS
// ============================================================

export const alunosApi = {
  listar: (params?: Record<string, unknown>) => api.get<User[]>('/alunos', params),
  buscar: (id: string) => api.get<User>(\`/alunos/\${id}\`),
  criar: (data: Partial<User>) => api.post<User>('/alunos', data),
  atualizar: (id: string, data: Partial<User>) => api.put<User>(\`/alunos/\${id}\`, data),
  excluir: (id: string) => api.delete(\`/alunos/\${id}\`),
};

export const professoresApi = {
  listar: (params?: Record<string, unknown>) => api.get<User[]>('/professores', params),
  buscar: (id: string) => api.get<User>(\`/professores/\${id}\`),
  criar: (data: Partial<User>) => api.post<User>('/professores', data),
  atualizar: (id: string, data: Partial<User>) => api.put<User>(\`/professores/\${id}\`, data),
  excluir: (id: string) => api.delete(\`/professores/\${id}\`),
};

export const cursosApi = {
  listar: (params?: Record<string, unknown>) => api.get<unknown[]>('/cursos', params),
  buscar: (id: string) => api.get(\`/cursos/\${id}\`),
  criar: (data: unknown) => api.post('/cursos', data),
  atualizar: (id: string, data: unknown) => api.put(\`/cursos/\${id}\`, data),
  excluir: (id: string) => api.delete(\`/cursos/\${id}\`),
};

export const turmasApi = {
  listar: (params?: Record<string, unknown>) => api.get<unknown[]>('/turmas', params),
  buscar: (id: string) => api.get(\`/turmas/\${id}\`),
  criar: (data: unknown) => api.post('/turmas', data),
  atualizar: (id: string, data: unknown) => api.put(\`/turmas/\${id}\`, data),
  excluir: (id: string) => api.delete(\`/turmas/\${id}\`),
};

export const notasApi = {
  listar: (params?: Record<string, unknown>) => api.get<unknown[]>('/notas', params),
  criar: (data: unknown) => api.post('/notas', data),
  atualizar: (id: string, data: unknown) => api.put(\`/notas/\${id}\`, data),
};

export const mensalidadesApi = {
  listar: (params?: Record<string, unknown>) => api.get<unknown[]>('/mensalidades', params),
  registrarPagamento: (id: string, data: unknown) => api.patch(\`/mensalidades/\${id}/pagar\`, data),
};

export default apiClient;
`);

  // ============================================================
  // ARQUIVO: src/contexts/AuthContext.tsx
  // ============================================================
  addPage();
  addTitle('ARQUIVO: src/contexts/AuthContext.tsx', 14);
  addCode(`
// ============================================================
// CONTEXTO DE AUTENTICAÇÃO - SUBSTITUI SUPABASE AUTH
// ============================================================

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authApi } from '@/api/client';

interface User {
  id: string;
  email: string;
  nome_completo: string;
  roles: string[];
  instituicao_id?: string;
}

interface AuthContextType {
  user: User | null;
  role: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, nomeCompleto: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Verificar autenticação ao carregar
  useEffect(() => {
    const checkAuth = () => {
      try {
        const storedUser = authApi.getStoredUser();
        if (storedUser && authApi.isAuthenticated()) {
          setUser(storedUser);
          setRole(storedUser.roles?.[0] || null);
        }
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const response = await authApi.login(email, password);
      setUser(response.user);
      setRole(response.user.roles?.[0] || null);
      return { error: null };
    } catch (error) {
      console.error('Erro no login:', error);
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string, nomeCompleto: string) => {
    try {
      await authApi.register({ email, password, nome_completo: nomeCompleto });
      return { error: null };
    } catch (error) {
      console.error('Erro no registro:', error);
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      await authApi.logout();
      setUser(null);
      setRole(null);
    } catch (error) {
      console.error('Erro ao sair:', error);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await authApi.forgotPassword(email);
      return { error: null };
    } catch (error) {
      console.error('Erro ao resetar senha:', error);
      return { error: error as Error };
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};
`);

  // ============================================================
  // ARQUIVO: src/components/ProtectedRoute.tsx
  // ============================================================
  addPage();
  addTitle('ARQUIVO: src/components/ProtectedRoute.tsx', 14);
  addCode(`
// ============================================================
// PROTEÇÃO DE ROTAS - VERSÃO SEM SUPABASE
// ============================================================

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-primary/20 flex items-center justify-center">
            <svg className="h-8 w-8 text-primary animate-spin" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    const dashboardRoutes: Record<string, string> = {
      'SUPER_ADMIN': '/super-admin',
      'ADMIN': '/admin-dashboard',
      'PROFESSOR': '/painel-professor',
      'ALUNO': '/painel-aluno',
      'SECRETARIA': '/secretaria-dashboard',
    };

    const targetRoute = dashboardRoutes[role] || '/auth';
    return <Navigate to={targetRoute} replace />;
  }

  return <>{children}</>;
};
`);

  // ============================================================
  // ARQUIVO: src/pages/Auth.tsx
  // ============================================================
  addPage();
  addTitle('ARQUIVO: src/pages/Auth.tsx', 14);
  addCode(`
// ============================================================
// PÁGINA DE LOGIN/REGISTRO - VERSÃO SEM SUPABASE
// ============================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { signIn, signUp, user, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && role) {
      const routes: Record<string, string> = {
        'SUPER_ADMIN': '/super-admin',
        'ADMIN': '/admin-dashboard',
        'PROFESSOR': '/painel-professor',
        'ALUNO': '/painel-aluno',
        'SECRETARIA': '/secretaria-dashboard',
      };
      navigate(routes[role] || '/');
    }
  }, [user, role, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error('Credenciais inválidas');
        } else {
          toast.success('Login realizado com sucesso!');
        }
      } else {
        const { error } = await signUp(email, password, nome);
        if (error) {
          toast.error('Erro ao criar conta');
        } else {
          toast.success('Conta criada! Faça login.');
          setIsLogin(true);
        }
      }
    } catch (error) {
      toast.error('Erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
      <div className="w-full max-w-md p-8 bg-card rounded-xl shadow-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">DSICOLA</h1>
          <p className="text-muted-foreground mt-2">
            {isLogin ? 'Entre na sua conta' : 'Crie sua conta'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Nome completo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border rounded-lg bg-background focus:ring-2 focus:ring-primary"
                required
              />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border rounded-lg bg-background focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-12 py-3 border rounded-lg bg-background focus:ring-2 focus:ring-primary"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {loading ? 'Carregando...' : isLogin ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary hover:underline"
          >
            {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entre'}
          </button>
        </div>
      </div>
    </div>
  );
}
`);

  // ============================================================
  // ARQUIVO: src/types/index.ts
  // ============================================================
  addPage();
  addTitle('ARQUIVO: src/types/index.ts', 14);
  addCode(`
// ============================================================
// TIPOS TYPESCRIPT DO FRONTEND
// ============================================================

export type UserRole = 
  | 'SUPER_ADMIN' 
  | 'ADMIN' 
  | 'SECRETARIA' 
  | 'PROFESSOR' 
  | 'ALUNO' 
  | 'RESPONSAVEL';

export interface User {
  id: string;
  email: string;
  nome_completo: string;
  numero_identificacao?: string;
  numero_identificacao_publica?: string;
  telefone?: string;
  data_nascimento?: string;
  genero?: string;
  avatar_url?: string;
  morada?: string;
  cidade?: string;
  pais?: string;
  status_aluno?: string;
  ativo?: boolean;
  instituicao_id?: string;
  roles: UserRole[];
  created_at?: string;
  updated_at?: string;
}

export interface Instituicao {
  id: string;
  nome: string;
  codigo: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  logo_url?: string;
  cor_primaria?: string;
  cor_secundaria?: string;
  ativo: boolean;
}

export interface Curso {
  id: string;
  nome: string;
  codigo: string;
  descricao?: string;
  carga_horaria: number;
  valor_mensalidade: number;
  duracao?: string;
  grau?: string;
  ativo: boolean;
  instituicao_id?: string;
}

export interface Disciplina {
  id: string;
  nome: string;
  carga_horaria: number;
  semestre: number;
  obrigatoria: boolean;
  curso_id: string;
  instituicao_id?: string;
}

export interface Turma {
  id: string;
  nome: string;
  codigo: string;
  ano_letivo: number;
  turno: string;
  sala?: string;
  capacidade: number;
  ativa: boolean;
  curso_id: string;
  professor_id?: string;
  instituicao_id?: string;
}

export interface Matricula {
  id: string;
  numero_matricula?: string;
  data_matricula: string;
  status: 'Ativa' | 'Cancelada' | 'Concluida' | 'Trancada';
  observacoes?: string;
  aluno_id: string;
  turma_id: string;
}

export interface Nota {
  id: string;
  valor: number;
  tipo: string;
  trimestre: number;
  ano_letivo: number;
  observacoes?: string;
  aluno_id: string;
  disciplina_id: string;
  turma_id: string;
  professor_id: string;
}

export interface Mensalidade {
  id: string;
  valor: number;
  data_vencimento: string;
  data_pagamento?: string;
  status: 'Pendente' | 'Pago' | 'Atrasado' | 'Cancelado';
  mes_referencia: number;
  ano_referencia: number;
  multa?: boolean;
  valor_multa?: number;
  aluno_id: string;
}

export interface Comunicado {
  id: string;
  titulo: string;
  conteudo: string;
  tipo: string;
  destinatarios: string;
  ativo: boolean;
  data_publicacao: string;
  autor_id?: string;
  instituicao_id?: string;
}

export interface EventoCalendario {
  id: string;
  titulo: string;
  descricao?: string;
  data_inicio: string;
  data_fim?: string;
  tipo: string;
  cor?: string;
  instituicao_id?: string;
}
`);

  // ============================================================
  // ARQUIVO: src/App.tsx
  // ============================================================
  addPage();
  addTitle('ARQUIVO: src/App.tsx', 14);
  addCode(`
// ============================================================
// APP PRINCIPAL - ROTEAMENTO
// ============================================================

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';

// Páginas
import Auth from '@/pages/Auth';
// import AdminDashboard from '@/pages/admin/AdminDashboard';
// import AlunoDashboard from '@/pages/aluno/AlunoDashboard';
// import ProfessorDashboard from '@/pages/professor/ProfessorDashboard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" richColors />
          <Routes>
            {/* Rotas públicas */}
            <Route path="/auth" element={<Auth />} />
            
            {/* Rotas protegidas - Exemplo */}
            {/*
            <Route 
              path="/admin-dashboard" 
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/painel-aluno" 
              element={
                <ProtectedRoute allowedRoles={['ALUNO']}>
                  <AlunoDashboard />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/painel-professor" 
              element={
                <ProtectedRoute allowedRoles={['PROFESSOR']}>
                  <ProfessorDashboard />
                </ProtectedRoute>
              } 
            />
            */}
            
            {/* Rota padrão */}
            <Route path="/" element={<Navigate to="/auth" replace />} />
            <Route path="*" element={<Navigate to="/auth" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
`);

  // ============================================================
  // ARQUIVO: src/main.tsx
  // ============================================================
  addSection('ARQUIVO: src/main.tsx', `
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`);

  // ============================================================
  // HOOKS CUSTOMIZADOS
  // ============================================================
  addPage();
  addTitle('HOOKS CUSTOMIZADOS', 14);
  
  addSection('ARQUIVO: src/hooks/useAlunos.ts', `
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alunosApi } from '@/api/client';
import { toast } from 'sonner';

export const useAlunos = (params?: Record<string, unknown>) => {
  return useQuery({
    queryKey: ['alunos', params],
    queryFn: () => alunosApi.listar(params),
  });
};

export const useAluno = (id: string) => {
  return useQuery({
    queryKey: ['aluno', id],
    queryFn: () => alunosApi.buscar(id),
    enabled: !!id,
  });
};

export const useCriarAluno = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: alunosApi.criar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alunos'] });
      toast.success('Aluno criado com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao criar aluno');
    },
  });
};

export const useAtualizarAluno = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => 
      alunosApi.atualizar(id, data as Partial<{ id: string }>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alunos'] });
      toast.success('Aluno atualizado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar aluno');
    },
  });
};

export const useExcluirAluno = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: alunosApi.excluir,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alunos'] });
      toast.success('Aluno excluído!');
    },
    onError: () => {
      toast.error('Erro ao excluir aluno');
    },
  });
};
`);

  // ============================================================
  // TAILWIND CONFIG
  // ============================================================
  addPage();
  addSection('ARQUIVO: tailwind.config.js', `
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
};
`);

  addSection('ARQUIVO: src/index.css', `
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 262 83% 58%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 262 83% 58%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 262 83% 58%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 262 83% 58%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
`);

  // ============================================================
  // README
  // ============================================================
  addPage();
  addTitle('README - INSTRUÇÕES DE MIGRAÇÃO', 16);
  addCode(`
# DSICOLA - FRONTEND MIGRADO

## Pré-requisitos
- Node.js 18+
- npm ou yarn
- Backend Express rodando na porta 3001

## Instalação

1. Clone/copie os arquivos para uma pasta
2. Instale dependências:
   npm install

3. Configure o .env:
   VITE_API_URL=http://localhost:3001/api

4. Inicie o desenvolvimento:
   npm run dev

5. Acesse: http://localhost:5173

## Estrutura

- src/api/client.ts - Cliente HTTP que substitui Supabase
- src/contexts/AuthContext.tsx - Autenticação via JWT
- src/components/ProtectedRoute.tsx - Proteção de rotas
- src/hooks/*.ts - Hooks com React Query

## Fluxo de Autenticação

1. Login envia credenciais para /api/auth/login
2. Backend retorna accessToken + refreshToken
3. Tokens são salvos no localStorage
4. Todas requisições incluem Bearer token
5. Refresh automático quando token expira

## Migração de Componentes

Para migrar componentes existentes:

1. Remover imports do Supabase
2. Usar api.* ou hooks específicos (useAlunos, etc)
3. Substituir supabase.from() por chamadas API

Exemplo:
// Antes (Supabase)
const { data } = await supabase.from('alunos').select('*');

// Depois (API)
const data = await api.get('/alunos');
// ou
const { data } = useAlunos();
`);

  // Salvar PDF
  doc.save('DSICOLA-frontend-completo.pdf');
};

export default generateFrontendMigrationPDF;
