/**
 * ============================================================
 * PROFESSOR RESOLVER - Helper para resolução de Professor
 * ============================================================
 * 
 * OBJETIVO: Resolver professor.id a partir de userId e instituicaoId
 * 
 * REGRA ARQUITETURAL:
 * - JWT continua trazendo userId (users.id)
 * - Backend resolve: userId → professor → professor.id
 * - PlanoEnsino.professorId referencia professores.id (NÃO users.id)
 * 
 * ============================================================
 */

import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * Resolve professor.id a partir de userId e instituicaoId
 * 
 * @param userId - ID do usuário (users.id) do JWT
 * @param instituicaoId - ID da instituição do JWT
 * @returns ID do professor (professores.id)
 * @throws AppError se professor não for encontrado
 */
export async function resolveProfessorId(
  userId: string,
  instituicaoId: string
): Promise<string> {
  if (!userId || !instituicaoId) {
    throw new AppError('userId e instituicaoId são obrigatórios para resolver professor', 400);
  }

  const professor = await prisma.professor.findFirst({
    where: {
      userId: userId,
      instituicaoId: instituicaoId,
    },
    select: {
      id: true,
    },
  });

  if (!professor) {
    // REGRA SIGA/SIGAE: Professor deve estar cadastrado na tabela professores
    throw new AppError(
      'Professor não cadastrado na instituição. Entre em contato com a administração para solicitar o cadastro.',
      403
    );
  }

  return professor.id;
}

/**
 * Resolve professor completo a partir de userId e instituicaoId
 * 
 * @param userId - ID do usuário (users.id) do JWT
 * @param instituicaoId - ID da instituição do JWT
 * @returns Objeto professor completo
 * @throws AppError se professor não for encontrado
 */
export async function resolveProfessor(
  userId: string,
  instituicaoId: string
) {
  if (!userId || !instituicaoId) {
    throw new AppError('userId e instituicaoId são obrigatórios para resolver professor', 400);
  }

  try {
    const professor = await prisma.professor.findFirst({
      where: {
        userId: userId,
        instituicaoId: instituicaoId,
      },
      include: {
        user: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
      },
    });

    if (!professor) {
      // FALLBACK: user.instituicaoId (JWT) pode não coincidir com professor.instituicaoId
      // Ex: user criado sem instituicaoId, ou professor em instituição diferente
      const professorPorUserId = await prisma.professor.findMany({
        where: { userId },
        include: {
          user: { select: { id: true, nomeCompleto: true, email: true } },
        },
      });
      if (professorPorUserId.length === 1) {
        const p = professorPorUserId[0];
        if (process.env.NODE_ENV !== 'production') {
          console.log('[resolveProfessor] Fallback: professor encontrado por userId (instituicaoId JWT difere do professor):', {
            professorId: p.id,
            professorInstituicaoId: p.instituicaoId,
            jwtInstituicaoId: instituicaoId,
          });
        }
        return p;
      }
      if (professorPorUserId.length > 1) {
        const matchInst = professorPorUserId.find((p) => p.instituicaoId === instituicaoId);
        if (matchInst) return matchInst;
      }

      // REGRA SIGA/SIGAE: Professor deve estar na tabela professores
      // SAFETY NET: Se usuário tem role PROFESSOR, criar registro automaticamente
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          roles: {
            select: { role: true }
          }
        }
      });

      const userRoles = user?.roles?.map(r => r.role) || [];
      const isProfessor = userRoles.includes('PROFESSOR');
      const isAdmin = userRoles.includes('ADMIN') || userRoles.includes('SUPER_ADMIN');

      // SAFETY NET: Criar professor automaticamente se tem role PROFESSOR e instituicaoId
      if (isProfessor && instituicaoId) {
        try {
          const novoProfessor = await prisma.professor.create({
            data: { userId, instituicaoId },
            include: {
              user: { select: { id: true, nomeCompleto: true, email: true } },
            },
          });
          if (process.env.NODE_ENV !== 'production') {
            console.log('[resolveProfessor] Professor criado automaticamente (safety net):', novoProfessor.id);
          }
          return novoProfessor;
        } catch (createError) {
          console.error('[resolveProfessor] Erro ao criar professor (safety net):', createError);
          // Continuar com erro original
        }
      }

      console.error('[resolveProfessor] Professor não encontrado na tabela professores:', {
        userId,
        instituicaoId,
        userEmail: user?.email,
        userRoles,
        isProfessor,
        isAdmin,
      });
      
      if (isAdmin) {
        throw new AppError(
          'Você precisa ter um registro na tabela professores para executar ações acadêmicas. Mesmo sendo ADMIN, é necessário cadastrar um registro de professor vinculado ao seu usuário. Entre em contato com a administração para cadastrar seu registro de professor.',
          400
        );
      } else if (isProfessor) {
        throw new AppError(
          'Professor não cadastrado na instituição. Entre em contato com a administração para solicitar o cadastro.',
          403
        );
      } else {
        throw new AppError(
          'Professor não cadastrado na instituição. Entre em contato com a administração para solicitar o cadastro.',
          403
        );
      }
    }

    // Validar que o professor retornado tem a estrutura esperada
    if (!professor.id || !professor.userId || !professor.instituicaoId) {
      console.error('[resolveProfessor] Professor com estrutura inválida:', {
        professorId: professor.id,
        userId: professor.userId,
        instituicaoId: professor.instituicaoId,
      });
      
      throw new AppError(
        'Dados do professor inválidos. Entre em contato com o suporte.',
        500
      );
    }

    return professor;
  } catch (error) {
    // Se já é AppError, propagar
    if (error instanceof AppError) {
      throw error;
    }

    // Erro do Prisma ou outro erro inesperado
    console.error('[resolveProfessor] Erro ao buscar professor no banco:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId,
      instituicaoId,
    });

    throw new AppError(
      `Erro ao buscar professor no banco de dados: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      500
    );
  }
}

/**
 * Valida se um professorId existe e pertence à instituição
 * 
 * @param professorId - ID do professor (professores.id)
 * @param instituicaoId - ID da instituição para validação
 * @returns true se válido, false caso contrário
 */
export async function validateProfessorId(
  professorId: string,
  instituicaoId: string
): Promise<boolean> {
  if (!professorId || !instituicaoId) {
    return false;
  }

  const professor = await prisma.professor.findFirst({
    where: {
      id: professorId,
      instituicaoId: instituicaoId,
    },
    select: {
      id: true,
    },
  });

  return !!professor;
}

/**
 * Valida professorId do JWT contra o banco (regra SIGAE enterprise - hardening).
 * NUNCA confiar cegamente no professorId do token.
 * 
 * @param professorId - professores.id (do JWT)
 * @param userId - users.id (do JWT)
 * @param instituicaoId - instituições.id (do JWT)
 * @returns Professor se válido
 * @throws AppError 403 se professorId não pertence ao user/tenant
 */
export async function validateProfessorIdFromToken(
  professorId: string,
  userId: string,
  instituicaoId: string
) {
  if (!professorId || !userId || !instituicaoId) {
    return null;
  }

  const professor = await prisma.professor.findFirst({
    where: {
      id: professorId,
      userId,
      instituicaoId,
    },
    select: {
      id: true,
      userId: true,
      instituicaoId: true,
    },
  });

  return professor;
}

/**
 * Verifica se um userId corresponde ao professorId de um PlanoEnsino
 * 
 * @param userId - ID do usuário (users.id) do JWT
 * @param professorId - ID do professor (professores.id) do PlanoEnsino
 * @param instituicaoId - ID da instituição para validação
 * @returns true se o userId corresponde ao professorId, false caso contrário
 */
export async function isProfessorOfPlanoEnsino(
  userId: string,
  professorId: string,
  instituicaoId: string
): Promise<boolean> {
  if (!userId || !professorId || !instituicaoId) {
    throw new AppError('Parâmetros inválidos para validação de professor do plano de ensino', 400);
  }

  // Resolver professores.id a partir de users.id
  // ERRO: Não usar fallback silencioso - sempre lançar erro se não encontrar
  const resolvedProfessorId = await resolveProfessorId(userId, instituicaoId);
  return resolvedProfessorId === professorId;
}

// ERRO: Função resolveProfessorIdFromRequest foi removida (LEGACY)
// Use req.professor.id do middleware resolveProfessorMiddleware ao invés desta função.
// Se você está vendo este comentário, há código não migrado que precisa ser corrigido.

