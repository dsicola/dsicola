import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { UserRole } from '@prisma/client';

/**
 * ========================================
 * SERVIÇO DE VALIDAÇÃO - CARGO E DEPARTAMENTO
 * ========================================
 * 
 * Validações institucionais para garantir consistência
 * entre cargo, departamento e perfil do usuário
 */

/**
 * Verifica se um usuário é interno (não é aluno)
 */
export function isUsuarioInterno(userRoles: UserRole[]): boolean {
  const rolesInternos: UserRole[] = [
    'ADMIN',
    'DIRECAO',
    'COORDENADOR',
    'PROFESSOR',
    'SECRETARIA',
    'AUDITOR',
  ];
  
  return userRoles.some(role => rolesInternos.includes(role));
}

/**
 * Verifica se um usuário é aluno
 */
export function isAluno(userRoles: UserRole[]): boolean {
  return userRoles.includes('ALUNO');
}

/**
 * Valida se cargo é compatível com o perfil do usuário
 * - PROFESSOR só pode estar em cargos ACADEMICO
 * - SECRETARIA só pode estar em cargos ADMINISTRATIVO
 * - ADMIN pode estar em qualquer cargo
 */
export async function validarCargoComPerfil(
  cargoId: string | null | undefined,
  userRoles: UserRole[],
  instituicaoId: string
): Promise<void> {
  // Se não tem cargo, validação será feita em outro lugar (obrigatoriedade)
  if (!cargoId) {
    return;
  }

  // Buscar cargo
  const cargo = await prisma.cargo.findFirst({
    where: {
      id: cargoId,
      instituicaoId,
      ativo: true,
    },
  });

  if (!cargo) {
    throw new AppError('Cargo não encontrado ou inativo', 400);
  }

  // Validar compatibilidade
  if (userRoles.includes('PROFESSOR')) {
    if (cargo.tipo !== 'ACADEMICO') {
      throw new AppError(
        'Professor só pode estar vinculado a cargos acadêmicos',
        400
      );
    }
  }

  if (userRoles.includes('SECRETARIA')) {
    if (cargo.tipo !== 'ADMINISTRATIVO') {
      throw new AppError(
        'Secretaria só pode estar vinculada a cargos administrativos',
        400
      );
    }
  }
}

/**
 * Valida se departamento existe e está ativo
 */
export async function validarDepartamento(
  departamentoId: string | null | undefined,
  instituicaoId: string
): Promise<void> {
  if (!departamentoId) {
    return;
  }

  const departamento = await prisma.departamento.findFirst({
    where: {
      id: departamentoId,
      instituicaoId,
      ativo: true,
    },
  });

  if (!departamento) {
    throw new AppError('Departamento não encontrado ou inativo', 400);
  }
}

/**
 * Valida obrigatoriedade de cargo e departamento para usuários internos
 */
export function validarObrigatoriedadeCargoDepartamento(
  cargoId: string | null | undefined,
  departamentoId: string | null | undefined,
  userRoles: UserRole[]
): void {
  // Alunos são isentos
  if (isAluno(userRoles)) {
    return;
  }

  // Usuários internos devem ter cargo e departamento
  if (isUsuarioInterno(userRoles)) {
    if (!cargoId) {
      throw new AppError(
        'Cargo é obrigatório para usuários internos (não alunos)',
        400
      );
    }

    if (!departamentoId) {
      throw new AppError(
        'Departamento é obrigatório para usuários internos (não alunos)',
        400
      );
    }
  }
}

/**
 * Validação completa: cargo, departamento e perfil
 */
export async function validarCargoDepartamentoCompleto(
  cargoId: string | null | undefined,
  departamentoId: string | null | undefined,
  userRoles: UserRole[],
  instituicaoId: string
): Promise<void> {
  // Validar obrigatoriedade
  validarObrigatoriedadeCargoDepartamento(cargoId, departamentoId, userRoles);

  // Validar existência e ativação
  await validarDepartamento(departamentoId, instituicaoId);
  await validarCargoComPerfil(cargoId, userRoles, instituicaoId);
}

