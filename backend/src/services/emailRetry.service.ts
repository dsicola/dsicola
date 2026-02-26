import prisma from '../lib/prisma.js';
import { EmailService } from './email.service.js';
import { Request } from 'express';

/**
 * Configurações de retry
 */
const MAX_TENTATIVAS = 3;
const RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutos entre tentativas

/**
 * Serviço de retry para e-mails falhados
 */
export class EmailRetryService {
  /**
   * Processar e-mails falhados que precisam de retry
   * @param limit - Número máximo de e-mails para processar por vez
   * @returns Estatísticas do processamento
   */
  static async processarEmailsFalhados(limit: number = 10): Promise<{
    processados: number;
    sucessos: number;
    erros: number;
  }> {
    const agora = new Date();
    const tempoMinimoRetry = new Date(agora.getTime() - RETRY_DELAY_MS);

    // Buscar e-mails com erro que ainda não atingiram o limite de tentativas
    const emailsFalhados = await prisma.emailEnviado.findMany({
      where: {
        status: 'erro',
        tentativas: { lt: MAX_TENTATIVAS },
        OR: [
          { proximaTentativa: null },
          { proximaTentativa: { lte: agora } },
        ],
      },
      take: limit,
      orderBy: {
        ultimaTentativa: 'asc', // Processar os que esperaram mais tempo primeiro
      },
    });

    let processados = 0;
    let sucessos = 0;
    let erros = 0;

    for (const emailLog of emailsFalhados) {
      try {
        processados++;

        // Verificar se há dados do e-mail salvos para retry.
        // Nota: anexos (ex.: PDF do recibo folha) não são guardados em dadosEmail; o retry reenvia só corpo/assunto.
        if (!emailLog.dadosEmail) {
          // Se não há dados salvos, marcar como não retryável
          await prisma.emailEnviado.update({
            where: { id: emailLog.id },
            data: {
              tentativas: MAX_TENTATIVAS,
              erro: 'Dados do e-mail não disponíveis para retry',
            },
          });
          erros++;
          continue;
        }

        const dadosEmail = emailLog.dadosEmail as any;

        // Tentar reenviar o e-mail
        const resultado = await EmailService.sendEmail(
          null, // req não disponível em retry automático
          emailLog.destinatarioEmail,
          dadosEmail.tipo,
          dadosEmail.data,
          {
            destinatarioNome: emailLog.destinatarioNome || undefined,
            instituicaoId: emailLog.instituicaoId || undefined,
            customSubject: dadosEmail.subject,
            customHtml: dadosEmail.html,
          }
        );

        if (resultado.success) {
          // Atualizar status para enviado
          await prisma.emailEnviado.update({
            where: { id: emailLog.id },
            data: {
              status: 'enviado',
              erro: null,
              tentativas: { increment: 1 },
              ultimaTentativa: agora,
            },
          });
          sucessos++;
        } else {
          // Incrementar tentativas e agendar próxima tentativa
          const novasTentativas = emailLog.tentativas + 1;
          const proximaTentativa = novasTentativas < MAX_TENTATIVAS
            ? new Date(agora.getTime() + RETRY_DELAY_MS)
            : null;

          await prisma.emailEnviado.update({
            where: { id: emailLog.id },
            data: {
              tentativas: novasTentativas,
              erro: resultado.error || 'Erro desconhecido',
              ultimaTentativa: agora,
              proximaTentativa,
            },
          });
          erros++;
        }

        // Delay entre tentativas para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        erros++;
        console.error(`[EmailRetryService] Erro ao processar e-mail ${emailLog.id}:`, error.message);
        
        // Incrementar tentativas mesmo em caso de erro crítico
        const novasTentativas = emailLog.tentativas + 1;
        const proximaTentativa = novasTentativas < MAX_TENTATIVAS
          ? new Date(agora.getTime() + RETRY_DELAY_MS)
          : null;

        await prisma.emailEnviado.update({
          where: { id: emailLog.id },
          data: {
            tentativas: novasTentativas,
            erro: error.message || 'Erro crítico no retry',
            ultimaTentativa: agora,
            proximaTentativa,
          },
        });
      }
    }

    return { processados, sucessos, erros };
  }

  /**
   * Agendar retry manual para um e-mail específico
   */
  static async agendarRetry(emailLogId: string): Promise<void> {
    const emailLog = await prisma.emailEnviado.findUnique({
      where: { id: emailLogId },
    });

    if (!emailLog) {
      throw new Error('E-mail não encontrado');
    }

    if (emailLog.status === 'enviado') {
      throw new Error('E-mail já foi enviado com sucesso');
    }

    if (emailLog.tentativas >= MAX_TENTATIVAS) {
      throw new Error('Limite de tentativas atingido');
    }

    const agora = new Date();
    const proximaTentativa = new Date(agora.getTime() + RETRY_DELAY_MS);

    await prisma.emailEnviado.update({
      where: { id: emailLogId },
      data: {
        proximaTentativa,
        ultimaTentativa: agora,
      },
    });
  }

  /**
   * Obter estatísticas de e-mails
   */
  static async obterEstatisticas(instituicaoId?: string): Promise<{
    total: number;
    enviados: number;
    falhados: number;
    pendentesRetry: number;
    tentativasMedias: number;
  }> {
    const where: any = instituicaoId ? { instituicaoId } : {};

    const [total, enviados, falhados, pendentesRetry, tentativas] = await Promise.all([
      prisma.emailEnviado.count({ where }),
      prisma.emailEnviado.count({ where: { ...where, status: 'enviado' } }),
      prisma.emailEnviado.count({ where: { ...where, status: 'erro' } }),
      prisma.emailEnviado.count({
        where: {
          ...where,
          status: 'erro',
          tentativas: { lt: MAX_TENTATIVAS },
        },
      }),
      prisma.emailEnviado.aggregate({
        where,
        _avg: { tentativas: true },
      }),
    ]);

    return {
      total,
      enviados,
      falhados,
      pendentesRetry,
      tentativasMedias: tentativas._avg.tentativas || 0,
    };
  }
}

