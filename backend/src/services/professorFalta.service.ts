/**
 * Serviço de faltas de professores
 * - Registo manual (ADMIN, RH, SECRETARIA)
 * - Processamento automático (aulas previstas não dadas)
 */

import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Regista falta manual
 * @param professorId - ID do professor
 * @param data - Data da falta
 * @param fracaoFalta - 0.5 (meia aula), 1 (inteira), 1.5, etc.
 * @param justificada - se a falta é justificada (não desconta)
 * @param registadoPorId - userId de quem regista (ADMIN, RH, SECRETARIA)
 * @param observacoes
 */
export async function registarFaltaManual(
  professorId: string,
  data: Date,
  instituicaoId: string,
  opts: {
    fracaoFalta?: number;
    justificada?: boolean;
    registadoPorId?: string;
    observacoes?: string;
  } = {}
) {
  const professor = await prisma.professor.findFirst({
    where: { id: professorId, instituicaoId },
  });
  if (!professor) {
    throw new AppError('Professor não encontrado', 404);
  }

  const fracao = Math.max(0.25, Math.min(10, opts.fracaoFalta ?? 1)); // 0.25 a 10

  return prisma.professorFalta.create({
    data: {
      professorId,
      data: new Date(data),
      fracaoFalta: new Decimal(fracao),
      justificada: opts.justificada ?? false,
      origem: 'MANUAL',
      registadoPorId: opts.registadoPorId ?? null,
      observacoes: opts.observacoes ?? null,
      instituicaoId,
    },
    include: {
      professor: { include: { user: { select: { nomeCompleto: true } } } },
    },
  });
}

/**
 * Processa faltas automáticas: aulas previstas (DistribuicaoAula) sem AulaLancada
 * Para cada professor com plano de ensino, verifica dias no mês com distribuição mas sem aula lançada
 */
export async function processarFaltasAutomaticas(
  data: Date,
  instituicaoId: string
): Promise<{ processadas: number; criadas: number }> {
  const dataNorm = new Date(data);
  dataNorm.setHours(0, 0, 0, 0);

  // Distribuições com data = dataNorm
  const distribuicoes = await prisma.distribuicaoAula.findMany({
    where: {
      instituicaoId,
      data: {
        gte: dataNorm,
        lt: new Date(dataNorm.getTime() + 24 * 60 * 60 * 1000),
      },
    },
    include: {
      planoEnsino: { select: { professorId: true } },
    },
  });

  let criadas = 0;
  for (const dist of distribuicoes) {
    const professorId = dist.planoEnsino.professorId;

    // Verificar se já existe AulaLancada para este planoAula nesta data
    const planoAula = await prisma.planoAula.findUnique({
      where: { id: dist.planoAulaId },
      select: { quantidadeAulas: true },
    });
    const aulasEsperadas = planoAula?.quantidadeAulas ?? 1;

    const aulaLancada = await prisma.aulaLancada.findFirst({
      where: {
        planoAulaId: dist.planoAulaId,
        planoEnsinoId: dist.planoEnsinoId,
        data: {
          gte: dataNorm,
          lt: new Date(dataNorm.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });

    if (!aulaLancada) {
      // Aula prevista mas não dada = falta
      const existente = await prisma.professorFalta.findFirst({
        where: {
          professorId,
          instituicaoId,
          data: dataNorm,
          origem: 'AUTOMATICO',
        },
      });

      if (!existente) {
        await prisma.professorFalta.create({
          data: {
            professorId,
            data: dataNorm,
            fracaoFalta: new Decimal(aulasEsperadas),
            justificada: false,
            origem: 'AUTOMATICO',
            instituicaoId,
          },
        });
        criadas++;
      }
    }
  }

  return { processadas: distribuicoes.length, criadas };
}
