import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';

// Verificar inadimplência de aluno (authenticate middleware garante req.user)
export const verificarInadimplencia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { alunoId } = req.params;

    const mensalidadesAtrasadas = await prisma.mensalidade.findMany({
      where: {
        alunoId,
        status: 'Atrasado',
      },
    });

    const totalDivida = mensalidadesAtrasadas.reduce((acc, m) => {
      const valor = Number(m.valor) || 0;
      const multa = Number(m.valorMulta) || 0;
      return acc + valor + multa;
    }, 0);

    res.json({
      inadimplente: mensalidadesAtrasadas.length > 0,
      quantidadeMensalidadesAtrasadas: mensalidadesAtrasadas.length,
      totalDivida,
      mensalidades: mensalidadesAtrasadas,
    });
  } catch (error) {
    next(error);
  }
};

// Verificar assinatura expirada
export const verificarAssinaturaExpirada = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // IMPORTANTE: Multi-tenant - instituicaoId vem APENAS do JWT (req.user.instituicaoId)
    // NUNCA ler de req.params, req.query ou req.body
    if (!req.user?.instituicaoId) {
      return res.json({
        expirada: true,
        motivo: 'Usuário sem instituição vinculada',
      });
    }

    const instituicaoId = req.user.instituicaoId;

    const assinatura = await prisma.assinatura.findUnique({
      where: { instituicaoId },
      include: {
        plano: { select: { nome: true } },
      },
    });

    if (!assinatura) {
      return res.json({
        expirada: true,
        motivo: 'Sem assinatura',
      });
    }

    const hoje = new Date();
    const dataProximoPagamento = assinatura.dataProximoPagamento 
      ? new Date(assinatura.dataProximoPagamento) 
      : null;

    const expirada = 
      assinatura.status === 'suspensa' || 
      assinatura.status === 'cancelada' ||
      (dataProximoPagamento && dataProximoPagamento < hoje);

    res.json({
      expirada,
      status: assinatura.status,
      plano: assinatura.plano?.nome,
      dataProximoPagamento: assinatura.dataProximoPagamento,
      diasRestantes: dataProximoPagamento 
        ? Math.ceil((dataProximoPagamento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
        : null,
    });
  } catch (error) {
    next(error);
  }
};
