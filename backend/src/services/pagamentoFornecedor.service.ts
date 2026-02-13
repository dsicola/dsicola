import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { AuditService } from './audit.service.js';

export interface CreatePagamentoFornecedorData {
  fornecedorId: string;
  contratoId?: string;
  valor: number;
  dataPagamento: Date;
  metodo: 'TRANSFERENCIA' | 'CASH' | 'CHEQUE' | 'MOBILE_MONEY' | 'OUTRO';
  referencia?: string;
  observacoes?: string;
}

export interface UpdatePagamentoFornecedorData extends Partial<CreatePagamentoFornecedorData> {
  status?: 'PENDENTE' | 'PAGO' | 'CANCELADO';
}

export class PagamentoFornecedorService {
  /**
   * Criar novo pagamento para fornecedor
   * CRÍTICO: Apenas ADMIN pode criar pagamentos
   */
  static async create(
    instituicaoId: string,
    data: CreatePagamentoFornecedorData,
    userId?: string,
    autorizadoPor?: string // ADMIN que autoriza
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
      throw new AppError('Apenas fornecedores ativos podem receber pagamentos', 400);
    }

    // VALIDAÇÃO CRÍTICA: Bloquear pagamento se fornecedor for funcionário
    // Fornecedor = Pessoa Jurídica, Funcionário = Pessoa Física
    // NUNCA permitir pagamento de fornecedor em folha salarial
    const funcionarioComMesmoNif = await prisma.funcionario.findFirst({
      where: {
        instituicaoId,
        numeroIdentificacao: fornecedor.nif || '',
      },
    });

    if (funcionarioComMesmoNif) {
      throw new AppError(
        'Não é permitido pagar fornecedor que é funcionário. Fornecedor = Pessoa Jurídica, Funcionário = Pessoa Física. Use folha de pagamento para funcionários.',
        400
      );
    }

    // Se tiver contrato, validar
    let contrato = null;
    if (data.contratoId) {
      contrato = await prisma.contratoFornecedor.findFirst({
        where: {
          id: data.contratoId,
          instituicaoId,
          fornecedorId: data.fornecedorId,
        },
      });

      if (!contrato) {
        throw new AppError('Contrato não encontrado ou não pertence ao fornecedor', 404);
      }

      // Validar que contrato está ativo
      if (contrato.status !== 'ATIVO') {
        throw new AppError('Apenas contratos ativos podem ter pagamentos', 400);
      }

      // Validar que data de pagamento está dentro do período do contrato
      if (data.dataPagamento < contrato.dataInicio) {
        throw new AppError('Data de pagamento não pode ser anterior à data de início do contrato', 400);
      }

      if (contrato.dataFim && data.dataPagamento > contrato.dataFim) {
        throw new AppError('Data de pagamento não pode ser posterior à data de fim do contrato', 400);
      }
    } else {
      // VALIDAÇÃO: Se não tiver contrato, alertar mas permitir (pagamento eventual)
      // Em sistemas SIGA/SIGAE, é recomendado ter contrato, mas não é obrigatório para pagamentos eventuais
      console.warn(`[PagamentoFornecedorService] Pagamento criado sem contrato para fornecedor ${data.fornecedorId}. Recomenda-se criar contrato para rastreabilidade.`);
    }

    // Validar valor
    if (!data.valor || data.valor <= 0) {
      throw new AppError('Valor do pagamento deve ser maior que zero', 400);
    }

    // Validar data de pagamento não é futura demais (máximo 1 ano)
    const umAnoAFrente = new Date();
    umAnoAFrente.setFullYear(umAnoAFrente.getFullYear() + 1);
    if (data.dataPagamento > umAnoAFrente) {
      throw new AppError('Data de pagamento não pode ser mais de 1 ano no futuro', 400);
    }

    // Criar pagamento
    const pagamento = await prisma.pagamentoFornecedor.create({
      data: {
        instituicaoId,
        fornecedorId: data.fornecedorId,
        contratoId: data.contratoId || null,
        valor: data.valor,
        dataPagamento: data.dataPagamento,
        metodo: data.metodo,
        status: 'PENDENTE', // Inicia como pendente, precisa ser autorizado
        referencia: data.referencia?.trim() || null,
        observacoes: data.observacoes?.trim() || null,
        criadoPor: userId || null,
        autorizadoPor: autorizadoPor || null, // ADMIN que autoriza
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
        contrato: {
          select: {
            id: true,
            tipoContrato: true,
            valor: true,
          },
        },
      },
    });

    // Auditoria
    try {
      await AuditService.log(null, {
        modulo: 'FINANCEIRO',
        acao: 'CREATE',
        entidade: 'PAGAMENTO_FORNECEDOR',
        entidadeId: pagamento.id,
        instituicaoId,
        dadosNovos: {
          fornecedor_id: pagamento.fornecedorId,
          contrato_id: pagamento.contratoId,
          valor: pagamento.valor.toString(),
          metodo: pagamento.metodo,
          status: pagamento.status,
        },
        observacao: `Pagamento criado para fornecedor: ${pagamento.fornecedor.razaoSocial}`,
      });
    } catch (auditError) {
      console.warn('[PagamentoFornecedorService] Erro ao registrar auditoria:', auditError);
    }

    return pagamento;
  }

  /**
   * Autorizar e executar pagamento
   * CRÍTICO: Apenas ADMIN pode autorizar pagamentos
   */
  static async autorizarEPagar(
    id: string,
    instituicaoId: string,
    userId: string // ADMIN que autoriza
  ) {
    // Verificar se pagamento existe e pertence à instituição
    const pagamento = await prisma.pagamentoFornecedor.findFirst({
      where: {
        id,
        instituicaoId,
      },
      include: {
        fornecedor: {
          select: {
            id: true,
            razaoSocial: true,
            status: true,
          },
        },
        contrato: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!pagamento) {
      throw new AppError('Pagamento não encontrado ou acesso negado', 404);
    }

    // Validar que pagamento está pendente
    if (pagamento.status !== 'PENDENTE') {
      throw new AppError(`Pagamento já foi ${pagamento.status === 'PAGO' ? 'pago' : 'cancelado'}`, 400);
    }

    // Validar que fornecedor ainda está ativo
    if (pagamento.fornecedor.status !== 'ATIVO') {
      throw new AppError('Não é possível pagar fornecedor inativo', 400);
    }

    // Se tiver contrato, validar que está ativo
    if (pagamento.contratoId && pagamento.contrato?.status !== 'ATIVO') {
      throw new AppError('Não é possível pagar contrato inativo', 400);
    }

    // Atualizar pagamento para PAGO
    const pagamentoAtualizado = await prisma.pagamentoFornecedor.update({
      where: { id },
      data: {
        status: 'PAGO',
        autorizadoPor: userId,
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
        contrato: {
          select: {
            id: true,
            tipoContrato: true,
            valor: true,
          },
        },
      },
    });

    // Auditoria
    try {
      await AuditService.log(null, {
        modulo: 'FINANCEIRO',
        acao: 'PAY',
        entidade: 'PAGAMENTO_FORNECEDOR',
        entidadeId: pagamentoAtualizado.id,
        instituicaoId,
        dadosAnteriores: {
          status: 'PENDENTE',
        },
        dadosNovos: {
          status: 'PAGO',
          autorizado_por: userId,
        },
        observacao: `Pagamento autorizado e executado para fornecedor: ${pagamentoAtualizado.fornecedor.razaoSocial}`,
      });
    } catch (auditError) {
      console.warn('[PagamentoFornecedorService] Erro ao registrar auditoria:', auditError);
    }

    return pagamentoAtualizado;
  }

  /**
   * Cancelar pagamento
   * CRÍTICO: Apenas ADMIN pode cancelar
   */
  static async cancelar(
    id: string,
    instituicaoId: string,
    userId: string,
    motivo?: string
  ) {
    const pagamento = await prisma.pagamentoFornecedor.findFirst({
      where: {
        id,
        instituicaoId,
      },
    });

    if (!pagamento) {
      throw new AppError('Pagamento não encontrado ou acesso negado', 404);
    }

    // Só pode cancelar se estiver pendente
    if (pagamento.status !== 'PENDENTE') {
      throw new AppError('Apenas pagamentos pendentes podem ser cancelados', 400);
    }

    const pagamentoCancelado = await prisma.pagamentoFornecedor.update({
      where: { id },
      data: {
        status: 'CANCELADO',
      },
    });

    // Auditoria
    try {
      await AuditService.log(null, {
        modulo: 'FINANCEIRO',
        acao: 'CANCEL',
        entidade: 'PAGAMENTO_FORNECEDOR',
        entidadeId: pagamentoCancelado.id,
        instituicaoId,
        dadosAnteriores: {
          status: 'PENDENTE',
        },
        dadosNovos: {
          status: 'CANCELADO',
          motivo: motivo || 'Cancelado por ADMIN',
        },
        observacao: `Pagamento cancelado: ${motivo || 'Sem motivo especificado'}`,
      });
    } catch (auditError) {
      console.warn('[PagamentoFornecedorService] Erro ao registrar auditoria:', auditError);
    }

    return pagamentoCancelado;
  }

  /**
   * Listar pagamentos
   */
  static async list(instituicaoId: string, filters?: {
    fornecedorId?: string;
    contratoId?: string;
    status?: 'PENDENTE' | 'PAGO' | 'CANCELADO';
    dataInicio?: Date;
    dataFim?: Date;
  }) {
    const where: any = {
      instituicaoId,
    };

    if (filters?.fornecedorId) {
      where.fornecedorId = filters.fornecedorId;
    }

    if (filters?.contratoId) {
      where.contratoId = filters.contratoId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.dataInicio || filters?.dataFim) {
      where.dataPagamento = {};
      if (filters.dataInicio) {
        where.dataPagamento.gte = filters.dataInicio;
      }
      if (filters.dataFim) {
        where.dataPagamento.lte = filters.dataFim;
      }
    }

    const pagamentos = await prisma.pagamentoFornecedor.findMany({
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
        contrato: {
          select: {
            id: true,
            tipoContrato: true,
            valor: true,
          },
        },
      },
      orderBy: {
        dataPagamento: 'desc',
      },
    });

    return pagamentos;
  }

  /**
   * Obter pagamento por ID
   */
  static async getById(id: string, instituicaoId: string) {
    const pagamento = await prisma.pagamentoFornecedor.findFirst({
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
        contrato: {
          select: {
            id: true,
            tipoContrato: true,
            valor: true,
            dataInicio: true,
            dataFim: true,
            status: true,
          },
        },
      },
    });

    if (!pagamento) {
      throw new AppError('Pagamento não encontrado ou acesso negado', 404);
    }

    return pagamento;
  }
}

