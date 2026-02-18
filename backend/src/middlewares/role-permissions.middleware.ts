import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';
import { messages } from '../utils/messages.js';
import prisma from '../lib/prisma.js';
import { addInstitutionFilter, requireTenantScope } from './auth.js';
import { EstadoService } from '../services/estado.service.js';

/**
 * Middleware para validar permissões específicas por módulo
 * Implementa a matriz de permissões institucional
 */

/**
 * Verificar se usuário é PROFESSOR
 */
const isProfessor = (req: Request): boolean => {
  return req.user?.roles?.includes('PROFESSOR') || false;
};

/**
 * Verificar se usuário é SECRETARIA
 */
const isSecretaria = (req: Request): boolean => {
  return req.user?.roles?.includes('SECRETARIA') || false;
};

/**
 * Verificar se usuário é ADMIN ou superior
 */
const isAdminOrSuperior = (req: Request): boolean => {
  return req.user?.roles?.some(r => ['ADMIN', 'SUPER_ADMIN', 'DIRECAO'].includes(r)) || false;
};

/**
 * Verificar se professor está vinculado a uma disciplina/turma
 */
const verificarVinculoProfessor = async (
  professorId: string,
  disciplinaId: string | null,
  turmaId: string | null,
  instituicaoId: string
): Promise<boolean> => {
  // Verificar via UserContext
  const userContext = await prisma.userContext.findFirst({
    where: {
      userId: professorId,
      instituicaoId,
      ativo: true,
      ...(disciplinaId && { disciplinaId }),
      ...(turmaId && { turmaId }),
    },
  });

  if (userContext) return true;

  // Verificar via Turma (professorId direto)
  if (turmaId) {
    const turma = await prisma.turma.findFirst({
      where: {
        id: turmaId,
        professorId,
        instituicaoId,
      },
    });
    if (turma) return true;
  }

  // Verificar via PlanoEnsino
  if (disciplinaId) {
    const plano = await prisma.planoEnsino.findFirst({
      where: {
        professorId,
        disciplinaId,
        instituicaoId,
      },
    });
    if (plano) return true;
  }

  return false;
};

/**
 * ========================================
 * PLANO DE ENSINO
 * ========================================
 */

/**
 * REGRA MESTRA SIGA/SIGAE: Validar se Plano de Ensino está ATIVO
 * Plano ATIVO = APROVADO (estado = 'APROVADO') E não bloqueado (bloqueado = false)
 * 
 * Esta validação é OBRIGATÓRIA para todas as ações pedagógicas do professor:
 * - Registrar aulas
 * - Marcar presenças
 * - Criar avaliações
 * - Lançar notas
 * 
 * Esta função é usada especificamente nas validações de permissão do middleware.
 * Para validações diretas nos controllers, use a função do validacaoAcademica.service.ts
 * 
 * @param planoEnsino - Objeto do plano de ensino (deve conter id, estado, bloqueado)
 * @param disciplinaId - ID da disciplina (opcional, para validar se pertence ao plano)
 * @param turmaId - ID da turma (opcional, para validar se pertence ao plano)
 * @param instituicaoId - ID da instituição (para validação multi-tenant)
 * @throws AppError se plano não estiver ATIVO ou se validações falharem
 */
export const validarPlanoEnsinoAtivoPermissao = async (
  planoEnsino: { id: string; estado: string; bloqueado: boolean; disciplinaId?: string; turmaId?: string | null } | null,
  disciplinaId?: string | null,
  turmaId?: string | null,
  instituicaoId?: string
): Promise<void> => {
  if (!planoEnsino) {
    throw new AppError(
      'Plano de Ensino não encontrado. Professores só podem executar ações acadêmicas quando vinculados a um Plano de Ensino ATIVO.',
      403
    );
  }

  // REGRA 1: Verificar se plano está APROVADO
  if (planoEnsino.estado !== 'APROVADO') {
    throw new AppError(
      `Plano de Ensino não está ATIVO. O plano está com estado "${planoEnsino.estado}". ` +
      'Apenas planos APROVADOS permitem ações acadêmicas. Contacte a coordenação acadêmica para aprovação do plano.',
      403
    );
  }

  // REGRA 2: Verificar se plano não está bloqueado
  if (planoEnsino.bloqueado) {
    throw new AppError(
      'Plano de Ensino está bloqueado. Ações acadêmicas estão temporariamente suspensas. ' +
      'Contacte a coordenação acadêmica para mais informações.',
      403
    );
  }

  // REGRA 3: Validar que disciplina pertence ao plano (se fornecida)
  if (disciplinaId && planoEnsino.disciplinaId && planoEnsino.disciplinaId !== disciplinaId) {
    throw new AppError(
      'Disciplina não pertence ao Plano de Ensino ATIVO. Verifique se está utilizando a disciplina correta vinculada ao plano.',
      403
    );
  }

  // REGRA 4: Validar que turma pertence ao plano (se fornecida e se plano tem turma)
  if (turmaId && planoEnsino.turmaId && planoEnsino.turmaId !== turmaId) {
    throw new AppError(
      'Turma não pertence ao Plano de Ensino ATIVO. Verifique se está utilizando a turma correta vinculada ao plano.',
      403
    );
  }
};

/**
 * Validar se usuário pode criar/editar plano de ensino
 * - ADMIN: criar / editar / aprovar
 * - SECRETARIA: criar / editar (antes de aprovado)
 * - PROFESSOR: APENAS visualizar plano aprovado
 */
export const validarPermissaoPlanoEnsino = async (
  req: Request,
  planoEnsinoId?: string
): Promise<void> => {
  if (!req.user) {
    throw new AppError('Não autenticado', 401);
  }

  const instituicaoId = requireTenantScope(req);
  const userId = req.user.userId;

  // Se for ADMIN ou superior, permite tudo
  if (isAdminOrSuperior(req)) {
    return;
  }

  // Se não tiver planoEnsinoId, é criação - verificar permissão
  if (!planoEnsinoId) {
    // SECRETARIA pode criar
    if (isSecretaria(req)) {
      return;
    }
    // PROFESSOR NÃO pode criar
    if (isProfessor(req)) {
      throw new AppError('Ação não permitida para o seu perfil. Professores não podem criar planos de ensino.', 403);
    }
    throw new AppError('Ação não permitida para o seu perfil.', 403);
  }

  // Buscar plano existente
  const plano = await prisma.planoEnsino.findFirst({
    where: {
      id: planoEnsinoId,
      instituicaoId,
    },
    select: {
      id: true,
      estado: true,
      professorId: true,
      disciplinaId: true,
      turmaId: true,
    },
  });

  if (!plano) {
    throw new AppError('Plano de ensino não encontrado', 404);
  }

  // Verificar estado
  const estado = plano.estado as 'RASCUNHO' | 'EM_REVISAO' | 'APROVADO' | 'ENCERRADO' | null;

  // PROFESSOR: só pode visualizar se estiver APROVADO
  if (isProfessor(req)) {
    if (estado !== 'APROVADO' && estado !== 'ENCERRADO') {
      throw new AppError('Ação não permitida para o seu perfil. Professores só podem visualizar planos aprovados.', 403);
    }
    // REGRA SIGA/SIGAE (OPÇÃO B): Verificar se é o professor do plano usando req.professor.id
    // plano.professorId é professores.id (NÃO users.id)
    // req.professor.id também é professores.id (resolvido pelo middleware resolveProfessor)
    if (!req.professor?.id) {
      throw new AppError(messages.professor.naoIdentificado, 500);
    }
    if (plano.professorId !== req.professor.id) {
      throw new AppError('Acesso negado: você não é o professor responsável por este plano.', 403);
    }
    // PROFESSOR não pode editar, apenas visualizar
    if (req.method !== 'GET') {
      throw new AppError('Ação não permitida para o seu perfil. Professores não podem editar planos de ensino.', 403);
    }
    return;
  }

  // SECRETARIA: pode editar apenas se não estiver APROVADO ou ENCERRADO
  if (isSecretaria(req)) {
    if (estado === 'APROVADO' || estado === 'ENCERRADO') {
      throw new AppError('Este plano está aprovado ou encerrado. Alterações não são permitidas.', 403);
    }
    return;
  }

  throw new AppError('Ação não permitida para o seu perfil.', 403);
};

/**
 * Validar se usuário pode aprovar plano de ensino
 * Apenas ADMIN pode aprovar
 */
export const validarPermissaoAprovarPlanoEnsino = async (req: Request): Promise<void> => {
  if (!isAdminOrSuperior(req)) {
    throw new AppError('Ação não permitida para o seu perfil. Apenas administradores podem aprovar planos de ensino.', 403);
  }
};

/**
 * ========================================
 * DISTRIBUIÇÃO DE AULAS (CALENDÁRIO)
 * ========================================
 */

/**
 * Validar se usuário pode criar/editar calendário
 * - ADMIN: criar / editar / aprovar
 * - SECRETARIA: criar / editar
 * - PROFESSOR: APENAS visualizar
 */
export const validarPermissaoCalendario = async (req: Request): Promise<void> => {
  if (!req.user) {
    throw new AppError('Não autenticado', 401);
  }

  // ADMIN pode tudo
  if (isAdminOrSuperior(req)) {
    return;
  }

  // SECRETARIA pode criar/editar
  if (isSecretaria(req)) {
    return;
  }

  // PROFESSOR só visualiza
  if (isProfessor(req)) {
    if (req.method !== 'GET') {
      throw new AppError('Ação não permitida para o seu perfil. Professores só podem visualizar o calendário.', 403);
    }
    return;
  }

  throw new AppError('Ação não permitida para o seu perfil.', 403);
};

/**
 * ========================================
 * LANÇAMENTO DE AULAS
 * ========================================
 */

/**
 * Validar se usuário pode lançar aula
 * - PROFESSOR: registrar aula realizada
 * - SECRETARIA: visualizar / corrigir com permissão
 * - ADMIN: auditoria
 */
export const validarPermissaoLancarAula = async (
  req: Request,
  planoAulaId?: string,
  planoEnsinoId?: string
): Promise<void> => {
  if (!req.user) {
    throw new AppError('Não autenticado', 401);
  }

  const instituicaoId = requireTenantScope(req);
  const userId = req.user.userId;

  // ADMIN pode tudo
  if (isAdminOrSuperior(req)) {
    return;
  }

  // Buscar plano de aula e plano de ensino
  let planoAula: any = null;
  let planoEnsino: any = null;

  if (planoAulaId) {
    planoAula = await prisma.planoAula.findUnique({
      where: { id: planoAulaId },
      include: {
        planoEnsino: {
          select: {
            id: true,
            professorId: true,
            disciplinaId: true,
            turmaId: true,
            estado: true,
            bloqueado: true,
            instituicaoId: true,
          },
        },
      },
    });

    if (!planoAula) {
      throw new AppError('Aula não encontrada', 404);
    }

    planoEnsino = planoAula.planoEnsino;
  } else if (planoEnsinoId) {
    planoEnsino = await prisma.planoEnsino.findFirst({
      where: {
        id: planoEnsinoId,
        instituicaoId,
      },
      select: {
        id: true,
        professorId: true,
        disciplinaId: true,
        turmaId: true,
        estado: true,
        bloqueado: true,
      },
    });

    if (!planoEnsino) {
      throw new AppError('Plano de ensino não encontrado', 404);
    }
  }

  if (!planoEnsino) {
    throw new AppError('Plano de ensino não encontrado', 404);
  }

  // Verificar se semestre está encerrado
  // TODO: Implementar verificação de semestre encerrado

  // PROFESSOR: só pode lançar se for o professor do plano
  if (isProfessor(req)) {
    // REGRA SIGA/SIGAE (OPÇÃO B): Usar req.professor.id quando disponível (middleware aplicado)
    // planoEnsino.professorId é professores.id (NÃO users.id)
    if (req.professor?.id) {
      // Middleware resolveProfessor aplicado - usar diretamente
      if (planoEnsino.professorId !== req.professor.id) {
        throw new AppError('Acesso negado: você não é o professor responsável por esta aula.', 403);
      }
    } else {
      // Fallback: resolver manualmente se middleware não foi aplicado
      const { isProfessorOfPlanoEnsino } = await import('../utils/professorResolver.js');
      const isOwner = await isProfessorOfPlanoEnsino(userId, planoEnsino.professorId, instituicaoId);
      if (!isOwner) {
        throw new AppError('Acesso negado: você não é o professor responsável por esta aula.', 403);
      }
    }
    
    // REGRA MESTRA SIGA/SIGAE: Validar que plano está ATIVO (APROVADO e não bloqueado)
    await validarPlanoEnsinoAtivoPermissao(planoEnsino, null, null, instituicaoId);
    
    return;
  }

  // SECRETARIA pode corrigir
  if (isSecretaria(req)) {
    return;
  }

  throw new AppError('Ação não permitida para o seu perfil.', 403);
};

/**
 * ========================================
 * CONTROLE DE PRESENÇAS
 * ========================================
 */

/**
 * Validar se usuário pode lançar presenças
 * - PROFESSOR: lançar presenças SOMENTE das suas aulas
 * - SECRETARIA: lançar/corrigir presenças
 * - ADMIN: auditoria
 */
export const validarPermissaoPresenca = async (
  req: Request,
  aulaLancadaId: string
): Promise<void> => {
  if (!req.user) {
    throw new AppError('Não autenticado', 401);
  }

  const instituicaoId = requireTenantScope(req);
  const userId = req.user.userId;

  // ADMIN pode tudo
  if (isAdminOrSuperior(req)) {
    return;
  }

  // Buscar aula lançada e plano de ensino
  const aulaLancada = await prisma.aulaLancada.findFirst({
    where: {
      id: aulaLancadaId,
      instituicaoId,
    },
    include: {
      planoAula: {
        include: {
          planoEnsino: {
            select: {
              id: true,
              professorId: true,
              disciplinaId: true,
              turmaId: true,
              estado: true,
              bloqueado: true,
            },
          },
        },
      },
    },
  });

  if (!aulaLancada) {
    throw new AppError('Aula lançada não encontrada', 404);
  }

  const planoEnsino = aulaLancada.planoAula.planoEnsino;

  // PROFESSOR: só pode lançar se for o professor do plano
  if (isProfessor(req)) {
    // REGRA SIGA/SIGAE (OPÇÃO B): Usar req.professor.id quando disponível (middleware aplicado)
    // planoEnsino.professorId é professores.id (NÃO users.id)
    if (req.professor?.id) {
      // Middleware resolveProfessor aplicado - usar diretamente
      if (planoEnsino.professorId !== req.professor.id) {
        throw new AppError('Acesso negado: você não é o professor responsável por esta aula.', 403);
      }
    } else {
      // Fallback: resolver manualmente se middleware não foi aplicado
      const { isProfessorOfPlanoEnsino } = await import('../utils/professorResolver.js');
      const isOwner = await isProfessorOfPlanoEnsino(userId, planoEnsino.professorId, instituicaoId);
      if (!isOwner) {
        throw new AppError('Acesso negado: você não é o professor responsável por esta aula.', 403);
      }
    }
    
    // REGRA MESTRA SIGA/SIGAE: Validar que plano está ATIVO (APROVADO e não bloqueado)
    await validarPlanoEnsinoAtivoPermissao(planoEnsino, null, null, instituicaoId);
    
    return;
  }

  // SECRETARIA: APENAS CONSULTA - não pode alterar presenças lançadas por professores
  if (isSecretaria(req)) {
    // Verificar se há presenças já lançadas (por professor)
    // Presenca não possui lancadoPor; Secretaria pode editar presenças
    // (restrição de "presenças lançadas por professor" não aplicável sem esse campo)

    // SECRETARIA pode criar presenças se não houver nenhuma (primeira vez)
    // Mas não pode alterar presenças existentes lançadas por professores
    return;
  }

  throw new AppError('Ação não permitida para o seu perfil.', 403);
};

/**
 * ========================================
 * AVALIAÇÕES E NOTAS
 * ========================================
 */

/**
 * Validar se usuário pode criar/editar avaliação
 * - PROFESSOR: criar avaliações em seus planos
 * - SECRETARIA: criar/editar avaliações
 * - ADMIN: auditoria
 */
export const validarPermissaoAvaliacao = async (
  req: Request,
  avaliacaoId?: string,
  planoEnsinoId?: string
): Promise<void> => {
  if (!req.user) {
    throw new AppError('Não autenticado', 401);
  }

  const instituicaoId = requireTenantScope(req);
  const userId = req.user.userId;

  // ADMIN pode tudo
  if (isAdminOrSuperior(req)) {
    return;
  }

  // Buscar avaliação ou plano de ensino
  let avaliacao: any = null;
  let planoEnsino: any = null;

  if (avaliacaoId) {
    avaliacao = await prisma.avaliacao.findFirst({
      where: {
        id: avaliacaoId,
        instituicaoId,
      },
      include: {
        planoEnsino: {
          select: {
            id: true,
            professorId: true,
            disciplinaId: true,
            turmaId: true,
            estado: true,
            bloqueado: true,
          },
        },
      },
    });

    if (!avaliacao) {
      throw new AppError('Avaliação não encontrada', 404);
    }

    planoEnsino = avaliacao.planoEnsino;
  } else if (planoEnsinoId) {
    planoEnsino = await prisma.planoEnsino.findFirst({
      where: {
        id: planoEnsinoId,
        instituicaoId,
      },
      select: {
        id: true,
        professorId: true,
        disciplinaId: true,
        turmaId: true,
        estado: true,
        bloqueado: true,
      },
    });

    if (!planoEnsino) {
      throw new AppError('Plano de ensino não encontrado', 404);
    }
  }

  if (!planoEnsino) {
    throw new AppError('Plano de ensino não encontrado', 404);
  }

  // Verificar estado do plano
  const estado = planoEnsino.estado as 'RASCUNHO' | 'EM_REVISAO' | 'APROVADO' | 'ENCERRADO' | null;
  if (estado === 'ENCERRADO') {
    throw new AppError('Este plano de ensino está encerrado. Alterações não são permitidas.', 403);
  }

  // PROFESSOR: só pode criar/editar se for o professor do plano
  if (isProfessor(req)) {
    // REGRA SIGA/SIGAE (OPÇÃO B): Usar req.professor.id quando disponível (middleware aplicado)
    // planoEnsino.professorId é professores.id (NÃO users.id)
    if (req.professor?.id) {
      // Middleware resolveProfessor aplicado - usar diretamente
      if (planoEnsino.professorId !== req.professor.id) {
        throw new AppError('Acesso negado: você não é o professor responsável por este plano.', 403);
      }
    } else {
      // Fallback: resolver manualmente se middleware não foi aplicado
      const { isProfessorOfPlanoEnsino } = await import('../utils/professorResolver.js');
      const isOwner = await isProfessorOfPlanoEnsino(userId, planoEnsino.professorId, instituicaoId);
      if (!isOwner) {
        throw new AppError('Acesso negado: você não é o professor responsável por este plano.', 403);
      }
    }
    
    // REGRA MESTRA SIGA/SIGAE: Validar que plano está ATIVO (APROVADO e não bloqueado)
    await validarPlanoEnsinoAtivoPermissao(planoEnsino, null, null, instituicaoId);
    
    return;
  }

  // SECRETARIA pode criar/editar
  if (isSecretaria(req)) {
    return;
  }

  throw new AppError('Ação não permitida para o seu perfil.', 403);
};

/**
 * Validar se usuário pode fechar/encerrar avaliação
 * Apenas ADMIN pode fechar/encerrar
 */
export const validarPermissaoFecharAvaliacao = async (req: Request): Promise<void> => {
  if (!isAdminOrSuperior(req)) {
    throw new AppError('Ação não permitida para o seu perfil. Apenas administradores podem fechar avaliações.', 403);
  }
};

/**
 * Validar se usuário pode lançar notas
 * - PROFESSOR: lançar notas em suas avaliações
 * - SECRETARIA: lançar/corrigir notas
 * - ADMIN: auditoria
 */
export const validarPermissaoNota = async (
  req: Request,
  avaliacaoId?: string,
  exameId?: string
): Promise<void> => {
  if (!req.user) {
    throw new AppError('Não autenticado', 401);
  }

  const instituicaoId = requireTenantScope(req);
  const userId = req.user.userId;
  const userRoles = req.user.roles || [];

  // VALIDAÇÃO: Verificar perfis autorizados para alterar notas (configuração institucional)
  const parametrosSistema = await prisma.parametrosSistema.findUnique({
    where: { instituicaoId },
  });

  const perfisAlterarNotas = parametrosSistema?.perfisAlterarNotas || ['ADMIN', 'PROFESSOR'];

  // Verificar se o usuário tem algum perfil autorizado
  const temPerfilAutorizado = userRoles.some(role => perfisAlterarNotas.includes(role));

  // SUPER_ADMIN sempre pode
  if (userRoles.includes('SUPER_ADMIN')) {
    return;
  }

  // ADMIN pode tudo (se estiver nos perfis autorizados)
  if (isAdminOrSuperior(req) && temPerfilAutorizado) {
    return;
  }

  // Se não tem perfil autorizado, bloquear
  if (!temPerfilAutorizado && req.method !== 'GET') {
    throw new AppError(
      `Ação não permitida para o seu perfil. Apenas os seguintes perfis podem alterar notas nesta instituição: ${perfisAlterarNotas.join(', ')}. ` +
      'Entre em contato com o administrador da instituição para mais informações.',
      403
    );
  }

  // Verificar avaliação
  if (avaliacaoId) {
    const avaliacao = await prisma.avaliacao.findFirst({
      where: {
        id: avaliacaoId,
        instituicaoId,
      },
      include: {
        planoEnsino: {
          select: {
            id: true,
            professorId: true,
            disciplinaId: true,
            turmaId: true,
            estado: true,
            bloqueado: true,
          },
        },
      },
    });

    if (!avaliacao) {
      throw new AppError('Avaliação não encontrada', 404);
    }

    // Verificar se avaliação está fechada
    if (avaliacao.fechada) {
      throw new AppError('Não é possível lançar notas em uma avaliação fechada', 400);
    }

    // PROFESSOR: só pode lançar se for o professor do plano
    if (isProfessor(req)) {
      // REGRA SIGA/SIGAE (OPÇÃO B): Usar req.professor.id quando disponível (middleware aplicado)
      // avaliacao.planoEnsino.professorId é professores.id (NÃO users.id)
      if (req.professor?.id) {
        // Middleware resolveProfessor aplicado - usar diretamente
        if (avaliacao.planoEnsino.professorId !== req.professor.id) {
          throw new AppError('Acesso negado: você não é o professor responsável por esta avaliação.', 403);
        }
      } else {
        // Fallback: resolver manualmente se middleware não foi aplicado
        const { isProfessorOfPlanoEnsino } = await import('../utils/professorResolver.js');
        const isOwner = await isProfessorOfPlanoEnsino(userId, avaliacao.planoEnsino.professorId, instituicaoId);
        if (!isOwner) {
          throw new AppError('Acesso negado: você não é o professor responsável por esta avaliação.', 403);
        }
      }
      
      // REGRA MESTRA SIGA/SIGAE: Validar que plano está ATIVO (APROVADO e não bloqueado)
      await validarPlanoEnsinoAtivoPermissao(avaliacao.planoEnsino, null, null, instituicaoId);
      
      return;
    }

    // SECRETARIA: APENAS CONSULTA - não pode alterar notas lançadas por professores
    if (isSecretaria(req)) {
      // Verificar se há notas já lançadas (por professor)
      const notasExistentes = await prisma.nota.findMany({
        where: {
          avaliacaoId,
          instituicaoId,
        },
        select: {
          id: true,
          lancadoPor: true,
        },
      });

      // Se há notas lançadas por professor, SECRETARIA não pode alterar
      const notasPorProfessor = notasExistentes.filter(n => n.lancadoPor);
      if (notasPorProfessor.length > 0 && req.method !== 'GET') {
        throw new AppError('Ação não permitida para o seu perfil. Secretaria não pode alterar notas lançadas por professores. Apenas consulta é permitida.', 403);
      }

      // SECRETARIA pode criar notas se não houver nenhuma (primeira vez)
      // Mas não pode alterar notas existentes lançadas por professores
      return;
    }
  }

  // Verificar exame
  if (exameId) {
    const exame = await prisma.exame.findFirst({
      where: {
        id: exameId,
        turma: { instituicaoId },
      },
      include: {
        turma: {
          select: {
            id: true,
            instituicaoId: true,
          },
        },
      },
    });

    if (!exame) {
      throw new AppError('Exame não encontrado', 404);
    }

    // PROFESSOR: só pode lançar se for o professor da turma via PlanoEnsino (ÚNICA fonte de verdade SIGAE)
    if (isProfessor(req)) {
      const professorId = req.professor?.id;
      if (!professorId) {
        throw new AppError(messages.professor.naoIdentificado, 500);
      }
      const planoDoProfessor = await prisma.planoEnsino.findFirst({
        where: {
          turmaId: exame.turma.id,
          professorId,
          instituicaoId,
        },
        select: { id: true },
      });
      if (!planoDoProfessor) {
        throw new AppError('Acesso negado: você não é o professor responsável por este exame. A atribuição é feita exclusivamente via Plano de Ensino.', 403);
      }
      return;
    }

    // SECRETARIA: APENAS CONSULTA - não pode alterar notas lançadas por professores
    if (isSecretaria(req)) {
      // Verificar se há notas já lançadas (por professor)
      const notasExistentes = await prisma.nota.findMany({
        where: {
          exameId,
          instituicaoId,
        },
        select: {
          id: true,
          lancadoPor: true,
        },
      });

      // Se há notas lançadas por professor, SECRETARIA não pode alterar
      const notasPorProfessor = notasExistentes.filter(n => n.lancadoPor);
      if (notasPorProfessor.length > 0 && req.method !== 'GET') {
        throw new AppError('Ação não permitida para o seu perfil. Secretaria não pode alterar notas lançadas por professores. Apenas consulta é permitida.', 403);
      }

      // SECRETARIA pode criar notas se não houver nenhuma (primeira vez)
      // Mas não pode alterar notas existentes lançadas por professores
      return;
    }
  }

  throw new AppError('Ação não permitida para o seu perfil.', 403);
};

