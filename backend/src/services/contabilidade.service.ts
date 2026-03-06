import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { TipoContaContabil } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreatePlanoContaData {
  codigo: string;
  descricao: string;
  tipo: TipoContaContabil;
  contaPaiId?: string | null;
  nivel?: number;
}

export interface UpdatePlanoContaData {
  codigo?: string;
  descricao?: string;
  tipo?: TipoContaContabil;
  contaPaiId?: string | null;
  nivel?: number;
  ativo?: boolean;
}

export interface CreateLancamentoData {
  data: Date;
  descricao: string;
  linhas: Array<{
    contaId: string;
    descricao?: string | null;
    debito: number;
    credito: number;
    ordem?: number;
  }>;
}

export interface UpdateLancamentoData {
  data?: Date;
  descricao?: string;
  fechado?: boolean;
  linhas?: Array<{
    id?: string;
    contaId: string;
    descricao?: string | null;
    debito: number;
    credito: number;
    ordem?: number;
  }>;
}

export class ContabilidadeService {
  // ========== PLANO DE CONTAS ==========

  static async listPlanoContas(instituicaoId: string, incluirInativos = false) {
    const where: { instituicaoId: string; ativo?: boolean } = { instituicaoId };
    if (!incluirInativos) where.ativo = true;

    const contas = await prisma.planoConta.findMany({
      where,
      include: {
        contaPai: { select: { id: true, codigo: true, descricao: true } },
        _count: { select: { subcontas: true } },
      },
      orderBy: [{ nivel: 'asc' }, { codigo: 'asc' }],
    });
    return contas;
  }

  static async getPlanoContaById(id: string, instituicaoId: string) {
    const conta = await prisma.planoConta.findFirst({
      where: { id, instituicaoId },
      include: {
        contaPai: { select: { id: true, codigo: true, descricao: true } },
        subcontas: { select: { id: true, codigo: true, descricao: true, tipo: true } },
      },
    });
    if (!conta) throw new AppError('Conta não encontrada', 404);
    return conta;
  }

  static async createPlanoConta(instituicaoId: string, data: CreatePlanoContaData) {
    const codigoExiste = await prisma.planoConta.findFirst({
      where: { instituicaoId, codigo: data.codigo.trim() },
    });
    if (codigoExiste) throw new AppError(`Código "${data.codigo}" já existe no plano de contas`, 400);

    const nivel = data.nivel ?? (data.contaPaiId ? 2 : 1);
    if (data.contaPaiId) {
      const pai = await prisma.planoConta.findFirst({
        where: { id: data.contaPaiId, instituicaoId },
      });
      if (!pai) throw new AppError('Conta pai não encontrada', 404);
    }

    return prisma.planoConta.create({
      data: {
        instituicaoId,
        codigo: data.codigo.trim(),
        descricao: data.descricao.trim(),
        tipo: data.tipo,
        contaPaiId: data.contaPaiId || null,
        nivel,
      },
    });
  }

  static async updatePlanoConta(id: string, instituicaoId: string, data: UpdatePlanoContaData) {
    const conta = await prisma.planoConta.findFirst({ where: { id, instituicaoId } });
    if (!conta) throw new AppError('Conta não encontrada', 404);

    if (data.codigo !== undefined && data.codigo !== conta.codigo) {
      const codigoExiste = await prisma.planoConta.findFirst({
        where: { instituicaoId, codigo: data.codigo.trim() },
      });
      if (codigoExiste) throw new AppError(`Código "${data.codigo}" já existe`, 400);
    }

    const updateData: Record<string, unknown> = {};
    if (data.codigo !== undefined) updateData.codigo = data.codigo.trim();
    if (data.descricao !== undefined) updateData.descricao = data.descricao.trim();
    if (data.tipo !== undefined) updateData.tipo = data.tipo;
    if (data.contaPaiId !== undefined) updateData.contaPaiId = data.contaPaiId;
    if (data.nivel !== undefined) updateData.nivel = data.nivel;
    if (data.ativo !== undefined) updateData.ativo = data.ativo;

    return prisma.planoConta.update({
      where: { id },
      data: updateData,
    });
  }

  static async deletePlanoConta(id: string, instituicaoId: string) {
    const conta = await prisma.planoConta.findFirst({ where: { id, instituicaoId } });
    if (!conta) throw new AppError('Conta não encontrada', 404);

    const emUso = await prisma.lancamentoContabilLinha.findFirst({ where: { contaId: id } });
    if (emUso) throw new AppError('Conta em uso em lançamentos. Desative em vez de excluir.', 400);

    const temSubcontas = await prisma.planoConta.findFirst({ where: { contaPaiId: id } });
    if (temSubcontas) throw new AppError('Remova as subcontas antes de excluir', 400);

    await prisma.planoConta.delete({ where: { id } });
    return { message: 'Conta excluída' };
  }

  // ========== LANÇAMENTOS ==========

  static async listLancamentos(
    instituicaoId: string,
    filters?: { dataInicio?: Date; dataFim?: Date; fechado?: boolean }
  ) {
    const where: { instituicaoId: string; data?: object; fechado?: boolean } = { instituicaoId };
    if (filters?.dataInicio || filters?.dataFim) {
      where.data = {};
      if (filters.dataInicio) (where.data as Record<string, Date>).gte = filters.dataInicio;
      if (filters.dataFim) (where.data as Record<string, Date>).lte = filters.dataFim;
    }
    if (filters?.fechado !== undefined) where.fechado = filters.fechado;

    return prisma.lancamentoContabil.findMany({
      where,
      include: {
        linhas: {
          include: { conta: { select: { id: true, codigo: true, descricao: true, tipo: true } } },
          orderBy: { ordem: 'asc' },
        },
      },
      orderBy: [{ data: 'desc' }, { numero: 'desc' }],
    });
  }

  static async getLancamentoById(id: string, instituicaoId: string) {
    const lanc = await prisma.lancamentoContabil.findFirst({
      where: { id, instituicaoId },
      include: {
        linhas: {
          include: { conta: { select: { id: true, codigo: true, descricao: true, tipo: true } } },
          orderBy: { ordem: 'asc' },
        },
      },
    });
    if (!lanc) throw new AppError('Lançamento não encontrado', 404);
    return lanc;
  }

  static async getProximoNumero(instituicaoId: string, ano: number): Promise<string> {
    const ultimo = await prisma.lancamentoContabil.findFirst({
      where: {
        instituicaoId,
        numero: { startsWith: `${ano}-` },
      },
      orderBy: { numero: 'desc' },
    });
    const seq = ultimo ? parseInt(ultimo.numero.split('-')[1] || '0', 10) + 1 : 1;
    return `${ano}-${String(seq).padStart(3, '0')}`;
  }

  static async createLancamento(instituicaoId: string, data: CreateLancamentoData) {
    const totalDebito = data.linhas.reduce((s, l) => s + l.debito, 0);
    const totalCredito = data.linhas.reduce((s, l) => s + l.credito, 0);
    if (Math.abs(totalDebito - totalCredito) > 0.01) {
      throw new AppError('Lançamento deve ter débito igual a crédito', 400);
    }
    if (data.linhas.length < 2) {
      throw new AppError('Lançamento deve ter pelo menos 2 linhas', 400);
    }

    const ano = new Date(data.data).getFullYear();
    const numero = await this.getProximoNumero(instituicaoId, ano);

    const contasIds = [...new Set(data.linhas.map((l) => l.contaId))];
    const contas = await prisma.planoConta.findMany({
      where: { id: { in: contasIds }, instituicaoId },
    });
    if (contas.length !== contasIds.length) {
      throw new AppError('Uma ou mais contas não pertencem à instituição', 400);
    }

    return prisma.lancamentoContabil.create({
      data: {
        instituicaoId,
        numero,
        data: data.data,
        descricao: data.descricao.trim(),
        linhas: {
          create: data.linhas.map((l, i) => ({
            contaId: l.contaId,
            descricao: l.descricao?.trim() || null,
            debito: new Decimal(l.debito),
            credito: new Decimal(l.credito),
            ordem: l.ordem ?? i,
          })),
        },
      },
      include: {
        linhas: {
          include: { conta: { select: { id: true, codigo: true, descricao: true, tipo: true } } },
          orderBy: { ordem: 'asc' },
        },
      },
    });
  }

  static async updateLancamento(id: string, instituicaoId: string, data: UpdateLancamentoData) {
    const lanc = await prisma.lancamentoContabil.findFirst({ where: { id, instituicaoId } });
    if (!lanc) throw new AppError('Lançamento não encontrado', 404);
    if (lanc.fechado) throw new AppError('Lançamento fechado não pode ser alterado', 400);

    const updateData: Record<string, unknown> = {};
    if (data.data !== undefined) updateData.data = data.data;
    if (data.descricao !== undefined) updateData.descricao = data.descricao.trim();
    if (data.fechado !== undefined) updateData.fechado = data.fechado;

    if (data.linhas) {
      const totalDebito = data.linhas.reduce((s, l) => s + l.debito, 0);
      const totalCredito = data.linhas.reduce((s, l) => s + l.credito, 0);
      if (Math.abs(totalDebito - totalCredito) > 0.01) {
        throw new AppError('Lançamento deve ter débito igual a crédito', 400);
      }
      if (data.linhas.length < 2) {
        throw new AppError('Lançamento deve ter pelo menos 2 linhas', 400);
      }

      await prisma.lancamentoContabilLinha.deleteMany({ where: { lancamentoId: id } });
      await prisma.lancamentoContabilLinha.createMany({
        data: data.linhas.map((l, i) => ({
          lancamentoId: id,
          contaId: l.contaId,
          descricao: l.descricao?.trim() || null,
          debito: l.debito,
          credito: l.credito,
          ordem: l.ordem ?? i,
        })),
      });
    }

    return prisma.lancamentoContabil.update({
      where: { id },
      data: updateData,
      include: {
        linhas: {
          include: { conta: { select: { id: true, codigo: true, descricao: true, tipo: true } } },
          orderBy: { ordem: 'asc' },
        },
      },
    });
  }

  static async fecharLancamento(id: string, instituicaoId: string) {
    const lanc = await prisma.lancamentoContabil.findFirst({ where: { id, instituicaoId } });
    if (!lanc) throw new AppError('Lançamento não encontrado', 404);
    return prisma.lancamentoContabil.update({
      where: { id },
      data: { fechado: true },
      include: {
        linhas: {
          include: { conta: { select: { id: true, codigo: true, descricao: true, tipo: true } } },
          orderBy: { ordem: 'asc' },
        },
      },
    });
  }

  static async deleteLancamento(id: string, instituicaoId: string) {
    const lanc = await prisma.lancamentoContabil.findFirst({ where: { id, instituicaoId } });
    if (!lanc) throw new AppError('Lançamento não encontrado', 404);
    if (lanc.fechado) throw new AppError('Lançamento fechado não pode ser excluído', 400);
    await prisma.lancamentoContabil.delete({ where: { id } });
    return { message: 'Lançamento excluído' };
  }

  // ========== BALANCETE ==========

  static async getBalancete(
    instituicaoId: string,
    dataInicio: Date,
    dataFim: Date
  ) {
    const linhas = await prisma.lancamentoContabilLinha.findMany({
      where: {
        lancamento: {
          instituicaoId,
          data: { gte: dataInicio, lte: dataFim },
        },
      },
      include: {
        conta: true,
        lancamento: { select: { data: true, numero: true } },
      },
    });

    const porConta = new Map<
      string,
      { conta: { id: string; codigo: string; descricao: string; tipo: TipoContaContabil }; debito: number; credito: number }
    >();

    for (const l of linhas) {
      const key = l.contaId;
      if (!porConta.has(key)) {
        porConta.set(key, {
          conta: l.conta,
          debito: 0,
          credito: 0,
        });
      }
      const r = porConta.get(key)!;
      r.debito += Number(l.debito);
      r.credito += Number(l.credito);
    }

    const contas = Array.from(porConta.values()).map((r) => ({
      ...r,
      saldo: r.debito - r.credito,
    }));

    return {
      dataInicio,
      dataFim,
      contas: contas.sort((a, b) => a.conta.codigo.localeCompare(b.conta.codigo)),
      totalDebito: contas.reduce((s, c) => s + c.debito, 0),
      totalCredito: contas.reduce((s, c) => s + c.credito, 0),
    };
  }
}
