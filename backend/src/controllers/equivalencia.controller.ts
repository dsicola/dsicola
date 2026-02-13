import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, getInstituicaoIdFromFilter, requireTenantScope } from '../middlewares/auth.js';
import { Decimal } from '@prisma/client/runtime/library';
import { AuditService } from '../services/audit.service.js';
import { ModuloAuditoria, EntidadeAuditoria } from '../services/audit.service.js';

/**
 * ========================================
 * CONTROLLER: EQUIVALÊNCIA DE DISCIPLINAS
 * ========================================
 * 
 * REGRAS ABSOLUTAS (SIGA/SIGAE):
 * - Equivalência NÃO apaga histórico anterior
 * - Equivalência NÃO altera notas originais
 * - Histórico acadêmico é IMUTÁVEL
 * - Equivalência gera REGISTRO OFICIAL
 * - Tudo deve ser auditável
 * - instituicao_id SEMPRE do token (NUNCA do frontend)
 */

/**
 * Validar equivalência (carga horária e compatibilidade)
 */
async function validarEquivalencia(
  cargaHorariaOrigem: number,
  cargaHorariaEquivalente: number,
  tipoAcademico: 'ENSINO_SUPERIOR' | 'ENSINO_SECUNDARIO' | null
): Promise<{ valido: boolean; erro?: string }> {
  // Validação básica: carga horária equivalente não pode ser maior que origem
  if (cargaHorariaEquivalente > cargaHorariaOrigem) {
    return {
      valido: false,
      erro: 'Carga horária equivalente não pode ser maior que a carga horária de origem',
    };
  }

  // Para Ensino Superior: exigir compatibilidade mínima de 80%
  if (tipoAcademico === 'ENSINO_SUPERIOR') {
    const percentualMinimo = 0.8;
    const cargaMinima = cargaHorariaOrigem * percentualMinimo;
    
    if (cargaHorariaEquivalente < cargaMinima) {
      return {
        valido: false,
        erro: `Para Ensino Superior, a carga horária equivalente deve ser pelo menos ${Math.round(percentualMinimo * 100)}% da carga horária de origem (mínimo: ${Math.round(cargaMinima)}h)`,
      };
    }
  }

  // Para Ensino Secundário: permitir mais flexibilidade (decisão administrativa)
  // Mas ainda validar que não seja maior que origem

  return { valido: true };
}

/**
 * Criar solicitação de equivalência
 */
export const createEquivalencia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;

    const {
      alunoId,
      cursoOrigemId,
      disciplinaOrigemId,
      disciplinaOrigemNome, // Para disciplinas externas
      instituicaoOrigemNome, // Para disciplinas externas
      cargaHorariaOrigem,
      notaOrigem,
      cursoDestinoId,
      disciplinaDestinoId,
      cargaHorariaEquivalente,
      criterio,
      observacao,
    } = req.body;

    // Validações obrigatórias
    if (!alunoId || !cursoDestinoId || !disciplinaDestinoId || !cargaHorariaOrigem || !cargaHorariaEquivalente) {
      throw new AppError('Aluno, curso destino, disciplina destino, carga horária origem e carga horária equivalente são obrigatórios', 400);
    }

    // Validar que disciplinaOrigemId OU disciplinaOrigemNome está presente
    if (!disciplinaOrigemId && !disciplinaOrigemNome) {
      throw new AppError('Disciplina de origem é obrigatória (ID ou nome)', 400);
    }

    // Validar que aluno pertence à instituição
    const aluno = await prisma.user.findFirst({
      where: {
        id: alunoId,
        instituicaoId,
        roles: {
          some: {
            role: 'ALUNO',
          },
        },
      },
    });

    if (!aluno) {
      throw new AppError('Aluno não encontrado ou não pertence à instituição', 404);
    }

    // Validar que disciplina destino existe e pertence à instituição
    const disciplinaDestino = await prisma.disciplina.findFirst({
      where: {
        id: disciplinaDestinoId,
        instituicaoId,
      },
      include: {
        curso: {
          include: {
            instituicao: true,
          },
        },
      },
    });

    if (!disciplinaDestino) {
      throw new AppError('Disciplina destino não encontrada ou não pertence à instituição', 404);
    }

    // Validar que curso destino existe e pertence à instituição
    const cursoDestino = await prisma.curso.findFirst({
      where: {
        id: cursoDestinoId,
        instituicaoId,
      },
    });

    if (!cursoDestino) {
      throw new AppError('Curso destino não encontrado ou não pertence à instituição', 404);
    }

    // Validar que disciplina origem existe (se for da mesma instituição)
    if (disciplinaOrigemId) {
      const disciplinaOrigem = await prisma.disciplina.findFirst({
        where: {
          id: disciplinaOrigemId,
        },
        include: {
          curso: {
            include: {
              instituicao: true,
            },
          },
        },
      });

      if (!disciplinaOrigem) {
        throw new AppError('Disciplina origem não encontrada', 404);
      }
    }

    // Buscar tipo acadêmico da instituição
    const instituicao = await prisma.instituicao.findUnique({
      where: { id: instituicaoId },
      select: { tipoAcademico: true },
    });

    // Validar equivalência (carga horária e compatibilidade)
    const tipoAcad = instituicao?.tipoAcademico ? (instituicao.tipoAcademico === 'SUPERIOR' ? 'ENSINO_SUPERIOR' : 'ENSINO_SECUNDARIO') : null;
    const validacao = await validarEquivalencia(
      cargaHorariaOrigem,
      cargaHorariaEquivalente,
      tipoAcad
    );

    if (!validacao.valido) {
      throw new AppError(validacao.erro || 'Equivalência inválida', 400);
    }

    // Verificar se já existe equivalência deferida para esta disciplina destino
    const equivalenciaExistente = await prisma.equivalenciaDisciplina.findFirst({
      where: {
        instituicaoId,
        alunoId,
        disciplinaDestinoId,
        deferido: true,
      },
    });

    if (equivalenciaExistente) {
      throw new AppError('Já existe uma equivalência deferida para esta disciplina destino', 409);
    }

    // Criar equivalência
    const equivalencia = await prisma.equivalenciaDisciplina.create({
      data: {
        instituicaoId,
        alunoId,
        cursoOrigemId: cursoOrigemId || null,
        disciplinaOrigemId: disciplinaOrigemId || null,
        disciplinaOrigemNome: disciplinaOrigemNome || null,
        instituicaoOrigemNome: instituicaoOrigemNome || null,
        cargaHorariaOrigem,
        notaOrigem: notaOrigem ? new Decimal(notaOrigem) : null,
        cursoDestinoId,
        disciplinaDestinoId,
        cargaHorariaEquivalente,
        criterio: criterio || 'EQUIVALENCIA',
        observacao: observacao || null,
        deferido: false,
      },
      include: {
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
        disciplinaDestino: {
          select: {
            id: true,
            nome: true,
            cargaHoraria: true,
          },
        },
        cursoDestino: {
          select: {
            id: true,
            nome: true,
          },
        },
        disciplinaOrigem: {
          select: {
            id: true,
            nome: true,
            cargaHoraria: true,
          },
        },
        cursoOrigem: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });

    // Registrar log de auditoria
    await AuditService.log(req, {
      modulo: ModuloAuditoria.ALUNOS,
      acao: 'CREATE',
      entidade: EntidadeAuditoria.EQUIVALENCIA_DISCIPLINA,
      entidadeId: equivalencia.id,
      dadosNovos: {
        alunoId,
        disciplinaOrigemId: disciplinaOrigemId || disciplinaOrigemNome,
        disciplinaDestinoId,
        criterio: criterio || 'EQUIVALENCIA',
        cargaHorariaOrigem,
        cargaHorariaEquivalente,
      },
    });

    res.status(201).json(equivalencia);
  } catch (error) {
    next(error);
  }
};

/**
 * Listar equivalências (filtrado por instituição)
 */
export const getEquivalencias = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { alunoId, deferido, disciplinaDestinoId } = req.query;

    const where: any = {
      ...filter,
    };

    if (alunoId) {
      where.alunoId = alunoId as string;
    }

    if (deferido !== undefined) {
      where.deferido = deferido === 'true';
    }

    if (disciplinaDestinoId) {
      where.disciplinaDestinoId = disciplinaDestinoId as string;
    }

    const equivalencias = await prisma.equivalenciaDisciplina.findMany({
      where,
      include: {
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            numeroIdentificacaoPublica: true,
          },
        },
        disciplinaDestino: {
          select: {
            id: true,
            nome: true,
            cargaHoraria: true,
          },
        },
        cursoDestino: {
          select: {
            id: true,
            nome: true,
          },
        },
        disciplinaOrigem: {
          select: {
            id: true,
            nome: true,
            cargaHoraria: true,
          },
        },
        cursoOrigem: {
          select: {
            id: true,
            nome: true,
          },
        },
        deferidoPorUser: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(equivalencias);
  } catch (error) {
    next(error);
  }
};

/**
 * Obter equivalência por ID
 */
export const getEquivalenciaById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const equivalencia = await prisma.equivalenciaDisciplina.findFirst({
      where: {
        id,
        ...filter,
      },
      include: {
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            numeroIdentificacaoPublica: true,
          },
        },
        disciplinaDestino: {
          select: {
            id: true,
            nome: true,
            cargaHoraria: true,
          },
        },
        cursoDestino: {
          select: {
            id: true,
            nome: true,
          },
        },
        disciplinaOrigem: {
          select: {
            id: true,
            nome: true,
            cargaHoraria: true,
          },
        },
        cursoOrigem: {
          select: {
            id: true,
            nome: true,
          },
        },
        deferidoPorUser: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
      },
    });

    if (!equivalencia) {
      throw new AppError('Equivalência não encontrada', 404);
    }

    res.json(equivalencia);
  } catch (error) {
    next(error);
  }
};

/**
 * Listar equivalências de um aluno
 */
export const getEquivalenciasByAluno = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { alunoId } = req.params;
    const filter = addInstitutionFilter(req);

    // Verificar que aluno pertence à instituição
    const aluno = await prisma.user.findFirst({
      where: {
        id: alunoId,
        ...(filter.instituicaoId ? { instituicaoId: filter.instituicaoId } : {}),
      },
    });

    if (!aluno) {
      throw new AppError('Aluno não encontrado', 404);
    }

    const equivalencias = await prisma.equivalenciaDisciplina.findMany({
      where: {
        alunoId,
        ...filter,
      },
      include: {
        disciplinaDestino: {
          select: {
            id: true,
            nome: true,
            cargaHoraria: true,
          },
        },
        cursoDestino: {
          select: {
            id: true,
            nome: true,
          },
        },
        disciplinaOrigem: {
          select: {
            id: true,
            nome: true,
            cargaHoraria: true,
          },
        },
        cursoOrigem: {
          select: {
            id: true,
            nome: true,
          },
        },
        deferidoPorUser: {
          select: {
            id: true,
            nomeCompleto: true,
          },
        },
      },
      orderBy: {
        deferidoEm: 'desc',
        createdAt: 'desc',
      },
    });

    res.json(equivalencias);
  } catch (error) {
    next(error);
  }
};

/**
 * Atualizar equivalência (apenas se não deferida)
 */
export const updateEquivalencia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    const userId = req.user?.userId;

    // Buscar equivalência
    const equivalencia = await prisma.equivalenciaDisciplina.findFirst({
      where: {
        id,
        ...filter,
      },
    });

    if (!equivalencia) {
      throw new AppError('Equivalência não encontrada', 404);
    }

    // NÃO permitir UPDATE após deferimento
    if (equivalencia.deferido) {
      throw new AppError('Não é possível atualizar equivalência deferida. O histórico é imutável.', 403);
    }

    const {
      cursoOrigemId,
      disciplinaOrigemId,
      disciplinaOrigemNome,
      instituicaoOrigemNome,
      cargaHorariaOrigem,
      notaOrigem,
      cursoDestinoId,
      disciplinaDestinoId,
      cargaHorariaEquivalente,
      criterio,
      observacao,
    } = req.body;

    // Validar carga horária se fornecida
    if (cargaHorariaOrigem && cargaHorariaEquivalente) {
      const instituicao = await prisma.instituicao.findUnique({
        where: { id: getInstituicaoIdFromFilter(filter) || '' },
        select: { tipoAcademico: true },
      });

      const tipoAcad = instituicao?.tipoAcademico ? (instituicao.tipoAcademico === 'SUPERIOR' ? 'ENSINO_SUPERIOR' : 'ENSINO_SECUNDARIO') : null;
      const validacao = await validarEquivalencia(
        cargaHorariaOrigem,
        cargaHorariaEquivalente,
        tipoAcad
      );

      if (!validacao.valido) {
        throw new AppError(validacao.erro || 'Equivalência inválida', 400);
      }
    }

    // Preparar dados de atualização
    const updateData: any = {};

    if (cursoOrigemId !== undefined) updateData.cursoOrigemId = cursoOrigemId || null;
    if (disciplinaOrigemId !== undefined) updateData.disciplinaOrigemId = disciplinaOrigemId || null;
    if (disciplinaOrigemNome !== undefined) updateData.disciplinaOrigemNome = disciplinaOrigemNome || null;
    if (instituicaoOrigemNome !== undefined) updateData.instituicaoOrigemNome = instituicaoOrigemNome || null;
    if (cargaHorariaOrigem !== undefined) updateData.cargaHorariaOrigem = cargaHorariaOrigem;
    if (notaOrigem !== undefined) updateData.notaOrigem = notaOrigem ? new Decimal(notaOrigem) : null;
    if (cursoDestinoId !== undefined) updateData.cursoDestinoId = cursoDestinoId;
    if (disciplinaDestinoId !== undefined) updateData.disciplinaDestinoId = disciplinaDestinoId;
    if (cargaHorariaEquivalente !== undefined) updateData.cargaHorariaEquivalente = cargaHorariaEquivalente;
    if (criterio !== undefined) updateData.criterio = criterio;
    if (observacao !== undefined) updateData.observacao = observacao || null;

    // NUNCA permitir alterar instituicaoId, alunoId ou status de deferimento
    if (req.body.instituicaoId !== undefined || req.body.alunoId !== undefined || req.body.deferido !== undefined) {
      throw new AppError('Não é permitido alterar instituição, aluno ou status de deferimento', 400);
    }

    const equivalenciaAtualizada = await prisma.equivalenciaDisciplina.update({
      where: { id },
      data: updateData,
      include: {
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
        disciplinaDestino: {
          select: {
            id: true,
            nome: true,
            cargaHoraria: true,
          },
        },
        cursoDestino: {
          select: {
            id: true,
            nome: true,
          },
        },
        disciplinaOrigem: {
          select: {
            id: true,
            nome: true,
            cargaHoraria: true,
          },
        },
        cursoOrigem: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });

    // Registrar log de auditoria
    await AuditService.log(req, {
      modulo: ModuloAuditoria.ALUNOS,
      acao: 'UPDATE',
      entidade: EntidadeAuditoria.EQUIVALENCIA_DISCIPLINA,
      entidadeId: equivalenciaAtualizada.id,
      dadosAnteriores: {
        // Campos anteriores (antes da atualização)
      },
      dadosNovos: updateData,
    });

    res.json(equivalenciaAtualizada);
  } catch (error) {
    next(error);
  }
};

/**
 * Deferir equivalência
 */
export const deferirEquivalencia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    const userId = req.user?.userId;
    const { observacao } = req.body;

    if (!userId) {
      throw new AppError('Usuário não identificado', 401);
    }

    // Buscar equivalência
    const equivalencia = await prisma.equivalenciaDisciplina.findFirst({
      where: {
        id,
        ...filter,
      },
      include: {
        aluno: true,
        disciplinaDestino: true,
        cursoDestino: true,
      },
    });

    if (!equivalencia) {
      throw new AppError('Equivalência não encontrada', 404);
    }

    // Verificar se já está deferida
    if (equivalencia.deferido) {
      throw new AppError('Equivalência já está deferida', 400);
    }

    // Deferir equivalência
    const equivalenciaDeferida = await prisma.equivalenciaDisciplina.update({
      where: { id },
      data: {
        deferido: true,
        deferidoPor: userId,
        deferidoEm: new Date(),
        observacao: observacao ? `${equivalencia.observacao || ''}\n[DEFERIDO]: ${observacao}`.trim() : equivalencia.observacao,
      },
      include: {
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
        disciplinaDestino: {
          select: {
            id: true,
            nome: true,
            cargaHoraria: true,
          },
        },
        cursoDestino: {
          select: {
            id: true,
            nome: true,
          },
        },
        disciplinaOrigem: {
          select: {
            id: true,
            nome: true,
            cargaHoraria: true,
          },
        },
        cursoOrigem: {
          select: {
            id: true,
            nome: true,
          },
        },
        deferidoPorUser: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
      },
    });

    // Registrar log de auditoria
    await AuditService.log(req, {
      modulo: ModuloAuditoria.ALUNOS,
      acao: 'DEFERIR',
      entidade: EntidadeAuditoria.EQUIVALENCIA_DISCIPLINA,
      entidadeId: equivalenciaDeferida.id,
      dadosNovos: {
        deferido: true,
        deferidoPor: userId,
        deferidoEm: new Date(),
      },
      observacao: observacao || undefined,
    });

    res.json({
      ...equivalenciaDeferida,
      message: 'Equivalência deferida com sucesso. O histórico acadêmico será atualizado no próximo encerramento de ano letivo.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Indeferir equivalência
 */
export const indeferirEquivalencia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    const userId = req.user?.userId;
    const { motivo } = req.body;

    if (!userId) {
      throw new AppError('Usuário não identificado', 401);
    }

    if (!motivo) {
      throw new AppError('Motivo do indeferimento é obrigatório', 400);
    }

    // Buscar equivalência
    const equivalencia = await prisma.equivalenciaDisciplina.findFirst({
      where: {
        id,
        ...filter,
      },
    });

    if (!equivalencia) {
      throw new AppError('Equivalência não encontrada', 404);
    }

    // NÃO permitir indeferir se já está deferida (histórico imutável)
    if (equivalencia.deferido) {
      throw new AppError('Não é possível indeferir equivalência já deferida. O histórico é imutável.', 403);
    }

    // Deletar equivalência indeferida (não deferida = pode ser removida)
    await prisma.equivalenciaDisciplina.delete({
      where: { id },
    });

    // Registrar log de auditoria
    await AuditService.log(req, {
      modulo: ModuloAuditoria.ALUNOS,
      acao: 'INDEFERIR',
      entidade: EntidadeAuditoria.EQUIVALENCIA_DISCIPLINA,
      entidadeId: id,
      dadosAnteriores: {
        alunoId: equivalencia.alunoId,
        disciplinaDestinoId: equivalencia.disciplinaDestinoId,
      },
      observacao: motivo,
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * Deletar equivalência (apenas se não deferida)
 */
export const deleteEquivalencia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    const userId = req.user?.userId;

    // Buscar equivalência
    const equivalencia = await prisma.equivalenciaDisciplina.findFirst({
      where: {
        id,
        ...filter,
      },
    });

    if (!equivalencia) {
      throw new AppError('Equivalência não encontrada', 404);
    }

    // NÃO permitir DELETE após deferimento
    if (equivalencia.deferido) {
      throw new AppError('Não é possível deletar equivalência deferida. O histórico é imutável.', 403);
    }

    // Deletar equivalência
    await prisma.equivalenciaDisciplina.delete({
      where: { id },
    });

    // Registrar log de auditoria
    await AuditService.log(req, {
      modulo: ModuloAuditoria.ALUNOS,
      acao: 'DELETE',
      entidade: EntidadeAuditoria.EQUIVALENCIA_DISCIPLINA,
      entidadeId: id,
      dadosAnteriores: {
        alunoId: equivalencia.alunoId,
        disciplinaDestinoId: equivalencia.disciplinaDestinoId,
      },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

