import prisma from '../lib/prisma.js';
import { NotificacaoService, TipoNotificacao } from './notificacao.service.js';
import type { Request } from 'express';

const DEFAULT_LIMITE_EMPRESTIMOS = 5;
const DEFAULT_MULTA_POR_DIA = 0;
const DEFAULT_DIAS_NOTIFICAR = 3;
const DEFAULT_DIAS_VALIDADE_RESERVA = 7;

/**
 * Obter ou criar configuração da biblioteca para instituição
 */
export async function getBibliotecaConfig(instituicaoId: string) {
  let config = await prisma.bibliotecaConfig.findUnique({
    where: { instituicaoId },
  });
  if (!config) {
    config = await prisma.bibliotecaConfig.create({
      data: {
        instituicaoId,
        limiteEmprestimosPorUsuario: DEFAULT_LIMITE_EMPRESTIMOS,
        multaPorDiaAtraso: DEFAULT_MULTA_POR_DIA,
        diasParaNotificarVencimento: DEFAULT_DIAS_NOTIFICAR,
        diasValidadeReserva: DEFAULT_DIAS_VALIDADE_RESERVA,
      },
    });
  }
  return config;
}

/**
 * Verificar limite de empréstimos do usuário
 */
export async function verificarLimiteEmprestimos(
  instituicaoId: string,
  usuarioId: string
): Promise<{ permitido: boolean; atual: number; limite: number }> {
  const config = await getBibliotecaConfig(instituicaoId);
  const limite = config.limiteEmprestimosPorUsuario;

  const atual = await prisma.emprestimoBiblioteca.count({
    where: {
      usuarioId,
      instituicaoId,
      status: 'ATIVO',
    },
  });

  return {
    permitido: atual < limite,
    atual,
    limite,
  };
}

/**
 * Calcular multa por atraso e criar registro
 */
export async function calcularECriarMulta(
  emprestimoId: string,
  dataPrevista: Date,
  dataDevolucao: Date,
  instituicaoId: string
): Promise<{ multaId?: string; valor: number; diasAtraso: number }> {
  const dataPrev = new Date(dataPrevista);
  const dataDev = new Date(dataDevolucao);
  if (dataDev <= dataPrev) {
    return { valor: 0, diasAtraso: 0 };
  }

  const diffMs = dataDev.getTime() - dataPrev.getTime();
  const diasAtraso = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diasAtraso <= 0) return { valor: 0, diasAtraso: 0 };

  const config = await getBibliotecaConfig(instituicaoId);
  const multaPorDia = Number(config.multaPorDiaAtraso || 0);
  const valor = Math.round(diasAtraso * multaPorDia * 100) / 100;

  if (valor <= 0) {
    return { valor: 0, diasAtraso };
  }

  const multa = await prisma.multaBiblioteca.create({
    data: {
      emprestimoId,
      valor,
      diasAtraso,
      status: 'PENDENTE',
      instituicaoId,
    },
  });

  return { multaId: multa.id, valor, diasAtraso };
}

/**
 * Enviar notificações de empréstimos próximos do vencimento ou atrasados
 * Chamado pelo scheduler diariamente
 */
export async function enviarNotificacoesVencimento(req: Request | null): Promise<number> {
  let enviadas = 0;
  const instituicoes = await prisma.instituicao.findMany({
    where: { status: 'ativa' },
    select: { id: true },
  });

  for (const inst of instituicoes) {
    try {
      const config = await getBibliotecaConfig(inst.id);
      const diasNotificar = config.diasParaNotificarVencimento;

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const limiteAviso = new Date(hoje);
      limiteAviso.setDate(limiteAviso.getDate() + diasNotificar);

      const emprestimosProximos = await prisma.emprestimoBiblioteca.findMany({
        where: {
          instituicaoId: inst.id,
          status: 'ATIVO',
          dataPrevista: {
            gte: hoje,
            lte: limiteAviso,
          },
        },
        include: {
          item: { select: { titulo: true } },
          usuario: { select: { id: true } },
        },
      });

      for (const emp of emprestimosProximos) {
        const dataPrev = new Date(emp.dataPrevista);
        dataPrev.setHours(0, 0, 0, 0);
        const diffDias = Math.ceil((dataPrev.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

        const n = await NotificacaoService.criar(req, {
          userId: emp.usuarioId,
          titulo: 'Empréstimo da biblioteca vence em breve',
          mensagem: `O item "${emp.item.titulo}" vence em ${diffDias} dia(s). Data prevista: ${emp.dataPrevista.toLocaleDateString('pt-BR')}.`,
          tipo: TipoNotificacao.LEMBRETE,
          link: '/biblioteca',
          instituicaoId: inst.id,
        });
        if (n) enviadas++;
      }

      const emprestimosAtrasados = await prisma.emprestimoBiblioteca.findMany({
        where: {
          instituicaoId: inst.id,
          status: 'ATIVO',
          dataPrevista: { lt: hoje },
        },
        include: {
          item: { select: { titulo: true } },
        },
      });

      for (const emp of emprestimosAtrasados) {
        const n = await NotificacaoService.criar(req, {
          userId: emp.usuarioId,
          titulo: 'Empréstimo da biblioteca em atraso',
          mensagem: `O item "${emp.item.titulo}" está em atraso desde ${emp.dataPrevista.toLocaleDateString('pt-BR')}. Devolva o mais breve possível para evitar multas.`,
          tipo: TipoNotificacao.AVISO,
          link: '/biblioteca',
          instituicaoId: inst.id,
        });
        if (n) enviadas++;
      }
    } catch (err) {
      console.error('[biblioteca.service] Erro ao enviar notificações para instituição', inst.id, err);
    }
  }

  return enviadas;
}

/**
 * Expirar reservas antigas (chamado pelo scheduler)
 */
export async function expirarReservasAntigas(): Promise<number> {
  const result = await prisma.reservaBiblioteca.updateMany({
    where: {
      status: 'PENDENTE',
      dataExpiracao: { lt: new Date() },
    },
    data: { status: 'EXPIRADA' },
  });
  return result.count;
}
