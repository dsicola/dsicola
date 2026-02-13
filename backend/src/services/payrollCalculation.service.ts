import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import {
  getSalarioBaseFuncionario,
  calcularDiasUteis,
  contarFaltasNaoJustificadas,
  contarHorasExtras,
  calcularValorHorasExtras,
} from './rh.service.js';

/**
 * Resultado do cálculo automático de folha de pagamento
 */
export interface CalculoFolhaResultado {
  salarioBase: number;
  diasUteis: number;
  valorDia: number;
  totalFaltasNaoJustificadas: number;
  descontosFaltas: number;
  horasExtras: number;
  valorHora: number;
  valorHorasExtras: number;
  salarioBruto: number;
  inss: number;
  irt: number;
  totalDescontos: number;
  salarioLiquido: number;
  origemCalculo: 'PRESENCA_BIOMETRICA';
  dadosPresenca: {
    totalPresencas: number;
    totalFaltas: number;
    totalAtrasos: number;
    diasTrabalhados: number;
  };
}

/**
 * Serviço de cálculo automático de folha de pagamento
 * Integra com presença biométrica para cálculos precisos
 */
export class PayrollCalculationService {
  /**
   * Calcular folha de pagamento automaticamente baseado em presenças biométricas
   * 
   * @param funcionarioId - ID do funcionário
   * @param mes - Mês (1-12)
   * @param ano - Ano (ex: 2024)
   * @param instituicaoId - ID da instituição (para multi-tenant)
   * @returns Promise<CalculoFolhaResultado>
   */
  static async calcularFolhaAutomatico(
    funcionarioId: string,
    mes: number,
    ano: number,
    instituicaoId: string
  ): Promise<CalculoFolhaResultado> {
    // Validar funcionário
    const funcionario = await prisma.funcionario.findUnique({
      where: { id: funcionarioId },
      select: {
        id: true,
        instituicaoId: true,
        cargo: {
          select: {
            nome: true,
          },
        },
      },
    });

    if (!funcionario) {
      throw new AppError('Funcionário não encontrado', 404);
    }

    // Multi-tenant: verificar se funcionário pertence à instituição
    if (funcionario.instituicaoId !== instituicaoId) {
      throw new AppError('Acesso negado: funcionário não pertence à instituição', 403);
    }

    // Buscar salário base do funcionário
    const salarioBase = await getSalarioBaseFuncionario(funcionarioId);

    if (!salarioBase || salarioBase <= 0) {
      throw new AppError(
        'Funcionário não possui salário base cadastrado. Cadastre um salário no funcionário ou cargo.',
        400
      );
    }

    // Calcular dias úteis do mês (excluindo sábados, domingos e feriados)
    const diasUteis = await calcularDiasUteis(mes, ano, instituicaoId);

    if (diasUteis === 0) {
      throw new AppError('Não há dias úteis no mês especificado', 400);
    }

    // Calcular valor por dia útil
    const valorDia = salarioBase / diasUteis;

    // BUSCAR PRESENÇAS BIOMÉTRICAS DO MÊS
    const primeiroDia = new Date(ano, mes - 1, 1);
    const ultimoDia = new Date(ano, mes, 0, 23, 59, 59);

    const presencas = await prisma.frequenciaFuncionario.findMany({
      where: {
        funcionarioId,
        data: {
          gte: primeiroDia,
          lte: ultimoDia,
        },
        instituicaoId,
      },
      orderBy: {
        data: 'asc',
      },
    });

    // Contar faltas não justificadas (baseado em presenças biométricas)
    const totalFaltasNaoJustificadas = await contarFaltasNaoJustificadas(
      funcionarioId,
      mes,
      ano
    );

    // Calcular desconto por faltas
    const descontosFaltas = valorDia * totalFaltasNaoJustificadas;

    // Buscar horas extras do mês (baseado em presenças biométricas)
    const horasExtras = await contarHorasExtras(funcionarioId, mes, ano);

    // Calcular valor da hora trabalhada (assumindo 8 horas por dia)
    const horasDiarias = 8;
    const horasTotaisMes = diasUteis * horasDiarias;
    const valorHora = horasTotaisMes > 0 ? salarioBase / horasTotaisMes : 0;

    // Calcular valor das horas extras
    const valorHorasExtras = await calcularValorHorasExtras(
      funcionarioId,
      mes,
      ano,
      horasExtras,
      horasDiarias
    );

    // Calcular INSS padrão (3% do salário base)
    const inss = salarioBase * 0.03;

    // IRT padrão (será calculado se necessário - por enquanto 0)
    const irt = 0;

    // Benefícios extras (calculado automaticamente só inclui horas extras, outros devem ser inseridos manualmente)
    const bonus = 0;
    const beneficioTransporte = 0;
    const beneficioAlimentacao = 0;
    const outrosBeneficios = 0;
    const outrosDescontos = 0;

    // Calcular salário bruto (base + todos os benefícios)
    // NOTA: Cálculo automático só inclui horas extras, outros benefícios devem ser adicionados manualmente
    const totalBeneficios = bonus + valorHorasExtras + beneficioTransporte + beneficioAlimentacao + outrosBeneficios;
    const salarioBruto = salarioBase + totalBeneficios;

    // Calcular total de descontos
    const totalDescontos = descontosFaltas + inss + irt + outrosDescontos;

    // Calcular salário líquido usando a mesma fórmula do controller
    const salarioLiquido = salarioBruto - totalDescontos;

    // Estatísticas de presença
    const totalPresencas = presencas.filter(
      (p) => p.status === 'PRESENTE'
    ).length;
    const totalFaltas = presencas.filter(
      (p) => p.status === 'FALTA_NAO_JUSTIFICADA' || p.status === 'FALTA'
    ).length;
    const totalAtrasos = presencas.filter((p) => p.status === 'ATRASO').length;
    const diasTrabalhados = presencas.filter(
      (p) => p.horaEntrada && p.horaSaida
    ).length;

    // Arredondar valores para 2 casas decimais
    const resultado: CalculoFolhaResultado = {
      salarioBase: Math.round(salarioBase * 100) / 100,
      diasUteis,
      valorDia: Math.round(valorDia * 100) / 100,
      totalFaltasNaoJustificadas,
      descontosFaltas: Math.round(descontosFaltas * 100) / 100,
      horasExtras: Math.round(horasExtras * 100) / 100,
      valorHora: Math.round(valorHora * 100) / 100,
      valorHorasExtras: Math.round(valorHorasExtras * 100) / 100,
      salarioBruto: Math.round(salarioBruto * 100) / 100,
      inss: Math.round(inss * 100) / 100,
      irt: Math.round(irt * 100) / 100,
      totalDescontos: Math.round(totalDescontos * 100) / 100,
      salarioLiquido: Math.max(0, Math.round(salarioLiquido * 100) / 100),
      origemCalculo: 'PRESENCA_BIOMETRICA',
      dadosPresenca: {
        totalPresencas,
        totalFaltas,
        totalAtrasos,
        diasTrabalhados,
      },
    };

    return resultado;
  }

  /**
   * Recalcular INSS e IRT com base no salário bruto atualizado
   * (Pode ser expandido para regras mais complexas)
   */
  static recalcularImpostos(
    salarioBruto: number,
    inssAtual?: number,
    irtAtual?: number
  ): { inss: number; irt: number } {
    // INSS: 3% do salário base (não do bruto)
    // Por enquanto mantém o valor calculado anteriormente
    const inss = inssAtual ?? salarioBruto * 0.03;

    // IRT: Calcular baseado em faixas (exemplo simples)
    // Por enquanto 0, mas pode ser expandido
    const irt = irtAtual ?? 0;

    return {
      inss: Math.round(inss * 100) / 100,
      irt: Math.round(irt * 100) / 100,
    };
  }
}

