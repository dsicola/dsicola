import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from './errorHandler.js';
import { addInstitutionFilter } from './auth.js';

/**
 * Tipos de entidades que suportam estado
 */
export type EntidadeComEstado = 'Semestre' | 'PlanoEnsino' | 'Avaliacao';

/**
 * Estados que bloqueiam edição
 * REGRA SIGA/SIGAE: Planos APROVADOS são imutáveis (fonte da verdade acadêmica)
 * REGRA SIGA/SIGAE: Planos ENCERRADOS são imutáveis (histórico preservado)
 */
const ESTADOS_BLOQUEADOS = ['APROVADO', 'ENCERRADO'] as const;

/**
 * Mensagens padronizadas de erro
 */
export const MENSAGEM_ESTADO_APROVADO = 'Este Plano de Ensino está APROVADO e é imutável. Para alterar regras acadêmicas, crie uma nova versão do plano.';
export const MENSAGEM_ESTADO_ENCERRADO = 'Este registro está encerrado. Alterações não são permitidas.';

/**
 * Verificar se estado permite edição
 * REGRA SIGA/SIGAE: APROVADO e ENCERRADO bloqueiam edição
 */
export const estadoPermiteEdicao = (estado: string | null | undefined): boolean => {
  if (!estado) return true; // Se não tiver estado, permite (compatibilidade)
  return !ESTADOS_BLOQUEADOS.includes(estado as any);
};

/**
 * Obter mensagem de erro apropriada para o estado
 */
export const obterMensagemErroEstado = (estado: string | null | undefined): string => {
  if (estado === 'APROVADO') {
    return MENSAGEM_ESTADO_APROVADO;
  }
  if (estado === 'ENCERRADO') {
    return MENSAGEM_ESTADO_ENCERRADO;
  }
  return 'Este registro não pode ser editado no estado atual.';
};

/**
 * Obter entidade e seu estado
 */
const obterEstadoEntidade = async (
  tipo: EntidadeComEstado,
  id: string,
  filter: any
): Promise<{ estado: string | null; entidade: any } | null> => {
  switch (tipo) {
    case 'Semestre': {
      const semestre = await prisma.semestre.findFirst({
        where: { id, ...filter },
        select: { id: true, estado: true },
      });
      return semestre ? { estado: semestre.estado, entidade: semestre } : null;
    }
    case 'PlanoEnsino': {
      const plano = await prisma.planoEnsino.findFirst({
        where: { id, ...filter },
        select: { id: true, estado: true },
      });
      return plano ? { estado: plano.estado, entidade: plano } : null;
    }
    case 'Avaliacao': {
      const avaliacao = await prisma.avaliacao.findFirst({
        where: { id, ...filter },
        select: { id: true, estado: true },
      });
      return avaliacao ? { estado: avaliacao.estado, entidade: avaliacao } : null;
    }
    default:
      return null;
  }
};

/**
 * Middleware para bloquear UPDATE quando estado = ENCERRADO
 */
export const bloquearEdicaoSeEncerrado = (tipo: EntidadeComEstado) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const filter = addInstitutionFilter(req);

      if (!id) {
        return next(); // Se não tiver ID, deixar passar (pode ser create)
      }

      const resultado = await obterEstadoEntidade(tipo, id, filter);

      if (!resultado) {
        throw new AppError(`${tipo} não encontrado ou não pertence à sua instituição`, 404);
      }

      const { estado } = resultado;

      if (!estadoPermiteEdicao(estado)) {
        throw new AppError(obterMensagemErroEstado(estado), 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware para bloquear DELETE quando estado = ENCERRADO
 */
export const bloquearExclusaoSeEncerrado = (tipo: EntidadeComEstado) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const filter = addInstitutionFilter(req);

      if (!id) {
        return next();
      }

      const resultado = await obterEstadoEntidade(tipo, id, filter);

      if (!resultado) {
        throw new AppError(`${tipo} não encontrado ou não pertence à sua instituição`, 404);
      }

      const { estado } = resultado;

      if (!estadoPermiteEdicao(estado)) {
        throw new AppError(obterMensagemErroEstado(estado), 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Helper para validar estado antes de operações
 */
export const validarEstadoParaEdicao = async (
  tipo: EntidadeComEstado,
  id: string,
  filter: any
): Promise<void> => {
  const resultado = await obterEstadoEntidade(tipo, id, filter);

  if (!resultado) {
    throw new AppError(`${tipo} não encontrado`, 404);
  }

  if (!estadoPermiteEdicao(resultado.estado)) {
    throw new AppError(obterMensagemErroEstado(resultado.estado), 403);
  }
};

