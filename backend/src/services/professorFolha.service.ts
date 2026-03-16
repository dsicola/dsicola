/**
 * Serviço de folha de pagamento para professores CONTRATADOS
 * Cálculo: salário = (aulas ministradas × valor por aula) - descontos (faltas, outros)
 * Faltas: manual (ProfessorFalta) + automático (aulas previstas não dadas)
 */

import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Obtém total de faltas não justificadas do professor no mês (ProfessorFalta)
 * Soma fracaoFalta onde justificada=false
 */
export async function somarFaltasProfessorNoMes(
  professorId: string,
  mes: number,
  ano: number,
  instituicaoId: string
): Promise<number> {
  const inicioMes = new Date(ano, mes - 1, 1);
  const fimMes = new Date(ano, mes, 0, 23, 59, 59, 999);

  const faltas = await prisma.professorFalta.findMany({
    where: {
      professorId,
      instituicaoId,
      justificada: false,
      data: { gte: inicioMes, lte: fimMes },
    },
    select: { fracaoFalta: true },
  });

  return faltas.reduce((s, f) => s + parseFloat(f.fracaoFalta.toString()), 0);
}

/**
 * Calcula valor do desconto por falta conforme config (ParametrosSistema)
 * tipos: VALOR_AULA = 1 falta = 1×valorPorAula; PERCENTAGEM = 1 falta = valorPorAula×(valor/100); NUMERICO = valor fixo
 */
function calcularValorDescontoPorFalta(
  valorPorAula: number,
  fracaoFalta: number,
  config: { tipo: string | null; valor: number | null }
): number {
  const tipo = config.tipo || 'VALOR_AULA';
  const valor = config.valor ?? 0;

  if (tipo === 'VALOR_AULA') {
    return fracaoFalta * valorPorAula;
  }
  if (tipo === 'PERCENTAGEM') {
    const pct = Math.min(100, Math.max(0, valor)) / 100;
    return fracaoFalta * valorPorAula * pct;
  }
  if (tipo === 'NUMERICO') {
    return fracaoFalta * Math.max(0, valor);
  }
  return fracaoFalta * valorPorAula;
}

/**
 * Conta aulas ministradas por um professor num mês
 * Fonte: AulaLancada (aulas lançadas = aulas dadas)
 */
export async function contarAulasProfessorNoMes(
  professorId: string,
  mes: number,
  ano: number,
  instituicaoId: string
): Promise<number> {
  const inicioMes = new Date(ano, mes - 1, 1);
  const fimMes = new Date(ano, mes, 0, 23, 59, 59, 999);

  const result = await prisma.aulaLancada.aggregate({
    where: {
      planoEnsino: { professorId },
      instituicaoId,
      data: { gte: inicioMes, lte: fimMes },
    },
    _sum: { cargaHoraria: true },
  });

  return result._sum.cargaHoraria ?? 0;
}

/**
 * Calcula ou recalcula a folha de pagamento de um professor CONTRATADO
 */
export async function calcularFolhaProfessorContratado(
  professorId: string,
  mes: number,
  ano: number,
  instituicaoId: string,
  opts?: {
    faltasNaoJustificadas?: number;
    outrosDescontos?: number;
    bonus?: number;
  }
): Promise<{
  totalAulas: number;
  valorPorAula: number;
  salarioBruto: number;
  faltasNaoJustificadas: number;
  valorDescontoFaltas: number;
  outrosDescontos: number;
  bonus: number;
  salarioLiquido: number;
}> {
  const professor = await prisma.professor.findFirst({
    where: { id: professorId, instituicaoId },
  });

  if (!professor) {
    throw new AppError('Professor não encontrado', 404);
  }

  if (professor.tipoVinculo !== 'CONTRATADO') {
    throw new AppError('Professor não é contratado. Cálculo por aula aplica-se apenas a contratados.', 400);
  }

  const valorPorAula = professor.valorPorAula
    ? parseFloat(professor.valorPorAula.toString())
    : 0;

  if (valorPorAula <= 0) {
    throw new AppError('Professor contratado deve ter valor por aula configurado.', 400);
  }

  const totalAulas = await contarAulasProfessorNoMes(professorId, mes, ano, instituicaoId);
  const salarioBruto = totalAulas * valorPorAula;

  // Faltas: prioridade opts (override) > ProfessorFalta (registadas)
  let faltasNaoJustificadas: number;
  if (opts?.faltasNaoJustificadas !== undefined && opts.faltasNaoJustificadas !== null) {
    faltasNaoJustificadas = opts.faltasNaoJustificadas;
  } else {
    faltasNaoJustificadas = await somarFaltasProfessorNoMes(professorId, mes, ano, instituicaoId);
  }

  const params = await prisma.parametrosSistema.findUnique({
    where: { instituicaoId },
    select: {
      descontoFaltaProfessorTipo: true,
      descontoFaltaProfessorValor: true,
    },
  });
  const config = {
    tipo: params?.descontoFaltaProfessorTipo ?? 'VALOR_AULA',
    valor: params?.descontoFaltaProfessorValor != null ? parseFloat(params.descontoFaltaProfessorValor.toString()) : null,
  };
  const valorDescontoFaltas = calcularValorDescontoPorFalta(valorPorAula, faltasNaoJustificadas, config);
  const outrosDescontos = opts?.outrosDescontos ?? 0;
  const bonus = opts?.bonus ?? 0;
  const salarioLiquido = Math.max(0, salarioBruto - valorDescontoFaltas - outrosDescontos + bonus);

  return {
    totalAulas,
    valorPorAula,
    salarioBruto,
    faltasNaoJustificadas,
    valorDescontoFaltas,
    outrosDescontos,
    bonus,
    salarioLiquido,
  };
}

/**
 * Cria ou atualiza folha de pagamento do professor contratado
 */
export async function criarOuAtualizarFolhaProfessor(
  professorId: string,
  mes: number,
  ano: number,
  instituicaoId: string,
  opts?: {
    faltasNaoJustificadas?: number;
    outrosDescontos?: number;
    bonus?: number;
    observacoes?: string;
  }
) {
  const calc = await calcularFolhaProfessorContratado(
    professorId,
    mes,
    ano,
    instituicaoId,
    opts
  );

  const existing = await prisma.folhaPagamentoProfessor.findUnique({
    where: {
      professorId_mes_ano: { professorId, mes, ano },
    },
  });

  const data = {
    totalAulas: calc.totalAulas,
    valorPorAula: new Decimal(calc.valorPorAula),
    salarioBruto: new Decimal(calc.salarioBruto),
    faltasNaoJustificadas: new Decimal(Math.round(calc.faltasNaoJustificadas * 100) / 100),
    valorDescontoFaltas: new Decimal(calc.valorDescontoFaltas),
    outrosDescontos: new Decimal(calc.outrosDescontos),
    bonus: new Decimal(calc.bonus),
    salarioLiquido: new Decimal(calc.salarioLiquido),
    observacoes: opts?.observacoes,
  };

  if (existing) {
    if (existing.status !== 'DRAFT' && existing.status !== 'CALCULATED') {
      throw new AppError('Folha já está fechada ou paga. Não é possível alterar.', 400);
    }
    return prisma.folhaPagamentoProfessor.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.folhaPagamentoProfessor.create({
    data: {
      professorId,
      mes,
      ano,
      ...data,
    },
  });
}
