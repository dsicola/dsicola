/**
 * Conciliação Bancária
 *
 * Permite importar extratos bancários e conciliar movimentos com lançamentos contábeis.
 * Profissional para instituições de ensino de grande porte.
 */
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreateContaBancariaData {
  nome: string;
  ibanOuNumero?: string | null;
  banco?: string | null;
  contaContabilId?: string | null;
}

export interface CreateMovimentoExtratoData {
  data: Date;
  valor: number; // positivo=entrada, negativo=saída
  descricao?: string | null;
  referenciaExterna?: string | null;
}

export class ConciliacaoBancariaService {
  static async listContasBancarias(instituicaoId: string, incluirInativas = false) {
    const where: { instituicaoId: string; ativo?: boolean } = { instituicaoId };
    if (!incluirInativas) where.ativo = true;

    return prisma.contaBancaria.findMany({
      where,
      include: {
        contaContabil: { select: { id: true, codigo: true, descricao: true } },
      },
      orderBy: { nome: 'asc' },
    });
  }

  static async createContaBancaria(instituicaoId: string, data: CreateContaBancariaData) {
    if (!data.nome?.trim()) throw new AppError('Nome é obrigatório', 400);

    if (data.contaContabilId) {
      const conta = await prisma.planoConta.findFirst({
        where: { id: data.contaContabilId, instituicaoId },
      });
      if (!conta) throw new AppError('Conta contábil não encontrada', 404);
    }

    return prisma.contaBancaria.create({
      data: {
        instituicaoId,
        nome: data.nome.trim(),
        ibanOuNumero: data.ibanOuNumero?.trim() || null,
        banco: data.banco?.trim() || null,
        contaContabilId: data.contaContabilId || null,
      },
      include: {
        contaContabil: { select: { id: true, codigo: true, descricao: true } },
      },
    });
  }

  static async updateContaBancaria(
    id: string,
    instituicaoId: string,
    data: { nome?: string; ibanOuNumero?: string | null; banco?: string | null; contaContabilId?: string | null; ativo?: boolean }
  ) {
    const conta = await prisma.contaBancaria.findFirst({ where: { id, instituicaoId } });
    if (!conta) throw new AppError('Conta bancária não encontrada', 404);

    return prisma.contaBancaria.update({
      where: { id },
      data: {
        nome: data.nome?.trim(),
        ibanOuNumero: data.ibanOuNumero?.trim() ?? conta.ibanOuNumero,
        banco: data.banco?.trim() ?? conta.banco,
        contaContabilId: data.contaContabilId ?? conta.contaContabilId,
        ativo: data.ativo,
      },
      include: {
        contaContabil: { select: { id: true, codigo: true, descricao: true } },
      },
    });
  }

  static async importarMovimentos(
    contaBancariaId: string,
    instituicaoId: string,
    movimentos: CreateMovimentoExtratoData[]
  ) {
    const conta = await prisma.contaBancaria.findFirst({
      where: { id: contaBancariaId, instituicaoId },
    });
    if (!conta) throw new AppError('Conta bancária não encontrada', 404);
    if (!conta.ativo) throw new AppError('Conta bancária inativa', 400);

    if (!movimentos.length) return { importados: 0, erros: [] };

    const erros: string[] = [];
    let importados = 0;

    for (const m of movimentos) {
      if (m.valor === 0) {
        erros.push(`Linha com valor zero ignorada: ${m.descricao || m.data}`);
        continue;
      }
      try {
        await prisma.movimentoExtratoBancario.create({
          data: {
            contaBancariaId,
            instituicaoId,
            data: m.data,
            valor: new Decimal(m.valor),
            descricao: m.descricao?.trim() || null,
            referenciaExterna: m.referenciaExterna?.trim() || null,
          },
        });
        importados++;
      } catch (e) {
        erros.push(`Erro ao importar: ${m.descricao || m.data} - ${(e as Error).message}`);
      }
    }

    return { importados, erros };
  }

  static async listMovimentos(
    contaBancariaId: string,
    instituicaoId: string,
    filters?: { dataInicio?: Date; dataFim?: Date; conciliado?: boolean }
  ) {
    const conta = await prisma.contaBancaria.findFirst({
      where: { id: contaBancariaId, instituicaoId },
    });
    if (!conta) throw new AppError('Conta bancária não encontrada', 404);

    const where: { contaBancariaId: string; instituicaoId: string; data?: object; conciliado?: boolean } = {
      contaBancariaId,
      instituicaoId,
    };
    if (filters?.dataInicio || filters?.dataFim) {
      where.data = {};
      if (filters.dataInicio) (where.data as Record<string, Date>).gte = filters.dataInicio;
      if (filters.dataFim) (where.data as Record<string, Date>).lte = filters.dataFim;
    }
    if (filters?.conciliado !== undefined) where.conciliado = filters.conciliado;

    return prisma.movimentoExtratoBancario.findMany({
      where,
      include: {
        lancamento: { select: { id: true, numero: true, data: true, descricao: true } },
      },
      orderBy: [{ data: 'desc' }, { createdAt: 'desc' }],
    });
  }

  static async conciliar(
    movimentoId: string,
    lancamentoContabilId: string,
    instituicaoId: string
  ) {
    const movimento = await prisma.movimentoExtratoBancario.findFirst({
      where: { id: movimentoId, instituicaoId },
    });
    if (!movimento) throw new AppError('Movimento não encontrado', 404);

    const lancamento = await prisma.lancamentoContabil.findFirst({
      where: { id: lancamentoContabilId, instituicaoId },
      include: { linhas: true },
    });
    if (!lancamento) throw new AppError('Lançamento contábil não encontrado', 404);

    // Verificar se o lançamento tem linha na conta bancária
    const contaBancaria = await prisma.contaBancaria.findUnique({
      where: { id: movimento.contaBancariaId },
      include: { contaContabil: true },
    });
    if (!contaBancaria?.contaContabilId) {
      throw new AppError('Conta bancária não tem conta contábil configurada para validação', 400);
    }

    const valorMovimento = Number(movimento.valor);
    let valorLancamentoNaConta = 0;
    for (const linha of lancamento.linhas) {
      if (linha.contaId === contaBancaria.contaContabilId) {
        valorLancamentoNaConta += Number(linha.debito) - Number(linha.credito);
      }
    }

    if (Math.abs(valorMovimento - valorLancamentoNaConta) > 0.01) {
      throw new AppError(
        `Valor do movimento (${valorMovimento}) não corresponde ao valor do lançamento na conta bancária (${valorLancamentoNaConta})`,
        400
      );
    }

    return prisma.movimentoExtratoBancario.update({
      where: { id: movimentoId },
      data: { conciliado: true, lancamentoContabilId },
      include: {
        lancamento: { select: { id: true, numero: true, data: true, descricao: true } },
      },
    });
  }

  static async desconciliar(movimentoId: string, instituicaoId: string) {
    const movimento = await prisma.movimentoExtratoBancario.findFirst({
      where: { id: movimentoId, instituicaoId },
    });
    if (!movimento) throw new AppError('Movimento não encontrado', 404);

    return prisma.movimentoExtratoBancario.update({
      where: { id: movimentoId },
      data: { conciliado: false, lancamentoContabilId: null },
    });
  }

  static async getResumoConciliacao(contaBancariaId: string, instituicaoId: string, dataFim: Date) {
    const conta = await prisma.contaBancaria.findFirst({
      where: { id: contaBancariaId, instituicaoId },
      include: { contaContabil: true },
    });
    if (!conta) throw new AppError('Conta bancária não encontrada', 404);

    const movimentos = await prisma.movimentoExtratoBancario.findMany({
      where: {
        contaBancariaId,
        instituicaoId,
        data: { lte: dataFim },
      },
    });

    const totalEntradas = movimentos.filter((m) => Number(m.valor) > 0).reduce((s, m) => s + Number(m.valor), 0);
    const totalSaidas = movimentos.filter((m) => Number(m.valor) < 0).reduce((s, m) => s + Math.abs(Number(m.valor)), 0);
    const saldoExtrato = totalEntradas - totalSaidas;
    const conciliados = movimentos.filter((m) => m.conciliado).length;
    const pendentes = movimentos.filter((m) => !m.conciliado).length;

    let saldoContabil = 0;
    if (conta.contaContabilId) {
      const linhas = await prisma.lancamentoContabilLinha.findMany({
        where: {
          contaId: conta.contaContabilId,
          lancamento: { instituicaoId, data: { lte: dataFim } },
        },
      });
      for (const l of linhas) {
        saldoContabil += Number(l.debito) - Number(l.credito);
      }
    }

    const diferenca = saldoExtrato - saldoContabil;

    return {
      contaBancaria: { id: conta.id, nome: conta.nome, banco: conta.banco },
      dataFim,
      saldoExtrato,
      saldoContabil,
      diferenca,
      conciliado: Math.abs(diferenca) < 0.01,
      totalMovimentos: movimentos.length,
      movimentosConciliados: conciliados,
      movimentosPendentes: pendentes,
    };
  }
}
