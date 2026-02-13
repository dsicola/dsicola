import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';

/**
 * Busca o salário base do funcionário para uso em CONTRATOS.
 * Prioridade: Salário do funcionário > Salário do cargo.
 * NÃO busca do contrato (para evitar circularidade ao criar novos contratos).
 * 
 * Retorna 0 se nenhum salário for encontrado.
 * 
 * @param funcionarioId - ID do funcionário
 * @returns Promise<number> - Salário base em número
 */
export async function getSalarioBaseParaContrato(funcionarioId: string): Promise<number> {
  const funcionario = await prisma.funcionario.findUnique({
    where: { id: funcionarioId },
    include: { cargo: true },
  });

  if (!funcionario) {
    throw new AppError('Funcionário não encontrado', 404);
  }

  // Primeiro, tenta obter do funcionário
  if (funcionario.salarioBase !== null && funcionario.salarioBase !== undefined) {
    return parseFloat(funcionario.salarioBase.toString());
  }

  // Se não tiver no funcionário, tenta obter do cargo
  if (funcionario.cargo?.salarioBase !== null && funcionario.cargo?.salarioBase !== undefined) {
    return parseFloat(funcionario.cargo.salarioBase.toString());
  }

  // Se não tiver nenhum, retorna 0
  return 0;
}

/**
 * Busca o salário base do funcionário para uso em FOLHA DE PAGAMENTO.
 * Prioridade: Salário do funcionário > Salário do cargo.
 * NOTA: NÃO busca do contrato, pois o salário deve vir do cadastro do funcionário.
 * 
 * Retorna 0 se nenhum salário for encontrado.
 * 
 * @param funcionarioId - ID do funcionário
 * @returns Promise<number> - Salário base em número
 */
export async function getSalarioBaseFuncionario(funcionarioId: string): Promise<number> {
  // Buscar do funcionário (prioridade)
  const funcionario = await prisma.funcionario.findUnique({
    where: { id: funcionarioId },
    include: { cargo: true },
  });

  if (!funcionario) {
    throw new AppError('Funcionário não encontrado', 404);
  }

  // Primeiro, tenta obter do funcionário
  if (funcionario.salarioBase !== null && funcionario.salarioBase !== undefined) {
    return parseFloat(funcionario.salarioBase.toString());
  }

  // Se não tiver no funcionário, tenta obter do cargo
  if (funcionario.cargo?.salarioBase !== null && funcionario.cargo?.salarioBase !== undefined) {
    return parseFloat(funcionario.cargo.salarioBase.toString());
  }

  // Se não tiver nenhum, retorna 0
  return 0;
}

/**
 * Busca o salário base APENAS do contrato ativo (sem fallback)
 * Usado para garantir que a folha de pagamento use sempre o valor do contrato
 * 
 * @param funcionarioId - ID do funcionário
 * @returns Promise<number | null> - Salário base do contrato ou null se não houver contrato ativo
 */
export async function getSalarioBaseFromContrato(funcionarioId: string): Promise<number | null> {
  const contratoAtivo = await prisma.contratoFuncionario.findFirst({
    where: {
      funcionarioId: funcionarioId,
            status: 'ATIVO',
    },
    orderBy: {
      dataInicio: 'desc',
    },
  });

  if (contratoAtivo && contratoAtivo.salario) {
    return parseFloat(contratoAtivo.salario.toString());
  }

  return null;
}

/**
 * Busca feriados de uma instituição em um mês/ano específico
 * Retorna apenas os feriados que caem em dias úteis (não sábado/domingo)
 * 
 * @param instituicaoId - ID da instituição (null para feriados nacionais)
 * @param mes - Mês (1-12)
 * @param ano - Ano
 * @returns Promise<Date[]> - Array de datas dos feriados em dias úteis
 */
export async function getFeriadosNoMes(
  instituicaoId: string | null,
  mes: number,
  ano: number
): Promise<Date[]> {
  const primeiroDia = new Date(ano, mes - 1, 1);
  const ultimoDia = new Date(ano, mes, 0, 23, 59, 59);
  
  // Buscar feriados nacionais (instituicaoId null) e institucionais (se instituicaoId fornecido)
  const where: any = {
    data: {
      gte: primeiroDia,
      lte: ultimoDia,
    },
  };
  
  if (instituicaoId) {
    where.OR = [
      { tipo: 'NACIONAL', instituicaoId: null },
      { instituicaoId },
    ];
  } else {
    where.tipo = 'NACIONAL';
    where.instituicaoId = null;
  }
  
  const feriados = await prisma.feriado.findMany({
    where,
  });
  
  // Filtrar apenas feriados que caem em dias úteis (não sábado/domingo)
  const feriadosDiasUteis = feriados
    .map(feriado => {
      const data = new Date(feriado.data);
      const diaSemana = data.getDay();
      // 0 = domingo, 6 = sábado
      if (diaSemana !== 0 && diaSemana !== 6) {
        // Retornar apenas a data (sem hora)
        return new Date(data.getFullYear(), data.getMonth(), data.getDate());
      }
      return null;
    })
    .filter((data): data is Date => data !== null);
  
  return feriadosDiasUteis;
}

/**
 * Verifica se uma data é feriado
 * 
 * @param data - Data a verificar
 * @param instituicaoId - ID da instituição (null para verificar apenas feriados nacionais)
 * @returns Promise<boolean>
 */
export async function isFeriado(
  data: Date,
  instituicaoId: string | null
): Promise<boolean> {
  const dataInicio = new Date(data);
  dataInicio.setHours(0, 0, 0, 0);
  const dataFim = new Date(data);
  dataFim.setHours(23, 59, 59, 999);
  
  const where: any = {
    data: {
      gte: dataInicio,
      lte: dataFim,
    },
  };
  
  if (instituicaoId) {
    where.OR = [
      { tipo: 'NACIONAL', instituicaoId: null },
      { instituicaoId },
    ];
  } else {
    where.tipo = 'NACIONAL';
    where.instituicaoId = null;
  }
  
  const feriado = await prisma.feriado.findFirst({ where });
  return !!feriado;
}

/**
 * Calcula o número de dias úteis em um mês/ano
 * Exclui sábados, domingos e feriados cadastrados
 * 
 * @param mes - Mês (1-12)
 * @param ano - Ano
 * @param instituicaoId - ID da instituição (opcional, para considerar feriados institucionais)
 * @returns Promise<number> - Número de dias úteis
 */
export async function calcularDiasUteis(
  mes: number,
  ano: number,
  instituicaoId?: string | null
): Promise<number> {
  const primeiroDia = new Date(ano, mes - 1, 1);
  const ultimoDia = new Date(ano, mes, 0); // Último dia do mês
  
  // Buscar feriados do mês
  const feriadosDiasUteis = await getFeriadosNoMes(instituicaoId || null, mes, ano);
  
  // Criar um Set com as datas dos feriados (apenas dia/mês/ano, sem hora)
  const feriadosSet = new Set(
    feriadosDiasUteis.map(f => {
      const d = new Date(f);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );
  
  let diasUteis = 0;
  const dataAtual = new Date(primeiroDia);
  
  while (dataAtual <= ultimoDia) {
    const diaSemana = dataAtual.getDay(); // 0 = domingo, 6 = sábado
    
    // Verificar se não é sábado nem domingo
    if (diaSemana !== 0 && diaSemana !== 6) {
      // Verificar se não é feriado
      const dataKey = `${dataAtual.getFullYear()}-${dataAtual.getMonth()}-${dataAtual.getDate()}`;
      if (!feriadosSet.has(dataKey)) {
        diasUteis++;
      }
    }
    
    dataAtual.setDate(dataAtual.getDate() + 1);
  }
  
  return diasUteis;
}

/**
 * Conta faltas não justificadas de um funcionário em um mês/ano
 * Considera apenas registros com status "FALTA_NAO_JUSTIFICADA"
 * Status como "PRESENTE", "FALTA_JUSTIFICADA" NÃO contam como faltas
 * 
 * @param funcionarioId - ID do funcionário
 * @param mes - Mês (1-12)
 * @param ano - Ano
 * @returns Promise<number> - Número de faltas não justificadas
 */
export async function contarFaltasNaoJustificadas(
  funcionarioId: string,
  mes: number,
  ano: number
): Promise<number> {
  const primeiroDia = new Date(ano, mes - 1, 1);
  const ultimoDia = new Date(ano, mes, 0, 23, 59, 59); // Último dia do mês às 23:59:59
  
  const faltas = await prisma.frequenciaFuncionario.findMany({
    where: {
      funcionarioId,
      data: {
        gte: primeiroDia,
        lte: ultimoDia,
      },
      status: 'FALTA_NAO_JUSTIFICADA', // Apenas faltas não justificadas (enum do Prisma)
    },
  });
  
  return faltas.length;
}

/**
 * Calcula o desconto por faltas não justificadas automaticamente
 * Fórmula: valor_dia = salario_base / dias_uteis_do_mes
 * desconto = valor_dia × faltas_nao_justificadas
 * 
 * @param funcionarioId - ID do funcionário
 * @param mes - Mês (1-12)
 * @param ano - Ano
 * @returns Promise<number> - Valor do desconto calculado
 */
export async function calcularDescontoFaltas(
  funcionarioId: string,
  mes: number,
  ano: number
): Promise<number> {
  // Buscar salário base do funcionário
  const salarioBase = await getSalarioBaseFuncionario(funcionarioId);
  
  if (!salarioBase || salarioBase <= 0) {
    return 0; // Se não houver salário base, não há desconto
  }
  
  // Buscar instituição do funcionário para calcular dias úteis com feriados
  const funcionario = await prisma.funcionario.findUnique({
    where: { id: funcionarioId },
    select: { instituicaoId: true },
  });
  
  const instituicaoId = funcionario?.instituicaoId || null;
  
  // Calcular dias úteis do mês (excluindo sábados, domingos e feriados)
  const diasUteis = await calcularDiasUteis(mes, ano, instituicaoId);
  
  if (diasUteis === 0) {
    return 0; // Evitar divisão por zero
  }
  
  // Contar faltas não justificadas
  const faltasNaoJustificadas = await contarFaltasNaoJustificadas(funcionarioId, mes, ano);
  
  if (faltasNaoJustificadas === 0) {
    return 0; // Se não houver faltas, não há desconto
  }
  
  // Calcular valor por dia útil
  const valorDia = salarioBase / diasUteis;
  
  // Calcular desconto total
  const desconto = valorDia * faltasNaoJustificadas;
  
  // Arredondar para 2 casas decimais
  return Math.round(desconto * 100) / 100;
}

/**
 * Calcula o total de horas extras de um funcionário em um mês/ano
 * Soma todas as horas extras registradas na frequência
 * 
 * @param funcionarioId - ID do funcionário
 * @param mes - Mês (1-12)
 * @param ano - Ano
 * @returns Promise<number> - Total de horas extras
 */
export async function contarHorasExtras(
  funcionarioId: string,
  mes: number,
  ano: number
): Promise<number> {
  const primeiroDia = new Date(ano, mes - 1, 1);
  const ultimoDia = new Date(ano, mes, 0, 23, 59, 59);
  
  const frequencias = await prisma.frequenciaFuncionario.findMany({
    where: {
      funcionarioId,
      data: {
        gte: primeiroDia,
        lte: ultimoDia,
      },
      horasExtras: {
        not: null,
        gt: 0,
      },
    },
    select: {
      horasExtras: true,
    },
  });
  
  // Somar todas as horas extras
  const totalHorasExtras = frequencias.reduce((total, freq) => {
    const horas = freq.horasExtras ? parseFloat(freq.horasExtras.toString()) : 0;
    return total + horas;
  }, 0);
  
  return Math.round(totalHorasExtras * 100) / 100; // Arredondar para 2 casas decimais
}

/**
 * Calcula o valor das horas extras
 * Fórmula: valor_hora = salario_base / (dias_uteis × horas_diarias)
 * valor_horas_extras = valor_hora × horas_extras
 * 
 * @param funcionarioId - ID do funcionário
 * @param mes - Mês (1-12)
 * @param ano - Ano
 * @param horasExtras - Número de horas extras (se não fornecido, busca automaticamente)
 * @param horasDiarias - Horas trabalhadas por dia (padrão: 8)
 * @returns Promise<number> - Valor total das horas extras
 */
export async function calcularValorHorasExtras(
  funcionarioId: string,
  mes: number,
  ano: number,
  horasExtras?: number,
  horasDiarias: number = 8
): Promise<number> {
  // Buscar salário base
  const salarioBase = await getSalarioBaseFuncionario(funcionarioId);
  
  if (!salarioBase || salarioBase <= 0) {
    return 0; // Se não houver salário base, não há valor para horas extras
  }
  
  // Buscar instituição do funcionário para calcular dias úteis com feriados
  const funcionario = await prisma.funcionario.findUnique({
    where: { id: funcionarioId },
    select: { instituicaoId: true },
  });
  
  const instituicaoId = funcionario?.instituicaoId || null;
  
  // Calcular dias úteis (excluindo sábados, domingos e feriados)
  const diasUteis = await calcularDiasUteis(mes, ano, instituicaoId);
  
  if (diasUteis === 0) {
    return 0; // Evitar divisão por zero
  }
  
  // Buscar horas extras se não fornecidas
  let horasExtrasFinal = horasExtras;
  if (horasExtrasFinal === undefined || horasExtrasFinal === null) {
    horasExtrasFinal = await contarHorasExtras(funcionarioId, mes, ano);
  }
  
  if (horasExtrasFinal <= 0) {
    return 0; // Se não houver horas extras, não há valor
  }
  
  // Calcular valor da hora trabalhada
  const horasTotaisMes = diasUteis * horasDiarias;
  const valorHora = salarioBase / horasTotaisMes;
  
  // Calcular valor total das horas extras
  const valorHorasExtras = valorHora * horasExtrasFinal;
  
  // Arredondar para 2 casas decimais
  return Math.round(valorHorasExtras * 100) / 100;
}

