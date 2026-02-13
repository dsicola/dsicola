import { Request } from 'express';
import prisma from '../lib/prisma.js';
import { AuditService } from './audit.service.js';
import { addInstitutionFilter } from '../middlewares/auth.js';
import { EntidadeComEstado } from '../middlewares/estado.middleware.js';

/**
 * Estados disponíveis
 */
export type EstadoRegistro = 'RASCUNHO' | 'EM_REVISAO' | 'APROVADO' | 'ENCERRADO';

/**
 * Serviço para gerenciar estados de registros
 */
export class EstadoService {
  /**
   * Atualizar estado de uma entidade
   * Registra auditoria automaticamente
   */
  static async atualizarEstado(
    req: Request,
    tipo: EntidadeComEstado,
    entidadeId: string,
    novoEstado: EstadoRegistro,
    observacao?: string
  ): Promise<void> {
    const filter = addInstitutionFilter(req);
    const userId = req.user?.userId;

    // Buscar entidade atual
    let entidadeAtual: any;
    let estadoAnterior: string | null = null;

    switch (tipo) {
      case 'Semestre': {
        entidadeAtual = await prisma.semestre.findFirst({
          where: { id: entidadeId, ...filter },
        });
        if (entidadeAtual) {
          estadoAnterior = entidadeAtual.estado;
          await prisma.semestre.update({
            where: { id: entidadeId },
            data: { estado: novoEstado },
          });
        }
        break;
      }
      case 'PlanoEnsino': {
        entidadeAtual = await prisma.planoEnsino.findFirst({
          where: { id: entidadeId, ...filter },
        });
        if (entidadeAtual) {
          estadoAnterior = entidadeAtual.estado;
          await prisma.planoEnsino.update({
            where: { id: entidadeId },
            data: { estado: novoEstado },
          });
        }
        break;
      }
      case 'Avaliacao': {
        entidadeAtual = await prisma.avaliacao.findFirst({
          where: { id: entidadeId, ...filter },
        });
        if (entidadeAtual) {
          estadoAnterior = entidadeAtual.estado;
          await prisma.avaliacao.update({
            where: { id: entidadeId },
            data: { estado: novoEstado },
          });
        }
        break;
      }
    }

    if (!entidadeAtual) {
      throw new Error(`${tipo} não encontrado`);
    }

    // Registrar auditoria
    await AuditService.log(req, {
      modulo: tipo.toUpperCase().replace('ENSINO', '_ENSINO') as any,
      acao: 'ESTADO_ALTERADO' as any,
      entidade: tipo,
      entidadeId,
      dadosAnteriores: { estado: estadoAnterior },
      dadosNovos: { estado: novoEstado },
      observacao: observacao || `Estado alterado de ${estadoAnterior || 'N/A'} para ${novoEstado}`,
    });
  }

  /**
   * Verificar se estado permite edição
   */
  static estadoPermiteEdicao(estado: string | null | undefined): boolean {
    if (!estado) return true;
    return estado !== 'ENCERRADO';
  }

  /**
   * Obter estado atual de uma entidade
   */
  static async obterEstado(
    tipo: EntidadeComEstado,
    entidadeId: string,
    filter: any
  ): Promise<string | null> {
    switch (tipo) {
      case 'Semestre': {
        const semestre = await prisma.semestre.findFirst({
          where: { id: entidadeId, ...filter },
          select: { estado: true },
        });
        return semestre?.estado || null;
      }
      case 'PlanoEnsino': {
        const plano = await prisma.planoEnsino.findFirst({
          where: { id: entidadeId, ...filter },
          select: { estado: true },
        });
        return plano?.estado || null;
      }
      case 'Avaliacao': {
        const avaliacao = await prisma.avaliacao.findFirst({
          where: { id: entidadeId, ...filter },
          select: { estado: true },
        });
        return avaliacao?.estado || null;
      }
      default:
        return null;
    }
  }
}

