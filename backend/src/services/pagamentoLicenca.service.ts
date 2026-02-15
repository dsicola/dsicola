import prisma from '../lib/prisma.js';

/**
 * Service para lógica compartilhada de pagamentos de licença
 */

/**
 * Renovar licença automaticamente após pagamento confirmado
 */
export async function renovarLicencaAutomatica(
  assinaturaId: string,
  periodo: 'MENSAL' | 'SEMESTRAL' | 'ANUAL'
): Promise<Date> {
  const assinatura = await prisma.assinatura.findUnique({
    where: { id: assinaturaId },
  });

  if (!assinatura) {
    throw new Error('Assinatura não encontrada');
  }

  // Calcular nova data fim
  const dataAtual = new Date();
  const dataFimAtual = assinatura.dataFim || dataAtual;
  const novaDataFim = new Date(dataFimAtual);

  // Adicionar período
  if (periodo === 'MENSAL') {
    novaDataFim.setMonth(novaDataFim.getMonth() + 1);
  } else if (periodo === 'SEMESTRAL') {
    novaDataFim.setMonth(novaDataFim.getMonth() + 6);
  } else if (periodo === 'ANUAL') {
    novaDataFim.setFullYear(novaDataFim.getFullYear() + 1);
  }

  // Atualizar assinatura
  await prisma.assinatura.update({
    where: { id: assinatura.id },
    data: {
      dataFim: novaDataFim,
      dataProximoPagamento: novaDataFim,
      status: 'ativa', // Garantir que está ativa
    },
  });

  return novaDataFim;
}

/**
 * Verificar se já existe pagamento PENDING para evitar duplicatas
 */
export async function verificarPagamentoPendente(
  instituicaoId: string,
  plano: string,
  periodo: 'MENSAL' | 'SEMESTRAL' | 'ANUAL'
): Promise<boolean> {
  const pagamentoPendente = await prisma.pagamentoLicenca.findFirst({
    where: {
      instituicaoId,
      status: 'PENDING',
      plano: plano.toUpperCase(),
      periodo,
    },
  });

  return !!pagamentoPendente;
}

