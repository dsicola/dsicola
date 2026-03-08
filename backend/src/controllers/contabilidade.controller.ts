import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';
import { ContabilidadeService } from '../services/contabilidade.service.js';
import { ConfiguracaoContabilidadeService } from '../services/configuracao-contabilidade.service.js';
import { MotorLancamentosService, type EventoContabil } from '../services/motor-lancamentos.service.js';

// ========== PLANO DE CONTAS ==========

export const listPlanoContas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const incluirInativos = req.query.incluirInativos === 'true';
    const contas = await ContabilidadeService.listPlanoContas(instituicaoId, incluirInativos);
    res.json(contas);
  } catch (error) {
    next(error);
  }
};

export const getPlanoContaById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;
    const conta = await ContabilidadeService.getPlanoContaById(id, instituicaoId);
    res.json(conta);
  } catch (error) {
    next(error);
  }
};

export const createPlanoConta = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { codigo, descricao, tipo, contaPaiId, nivel } = req.body;

    if (!codigo?.trim()) throw new AppError('Código é obrigatório', 400);
    if (!descricao?.trim()) throw new AppError('Descrição é obrigatória', 400);
    if (!tipo) throw new AppError('Tipo é obrigatório', 400);

    const conta = await ContabilidadeService.createPlanoConta(instituicaoId, {
      codigo,
      descricao,
      tipo,
      contaPaiId: contaPaiId || null,
      nivel,
    });
    res.status(201).json(conta);
  } catch (error) {
    next(error);
  }
};

export const updatePlanoConta = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;
    const { codigo, descricao, tipo, contaPaiId, nivel, ativo } = req.body;

    const conta = await ContabilidadeService.updatePlanoConta(id, instituicaoId, {
      codigo,
      descricao,
      tipo,
      contaPaiId,
      nivel,
      ativo,
    });
    res.json(conta);
  } catch (error) {
    next(error);
  }
};

export const seedPlanoPadrao = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const tipoParam = req.query.tipo as 'ESCOLA' | 'SECUNDARIO' | 'SUPERIOR' | 'minimo' | undefined;
    const tipo = tipoParam === 'minimo' ? null : tipoParam;
    const result = await ContabilidadeService.seedPlanoPadrao(instituicaoId, tipo);
    res.json(result);
  } catch (error: any) {
    // Log para diagnóstico (produção e dev)
    console.error('[seedPlanoPadrao] Erro ao gerar plano de contas:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      instituicaoId: req.user?.instituicaoId,
    });
    next(error);
  }
};

export const deletePlanoConta = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;
    await ContabilidadeService.deletePlanoConta(id, instituicaoId);
    res.json({ message: 'Conta excluída' });
  } catch (error) {
    next(error);
  }
};

// ========== LANÇAMENTOS ==========

export const listLancamentos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { dataInicio, dataFim, fechado } = req.query;

    const filters: { dataInicio?: Date; dataFim?: Date; fechado?: boolean } = {};
    if (dataInicio) filters.dataInicio = new Date(dataInicio as string);
    if (dataFim) filters.dataFim = new Date(dataFim as string);
    if (fechado !== undefined) filters.fechado = fechado === 'true';

    const lancamentos = await ContabilidadeService.listLancamentos(instituicaoId, filters);
    res.json(lancamentos);
  } catch (error) {
    next(error);
  }
};

export const getLancamentoById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;
    const lanc = await ContabilidadeService.getLancamentoById(id, instituicaoId);
    res.json(lanc);
  } catch (error) {
    next(error);
  }
};

export const createLancamento = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { data, descricao, linhas } = req.body;

    if (!data) throw new AppError('Data é obrigatória', 400);
    if (!descricao?.trim()) throw new AppError('Descrição é obrigatória', 400);
    if (!Array.isArray(linhas) || linhas.length < 2) {
      throw new AppError('Lançamento deve ter pelo menos 2 linhas', 400);
    }

    const lanc = await ContabilidadeService.createLancamento(instituicaoId, {
      data: new Date(data),
      descricao,
      linhas: linhas.map((l: { contaId: string; descricao?: string; debito: number; credito: number; ordem?: number }) => ({
        contaId: l.contaId,
        descricao: l.descricao,
        debito: Number(l.debito) || 0,
        credito: Number(l.credito) || 0,
        ordem: l.ordem,
      })),
    });
    res.status(201).json(lanc);
  } catch (error) {
    next(error);
  }
};

export const updateLancamento = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;
    const { data, descricao, fechado, linhas } = req.body;

    const updateData: { data?: Date; descricao?: string; fechado?: boolean; linhas?: Array<{ contaId: string; descricao?: string; debito: number; credito: number; ordem?: number }> } = {};
    if (data !== undefined) updateData.data = new Date(data);
    if (descricao !== undefined) updateData.descricao = descricao;
    if (fechado !== undefined) updateData.fechado = fechado;
    if (Array.isArray(linhas)) {
      updateData.linhas = linhas.map((l: { contaId: string; descricao?: string; debito: number; credito: number; ordem?: number }) => ({
        contaId: l.contaId,
        descricao: l.descricao,
        debito: Number(l.debito) || 0,
        credito: Number(l.credito) || 0,
        ordem: l.ordem,
      }));
    }

    const lanc = await ContabilidadeService.updateLancamento(id, instituicaoId, updateData);
    res.json(lanc);
  } catch (error) {
    next(error);
  }
};

export const fecharLancamento = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;
    const lanc = await ContabilidadeService.fecharLancamento(id, instituicaoId);
    res.json(lanc);
  } catch (error) {
    next(error);
  }
};

export const deleteLancamento = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;
    await ContabilidadeService.deleteLancamento(id, instituicaoId);
    res.json({ message: 'Lançamento excluído' });
  } catch (error) {
    next(error);
  }
};

// ========== BALANCETE ==========

export const getBalancete = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { dataInicio, dataFim } = req.query;

    if (!dataInicio || !dataFim) {
      throw new AppError('dataInicio e dataFim são obrigatórios', 400);
    }

    const balancete = await ContabilidadeService.getBalancete(
      instituicaoId,
      new Date(dataInicio as string),
      new Date(dataFim as string)
    );
    res.json(balancete);
  } catch (error) {
    next(error);
  }
};

// ========== DASHBOARD CONTÁBIL ==========

export const getDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const dashboard = await ContabilidadeService.getDashboard(instituicaoId);
    res.json(dashboard);
  } catch (error) {
    next(error);
  }
};

// ========== LIVRO DIÁRIO ==========

export const getDiario = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { dataInicio, dataFim } = req.query;

    if (!dataInicio || !dataFim) {
      throw new AppError('dataInicio e dataFim são obrigatórios', 400);
    }

    const diario = await ContabilidadeService.getDiario(
      instituicaoId,
      new Date(dataInicio as string),
      new Date(dataFim as string)
    );
    res.json(diario);
  } catch (error) {
    next(error);
  }
};

// ========== BALANÇO PATRIMONIAL ==========

export const getBalanco = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { dataFim, dataInicio } = req.query;

    if (!dataFim) {
      throw new AppError('dataFim é obrigatório', 400);
    }

    const dataInicioOpt = dataInicio ? new Date(dataInicio as string) : undefined;
    const balanco = await ContabilidadeService.getBalanco(
      instituicaoId,
      new Date(dataFim as string),
      dataInicioOpt
    );
    res.json(balanco);
  } catch (error) {
    next(error);
  }
};

// ========== DRE (Demonstração de Resultados) ==========

export const getDRE = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { dataInicio, dataFim } = req.query;

    if (!dataInicio || !dataFim) {
      throw new AppError('dataInicio e dataFim são obrigatórios', 400);
    }

    const dre = await ContabilidadeService.getDRE(
      instituicaoId,
      new Date(dataInicio as string),
      new Date(dataFim as string)
    );
    res.json(dre);
  } catch (error) {
    next(error);
  }
};

// ========== FECHO DE EXERCÍCIO ==========

export const listFechosExercicio = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const fechos = await ContabilidadeService.listFechosExercicio(instituicaoId);
    res.json(fechos);
  } catch (error) {
    next(error);
  }
};

export const getBloqueioPeriodo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const dataFim = await ContabilidadeService.getDataFimBloqueio(instituicaoId);
    res.json({ dataFimBloqueio: dataFim });
  } catch (error) {
    next(error);
  }
};

export const fecharExercicio = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const ano = parseInt(String(req.body.ano ?? req.query.ano), 10);
    if (isNaN(ano) || ano < 2000 || ano > 2100) {
      throw new AppError('Ano inválido', 400);
    }
    const userId = req.user?.userId;
    const result = await ContabilidadeService.fecharExercicio(instituicaoId, ano, userId);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

// ========== MOTOR AUTOMÁTICO DE LANÇAMENTOS (REGRAS CONTÁBEIS) ==========

export const listRegrasContabeis = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const regras = await MotorLancamentosService.listarRegras(instituicaoId);
    const eventos = MotorLancamentosService.getEventosDisponiveis();
    res.json({ regras, eventos });
  } catch (error) {
    next(error);
  }
};

const EVENTOS_VALIDOS: EventoContabil[] = [
  'pagamento_propina', 'estorno_propina', 'pagamento_matricula', 'estorno_matricula',
  'pagamento_salario', 'estorno_salario', 'pagamento_fornecedor', 'compra_material',
];

export const upsertRegraContabil = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { evento, contaDebitoCodigo, contaCreditoCodigo, ativo } = req.body;
    if (!evento || !contaDebitoCodigo?.trim() || !contaCreditoCodigo?.trim()) {
      throw new AppError('evento, contaDebitoCodigo e contaCreditoCodigo são obrigatórios', 400);
    }
    if (!EVENTOS_VALIDOS.includes(evento)) {
      throw new AppError(`evento inválido. Use: ${EVENTOS_VALIDOS.join(', ')}`, 400);
    }
    const regra = await MotorLancamentosService.upsertRegra(instituicaoId, evento as EventoContabil, {
      contaDebitoCodigo,
      contaCreditoCodigo,
      ativo,
    });
    res.json(regra);
  } catch (error) {
    next(error);
  }
};

export const getEventosContabeis = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const eventos = MotorLancamentosService.getEventosDisponiveis();
    res.json(eventos);
  } catch (error) {
    next(error);
  }
};

// ========== CONFIGURAÇÃO DE CONTAS ==========

export const getConfiguracaoContabilidade = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const config = await ConfiguracaoContabilidadeService.get(instituicaoId);
    res.json(config);
  } catch (error) {
    next(error);
  }
};

export const updateConfiguracaoContabilidade = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const {
      contaCaixaCodigo,
      contaBancoCodigo,
      contaReceitaMensalidadesCodigo,
      contaReceitaTaxasCodigo,
      contaPessoalCodigo,
      contaFornecedoresCodigo,
    } = req.body;

    const config = await ConfiguracaoContabilidadeService.update(instituicaoId, {
      contaCaixaCodigo,
      contaBancoCodigo,
      contaReceitaMensalidadesCodigo,
      contaReceitaTaxasCodigo,
      contaPessoalCodigo,
      contaFornecedoresCodigo,
    });
    res.json(config);
  } catch (error) {
    next(error);
  }
};

// ========== CENTROS DE CUSTO ==========

export const listCentrosCusto = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const incluirInativos = req.query.incluirInativos === 'true';
    const centros = await ContabilidadeService.listCentrosCusto(instituicaoId, incluirInativos);
    res.json(centros);
  } catch (error) {
    next(error);
  }
};

export const createCentroCusto = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { codigo, descricao } = req.body;
    if (!codigo?.trim()) throw new AppError('Código é obrigatório', 400);
    if (!descricao?.trim()) throw new AppError('Descrição é obrigatória', 400);
    const centro = await ContabilidadeService.createCentroCusto(instituicaoId, { codigo, descricao });
    res.status(201).json(centro);
  } catch (error) {
    next(error);
  }
};

export const updateCentroCusto = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;
    const { codigo, descricao, ativo } = req.body;
    const centro = await ContabilidadeService.updateCentroCusto(id, instituicaoId, {
      codigo,
      descricao,
      ativo,
    });
    res.json(centro);
  } catch (error) {
    next(error);
  }
};

export const deleteCentroCusto = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { id } = req.params;
    await ContabilidadeService.deleteCentroCusto(id, instituicaoId);
    res.json({ message: 'Centro de custo excluído' });
  } catch (error) {
    next(error);
  }
};

// ========== IMPORTAR LANÇAMENTOS (CSV) ==========

export const importarLancamentos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { linhas } = req.body;

    if (!Array.isArray(linhas) || linhas.length === 0) {
      throw new AppError('Envie um array de linhas com: data, contaCodigo, descricao, debito, credito', 400);
    }

    const resultado = await ContabilidadeService.importarLancamentosCSV(instituicaoId, linhas);
    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
};

// ========== LIVRO RAZÃO (por conta) ==========

export const getRazao = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { contaId } = req.params;
    const { dataInicio, dataFim } = req.query;

    if (!contaId) throw new AppError('contaId é obrigatório', 400);
    if (!dataInicio || !dataFim) {
      throw new AppError('dataInicio e dataFim são obrigatórios', 400);
    }

    const razao = await ContabilidadeService.getRazao(
      instituicaoId,
      contaId,
      new Date(dataInicio as string),
      new Date(dataFim as string)
    );
    res.json(razao);
  } catch (error) {
    next(error);
  }
};
