import { UserRole } from '@/types/auth';

/**
 * Decodifica um JWT token sem verificar assinatura (apenas para UI)
 * NUNCA use isso para validação de segurança - apenas para exibição
 */
export function decodeJWT(token: string): {
  userId?: string;
  email?: string;
  roles?: UserRole[];
  instituicaoId?: string | null;
  tipoAcademico?: 'SUPERIOR' | 'SECUNDARIO' | null;
  type?: string;
  exp?: number;
} | null {
  try {
    // JWT tem 3 partes separadas por ponto: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decodificar payload (segunda parte)
    const payload = parts[1];
    
    // Base64URL decode
    // Substituir caracteres Base64URL por Base64 padrão
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    
    // Adicionar padding se necessário
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    
    // Decodificar
    const decoded = JSON.parse(atob(padded));
    
    return decoded;
  } catch (error) {
    console.error('Erro ao decodificar JWT:', error);
    return null;
  }
}

/**
 * Extrai as roles de um token JWT
 */
export function getRolesFromToken(token: string | null): UserRole[] | null {
  if (!token) return null;
  
  const decoded = decodeJWT(token);
  if (!decoded || !decoded.roles) return null;
  
  return Array.isArray(decoded.roles) ? decoded.roles : null;
}

