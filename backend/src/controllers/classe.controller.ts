import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter } from '../middlewares/auth.js';

/**
 * GET /classes
 * Lista todas as classes da instituição (apenas Ensino Secundário)
 */
export const getClasses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);

    // Verificar tipo acadêmico da instituição
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;
    
    // VALIDAÇÃO: Classes só são permitidas no Ensino Secundário
    if (tipoAcademico === 'SUPERIOR') {
      // Para Ensino Superior, retornar array vazio (não deve usar classes)
      return res.json([]);
    }

    const where: any = { ...filter };

    const classes = await prisma.classe.findMany({
      where,
      include: {
        instituicao: { select: { id: true, nome: true } },
        _count: { select: { turmas: true } }
      },
      orderBy: { nome: 'asc' }
    });

    res.json(classes);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /classes/:id
 * Obtém uma classe específica
 */
export const getClasseById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    // Verificar tipo acadêmico da instituição
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;
    
    // VALIDAÇÃO: Classes só são permitidas no Ensino Secundário
    if (tipoAcademico === 'SUPERIOR') {
      throw new AppError('Classes não são permitidas no Ensino Superior', 403);
    }

    const classe = await prisma.classe.findFirst({
      where: { id, ...filter },
      include: {
        instituicao: true,
        turmas: true
      }
    });

    if (!classe) {
      throw new AppError('Classe não encontrada', 404);
    }

    res.json(classe);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /classes
 * Cria uma nova classe (apenas Ensino Secundário)
 */
export const createClasse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // VALIDAÇÃO MULTI-TENANT: Rejeitar explicitamente instituicaoId do body (segurança)
    if (req.body.instituicaoId !== undefined || req.body.instituicao_id !== undefined) {
      throw new AppError('Não é permitido alterar a instituição. O sistema usa a instituição do usuário autenticado.', 400);
    }

    // Multi-tenant: SEMPRE usar instituicaoId do usuário autenticado, nunca do body
    if (!req.user?.instituicaoId) {
      throw new AppError('Usuário não possui instituição vinculada', 400);
    }

    const { nome, codigo, cargaHoraria, valorMensalidade, taxaMatricula, descricao } = req.body;

    // Validar campos obrigatórios
    if (!nome || !codigo) {
      throw new AppError('Nome e código são obrigatórios', 400);
    }

    // Verificar tipo acadêmico da instituição
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;
    
    // VALIDAÇÃO: Classes só são permitidas no Ensino Secundário
    if (tipoAcademico === 'SUPERIOR') {
      throw new AppError('Classes não são permitidas no Ensino Superior. Use Cursos.', 400);
    }
    
    // VALIDAÇÃO: Ensino Secundário - valorMensalidade é OBRIGATÓRIO e deve ser > 0
    if (!valorMensalidade || Number(valorMensalidade) <= 0) {
      throw new AppError('Valor da mensalidade é obrigatório e deve ser maior que zero', 400);
    }

    // Verificar se já existe classe com mesmo código na instituição
    const existing = await prisma.classe.findFirst({
      where: {
        codigo,
        instituicaoId: req.user.instituicaoId
      }
    });

    if (existing) {
      throw new AppError('Já existe uma classe com este código', 409);
    }

    const classeData: any = {
      nome,
      codigo,
      instituicaoId: req.user.instituicaoId,
      ativo: true,
      cargaHoraria: cargaHoraria ? Number(cargaHoraria) : 0,
      valorMensalidade: valorMensalidade ? Number(valorMensalidade) : 0,
    };

    if (taxaMatricula !== undefined && taxaMatricula !== null && taxaMatricula !== '') {
      const val = Number(taxaMatricula);
      classeData.taxaMatricula = val >= 0 ? val : 0;
    }

    // Adicionar campos opcionais apenas se definidos
    if (descricao !== undefined && descricao !== null && descricao !== '') {
      classeData.descricao = descricao;
    }

    const classe = await prisma.classe.create({
      data: classeData
    });

    res.status(201).json(classe);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /classes/:id
 * Atualiza uma classe existente
 */
export const updateClasse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const existing = await prisma.classe.findFirst({
      where: { id, ...filter }
    });

    if (!existing) {
      throw new AppError('Classe não encontrada', 404);
    }

    // Verificar tipo acadêmico da instituição
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;
    
    // VALIDAÇÃO: Classes só são permitidas no Ensino Secundário
    if (tipoAcademico === 'SUPERIOR') {
      throw new AppError('Classes não são permitidas no Ensino Superior', 400);
    }

    const { nome, codigo, cargaHoraria, valorMensalidade, taxaMatricula, descricao, ativo } = req.body;

    // VALIDAÇÃO: Ensino Secundário - valorMensalidade é OBRIGATÓRIO e deve ser > 0
    if (valorMensalidade !== undefined && (!valorMensalidade || Number(valorMensalidade) <= 0)) {
      throw new AppError('Valor da mensalidade é obrigatório e deve ser maior que zero', 400);
    }

    // Verificar se código já existe em outra classe
    if (codigo && codigo !== existing.codigo) {
      const codigoExists = await prisma.classe.findFirst({
        where: {
          codigo,
          instituicaoId: req.user?.instituicaoId,
          id: { not: id }
        }
      });

      if (codigoExists) {
        throw new AppError('Já existe uma classe com este código', 409);
      }
    }

    // Preparar dados apenas com campos definidos (sem undefined)
    const updateData: any = {};

    if (nome !== undefined) updateData.nome = nome;
    if (codigo !== undefined) updateData.codigo = codigo;
    if (cargaHoraria !== undefined) updateData.cargaHoraria = Number(cargaHoraria);
    if (valorMensalidade !== undefined) updateData.valorMensalidade = Number(valorMensalidade);
    if (taxaMatricula !== undefined) updateData.taxaMatricula = taxaMatricula === null || taxaMatricula === '' ? null : Math.max(0, Number(taxaMatricula));
    if (descricao !== undefined) updateData.descricao = descricao || null;
    if (ativo !== undefined) updateData.ativo = ativo;

    const classe = await prisma.classe.update({
      where: { id },
      data: updateData
    });

    res.json(classe);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /classes/:id
 * Remove uma classe (soft delete - marca como inativa)
 */
export const deleteClasse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const existing = await prisma.classe.findFirst({
      where: { id, ...filter },
      include: {
        _count: {
          select: {
            turmas: true,
            mensalidades: true
          }
        }
      }
    });

    if (!existing) {
      throw new AppError('Classe não encontrada', 404);
    }

    // Verificar tipo acadêmico da instituição
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;
    
    // VALIDAÇÃO: Classes só são permitidas no Ensino Secundário
    if (tipoAcademico === 'SUPERIOR') {
      throw new AppError('Classes não são permitidas no Ensino Superior', 400);
    }

    // Verificar se há relacionamentos
    if (existing._count.turmas > 0 || existing._count.mensalidades > 0) {
      // Soft delete - marcar como inativa
      await prisma.classe.update({
        where: { id },
        data: { ativo: false }
      });
    } else {
      // Hard delete se não há relacionamentos
      await prisma.classe.delete({
        where: { id }
      });
    }

    res.json({ message: 'Classe removida com sucesso' });
  } catch (error) {
    next(error);
  }
};

