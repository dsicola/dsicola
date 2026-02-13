import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { AuditService } from './audit.service.js';

export interface CreateContratoFornecedorData {
  fornecedorId: string;
  tipoContrato: 'MENSAL' | 'ANUAL' | 'EVENTUAL';
  valor: number;
  dataInicio: Date;
  dataFim?: Date;
  observacoes?: string;
}

export interface UpdateContratoFornecedorData extends Partial<CreateContratoFornecedorData> {
  status?: 'ATIVO' | 'ENCERRADO' | 'SUSPENSO';
}

export class ContratoFornecedorService {
  /**
   * Criar novo contrato com fornecedor
   */
  static async create(
    instituicaoId: string,
    data: CreateContratoFornecedorData,
    userId?: string
  ) {
    // Validar que fornecedor existe e pertence à instituição
    const fornecedor = await prisma.fornecedor.findFirst({
      where: {
        id: data.fornecedorId,
        instituicaoId,
      },
    });

    if (!fornecedor) {
      throw new AppError('Fornecedor não encontrado ou acesso negado', 404);
    }

    // Validar que fornecedor está ativo
    if (fornecedor.status !== 'ATIVO') {
      throw new AppError('Apenas fornecedores ativos podem ter contratos', 400);
    }

    // Validar valor
    if (!data.valor || data.valor <= 0) {
      throw new AppError('Valor do contrato deve ser maior que zero', 400);
    }

    // Validar datas
    if (data.dataFim && data.dataFim <= data.dataInicio) {
      throw new AppError('Data de fim deve ser posterior à data de início', 400);
    }

    // Criar contrato
    const contrato = await prisma.contratoFornecedor.create({
      data: {
        instituicaoId,
        fornecedorId: data.fornecedorId,
        tipoContrato: data.tipoContrato,
        valor: data.valor,
        dataInicio: data.dataInicio,
        dataFim: data.dataFim || null,
        status: 'ATIVO',
        observacoes: data.observacoes?.trim() || null,
        criadoPor: userId || null,
      },
      include: {
        instituicao: {
          select: {
            id: true,
            nome: true,
          },
        },
        fornecedor: {
          select: {
            id: true,
            razaoSocial: true,
            tipoServico: true,
          },
        },
      },
    });

    // Auditoria
    try {
      await AuditService.log(null, {
        modulo: 'FINANCEIRO',
        acao: 'CREATE',
        entidade: 'CONTRATO_FORNECEDOR',
        entidadeId: contrato.id,
        instituicaoId,
        dadosNovos: {
          fornecedor_id: contrato.fornecedorId,
          tipo_contrato: contrato.tipoContrato,
          valor: contrato.valor.toString(),
          data_inicio: contrato.dataInicio.toISOString(),
        },
        observacao: `Contrato criado com fornecedor: ${contrato.fornecedor.razaoSocial}`,
      });
    } catch (auditError) {
      console.warn('[ContratoFornecedorService] Erro ao registrar auditoria:', auditError);
    }

    return contrato;
  }

  /**
   * Atualizar contrato
   */
  static async update(
    id: string,
    instituicaoId: string,
    data: UpdateContratoFornecedorData,
    userId?: string
  ) {
    // Verificar se contrato existe e pertence à instituição
    const contratoExistente = await prisma.contratoFornecedor.findFirst({
      where: {
        id,
        instituicaoId,
      },
    });

    if (!contratoExistente) {
      throw new AppError('Contrato não encontrado ou acesso negado', 404);
    }

    // Preparar dados para atualização
    const updateData: any = {};
    if (data.tipoContrato !== undefined) updateData.tipoContrato = data.tipoContrato;
    if (data.valor !== undefined) {
      if (data.valor <= 0) {
        throw new AppError('Valor do contrato deve ser maior que zero', 400);
      }
      updateData.valor = data.valor;
    }
    if (data.dataInicio !== undefined) updateData.dataInicio = data.dataInicio;
    if (data.dataFim !== undefined) {
      if (data.dataFim && data.dataInicio && data.dataFim <= data.dataInicio) {
        throw new AppError('Data de fim deve ser posterior à data de início', 400);
      }
      updateData.dataFim = data.dataFim || null;
    }
    if (data.status !== undefined) updateData.status = data.status;
    if (data.observacoes !== undefined) updateData.observacoes = data.observacoes?.trim() || null;

    // Atualizar
    const contrato = await prisma.contratoFornecedor.update({
      where: { id },
      data: updateData,
      include: {
        instituicao: {
          select: {
            id: true,
            nome: true,
          },
        },
        fornecedor: {
          select: {
            id: true,
            razaoSocial: true,
            tipoServico: true,
          },
        },
      },
    });

    // Auditoria
    try {
      await AuditService.log(null, {
        modulo: 'FINANCEIRO',
        acao: 'UPDATE',
        entidade: 'CONTRATO_FORNECEDOR',
        entidadeId: contrato.id,
        instituicaoId,
        dadosAnteriores: {
          status: contratoExistente.status,
          valor: contratoExistente.valor.toString(),
        },
        dadosNovos: {
          status: contrato.status,
          valor: contrato.valor.toString(),
        },
        observacao: `Contrato atualizado: ${contrato.fornecedor.razaoSocial}`,
      });
    } catch (auditError) {
      console.warn('[ContratoFornecedorService] Erro ao registrar auditoria:', auditError);
    }

    return contrato;
  }

  /**
   * Listar contratos
   */
  static async list(instituicaoId: string, filters?: {
    fornecedorId?: string;
    status?: 'ATIVO' | 'ENCERRADO' | 'SUSPENSO';
    tipoContrato?: 'MENSAL' | 'ANUAL' | 'EVENTUAL';
  }) {
    const where: any = {
      instituicaoId,
    };

    if (filters?.fornecedorId) {
      where.fornecedorId = filters.fornecedorId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.tipoContrato) {
      where.tipoContrato = filters.tipoContrato;
    }

    const contratos = await prisma.contratoFornecedor.findMany({
      where,
      include: {
        instituicao: {
          select: {
            id: true,
            nome: true,
          },
        },
        fornecedor: {
          select: {
            id: true,
            razaoSocial: true,
            tipoServico: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return contratos;
  }

  /**
   * Obter contrato por ID
   */
  static async getById(id: string, instituicaoId: string) {
    const contrato = await prisma.contratoFornecedor.findFirst({
      where: {
        id,
        instituicaoId,
      },
      include: {
        instituicao: {
          select: {
            id: true,
            nome: true,
          },
        },
        fornecedor: {
          select: {
            id: true,
            razaoSocial: true,
            tipoServico: true,
            nif: true,
            email: true,
            telefone: true,
          },
        },
        pagamentos: {
          orderBy: {
            dataPagamento: 'desc',
          },
        },
      },
    });

    if (!contrato) {
      throw new AppError('Contrato não encontrado ou acesso negado', 404);
    }

    return contrato;
  }
}

