import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter } from '../middlewares/auth.js';

/**
 * Vincular disciplina a um curso
 * POST /cursos/:cursoId/disciplinas
 */
export const vincularDisciplina = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cursoId } = req.params;
    const { disciplinaId, semestre, trimestre, cargaHoraria, obrigatoria, preRequisitoDisciplinaId } =
      req.body;

    if (!disciplinaId) {
      throw new AppError('Disciplina é obrigatória', 400);
    }

    const filter = addInstitutionFilter(req);

    // Verificar se curso existe e pertence à instituição
    const curso = await prisma.curso.findFirst({
      where: { id: cursoId, ...filter },
    });

    if (!curso) {
      throw new AppError('Curso não encontrado', 404);
    }

    // Verificar se disciplina existe e pertence à instituição
    const disciplina = await prisma.disciplina.findFirst({
      where: { id: disciplinaId, ...filter },
    });

    if (!disciplina) {
      throw new AppError('Disciplina não encontrada', 404);
    }

    let preReqId: string | null = null;
    if (preRequisitoDisciplinaId != null && String(preRequisitoDisciplinaId).trim() !== '') {
      preReqId = String(preRequisitoDisciplinaId).trim();
      if (preReqId === disciplinaId) {
        throw new AppError('A disciplina não pode ser pré-requisito de si mesma.', 400);
      }
      const pre = await prisma.disciplina.findFirst({
        where: { id: preReqId, ...filter },
      });
      if (!pre) {
        throw new AppError('Disciplina de pré-requisito não encontrada nesta instituição.', 404);
      }
    }

    // Verificar se vínculo já existe
    const vinculoExistente = await prisma.cursoDisciplina.findUnique({
      where: {
        cursoId_disciplinaId: {
          cursoId,
          disciplinaId,
        },
      },
    });

    if (vinculoExistente) {
      throw new AppError('Disciplina já está vinculada a este curso', 409);
    }

    // Criar vínculo
    const vinculo = await prisma.cursoDisciplina.create({
      data: {
        cursoId,
        disciplinaId,
        semestre: semestre ? Number(semestre) : null,
        trimestre: trimestre ? Number(trimestre) : null,
        cargaHoraria: cargaHoraria ? Number(cargaHoraria) : disciplina.cargaHoraria,
        obrigatoria: obrigatoria !== undefined ? Boolean(obrigatoria) : true,
        preRequisitoDisciplinaId: preReqId,
      },
      include: {
        curso: {
          select: { id: true, nome: true, codigo: true },
        },
        disciplina: {
          select: { id: true, nome: true, codigo: true, cargaHoraria: true },
        },
        preRequisitoDisciplina: {
          select: { id: true, nome: true, codigo: true },
        },
      },
    });

    res.status(201).json(vinculo);
  } catch (error) {
    next(error);
  }
};

/**
 * Desvincular disciplina de um curso
 * DELETE /cursos/:cursoId/disciplinas/:disciplinaId
 */
export const desvincularDisciplina = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cursoId, disciplinaId } = req.params;
    const filter = addInstitutionFilter(req);

    // Verificar se curso existe e pertence à instituição
    const curso = await prisma.curso.findFirst({
      where: { id: cursoId, ...filter },
    });

    if (!curso) {
      throw new AppError('Curso não encontrado', 404);
    }

    // Verificar se vínculo existe
    const vinculo = await prisma.cursoDisciplina.findUnique({
      where: {
        cursoId_disciplinaId: {
          cursoId,
          disciplinaId,
        },
      },
    });

    if (!vinculo) {
      throw new AppError('Vínculo não encontrado', 404);
    }

    // Verificar se há planos de ensino usando este vínculo
    const planosCount = await prisma.planoEnsino.count({
      where: {
        cursoId,
        disciplinaId,
      },
    });

    if (planosCount > 0) {
      throw new AppError('Não é possível desvincular disciplina com planos de ensino vinculados', 400);
    }

    await prisma.cursoDisciplina.delete({
      where: {
        cursoId_disciplinaId: {
          cursoId,
          disciplinaId,
        },
      },
    });

    res.json({ message: 'Disciplina desvinculada do curso com sucesso' });
  } catch (error) {
    next(error);
  }
};

/**
 * Atualizar vínculo curso–disciplina (semestre, obrigatória, pré-requisito).
 * PATCH /cursos/:cursoId/disciplinas/:disciplinaId
 */
export const atualizarVinculoDisciplina = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cursoId, disciplinaId } = req.params;
    const { semestre, trimestre, cargaHoraria, obrigatoria, preRequisitoDisciplinaId } = req.body;
    const filter = addInstitutionFilter(req);

    const curso = await prisma.curso.findFirst({
      where: { id: cursoId, ...filter },
    });
    if (!curso) {
      throw new AppError('Curso não encontrado', 404);
    }

    const vinculo = await prisma.cursoDisciplina.findUnique({
      where: {
        cursoId_disciplinaId: { cursoId, disciplinaId },
      },
    });
    if (!vinculo) {
      throw new AppError('Vínculo não encontrado', 404);
    }

    const data: Record<string, unknown> = {};
    if (semestre !== undefined) data.semestre = semestre === null || semestre === '' ? null : Number(semestre);
    if (trimestre !== undefined)
      data.trimestre = trimestre === null || trimestre === '' ? null : Number(trimestre);
    if (cargaHoraria !== undefined)
      data.cargaHoraria = cargaHoraria === null || cargaHoraria === '' ? null : Number(cargaHoraria);
    if (obrigatoria !== undefined) data.obrigatoria = Boolean(obrigatoria);

    if (preRequisitoDisciplinaId !== undefined) {
      if (preRequisitoDisciplinaId === null || preRequisitoDisciplinaId === '') {
        data.preRequisitoDisciplinaId = null;
      } else {
        const preId = String(preRequisitoDisciplinaId);
        if (preId === disciplinaId) {
          throw new AppError('A disciplina não pode ser pré-requisito de si mesma.', 400);
        }
        const pre = await prisma.disciplina.findFirst({
          where: { id: preId, ...filter },
        });
        if (!pre) {
          throw new AppError('Disciplina de pré-requisito não encontrada nesta instituição.', 404);
        }
        data.preRequisitoDisciplinaId = preId;
      }
    }

    const atualizado = await prisma.cursoDisciplina.update({
      where: { cursoId_disciplinaId: { cursoId, disciplinaId } },
      data,
      include: {
        curso: { select: { id: true, nome: true, codigo: true } },
        disciplina: { select: { id: true, nome: true, codigo: true, cargaHoraria: true } },
        preRequisitoDisciplina: { select: { id: true, nome: true, codigo: true } },
      },
    });

    res.json(atualizado);
  } catch (error) {
    next(error);
  }
};

/**
 * Listar disciplinas de um curso
 * GET /cursos/:cursoId/disciplinas
 * 
 * REGRA MULTI-TENANT: Garante que curso e disciplinas pertencem à instituição do usuário
 * REGRA ENSINO SUPERIOR: Usa tabela de junção CursoDisciplina (N:N)
 * REGRA ENSINO SECUNDÁRIO: Mantém lógica intacta
 */
export const listarDisciplinas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cursoId } = req.params;
    
    // Multi-tenant: Validar que usuário está autenticado e tem instituicaoId
    if (!req.user) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // Multi-tenant: Extrair instituicaoId do token JWT
    const instituicaoId = req.user.instituicaoId;
    if (!instituicaoId && !req.user.roles?.includes('SUPER_ADMIN')) {
      throw new AppError('Usuário sem instituição associada', 403);
    }

    const filter = addInstitutionFilter(req);

    // Validar que cursoId foi fornecido
    if (!cursoId) {
      throw new AppError('cursoId é obrigatório', 400);
    }

    // CRÍTICO MULTI-TENANT: Verificar se curso existe e pertence à instituição do usuário
    const curso = await prisma.curso.findFirst({
      where: { 
        id: cursoId, 
        ...filter 
      },
      select: {
        id: true,
        nome: true,
        instituicaoId: true,
      },
    });

    if (!curso) {
      throw new AppError('Curso não encontrado', 404);
    }

    // CRÍTICO MULTI-TENANT: Buscar vínculos filtrando através das relações
    // Garantir que tanto o curso quanto a disciplina pertencem à instituição do usuário
    // REGRA: CursoDisciplina é N:N entre Curso e Disciplina
    // Para Ensino Superior: não usar filtros de Turma/Classe/Ano (Disciplina é estrutural)
    
    // Construir filtro de instituição para relações
    const instituicaoFilter = filter.instituicaoId || instituicaoId;
    
    const whereClause: any = {
      cursoId,
    };
    
    // Aplicar filtro multi-tenant apenas se houver instituicaoId
    if (instituicaoFilter) {
      whereClause.curso = {
        instituicaoId: instituicaoFilter,
      };
      whereClause.disciplina = {
        instituicaoId: instituicaoFilter,
        // Para Ensino Superior: remover qualquer filtro de Turma/Classe/Ano
        // Disciplina é estrutural e não depende desses campos
      };
    }
    
    const vinculos = await prisma.cursoDisciplina.findMany({
      where: whereClause,
      include: {
        curso: {
          select: {
            id: true,
            nome: true,
            codigo: true,
          },
        },
        disciplina: {
          select: {
            id: true,
            nome: true,
            codigo: true,
            cargaHoraria: true,
            descricao: true,
            ativa: true,
            instituicaoId: true, // Incluir para validação
          },
        },
        preRequisitoDisciplina: {
          select: { id: true, nome: true, codigo: true },
        },
      },
      orderBy: {
        disciplina: {
          nome: 'asc',
        },
      },
    });

    // Validação adicional de segurança: garantir que todas as disciplinas retornadas
    // pertencem à instituição do usuário (proteção extra contra vazamento multi-tenant)
    const vinculosValidos = vinculos.filter((vinculo) => {
      if (!vinculo.disciplina) return false;
      if (instituicaoId && vinculo.disciplina.instituicaoId !== instituicaoId) {
        console.warn('[listarDisciplinas] ⚠️ Disciplina de outra instituição filtrada:', {
          disciplinaId: vinculo.disciplina.id,
          disciplinaInstituicaoId: vinculo.disciplina.instituicaoId,
          userInstituicaoId: instituicaoId,
        });
        return false;
      }
      return true;
    });

    res.json(vinculosValidos);
  } catch (error) {
    next(error);
  }
};

