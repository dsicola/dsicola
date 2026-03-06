/**
 * Integração Contabilidade ↔ Pagamentos, Folha de Pagamento, Fornecedores
 * Gera lançamentos contábeis automáticos.
 *
 * Usa ConfiguracaoContabilidade para códigos de conta por instituição.
 * Fallback: 11 Caixa, 12 Banco, 41 Receita Mensalidades, 42 Receita Taxas, 51 Pessoal, 21 Fornecedores.
 *
 * Se as contas não existirem no plano, o lançamento é ignorado (não bloqueia o fluxo).
 */
import prisma from '../lib/prisma.js';
import { Decimal } from '@prisma/client/runtime/library';
import { ConfiguracaoContabilidadeService } from './configuracao-contabilidade.service.js';

async function getProximoNumero(instituicaoId: string, data: Date): Promise<string> {
  const ano = data.getFullYear();
  const ultimo = await prisma.lancamentoContabil.findFirst({
    where: { instituicaoId, numero: { startsWith: `${ano}-` } },
    orderBy: { numero: 'desc' },
  });
  const seq = ultimo ? parseInt(ultimo.numero.split('-')[1] || '0', 10) + 1 : 1;
  return `${ano}-${String(seq).padStart(3, '0')}`;
}

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
  const valorNum = typeof valor === 'number' ? valor : Number(valor);
  if (valorNum <= 0) return null;

  const codigos = await ConfiguracaoContabilidadeService.getCodigosContas(instituicaoId);
  const usaBanco = metodoPagamento === 'TRANSFERENCIA' || metodoPagamento === 'CHEQUE';
  const codigoContaDestino = usaBanco ? codigos.contaBanco : codigos.contaCaixa;

  const contaDestino = await prisma.planoConta.findFirst({
    where: { instituicaoId, codigo: codigoContaDestino, ativo: true },
  });
  const contaReceita = await prisma.planoConta.findFirst({
    where: { instituicaoId, codigo: codigos.contaReceitaMensalidades, ativo: true },
  });

  if (!contaDestino || !contaReceita) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[ContabilidadeIntegracao] Contas ${codigoContaDestino} ou ${codigos.contaReceitaMensalidades} não encontradas. Configure em Contabilidade → Configuração.`
      );
    }
    return null;
  }

  const numero = await getProximoNumero(instituicaoId, dataPagamento);
  const descLanc = pagamentoId ? `${descricao} (Pagamento ${pagamentoId.slice(0, 8)})` : descricao;

  const lancamento = await prisma.lancamentoContabil.create({
    data: {
      instituicaoId,
      numero,
      data: dataPagamento,
      descricao: descLanc,
      fechado: true,
      linhas: {
        create: [
          { contaId: contaDestino.id, debito: valorNum, credito: 0, ordem: 0 },
          { contaId: contaReceita.id, debito: 0, credito: valorNum, ordem: 1 },
        ],
      },
    },
  });
  return lancamento.id;
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
  const valorNum = typeof valor === 'number' ? valor : Number(valor);
  if (valorNum <= 0) return null;

  const codigos = await ConfiguracaoContabilidadeService.getCodigosContas(instituicaoId);
  const usaBanco = metodoPagamentoOriginal === 'TRANSFERENCIA' || metodoPagamentoOriginal === 'CHEQUE';
  const codigoContaDestino = usaBanco ? codigos.contaBanco : codigos.contaCaixa;

  const contaDestino = await prisma.planoConta.findFirst({
    where: { instituicaoId, codigo: codigoContaDestino, ativo: true },
  });
  const contaReceita = await prisma.planoConta.findFirst({
    where: { instituicaoId, codigo: codigos.contaReceitaMensalidades, ativo: true },
  });

  if (!contaDestino || !contaReceita) return null;

  const numero = await getProximoNumero(instituicaoId, dataEstorno);
  const descLanc = pagamentoOriginalId
    ? `${descricao} (Estorno Pag. ${pagamentoOriginalId.slice(0, 8)})`
    : descricao;

  const lancamento = await prisma.lancamentoContabil.create({
    data: {
      instituicaoId,
      numero,
      data: dataEstorno,
      descricao: descLanc,
      fechado: true,
      linhas: {
        create: [
          { contaId: contaDestino.id, debito: 0, credito: valorNum, ordem: 0 },
          { contaId: contaReceita.id, debito: valorNum, credito: 0, ordem: 1 },
        ],
      },
    },
  });
  return lancamento.id;
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
  const valorNum = typeof valor === 'number' ? valor : Number(valor);
  if (valorNum <= 0) return null;

  const codigos = await ConfiguracaoContabilidadeService.getCodigosContas(instituicaoId);
  const usaBanco = metodoPagamento === 'TRANSFERENCIA' || metodoPagamento === 'CHEQUE';
  const codigoContaOrigem = usaBanco ? codigos.contaBanco : codigos.contaCaixa;

  const contaPessoal = await prisma.planoConta.findFirst({
    where: { instituicaoId, codigo: codigos.contaPessoal, ativo: true },
  });
  const contaOrigem = await prisma.planoConta.findFirst({
    where: { instituicaoId, codigo: codigoContaOrigem, ativo: true },
  });

  if (!contaPessoal || !contaOrigem) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[ContabilidadeIntegracao] Contas ${codigos.contaPessoal} ou ${codigoContaOrigem} não encontradas para folha. Configure em Contabilidade → Configuração.`
      );
    }
    return null;
  }

  const numero = await getProximoNumero(instituicaoId, dataPagamento);
  const descLanc = folhaId ? `${descricao} (Folha ${folhaId.slice(0, 8)})` : descricao;

  const lancamento = await prisma.lancamentoContabil.create({
    data: {
      instituicaoId,
      numero,
      data: dataPagamento,
      descricao: descLanc,
      fechado: true,
      linhas: {
        create: [
          { contaId: contaPessoal.id, debito: valorNum, credito: 0, ordem: 0 },
          { contaId: contaOrigem.id, debito: 0, credito: valorNum, ordem: 1 },
        ],
      },
    },
  });
  return lancamento.id;
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
  const valorNum = typeof valor === 'number' ? valor : Number(valor);
  if (valorNum <= 0) return null;

  const codigos = await ConfiguracaoContabilidadeService.getCodigosContas(instituicaoId);
  const usaBanco = metodoPagamentoOriginal === 'TRANSFERENCIA' || metodoPagamentoOriginal === 'CHEQUE';
  const codigoContaOrigem = usaBanco ? codigos.contaBanco : codigos.contaCaixa;

  const contaPessoal = await prisma.planoConta.findFirst({
    where: { instituicaoId, codigo: codigos.contaPessoal, ativo: true },
  });
  const contaOrigem = await prisma.planoConta.findFirst({
    where: { instituicaoId, codigo: codigoContaOrigem, ativo: true },
  });

  if (!contaPessoal || !contaOrigem) return null;

  const numero = await getProximoNumero(instituicaoId, dataEstorno);
  const descLanc = folhaId ? `${descricao} (Estorno Folha ${folhaId.slice(0, 8)})` : descricao;

  const lancamento = await prisma.lancamentoContabil.create({
    data: {
      instituicaoId,
      numero,
      data: dataEstorno,
      descricao: descLanc,
      fechado: true,
      linhas: {
        create: [
          { contaId: contaPessoal.id, debito: 0, credito: valorNum, ordem: 0 },
          { contaId: contaOrigem.id, debito: valorNum, credito: 0, ordem: 1 },
        ],
      },
    },
  });
  return lancamento.id;
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
  const valorNum = typeof valor === 'number' ? valor : Number(valor);
  if (valorNum <= 0) return null;

  const codigos = await ConfiguracaoContabilidadeService.getCodigosContas(instituicaoId);
  const usaBanco = metodoPagamento === 'TRANSFERENCIA' || metodoPagamento === 'CHEQUE';
  const codigoContaOrigem = usaBanco ? codigos.contaBanco : codigos.contaCaixa;

  const contaFornecedores = await prisma.planoConta.findFirst({
    where: { instituicaoId, codigo: codigos.contaFornecedores, ativo: true },
  });
  const contaOrigem = await prisma.planoConta.findFirst({
    where: { instituicaoId, codigo: codigoContaOrigem, ativo: true },
  });

  if (!contaFornecedores || !contaOrigem) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[ContabilidadeIntegracao] Contas ${codigos.contaFornecedores} ou ${codigoContaOrigem} não encontradas para fornecedor. Configure em Contabilidade → Configuração.`
      );
    }
    return null;
  }

  const numero = await getProximoNumero(instituicaoId, dataPagamento);
  const descLanc = pagamentoFornecedorId
    ? `${descricao} (Pag.Fornec. ${pagamentoFornecedorId.slice(0, 8)})`
    : descricao;

  const lancamento = await prisma.lancamentoContabil.create({
    data: {
      instituicaoId,
      numero,
      data: dataPagamento,
      descricao: descLanc,
      fechado: true,
      linhas: {
        create: [
          { contaId: contaFornecedores.id, debito: valorNum, credito: 0, ordem: 0 },
          { contaId: contaOrigem.id, debito: 0, credito: valorNum, ordem: 1 },
        ],
      },
    },
  });
  return lancamento.id;
}
