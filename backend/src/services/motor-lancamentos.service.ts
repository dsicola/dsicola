/**
 * Motor Automático de Lançamentos
 *
 * Sistema de regras que cria lançamentos contábeis automaticamente quando eventos ocorrem.
 * Ex: pagamento_propina → Débito Caixa/Banco, Crédito Receita Propinas
 *
 * Usa RegraContabil quando configurado; senão fallback para ConfiguracaoContabilidade.
 */
import prisma from '../lib/prisma.js';
import { Decimal } from '@prisma/client/runtime/library';
import { ConfiguracaoContabilidadeService } from './configuracao-contabilidade.service.js';

export type EventoContabil =
  | 'pagamento_propina'
  | 'estorno_propina'
  | 'pagamento_matricula'
  | 'estorno_matricula'
  | 'pagamento_salario'
  | 'estorno_salario'
  | 'pagamento_fornecedor'
  | 'compra_material';

export interface ParamsMotor {
  valor: Decimal | number;
  descricao: string;
  data: Date;
  metodoPagamento?: string;
  referenciaId?: string;
  referenciaTipo?: string; // 'pagamento', 'folha', 'pagamento_fornecedor'
}

const CAIXA_BANCO = 'CAIXA_BANCO';

async function getProximoNumero(instituicaoId: string, data: Date): Promise<string> {
  const ano = data.getFullYear();
  const ultimo = await prisma.lancamentoContabil.findFirst({
    where: { instituicaoId, numero: { startsWith: `${ano}-` } },
    orderBy: { numero: 'desc' },
  });
  const seq = ultimo ? parseInt(ultimo.numero.split('-')[1] || '0', 10) + 1 : 1;
  return `${ano}-${String(seq).padStart(3, '0')}`;
}

function resolveCodigo(
  codigo: string,
  codigos: Awaited<ReturnType<typeof ConfiguracaoContabilidadeService.getCodigosContas>>,
  metodoPagamento?: string
): string {
  if (codigo !== CAIXA_BANCO) return codigo;
  const usaBanco = metodoPagamento === 'TRANSFERENCIA' || metodoPagamento === 'CHEQUE';
  return usaBanco ? codigos.contaBanco : codigos.contaCaixa;
}

/**
 * Mapeamento evento → campo em ConfiguracaoContabilidade (fallback quando não há RegraContabil)
 * null = usa CAIXA_BANCO (resolve conforme metodoPagamento)
 */
type ConfigField = keyof Awaited<ReturnType<typeof ConfiguracaoContabilidadeService.getCodigosContas>> | null;

export class MotorLancamentosService {
  /**
   * Executar regra contábil para um evento
   * @returns ID do lançamento criado ou null se contas não existirem
   */
  static async executar(
    instituicaoId: string,
    evento: EventoContabil,
    params: ParamsMotor
  ): Promise<string | null> {
    const valorNum = typeof params.valor === 'number' ? params.valor : Number(params.valor);
    if (valorNum <= 0) return null;

    const codigos = await ConfiguracaoContabilidadeService.getCodigosContas(instituicaoId);

    // 1. Obter regra: RegraContabil ou padrão (ConfiguracaoContabilidade)
    let contaDebitoCodigo: string;
    let contaCreditoCodigo: string;

    const regra = await prisma.regraContabil.findFirst({
      where: { instituicaoId, evento, ativo: true },
    });

    if (regra) {
      contaDebitoCodigo = regra.contaDebitoCodigo;
      contaCreditoCodigo = regra.contaCreditoCodigo;
    } else {
      // Fallback: usar ConfiguracaoContabilidade
      const padroes: Record<EventoContabil, { debito: ConfigField; credito: ConfigField }> = {
        pagamento_propina: { debito: null, credito: 'contaReceitaMensalidades' },
        estorno_propina: { debito: 'contaReceitaMensalidades', credito: null },
        pagamento_matricula: { debito: null, credito: 'contaReceitaTaxas' },
        estorno_matricula: { debito: 'contaReceitaTaxas', credito: null },
        pagamento_salario: { debito: 'contaPessoal', credito: null },
        estorno_salario: { debito: null, credito: 'contaPessoal' },
        pagamento_fornecedor: { debito: 'contaFornecedores', credito: null },
        compra_material: { debito: null, credito: null }, // 52 Despesa, 21 Fornecedores - tratado abaixo
      };
      const padrao = padroes[evento];
      if (!padrao) return null;
      if (evento === 'compra_material') {
        contaDebitoCodigo = '52'; // Despesa Aquisição Bens/Serviços
        contaCreditoCodigo = codigos.contaFornecedores;
      } else {
        const resolve = (f: ConfigField) => (f ? codigos[f as keyof typeof codigos] : CAIXA_BANCO);
        contaDebitoCodigo = resolve(padrao.debito);
        contaCreditoCodigo = resolve(padrao.credito);
      }
    }

    const codigoDebito = resolveCodigo(contaDebitoCodigo, codigos, params.metodoPagamento);
    const codigoCredito = resolveCodigo(contaCreditoCodigo, codigos, params.metodoPagamento);

    const contaDebito = await prisma.planoConta.findFirst({
      where: { instituicaoId, codigo: codigoDebito, ativo: true },
    });
    const contaCredito = await prisma.planoConta.findFirst({
      where: { instituicaoId, codigo: codigoCredito, ativo: true },
    });

    if (!contaDebito || !contaCredito) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(
          `[MotorLancamentos] Contas ${codigoDebito} ou ${codigoCredito} não encontradas para evento ${evento}. Configure em Contabilidade → Regras ou Plano de Contas.`
        );
      }
      return null;
    }

    const numero = await getProximoNumero(instituicaoId, params.data);

    const lancamento = await prisma.lancamentoContabil.create({
      data: {
        instituicaoId,
        numero,
        data: params.data,
        descricao: params.descricao,
        fechado: true,
        origem: 'AUTOMATICO',
        referenciaExterna: params.referenciaId?.trim() || null,
        referenciaTipo: params.referenciaTipo?.trim() || null,
        linhas: {
          create: [
            { contaId: contaDebito.id, debito: valorNum, credito: 0, ordem: 0 },
            { contaId: contaCredito.id, debito: 0, credito: valorNum, ordem: 1 },
          ],
        },
      },
    });
    return lancamento.id;
  }

  /**
   * Listar regras da instituição
   */
  static async listarRegras(instituicaoId: string) {
    return prisma.regraContabil.findMany({
      where: { instituicaoId },
      orderBy: { evento: 'asc' },
    });
  }

  /**
   * Criar ou atualizar regra
   */
  static async upsertRegra(
    instituicaoId: string,
    evento: EventoContabil,
    data: { contaDebitoCodigo: string; contaCreditoCodigo: string; ativo?: boolean }
  ) {
    return prisma.regraContabil.upsert({
      where: {
        instituicaoId_evento: { instituicaoId, evento },
      },
      create: {
        instituicaoId,
        evento,
        contaDebitoCodigo: data.contaDebitoCodigo.trim(),
        contaCreditoCodigo: data.contaCreditoCodigo.trim(),
        ativo: data.ativo ?? true,
      },
      update: {
        contaDebitoCodigo: data.contaDebitoCodigo.trim(),
        contaCreditoCodigo: data.contaCreditoCodigo.trim(),
        ativo: data.ativo,
      },
    });
  }

  /**
   * Obter eventos disponíveis com descrições
   */
  static getEventosDisponiveis(): Array<{ codigo: EventoContabil; descricao: string }> {
    return [
      { codigo: 'pagamento_propina', descricao: 'Pagamento de propina/mensalidade' },
      { codigo: 'estorno_propina', descricao: 'Estorno de pagamento de propina' },
      { codigo: 'pagamento_matricula', descricao: 'Pagamento de taxa de matrícula' },
      { codigo: 'estorno_matricula', descricao: 'Estorno de pagamento de taxa de matrícula' },
      { codigo: 'pagamento_salario', descricao: 'Pagamento de salários (folha)' },
      { codigo: 'estorno_salario', descricao: 'Estorno de pagamento de folha' },
      { codigo: 'pagamento_fornecedor', descricao: 'Pagamento a fornecedor' },
      { codigo: 'compra_material', descricao: 'Compra de material (Débito Despesa, Crédito Fornecedores)' },
    ];
  }
}
