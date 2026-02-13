import { Request, Response, NextFunction } from 'express';
import { PontoRelatorioService } from '../services/pontoRelatorio.service.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';

/**
 * Gerar relatório de ponto diário
 */
export const gerarRelatorioDiario = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data } = req.body;

    if (!data) {
      throw new AppError('Data é obrigatória', 400);
    }

    const resultado = await PontoRelatorioService.gerarRelatorio(req, {
      tipo: 'DIARIO',
      data: new Date(data),
    });

    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
};

/**
 * Gerar relatório de ponto mensal
 */
export const gerarRelatorioMensal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mes, ano } = req.body;

    if (!mes || !ano) {
      throw new AppError('Mês e ano são obrigatórios', 400);
    }

    const resultado = await PontoRelatorioService.gerarRelatorio(req, {
      tipo: 'MENSAL',
      mes: Number(mes),
      ano: Number(ano),
    });

    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
};

/**
 * Gerar relatório de ponto individual
 */
export const gerarRelatorioIndividual = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { funcionarioId, dataInicio, dataFim } = req.body;

    if (!funcionarioId || !dataInicio || !dataFim) {
      throw new AppError('Funcionário, data início e data fim são obrigatórios', 400);
    }

    const resultado = await PontoRelatorioService.gerarRelatorio(req, {
      tipo: 'INDIVIDUAL',
      funcionarioId,
      dataInicio: new Date(dataInicio),
      dataFim: new Date(dataFim),
    });

    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
};

/**
 * Verificar integridade do relatório
 */
export const verificarIntegridade = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const instituicaoId = requireTenantScope(req);

    const integro = await PontoRelatorioService.verificarIntegridade(id, instituicaoId);

    res.json({
      integro,
      mensagem: integro
        ? 'Relatório íntegro - não foi alterado'
        : 'Relatório alterado ou não encontrado',
    });
  } catch (error) {
    next(error);
  }
};

