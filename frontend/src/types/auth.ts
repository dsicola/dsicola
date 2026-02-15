export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'PROFESSOR' | 'ALUNO' | 'SECRETARIA' | 'POS' | 'RESPONSAVEL' | 'RH';

export interface UserProfile {
  id: string;
  email: string;
  nome_completo: string;
  avatar_url?: string | null;
  telefone?: string | null;
  numero_identificacao?: string | null;
  numero_identificacao_publica?: string | null;
  data_nascimento?: string | null;
  genero?: string | null;
  morada?: string | null;
  status?: string | null;
  status_aluno?: string | null;
  instituicao_id: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRole;
  instituicao_id?: string | null;
  created_at: string;
}

export interface AuthError {
  message: string;
  code?: string;
}

export interface AuthContextType {
  user: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, nomeCompleto: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<{ error: AuthError | null }>;
  changePasswordRequired: (newPassword: string, confirmPassword: string) => Promise<{ error: AuthError | null }>;
  refreshUser: () => Promise<boolean>;
}
