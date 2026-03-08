/**
 * Integração Contabilidade ↔ Pagamentos, Folha de Pagamento, Fornecedores
 * Gera lançamentos contábeis automáticos via Motor Automático de Lançamentos.
 *
 * Usa RegraContabil quando configurado; senão fallback para ConfiguracaoContabilidade.
 * Se as contas não existirem no plano, o lançamento é ignorado (não bloqueia o fluxo).
 */
import { Decimal } from '@prisma/client/runtime/library';
import { MotorLancamentosService } from './motor-lancamentos.service.js';

/**
 * Lançar pagamento de mensalidade na contabilidade
 * Débito: Caixa (11) ou Banco (12) conforme método | Crédito: Receita Mensalidades (41)
 */
export async function lancarPagamentoMensalidadeContabil(
  instituicaoId: string,
  valor: Decimal | number,
  descricao: string,
  dataPagamento: Date,
  pagamentoId?: string,
  metodoPagamento?: string
): Promise<string | null> {
  return MotorLancamentosService.executar(instituicaoId, 'pagamento_propina', {
    valor,
    descricao,
    data: dataPagamento,
    metodoPagamento,
    referenciaId: pagamentoId,
    referenciaTipo: 'pagamento',
  });
}

/**
 * Lançar estorno de pagamento na contabilidade (lançamento reverso)
 * Crédito: Caixa/Banco | Débito: Receita Mensalidades
 */
export async function lancarEstornoMensalidadeContabil(
  instituicaoId: string,
  valor: Decimal | number,
  descricao: string,
  dataEstorno: Date,
  pagamentoOriginalId?: string,
  metodoPagamentoOriginal?: string
): Promise<string | null> {
  return MotorLancamentosService.executar(instituicaoId, 'estorno_propina', {
    valor,
    descricao,
    data: dataEstorno,
    metodoPagamento: metodoPagamentoOriginal,
    referenciaId: pagamentoOriginalId,
    referenciaTipo: 'estorno',
  });
}

/**
 * Lançar pagamento de folha de pagamento na contabilidade
 * Débito: Despesas Pessoal (51) | Crédito: Caixa (11) ou Banco (12) conforme método
 */
export async function lancarFolhaPagamentoContabil(
  instituicaoId: string,
  valor: Decimal | number,
  descricao: string,
  dataPagamento: Date,
  folhaId?: string,
  metodoPagamento?: string
): Promise<string | null> {
  return MotorLancamentosService.executar(instituicaoId, 'pagamento_salario', {
    valor,
    descricao,
    data: dataPagamento,
    metodoPagamento,
    referenciaId: folhaId,
    referenciaTipo: 'folha',
  });
}

/**
 * Lançar estorno de pagamento de folha (reversão)
 * Crédito: Pessoal (51) | Débito: Caixa/Banco
 */
export async function lancarEstornoFolhaPagamentoContabil(
  instituicaoId: string,
  valor: Decimal | number,
  descricao: string,
  dataEstorno: Date,
  folhaId?: string,
  metodoPagamentoOriginal?: string
): Promise<string | null> {
  return MotorLancamentosService.executar(instituicaoId, 'estorno_salario', {
    valor,
    descricao,
    data: dataEstorno,
    metodoPagamento: metodoPagamentoOriginal,
    referenciaId: folhaId,
    referenciaTipo: 'estorno_folha',
  });
}

/**
 * Lançar pagamento de taxa de matrícula na contabilidade
 * Débito: Caixa (11) ou Banco (12) conforme método | Crédito: Receita Taxas (42)
 */
export async function lancarPagamentoMatriculaContabil(
  instituicaoId: string,
  valor: Decimal | number,
  descricao: string,
  dataPagamento: Date,
  matriculaId?: string,
  metodoPagamento?: string
): Promise<string | null> {
  return MotorLancamentosService.executar(instituicaoId, 'pagamento_matricula', {
    valor,
    descricao,
    data: dataPagamento,
    metodoPagamento,
    referenciaId: matriculaId,
    referenciaTipo: 'matricula',
  });
}

/**
 * Lançar estorno de taxa de matrícula na contabilidade (lançamento reverso)
 * Crédito: Caixa/Banco | Débito: Receita Taxas (42)
 */
export async function lancarEstornoMatriculaContabil(
  instituicaoId: string,
  valor: Decimal | number,
  descricao: string,
  dataEstorno: Date,
  matriculaId?: string,
  metodoPagamentoOriginal?: string
): Promise<string | null> {
  return MotorLancamentosService.executar(instituicaoId, 'estorno_matricula', {
    valor,
    descricao,
    data: dataEstorno,
    metodoPagamento: metodoPagamentoOriginal,
    referenciaId: matriculaId,
    referenciaTipo: 'estorno_matricula',
  });
}

/**
 * Lançar pagamento a fornecedor na contabilidade
 * Débito: Fornecedores (21) | Crédito: Caixa (11) ou Banco (12) conforme método
 */
export async function lancarPagamentoFornecedorContabil(
  instituicaoId: string,
  valor: Decimal | number,
  descricao: string,
  dataPagamento: Date,
  pagamentoFornecedorId?: string,
  metodoPagamento?: string
): Promise<string | null> {
  return MotorLancamentosService.executar(instituicaoId, 'pagamento_fornecedor', {
    valor,
    descricao,
    data: dataPagamento,
    metodoPagamento,
    referenciaId: pagamentoFornecedorId,
    referenciaTipo: 'pagamento_fornecedor',
  });
}
