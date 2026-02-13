/**
 * Controller - Mural da Disciplina (Professor ↔ Estudantes)
 */
import { Request, Response, NextFunction } from 'express';
import { DisciplinaAvisoService, CriarAvisoInput } from '../services/disciplinaAviso.service.js';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * POST /disciplinas/:id/avisos
 * Professor cria aviso na disciplina
 */
export const criar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const disciplinaId = req.params.id;
    if (!disciplinaId) {
      throw new AppError('ID da disciplina é obrigatório', 400);
    }

    const { titulo, conteudo, anexoUrl } = req.body as CriarAvisoInput;
    const aviso = await DisciplinaAvisoService.criar(req, disciplinaId, {
      titulo,
      conteudo,
      anexoUrl,
    });

    res.status(201).json(aviso);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /disciplinas/:id/avisos
 * Listar avisos da disciplina (professor ou aluno da turma)
 */
export const listar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const disciplinaId = req.params.id;
    if (!disciplinaId) {
      throw new AppError('ID da disciplina é obrigatório', 400);
    }

    const avisos = await DisciplinaAvisoService.listar(req, disciplinaId);
    res.json(avisos);
  } catch (error) {
    next(error);
  }
};
