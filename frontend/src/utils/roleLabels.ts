/**
 * Mapeamento centralizado de roles para labels exibidas ao usuário
 * Garante consistência em toda a aplicação
 */
import type { UserRole } from '@/types/auth';

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  COMERCIAL: 'Comercial',
  ADMIN: 'Administrador',
  DIRECAO: 'Direção',
  COORDENADOR: 'Coordenador',
  SECRETARIA: 'Secretaria',
  RH: 'Recursos Humanos',
  FINANCEIRO: 'Financeiro',
  POS: 'Ponto de Venda',
  PROFESSOR: 'Professor',
  RESPONSAVEL: 'Responsável',
  ALUNO: 'Estudante',
  AUDITOR: 'Auditor',
};

/** Roles que não dependem de ano letivo para operações principais */
export const ROLES_SEM_EXIGENCIA_ANO_LETIVO: UserRole[] = ['SUPER_ADMIN', 'COMERCIAL', 'RH', 'FINANCEIRO', 'POS'];

/** Roles staff que obtêm instituicaoId via fallback (Funcionario/Professor) - permitir queries sem instituicaoId inicial */
export const ROLES_STAFF_FALLBACK: UserRole[] = [
  'RH', 'SECRETARIA', 'FINANCEIRO', 'POS', 'DIRECAO', 'COORDENADOR', 'PROFESSOR'
];

export function getRoleLabel(role: string | null | undefined): string {
  if (!role) return 'Usuário';
  return ROLE_LABELS[role] || role;
}

/** Indica se o role obtém instituicaoId via fallback (permitir queries sem instituicaoId inicial) */
export function isStaffWithFallback(role: string | null | undefined): boolean {
  return !!role && ROLES_STAFF_FALLBACK.includes(role as UserRole);
}
