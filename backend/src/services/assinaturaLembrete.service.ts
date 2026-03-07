import prisma from '../lib/prisma.js';
import { EmailService } from './email.service.js';
import { getAdminInfoForInstituicao } from './instituicaoAdmin.service.js';

const DIAS_ANTES_PADRAO = 5;

/**
 * Envia lembretes de assinatura a expirar (5 dias antes por padrão).
 * Usa diasAntesLembrete da assinatura ou 5 como padrão.
 * Atualiza ultimoLembreteEnviado para evitar envios duplicados.
 */
export async function enviarLembretesAssinaturaExpiracao(): Promise<{ enviados: number; erros: string[] }> {
  const erros: string[] = [];
  let enviados = 0;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const assinaturas = await prisma.assinatura.findMany({
    where: {
      status: 'ativa',
      dataFim: { not: null },
    },
    include: {
      plano: { select: { nome: true } },
      instituicao: { select: { nome: true, subdominio: true, emailContato: true } },
    },
  });

  for (const assinatura of assinaturas) {
    if (!assinatura.dataFim) continue;

    const dataFim = new Date(assinatura.dataFim);
    dataFim.setHours(0, 0, 0, 0);
    const diasRestantes = Math.ceil((dataFim.getTime() - hoje.getTime()) / (24 * 60 * 60 * 1000));
    const diasAntes = assinatura.diasAntesLembrete ?? DIAS_ANTES_PADRAO;

    // Enviar apenas quando faltam exatamente diasAntes dias (evita múltiplos envios)
    if (diasRestantes <= 0 || diasRestantes !== diasAntes) continue;

    // Evitar reenvio: se já enviou lembrete para esta assinatura, não reenviar
    if (assinatura.ultimoLembreteEnviado) continue;

    try {
      const { email } = await getAdminInfoForInstituicao(assinatura.instituicaoId);
      const emailDestino = email || assinatura.instituicao?.emailContato;
      if (!emailDestino) continue;

      await EmailService.sendEmail(
        null,
        emailDestino,
        'ASSINATURA_EXPIRANDO',
        {
          planoNome: assinatura.plano?.nome || 'N/A',
          dataExpiracao: dataFim.toLocaleDateString('pt-BR'),
          diasRestantes,
          nomeDestinatario: 'Administrador',
        },
        {
          instituicaoId: assinatura.instituicaoId,
        }
      );

      await prisma.assinatura.update({
        where: { id: assinatura.id },
        data: { ultimoLembreteEnviado: new Date() },
      });
      enviados++;
    } catch (error: any) {
      erros.push(`Assinatura ${assinatura.id}: ${error.message}`);
      console.error('[assinaturaLembrete] Erro ao enviar:', error.message);
    }
  }

  return { enviados, erros };
}
