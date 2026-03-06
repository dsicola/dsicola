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
    centroCustoId?: string | null;
    descricao?: string | null;
    debito: number;
    credito: number;
    ordem?: number;
  }>;
}

export interface LinhaImportacaoCSV {
  data: string; // YYYY-MM-DD
  contaCodigo: string;
  descricao?: string;
  debito: number;
  credito: number;
}

export interface UpdateLancamentoData {
  data?: Date;
  descricao?: string;
  fechado?: boolean;
  linhas?: Array<{
    id?: string;
    contaId: string;
    centroCustoId?: string | null;
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

  /**
   * Planos de contas padrão por tipo de instituição
   * SECUNDARIO: plano simplificado (ensino médio)
   * SUPERIOR: plano mais completo (universidade)
   * null/outros: plano mínimo (11, 41) para integração com mensalidades
   */
  private static readonly PLANO_SECUNDARIO: Array<{ codigo: string; descricao: string; tipo: TipoContaContabil }> = [
    { codigo: '1', descricao: 'Ativos', tipo: 'ATIVO' },
    { codigo: '11', descricao: 'Caixa', tipo: 'ATIVO' },
    { codigo: '12', descricao: 'Bancos', tipo: 'ATIVO' },
    { codigo: '2', descricao: 'Passivos', tipo: 'PASSIVO' },
    { codigo: '21', descricao: 'Fornecedores', tipo: 'PASSIVO' },
    { codigo: '3', descricao: 'Patrimônio Líquido', tipo: 'PATRIMONIO_LIQUIDO' },
    { codigo: '31', descricao: 'Capital Social', tipo: 'PATRIMONIO_LIQUIDO' },
    { codigo: '4', descricao: 'Receitas', tipo: 'RECEITA' },
    { codigo: '41', descricao: 'Receita de Mensalidades', tipo: 'RECEITA' },
    { codigo: '42', descricao: 'Receita de Taxas', tipo: 'RECEITA' },
    { codigo: '5', descricao: 'Despesas', tipo: 'DESPESA' },
    { codigo: '51', descricao: 'Despesas com Pessoal', tipo: 'DESPESA' },
    { codigo: '52', descricao: 'Despesas Operacionais', tipo: 'DESPESA' },
  ];

  private static readonly PLANO_SUPERIOR: Array<{ codigo: string; descricao: string; tipo: TipoContaContabil }> = [
    { codigo: '1', descricao: 'Ativos', tipo: 'ATIVO' },
    { codigo: '11', descricao: 'Caixa', tipo: 'ATIVO' },
    { codigo: '12', descricao: 'Depósitos à Ordem', tipo: 'ATIVO' },
    { codigo: '13', descricao: 'Outros Depósitos Bancários', tipo: 'ATIVO' },
    { codigo: '14', descricao: 'Clientes', tipo: 'ATIVO' },
    { codigo: '2', descricao: 'Passivos', tipo: 'PASSIVO' },
    { codigo: '21', descricao: 'Fornecedores', tipo: 'PASSIVO' },
    { codigo: '22', descricao: 'Estado e Outros Entes Públicos', tipo: 'PASSIVO' },
    { codigo: '23', descricao: 'Passivos de Financiamento', tipo: 'PASSIVO' },
    { codigo: '3', descricao: 'Patrimônio Líquido', tipo: 'PATRIMONIO_LIQUIDO' },
    { codigo: '31', descricao: 'Capital e Reservas', tipo: 'PATRIMONIO_LIQUIDO' },
    { codigo: '32', descricao: 'Resultados Transitados', tipo: 'PATRIMONIO_LIQUIDO' },
    { codigo: '4', descricao: 'Receitas', tipo: 'RECEITA' },
    { codigo: '41', descricao: 'Receita de Propinas/Mensalidades', tipo: 'RECEITA' },
    { codigo: '42', descricao: 'Receita de Taxas e Emolumentos', tipo: 'RECEITA' },
    { codigo: '43', descricao: 'Receitas de Prestação de Serviços', tipo: 'RECEITA' },
    { codigo: '44', descricao: 'Subsídios e Donativos', tipo: 'RECEITA' },
    { codigo: '5', descricao: 'Despesas', tipo: 'DESPESA' },
    { codigo: '51', descricao: 'Remunerações e Encargos', tipo: 'DESPESA' },
    { codigo: '52', descricao: 'Aquisição de Bens e Serviços', tipo: 'DESPESA' },
    { codigo: '53', descricao: 'Imobilizado e Investimentos', tipo: 'DESPESA' },
    { codigo: '54', descricao: 'Outras Despesas', tipo: 'DESPESA' },
  ];

  private static readonly PLANO_MINIMO: Array<{ codigo: string; descricao: string; tipo: TipoContaContabil }> = [
    { codigo: '11', descricao: 'Caixa', tipo: 'ATIVO' },
    { codigo: '31', descricao: 'Capital/Resultados', tipo: 'PATRIMONIO_LIQUIDO' },
    { codigo: '41', descricao: 'Receita de Mensalidades', tipo: 'RECEITA' },
  ];

  /**
   * Criar plano de contas padrão por tipo de instituição
   * @param instituicaoId - ID da instituição
   * @param tipoAcademico - SECUNDARIO | SUPERIOR | null (auto-detecta da instituição ou usa plano mínimo)
   */
  static async seedPlanoPadrao(
    instituicaoId: string,
    tipoAcademico?: 'SECUNDARIO' | 'SUPERIOR' | null
  ) {
    let tipo = tipoAcademico;
    if (tipo === undefined || tipo === null) {
      const inst = await prisma.instituicao.findUnique({
        where: { id: instituicaoId },
        select: { tipoAcademico: true },
      });
      tipo = inst?.tipoAcademico || null;
    }

    let plano: Array<{ codigo: string; descricao: string; tipo: TipoContaContabil }>;
    if (tipo === 'SECUNDARIO') {
      plano = this.PLANO_SECUNDARIO;
    } else if (tipo === 'SUPERIOR') {
      plano = this.PLANO_SUPERIOR;
    } else {
      plano = this.PLANO_MINIMO;
    }

    const criadas: Array<{ codigo: string; descricao: string }> = [];
    for (const c of plano) {
      const existe = await prisma.planoConta.findFirst({
        where: { instituicaoId, codigo: c.codigo },
      });
      if (!existe) {
        await prisma.planoConta.create({
          data: { instituicaoId, codigo: c.codigo, descricao: c.descricao, tipo: c.tipo },
        });
        criadas.push({ codigo: c.codigo, descricao: c.descricao });
      }
    }
    return { criadas, total: criadas.length, tipoUsado: tipo || 'minimo' };
  }

  // ========== CENTROS DE CUSTO ==========

  static async listCentrosCusto(instituicaoId: string, incluirInativos = false) {
    const where: { instituicaoId: string; ativo?: boolean } = { instituicaoId };
    if (!incluirInativos) where.ativo = true;
    return prisma.centroCusto.findMany({
      where,
      orderBy: { codigo: 'asc' },
    });
  }

  static async createCentroCusto(instituicaoId: string, data: { codigo: string; descricao: string }) {
    const codigoExiste = await prisma.centroCusto.findFirst({
      where: { instituicaoId, codigo: data.codigo.trim() },
    });
    if (codigoExiste) throw new AppError(`Código "${data.codigo}" já existe`, 400);
    return prisma.centroCusto.create({
      data: {
        instituicaoId,
        codigo: data.codigo.trim(),
        descricao: data.descricao.trim(),
      },
    });
  }

  static async updateCentroCusto(
    id: string,
    instituicaoId: string,
    data: { codigo?: string; descricao?: string; ativo?: boolean }
  ) {
    const centro = await prisma.centroCusto.findFirst({ where: { id, instituicaoId } });
    if (!centro) throw new AppError('Centro de custo não encontrado', 404);
    if (data.codigo !== undefined && data.codigo !== centro.codigo) {
      const codigoExiste = await prisma.centroCusto.findFirst({
        where: { instituicaoId, codigo: data.codigo.trim() },
      });
      if (codigoExiste) throw new AppError(`Código "${data.codigo}" já existe`, 400);
    }
    return prisma.centroCusto.update({
      where: { id },
      data: {
        codigo: data.codigo?.trim(),
        descricao: data.descricao?.trim(),
        ativo: data.ativo,
      },
    });
  }

  static async deleteCentroCusto(id: string, instituicaoId: string) {
    const centro = await prisma.centroCusto.findFirst({ where: { id, instituicaoId } });
    if (!centro) throw new AppError('Centro de custo não encontrado', 404);
    const emUso = await prisma.lancamentoContabilLinha.findFirst({ where: { centroCustoId: id } });
    if (emUso) throw new AppError('Centro de custo em uso. Desative em vez de excluir.', 400);
    await prisma.centroCusto.delete({ where: { id } });
    return { message: 'Centro de custo excluído' };
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
          include: {
            conta: { select: { id: true, codigo: true, descricao: true, tipo: true } },
            centroCusto: { select: { id: true, codigo: true, descricao: true } },
          },
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
          include: {
            conta: { select: { id: true, codigo: true, descricao: true, tipo: true } },
            centroCusto: { select: { id: true, codigo: true, descricao: true } },
          },
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
    const bloqueado = await this.isPeriodoBloqueado(instituicaoId, data.data);
    if (bloqueado) throw new AppError('Período bloqueado. Não é possível criar lançamentos em exercícios já fechados.', 400);
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
            centroCustoId: l.centroCustoId || null,
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

  /** Retorna a data até a qual o período está bloqueado (31/12 do último ano fechado), ou null */
  static async getDataFimBloqueio(instituicaoId: string): Promise<Date | null> {
    const ultimo = await prisma.fechoExercicio.findFirst({
      where: { instituicaoId },
      orderBy: { ano: 'desc' },
    });
    if (!ultimo) return null;
    return new Date(ultimo.ano, 11, 31, 23, 59, 59);
  }

  /** Verifica se uma data está em período bloqueado */
  static async isPeriodoBloqueado(instituicaoId: string, data: Date): Promise<boolean> {
    const dataFim = await this.getDataFimBloqueio(instituicaoId);
    if (!dataFim) return false;
    return data <= dataFim;
  }

  static async updateLancamento(id: string, instituicaoId: string, data: UpdateLancamentoData) {
    const lanc = await prisma.lancamentoContabil.findFirst({ where: { id, instituicaoId } });
    if (!lanc) throw new AppError('Lançamento não encontrado', 404);
    if (lanc.fechado) throw new AppError('Lançamento fechado não pode ser alterado', 400);
    const bloqueado = await this.isPeriodoBloqueado(instituicaoId, lanc.data);
    if (bloqueado) throw new AppError('Período bloqueado. Não é possível alterar lançamentos de exercícios já fechados.', 400);

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
          centroCustoId: l.centroCustoId || null,
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

  /**
   * Importar lançamentos a partir de array (ex: CSV parseado)
   * Formato: [{ data, contaCodigo, descricao?, debito, credito }]
   * Linhas com mesma data são agrupadas num lançamento; descricao do lançamento = primeira linha ou "Importação"
   */
  static async importarLancamentosCSV(
    instituicaoId: string,
    linhas: Array<{ data: string; contaCodigo: string; descricao?: string; debito: number; credito: number }>
  ) {
    if (linhas.length === 0) return { criados: 0, erros: [], mensagem: 'Nenhuma linha para importar' };

    const bloqueado = await this.isPeriodoBloqueado(instituicaoId, new Date(linhas[0].data));
    if (bloqueado) throw new AppError('Período bloqueado. Não é possível importar em exercícios já fechados.', 400);

    const contas = await prisma.planoConta.findMany({
      where: { instituicaoId, ativo: true },
    });
    const mapaContas = new Map(contas.map((c) => [c.codigo.trim().toUpperCase(), c]));

    const erros: string[] = [];
    const porGrupo = new Map<string, Array<{ contaId: string; descricao?: string; debito: number; credito: number }>>();
    for (const l of linhas) {
      const d = String(l.data).trim();
      const cod = String(l.contaCodigo).trim();
      const deb = Number(l.debito) || 0;
      const cred = Number(l.credito) || 0;
      const desc = (l.descricao || '').trim() || 'Importação';
      if (!d || !cod) {
        erros.push(`Linha inválida: data ou contaCodigo vazio`);
        continue;
      }
      const conta = mapaContas.get(cod.toUpperCase());
      if (!conta) {
        erros.push(`Conta "${cod}" não encontrada no plano`);
        continue;
      }
      const key = `${d}|${desc}`;
      if (!porGrupo.has(key)) porGrupo.set(key, []);
      porGrupo.get(key)!.push({ contaId: conta.id, debito: deb, credito: cred });
    }

    let criados = 0;
    for (const [key, grupo] of porGrupo) {
      const [dataStr, descricao] = key.split('|');
      const totalDeb = grupo.reduce((s, g) => s + g.debito, 0);
      const totalCred = grupo.reduce((s, g) => s + g.credito, 0);
      if (Math.abs(totalDeb - totalCred) > 0.01) {
        erros.push(`Data ${dataStr}: débito (${totalDeb}) ≠ crédito (${totalCred})`);
        continue;
      }
      if (grupo.length < 2) {
        erros.push(`Data ${dataStr}: lançamento deve ter pelo menos 2 linhas`);
        continue;
      }

      const data = new Date(dataStr);
      const bloqueadoData = await this.isPeriodoBloqueado(instituicaoId, data);
      if (bloqueadoData) {
        erros.push(`Data ${dataStr}: período bloqueado`);
        continue;
      }

      const numero = await this.getProximoNumero(instituicaoId, data.getFullYear());

      await prisma.lancamentoContabil.create({
        data: {
          instituicaoId,
          numero,
          data,
          descricao: descricao || `Importação ${dataStr}`,
          linhas: {
            create: grupo.map((g, i) => ({
              contaId: g.contaId,
              descricao: null,
              debito: new Decimal(g.debito),
              credito: new Decimal(g.credito),
              ordem: i,
            })),
          },
        },
      });
      criados++;
    }

    return {
      criados,
      erros,
      mensagem: criados > 0 ? `${criados} lançamento(s) criado(s)` : 'Nenhum lançamento criado',
    };
  }

  static async deleteLancamento(id: string, instituicaoId: string) {
    const lanc = await prisma.lancamentoContabil.findFirst({ where: { id, instituicaoId } });
    if (!lanc) throw new AppError('Lançamento não encontrado', 404);
    if (lanc.fechado) throw new AppError('Lançamento fechado não pode ser excluído', 400);
    const bloqueado = await this.isPeriodoBloqueado(instituicaoId, lanc.data);
    if (bloqueado) throw new AppError('Período bloqueado. Não é possível excluir lançamentos de exercícios já fechados.', 400);
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

  // ========== BALANÇO PATRIMONIAL ==========
  /**
   * Balanço: Ativo = Passivo + Patrimônio Líquido
   * Saldos até dataFim (cumulativo). dataInicio opcional (ex: início do ano).
   */
  static async getBalanco(
    instituicaoId: string,
    dataFim: Date,
    dataInicio?: Date
  ) {
    const inicio = dataInicio || new Date(dataFim.getFullYear(), 0, 1);
    const linhas = await prisma.lancamentoContabilLinha.findMany({
      where: {
        lancamento: {
          instituicaoId,
          data: { gte: inicio, lte: dataFim },
        },
      },
      include: { conta: true },
    });

    const porConta = new Map<string, { conta: { id: string; codigo: string; descricao: string; tipo: TipoContaContabil }; debito: number; credito: number }>();
    for (const l of linhas) {
      if (!porConta.has(l.contaId)) {
        porConta.set(l.contaId, { conta: l.conta, debito: 0, credito: 0 });
      }
      const r = porConta.get(l.contaId)!;
      r.debito += Number(l.debito);
      r.credito += Number(l.credito);
    }

    const contas = Array.from(porConta.values()).map((r) => ({
      ...r,
      saldo: r.debito - r.credito,
    }));

    const ativos = contas
      .filter((c) => c.conta.tipo === 'ATIVO')
      .map((c) => ({ ...c, saldoNatural: c.debito - c.credito }))
      .sort((a, b) => a.conta.codigo.localeCompare(b.conta.codigo));
    const passivos = contas
      .filter((c) => c.conta.tipo === 'PASSIVO')
      .map((c) => ({ ...c, saldoNatural: c.credito - c.debito }))
      .sort((a, b) => a.conta.codigo.localeCompare(b.conta.codigo));
    const pl = contas
      .filter((c) => c.conta.tipo === 'PATRIMONIO_LIQUIDO')
      .map((c) => ({ ...c, saldoNatural: c.credito - c.debito }))
      .sort((a, b) => a.conta.codigo.localeCompare(b.conta.codigo));

    const totalAtivo = ativos.reduce((s, c) => s + c.saldoNatural, 0);
    const totalPassivo = passivos.reduce((s, c) => s + c.saldoNatural, 0);
    const totalPL = pl.reduce((s, c) => s + c.saldoNatural, 0);

    return {
      dataFim,
      dataInicio: inicio,
      ativos,
      passivos,
      patrimonioLiquido: pl,
      totalAtivo,
      totalPassivo,
      totalPatrimonioLiquido: totalPL,
      totalPassivoMaisPL: totalPassivo + totalPL,
    };
  }

  // ========== DRE (Demonstração de Resultados) ==========
  /**
   * DRE: Receitas - Despesas = Resultado do período
   */
  static async getDRE(instituicaoId: string, dataInicio: Date, dataFim: Date) {
    const linhas = await prisma.lancamentoContabilLinha.findMany({
      where: {
        lancamento: {
          instituicaoId,
          data: { gte: dataInicio, lte: dataFim },
        },
      },
      include: { conta: true },
    });

    const porConta = new Map<string, { conta: { id: string; codigo: string; descricao: string; tipo: TipoContaContabil }; debito: number; credito: number }>();
    for (const l of linhas) {
      if (!porConta.has(l.contaId)) {
        porConta.set(l.contaId, { conta: l.conta, debito: 0, credito: 0 });
      }
      const r = porConta.get(l.contaId)!;
      r.debito += Number(l.debito);
      r.credito += Number(l.credito);
    }

    const receitas = Array.from(porConta.values())
      .filter((c) => c.conta.tipo === 'RECEITA')
      .map((r) => ({ ...r, valor: r.credito - r.debito }))
      .sort((a, b) => a.conta.codigo.localeCompare(b.conta.codigo));

    const despesas = Array.from(porConta.values())
      .filter((c) => c.conta.tipo === 'DESPESA')
      .map((r) => ({ ...r, valor: r.debito - r.credito }))
      .sort((a, b) => a.conta.codigo.localeCompare(b.conta.codigo));

    const totalReceitas = receitas.reduce((s, c) => s + c.valor, 0);
    const totalDespesas = despesas.reduce((s, c) => s + c.valor, 0);
    const resultado = totalReceitas - totalDespesas;

    return {
      dataInicio,
      dataFim,
      receitas,
      despesas,
      totalReceitas,
      totalDespesas,
      resultado,
    };
  }

  // ========== LIVRO RAZÃO (por conta) ==========
  /**
   * Razão: movimentos de uma conta com saldo inicial, débito, crédito e saldo corrente.
   * Ordenado cronologicamente.
   */
  static async getRazao(
    instituicaoId: string,
    contaId: string,
    dataInicio: Date,
    dataFim: Date
  ) {
    const conta = await prisma.planoConta.findFirst({
      where: { id: contaId, instituicaoId },
    });
    if (!conta) throw new AppError('Conta não encontrada', 404);

    // Saldo inicial: movimentos antes de dataInicio
    const linhasAntes = await prisma.lancamentoContabilLinha.findMany({
      where: {
        contaId,
        lancamento: {
          instituicaoId,
          data: { lt: dataInicio },
        },
      },
      include: { lancamento: { select: { data: true, numero: true } } },
    });
    let saldoInicial = 0;
    const isDebitoNature = conta.tipo === 'ATIVO' || conta.tipo === 'DESPESA';
    for (const l of linhasAntes) {
      saldoInicial += isDebitoNature ? Number(l.debito) - Number(l.credito) : Number(l.credito) - Number(l.debito);
    }

    // Movimentos no período
    const linhas = await prisma.lancamentoContabilLinha.findMany({
      where: {
        contaId,
        lancamento: {
          instituicaoId,
          data: { gte: dataInicio, lte: dataFim },
        },
      },
      include: {
        lancamento: { select: { data: true, numero: true, descricao: true } },
      },
      orderBy: [{ lancamento: { data: 'asc' } }, { lancamento: { numero: 'asc' } }, { ordem: 'asc' }],
    });

    const movimentos: Array<{
      data: Date;
      numero: string;
      descricao: string;
      linhaDescricao: string | null;
      debito: number;
      credito: number;
      saldoCorrente: number;
    }> = [];
    let saldoCorrente = saldoInicial;
    for (const l of linhas) {
      const deb = Number(l.debito);
      const cred = Number(l.credito);
      saldoCorrente += isDebitoNature ? deb - cred : cred - deb;
      movimentos.push({
        data: l.lancamento.data,
        numero: l.lancamento.numero,
        descricao: l.lancamento.descricao,
        linhaDescricao: l.descricao,
        debito: deb,
        credito: cred,
        saldoCorrente,
      });
    }

    return {
      conta: { id: conta.id, codigo: conta.codigo, descricao: conta.descricao, tipo: conta.tipo },
      dataInicio,
      dataFim,
      saldoInicial,
      movimentos,
      saldoFinal: saldoCorrente,
    };
  }

  // ========== FECHO DE EXERCÍCIO ==========

  static async listFechosExercicio(instituicaoId: string) {
    return prisma.fechoExercicio.findMany({
      where: { instituicaoId },
      orderBy: { ano: 'desc' },
    });
  }

  /**
   * Fecha o exercício do ano: cria lançamento de encerramento (Receitas e Despesas → PL)
   * e bloqueia o período para edições futuras.
   */
  static async fecharExercicio(instituicaoId: string, ano: number, userId?: string) {
    const existe = await prisma.fechoExercicio.findFirst({
      where: { instituicaoId, ano },
    });
    if (existe) throw new AppError(`Exercício ${ano} já está fechado.`, 400);

    const dataInicio = new Date(ano, 0, 1);
    const dataFim = new Date(ano, 11, 31, 23, 59, 59);

    const dre = await this.getDRE(instituicaoId, dataInicio, dataFim);
    const totalReceitas = dre.totalReceitas || 0;
    const totalDespesas = dre.totalDespesas || 0;
    const resultado = dre.resultado || 0;

    const contaResultados = await prisma.planoConta.findFirst({
      where: {
        instituicaoId,
        tipo: 'PATRIMONIO_LIQUIDO',
        codigo: { in: ['32', '31'] },
      },
      orderBy: { codigo: 'desc' },
    });
    if (!contaResultados) throw new AppError('Conta de Resultados (31 ou 32) não encontrada no plano de contas.', 400);

    const linhas: Array<{ contaId: string; descricao?: string; debito: number; credito: number; ordem: number }> = [];
    let ordem = 0;

    for (const r of dre.receitas || []) {
      if (Math.abs(r.valor) < 0.01) continue;
      linhas.push({
        contaId: r.conta.id,
        descricao: `Fecho ${ano}: ${r.conta.descricao}`,
        debito: r.valor,
        credito: 0,
        ordem: ordem++,
      });
    }
    if (totalReceitas > 0) {
      linhas.push({
        contaId: contaResultados.id,
        descricao: `Fecho ${ano}: Receitas`,
        debito: 0,
        credito: totalReceitas,
        ordem: ordem++,
      });
    }

    for (const d of dre.despesas || []) {
      if (Math.abs(d.valor) < 0.01) continue;
      linhas.push({
        contaId: d.conta.id,
        descricao: `Fecho ${ano}: ${d.conta.descricao}`,
        debito: 0,
        credito: d.valor,
        ordem: ordem++,
      });
    }
    if (totalDespesas > 0) {
      linhas.push({
        contaId: contaResultados.id,
        descricao: `Fecho ${ano}: Despesas`,
        debito: totalDespesas,
        credito: 0,
        ordem: ordem++,
      });
    }

    if (linhas.length < 2) {
      throw new AppError(`Não há movimentos de receitas ou despesas no ano ${ano} para encerrar.`, 400);
    }

    const numero = await this.getProximoNumero(instituicaoId, ano);
    const lancamento = await prisma.lancamentoContabil.create({
      data: {
        instituicaoId,
        numero,
        data: dataFim,
        descricao: `Fecho do exercício ${ano}`,
        fechado: true,
        linhas: {
          create: linhas.map((l) => ({
            contaId: l.contaId,
            descricao: l.descricao,
            debito: new Decimal(l.debito),
            credito: new Decimal(l.credito),
            ordem: l.ordem,
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

    await prisma.fechoExercicio.create({
      data: {
        instituicaoId,
        ano,
        lancamentoId: lancamento.id,
        fechadoPor: userId || null,
      },
    });

    return {
      ano,
      lancamento,
      resultado,
      message: `Exercício ${ano} fechado com sucesso. Resultado: ${resultado.toFixed(2)}`,
    };
  }
}
