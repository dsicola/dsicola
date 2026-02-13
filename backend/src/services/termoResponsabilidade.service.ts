import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { Request } from 'express';

/**
 * Serviço de Termo de Responsabilidade Enterprise
 * Implementa aviso legal e termo de responsabilidade para operações críticas
 * Apenas SUPER_ADMIN deve confirmar termo antes de operações críticas
 */
export class TermoResponsabilidadeService {
  private static readonly PALAVRA_CHAVE = 'CONFIRMO';

  /**
   * Criar termo de responsabilidade
   * @param userId ID do usuário
   * @param instituicaoId ID da instituição (opcional para SUPER_ADMIN)
   * @param operacao Tipo de operação (RESTORE, REABERTURA_ANO_LETIVO, etc.)
   * @param palavraChave Palavra-chave digitada pelo usuário
   * @param req Request para capturar IP e User-Agent
   * @returns ID do termo criado
   */
  static async criarTermo(
    userId: string,
    instituicaoId: string | null,
    operacao: string,
    palavraChave: string,
    req?: Request | null
  ): Promise<string> {
    // Validar palavra-chave
    if (palavraChave.toUpperCase() !== this.PALAVRA_CHAVE) {
      throw new AppError(
        'Palavra-chave incorreta. Digite "CONFIRMO" para confirmar esta operação.',
        400
      );
    }

    // Capturar IP e User-Agent
    const ip = req?.ip || req?.socket.remoteAddress || null;
    const userAgent = req?.get('user-agent') || null;

    // Criar termo de responsabilidade
    const termo = await prisma.termoResponsabilidade.create({
      data: {
        userId,
        instituicaoId,
        operacao,
        palavraChave: palavraChave.toUpperCase(),
        ip,
        userAgent,
      },
    });

    // AUDITORIA: Registrar criação do termo
    try {
      const { AuditService } = await import('./audit.service.js');
      await AuditService.log(req || null, {
        modulo: 'SEGURANCA',
        acao: 'TERMO_RESPONSABILIDADE',
        entidade: 'TERMO_RESPONSABILIDADE',
        entidadeId: termo.id,
        instituicaoId: instituicaoId || undefined,
        dadosNovos: {
          operacao,
          confirmado_em: termo.confirmadoEm.toISOString(),
        },
        observacao: `Termo de responsabilidade criado para operação: ${operacao}`,
      });
    } catch (auditError) {
      console.warn('[TermoResponsabilidadeService] Erro ao registrar auditoria:', auditError);
      // Não falhar se auditoria falhar
    }

    return termo.id;
  }

  /**
   * Verificar se termo de responsabilidade é obrigatório para operação
   * @param operacao Tipo de operação
   * @returns true se termo é obrigatório
   */
  static isTermoObrigatorio(operacao: string): boolean {
    const operacoesCriticas = [
      'RESTORE',
      'REABERTURA_ANO_LETIVO',
      'ENCERRAMENTO_ANO_LETIVO',
      'ALTERACAO_DADOS_CRITICOS',
      'EXCLUSAO_MASSA',
    ];
    return operacoesCriticas.includes(operacao.toUpperCase());
  }

  /**
   * Obter palavra-chave esperada
   */
  static getPalavraChave(): string {
    return this.PALAVRA_CHAVE;
  }
}

