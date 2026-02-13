import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import { 
  getSalarioBaseFuncionario, 
  calcularDescontoFaltas,
  contarFaltasNaoJustificadas,
  calcularDiasUteis,
  contarHorasExtras,
  calcularValorHorasExtras
} from '../services/rh.service.js';
import { PayrollCalculationService } from '../services/payrollCalculation.service.js';
import { AuditService } from '../services/audit.service.js';
import { PayrollClosingService } from '../services/payrollClosing.service.js';
import { PayrollPaymentService } from '../services/payrollPayment.service.js';

/**
 * Calcula o salário líquido baseado nos valores fornecidos
 * Fórmula: (salarioBase + beneficios) - descontos
 */
function calcularSalarioLiquido(data: {
  salarioBase: number;
  bonus: number;
  valorHorasExtras: number;
  beneficioTransporte: number;
  beneficioAlimentacao: number;
  outrosBeneficios: number;
  descontoFaltas: number;
  inss: number;
  irt: number;
  outrosDescontos: number;
}): number {
  const totalBeneficios = 
    (data.bonus || 0) +
    (data.valorHorasExtras || 0) +
    (data.beneficioTransporte || 0) +
    (data.beneficioAlimentacao || 0) +
    (data.outrosBeneficios || 0);

  const totalDescontos = 
    (data.descontoFaltas || 0) +
    (data.inss || 0) +
    (data.irt || 0) +
    (data.outrosDescontos || 0);

  const salarioBruto = (data.salarioBase || 0) + totalBeneficios;
  const salarioLiquido = salarioBruto - totalDescontos;

  // Garantir que não seja negativo e arredondar para 2 casas decimais
  return Math.max(0, Math.round(salarioLiquido * 100) / 100);
}

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { funcionarioId, mes, ano, status } = req.query;
    
    const where: any = {};
    
    // Filter by institution through funcionario
    if (filter.instituicaoId) {
      where.funcionario = { instituicaoId: filter.instituicaoId };
    }
    
    // Additional filters
    if (funcionarioId) {
      where.funcionarioId = funcionarioId as string;
    }
    
    if (mes) {
      where.mes = parseInt(mes as string);
    }
    
    if (ano) {
      where.ano = parseInt(ano as string);
    }
    
    if (status) {
      where.status = status as string;
    }
    
    const folhas = await prisma.folhaPagamento.findMany({
      where,
      include: { 
        funcionario: {
          include: {
            cargo: true,
            departamento: true,
          }
        }
      },
      orderBy: [{ ano: 'desc' }, { mes: 'desc' }],
    });
    
    // Convert to snake_case for frontend compatibility
    const formatted = folhas.map(folha => ({
      id: folha.id,
      funcionario_id: folha.funcionarioId,
      mes: folha.mes,
      ano: folha.ano,
      dias_uteis: (folha as any).diasUteis || 0,
      salario_base: parseFloat(folha.salarioBase.toString()),
      valor_dia: parseFloat((folha as any).valorDia?.toString() || '0'),
      total_faltas_nao_justificadas: (folha as any).totalFaltasNaoJustificadas || 0,
      horas_extras: parseFloat(folha.horasExtras.toString()),
      valor_hora: parseFloat((folha as any).valorHora?.toString() || '0'),
      valor_horas_extras: parseFloat(folha.valorHorasExtras.toString()),
      bonus: parseFloat(folha.bonus.toString()),
      beneficio_transporte: parseFloat(folha.beneficioTransporte.toString()),
      beneficio_alimentacao: parseFloat(folha.beneficioAlimentacao.toString()),
      outros_beneficios: parseFloat(folha.outrosBeneficios.toString()),
      inss: parseFloat(folha.inss.toString()),
      irt: parseFloat(folha.irt.toString()),
      descontos_faltas: parseFloat(folha.descontosFaltas.toString()),
      outros_descontos: parseFloat(folha.outrosDescontos.toString()),
      salario_liquido: parseFloat(folha.salarioLiquido.toString()),
      status: folha.status,
      fechado_em: folha.fechadoEm ? folha.fechadoEm.toISOString() : null,
      fechado_por: folha.fechadoPor,
      reaberto_em: folha.reabertoEm ? folha.reabertoEm.toISOString() : null,
      reaberto_por: folha.reabertoPor,
      justificativa_reabertura: folha.justificativaReabertura,
      pago_em: folha.pagoEm ? folha.pagoEm.toISOString() : null,
      pago_por: folha.pagoPor,
      metodo_pagamento: folha.metodoPagamento,
      referencia: folha.referencia,
      observacao_pagamento: folha.observacaoPagamento,
      data_pagamento: folha.dataPagamento ? folha.dataPagamento.toISOString().split('T')[0] : null,
      forma_pagamento: folha.formaPagamento,
      gerado_por: folha.geradoPor,
      aprovado_por: folha.aprovadoPor,
      observacoes: folha.observacoes,
      created_at: folha.createdAt,
      updated_at: folha.updatedAt,
      funcionario: folha.funcionario ? {
        id: folha.funcionario.id,
        nome_completo: folha.funcionario.nomeCompleto,
        email: folha.funcionario.email,
        cargo: folha.funcionario.cargo?.nome || null,
        departamento: folha.funcionario.departamento?.nome || null,
      } : null,
    }));
    
    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    // CORREÇÃO: Verificar instituição na query inicial para evitar vazamento de dados
    const folha = await prisma.folhaPagamento.findFirst({
      where: { 
        id,
        ...(filter.instituicaoId ? {
          funcionario: {
            instituicaoId: filter.instituicaoId
          }
        } : {})
      },
      include: { 
        funcionario: {
          include: {
            cargo: true,
            departamento: true,
          }
        }
      },
    });
    
    if (!folha) {
      throw new AppError('Folha de pagamento não encontrada', 404);
    }
    
    // Check institution access (double check)
    if (filter.instituicaoId && folha.funcionario.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado a esta folha de pagamento', 403);
    }
    
    // Convert to snake_case
    const formatted = {
      id: folha.id,
      funcionario_id: folha.funcionarioId,
      mes: folha.mes,
      ano: folha.ano,
      dias_uteis: (folha as any).diasUteis || 0,
      salario_base: parseFloat(folha.salarioBase.toString()),
      valor_dia: parseFloat((folha as any).valorDia?.toString() || '0'),
      total_faltas_nao_justificadas: (folha as any).totalFaltasNaoJustificadas || 0,
      horas_extras: parseFloat(folha.horasExtras.toString()),
      valor_hora: parseFloat((folha as any).valorHora?.toString() || '0'),
      valor_horas_extras: parseFloat(folha.valorHorasExtras.toString()),
      bonus: parseFloat(folha.bonus.toString()),
      beneficio_transporte: parseFloat(folha.beneficioTransporte.toString()),
      beneficio_alimentacao: parseFloat(folha.beneficioAlimentacao.toString()),
      outros_beneficios: parseFloat(folha.outrosBeneficios.toString()),
      inss: parseFloat(folha.inss.toString()),
      irt: parseFloat(folha.irt.toString()),
      descontos_faltas: parseFloat(folha.descontosFaltas.toString()),
      outros_descontos: parseFloat(folha.outrosDescontos.toString()),
      salario_liquido: parseFloat(folha.salarioLiquido.toString()),
      status: folha.status,
      fechado_em: folha.fechadoEm ? folha.fechadoEm.toISOString() : null,
      fechado_por: folha.fechadoPor,
      reaberto_em: folha.reabertoEm ? folha.reabertoEm.toISOString() : null,
      reaberto_por: folha.reabertoPor,
      justificativa_reabertura: folha.justificativaReabertura,
      pago_em: folha.pagoEm ? folha.pagoEm.toISOString() : null,
      pago_por: folha.pagoPor,
      metodo_pagamento: folha.metodoPagamento,
      referencia: folha.referencia,
      observacao_pagamento: folha.observacaoPagamento,
      data_pagamento: folha.dataPagamento ? folha.dataPagamento.toISOString().split('T')[0] : null,
      forma_pagamento: folha.formaPagamento,
      gerado_por: folha.geradoPor,
      aprovado_por: folha.aprovadoPor,
      observacoes: folha.observacoes,
      created_at: folha.createdAt,
      updated_at: folha.updatedAt,
      funcionario: {
        id: folha.funcionario.id,
        nome_completo: folha.funcionario.nomeCompleto,
        email: folha.funcionario.email,
        cargo: folha.funcionario.cargo?.nome || null,
        departamento: folha.funcionario.departamento?.nome || null,
      },
    };
    
    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    
    // Map snake_case to camelCase
    // NOTA: salario_base/salarioBase é IGNORADO - será buscado automaticamente do contrato/funcionário/cargo
    // NOTA: descontos_faltas/descontosFaltas é IGNORADO - será calculado automaticamente baseado nas faltas não justificadas
    const {
      funcionario_id,
      funcionarioId,
      mes,
      ano,
      horas_extras,
      horasExtras = 0,
      valor_horas_extras,
      valorHorasExtras = 0,
      bonus = 0,
      beneficio_transporte,
      beneficioTransporte = 0,
      beneficio_alimentacao,
      beneficioAlimentacao = 0,
      outros_beneficios,
      outrosBeneficios = 0,
      inss = 0,
      irt = 0,
      descontos_faltas, // IGNORADO - será calculado automaticamente
      descontosFaltas, // IGNORADO - será calculado automaticamente
      outros_descontos,
      outrosDescontos = 0,
      status = 'DRAFT',
      data_pagamento,
      dataPagamento,
      forma_pagamento,
      formaPagamento,
      observacoes,
    } = req.body;
    
    const finalFuncionarioId = funcionarioId || funcionario_id;
    if (!finalFuncionarioId) {
      throw new AppError('Funcionário é obrigatório', 400);
    }
    
    if (!mes || !ano) {
      throw new AppError('Mês e ano são obrigatórios', 400);
    }
    
    // Verify funcionario exists and belongs to institution
    const funcionario = await prisma.funcionario.findUnique({
      where: { id: finalFuncionarioId },
      select: { instituicaoId: true },
    });
    
    if (!funcionario) {
      throw new AppError('Funcionário não encontrado', 404);
    }
    
    if (filter.instituicaoId && funcionario.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado a este funcionário', 403);
    }

    // Buscar salário base automaticamente do contrato/funcionário/cargo
    // IMPORTANTE: Ignoramos qualquer salário vindo do body para garantir consistência
    const salarioBaseAutomatico = await getSalarioBaseFuncionario(finalFuncionarioId);
    
    if (!salarioBaseAutomatico || salarioBaseAutomatico <= 0) {
      throw new AppError('Funcionário não possui salário base cadastrado. Cadastre um salário no funcionário, cargo ou contrato.', 400);
    }
    
    const finalSalarioBase = salarioBaseAutomatico;
    
    // Check if folha already exists for this funcionario/month/year
    const existing = await prisma.folhaPagamento.findUnique({
      where: {
        funcionarioId_mes_ano: {
          funcionarioId: finalFuncionarioId,
          mes: parseInt(mes),
          ano: parseInt(ano),
        },
      },
    });
    
    if (existing) {
      throw new AppError('Folha de pagamento já existe para este funcionário, mês e ano', 409);
    }
    
    const userId = req.user?.userId;
    
    // Calcular desconto por faltas automaticamente
    // IMPORTANTE: Sempre calcula automaticamente baseado nas faltas não justificadas do mês
    const mesNumero = parseInt(mes);
    const anoNumero = parseInt(ano);
    
    // Calcular dias úteis (excluindo sábados, domingos e feriados)
    const diasUteis = await calcularDiasUteis(mesNumero, anoNumero, funcionario.instituicaoId || null);
    
    // Calcular valor por dia útil
    const valorDia = diasUteis > 0 ? finalSalarioBase / diasUteis : 0;
    
    // Contar faltas não justificadas
    const totalFaltasNaoJustificadas = await contarFaltasNaoJustificadas(finalFuncionarioId, mesNumero, anoNumero);
    
    // Calcular desconto por faltas
    const descontosFaltasCalculado = totalFaltasNaoJustificadas > 0 ? valorDia * totalFaltasNaoJustificadas : 0;
    
    // Calcular valor da hora trabalhada (assumindo 8 horas por dia)
    const horasDiarias = 8;
    const horasTotaisMes = diasUteis * horasDiarias;
    const valorHora = horasTotaisMes > 0 ? finalSalarioBase / horasTotaisMes : 0;
    
    // Buscar horas extras se não fornecidas
    const horasExtrasFornecidas = parseFloat(horasExtras || horas_extras || '0');
    const horasExtrasFinal = horasExtrasFornecidas > 0 ? horasExtrasFornecidas : await contarHorasExtras(finalFuncionarioId, mesNumero, anoNumero);
    
    // Calcular valor das horas extras automaticamente
    const valorHorasExtrasCalculado = await calcularValorHorasExtras(finalFuncionarioId, mesNumero, anoNumero, horasExtrasFinal);
    
    // Normalizar valores numéricos
    const valoresNumericos = {
      salarioBase: finalSalarioBase,
      horasExtras: horasExtrasFinal,
      valorHorasExtras: parseFloat(valorHorasExtras || valor_horas_extras || '0') || valorHorasExtrasCalculado,
      bonus: parseFloat(bonus || '0'),
      beneficioTransporte: parseFloat(beneficioTransporte || beneficio_transporte || '0'),
      beneficioAlimentacao: parseFloat(beneficioAlimentacao || beneficio_alimentacao || '0'),
      outrosBeneficios: parseFloat(outrosBeneficios || outros_beneficios || '0'),
      inss: parseFloat(inss || '0'),
      irt: parseFloat(irt || '0'),
      descontosFaltas: Math.round(descontosFaltasCalculado * 100) / 100, // SEMPRE usa o valor calculado automaticamente
      outrosDescontos: parseFloat(outrosDescontos || outros_descontos || '0'),
      diasUteis,
      valorDia: Math.round(valorDia * 100) / 100,
      totalFaltasNaoJustificadas,
      valorHora: Math.round(valorHora * 100) / 100,
    };

    // Calcular INSS padrão (3%) se não fornecido
    let inssCalculado = valoresNumericos.inss;
    if (!inss && inss !== 0) {
      inssCalculado = finalSalarioBase * 0.03;
    }

    // Calcular salário líquido no backend (fonte da verdade)
    const salarioLiquidoCalculado = calcularSalarioLiquido({
      salarioBase: valoresNumericos.salarioBase,
      bonus: valoresNumericos.bonus,
      valorHorasExtras: valoresNumericos.valorHorasExtras,
      beneficioTransporte: valoresNumericos.beneficioTransporte,
      beneficioAlimentacao: valoresNumericos.beneficioAlimentacao,
      outrosBeneficios: valoresNumericos.outrosBeneficios,
      descontoFaltas: valoresNumericos.descontosFaltas,
      inss: inssCalculado,
      irt: valoresNumericos.irt,
      outrosDescontos: valoresNumericos.outrosDescontos,
    });
    
    // Prepare data
    const createData: any = {
      funcionarioId: finalFuncionarioId,
      mes: parseInt(mes),
      ano: parseInt(ano),
      diasUteis: valoresNumericos.diasUteis,
      salarioBase: valoresNumericos.salarioBase,
      valorDia: valoresNumericos.valorDia,
      totalFaltasNaoJustificadas: valoresNumericos.totalFaltasNaoJustificadas,
      horasExtras: valoresNumericos.horasExtras,
      valorHora: valoresNumericos.valorHora,
      valorHorasExtras: valoresNumericos.valorHorasExtras,
      bonus: valoresNumericos.bonus,
      beneficioTransporte: valoresNumericos.beneficioTransporte,
      beneficioAlimentacao: valoresNumericos.beneficioAlimentacao,
      outrosBeneficios: valoresNumericos.outrosBeneficios,
      inss: inssCalculado,
      irt: valoresNumericos.irt,
      descontosFaltas: valoresNumericos.descontosFaltas,
      outrosDescontos: valoresNumericos.outrosDescontos,
      salarioLiquido: salarioLiquidoCalculado,
      status: 'DRAFT', // SEMPRE criar como DRAFT - não aceitar status do body para garantir segurança
      geradoPor: userId || null,
    };
    
    if (dataPagamento || data_pagamento) {
      createData.dataPagamento = new Date(dataPagamento || data_pagamento);
    }
    
    if (formaPagamento || forma_pagamento) {
      createData.formaPagamento = formaPagamento || forma_pagamento;
    }
    
    if (observacoes) {
      createData.observacoes = observacoes;
    }
    
    const folha = await prisma.folhaPagamento.create({
      data: createData,
      include: {
        funcionario: {
          include: {
            cargo: true,
            departamento: true,
          }
        }
      },
    });

    // Gerar audit log
    try {
      await AuditService.log(req, {
        modulo: 'FOLHA_PAGAMENTO',
        acao: 'CREATE',
        entidade: 'FOLHA_PAGAMENTO',
        entidadeId: folha.id,
        dadosNovos: {
          funcionarioId: folha.funcionarioId,
          mes: folha.mes,
          ano: folha.ano,
          status: folha.status,
          salarioBase: parseFloat(folha.salarioBase.toString()),
          salarioLiquido: parseFloat(folha.salarioLiquido.toString()),
        },
        observacao: `Folha de pagamento criada - Funcionário: ${folha.funcionarioId}, Mês: ${folha.mes}/${folha.ano}`,
      });
    } catch (auditError) {
      console.error('Erro ao gerar audit log:', auditError);
    }
    
    // Convert to snake_case
    const formatted = {
      id: folha.id,
      funcionario_id: folha.funcionarioId,
      mes: folha.mes,
      ano: folha.ano,
      dias_uteis: (folha as any).diasUteis || 0,
      salario_base: parseFloat(folha.salarioBase.toString()),
      valor_dia: parseFloat((folha as any).valorDia?.toString() || '0'),
      total_faltas_nao_justificadas: (folha as any).totalFaltasNaoJustificadas || 0,
      horas_extras: parseFloat(folha.horasExtras.toString()),
      valor_hora: parseFloat((folha as any).valorHora?.toString() || '0'),
      valor_horas_extras: parseFloat(folha.valorHorasExtras.toString()),
      bonus: parseFloat(folha.bonus.toString()),
      beneficio_transporte: parseFloat(folha.beneficioTransporte.toString()),
      beneficio_alimentacao: parseFloat(folha.beneficioAlimentacao.toString()),
      outros_beneficios: parseFloat(folha.outrosBeneficios.toString()),
      inss: parseFloat(folha.inss.toString()),
      irt: parseFloat(folha.irt.toString()),
      descontos_faltas: parseFloat(folha.descontosFaltas.toString()),
      outros_descontos: parseFloat(folha.outrosDescontos.toString()),
      salario_liquido: parseFloat(folha.salarioLiquido.toString()),
      status: folha.status,
      fechado_em: folha.fechadoEm ? folha.fechadoEm.toISOString() : null,
      fechado_por: folha.fechadoPor,
      reaberto_em: folha.reabertoEm ? folha.reabertoEm.toISOString() : null,
      reaberto_por: folha.reabertoPor,
      justificativa_reabertura: folha.justificativaReabertura,
      pago_em: folha.pagoEm ? folha.pagoEm.toISOString() : null,
      pago_por: folha.pagoPor,
      metodo_pagamento: folha.metodoPagamento,
      referencia: folha.referencia,
      observacao_pagamento: folha.observacaoPagamento,
      data_pagamento: folha.dataPagamento ? folha.dataPagamento.toISOString().split('T')[0] : null,
      forma_pagamento: folha.formaPagamento,
      gerado_por: folha.geradoPor,
      aprovado_por: folha.aprovadoPor,
      observacoes: folha.observacoes,
      created_at: folha.createdAt,
      updated_at: folha.updatedAt,
      funcionario: {
        id: folha.funcionario.id,
        nome_completo: folha.funcionario.nomeCompleto,
        email: folha.funcionario.email,
        cargo: folha.funcionario.cargo?.nome || null,
        departamento: folha.funcionario.departamento?.nome || null,
      },
    };
    
    res.status(201).json(formatted);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    // Check if folha exists and belongs to institution
    const existing = await prisma.folhaPagamento.findFirst({
      where: { 
        id,
        ...(filter.instituicaoId ? {
          funcionario: {
            instituicaoId: filter.instituicaoId
          }
        } : {})
      },
      include: { funcionario: { select: { instituicaoId: true } } },
    });
    
    if (!existing) {
      throw new AppError('Folha de pagamento não encontrada', 404);
    }
    
    if (filter.instituicaoId && existing.funcionario.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado a esta folha de pagamento', 403);
    }

    // CORREÇÃO CRÍTICA: Bloquear edição se folha está FECHADA
    if (existing.status === 'CLOSED' || existing.status === 'PAID') {
      throw new AppError('Não é possível editar uma folha de pagamento FECHADA ou PAGA. Para editar, é necessário reabrir a folha primeiro.', 403);
    }
    
    // Map snake_case to camelCase
    // NOTA: salario_base/salarioBase NÃO pode ser editado manualmente - vem do funcionário/contrato
    // NOTA: descontos_faltas/descontosFaltas NÃO pode ser editado manualmente - é calculado automaticamente
    const {
      funcionario_id,
      funcionarioId,
      mes,
      ano,
      salario_base, // IGNORADO - não pode ser editado
      salarioBase, // IGNORADO - não pode ser editado
      horas_extras,
      horasExtras,
      valor_horas_extras,
      valorHorasExtras,
      bonus,
      beneficio_transporte,
      beneficioTransporte,
      beneficio_alimentacao,
      beneficioAlimentacao,
      outros_beneficios,
      outrosBeneficios,
      inss,
      irt,
      descontos_faltas, // IGNORADO - será recalculado automaticamente
      descontosFaltas, // IGNORADO - será recalculado automaticamente
      outros_descontos,
      outrosDescontos,
      salario_liquido, // IGNORADO - será recalculado automaticamente
      salarioLiquido, // IGNORADO - será recalculado automaticamente
      status,
      data_pagamento,
      dataPagamento,
      forma_pagamento,
      formaPagamento,
      observacoes,
    } = req.body;
    
    const updateData: any = {};
    
    if (funcionarioId || funcionario_id) {
      const finalFuncionarioId = funcionarioId || funcionario_id;
      
      // Verify new funcionario belongs to institution
      const funcionario = await prisma.funcionario.findUnique({
        where: { id: finalFuncionarioId },
        select: { instituicaoId: true },
      });
      
      if (!funcionario) {
        throw new AppError('Funcionário não encontrado', 404);
      }
      
      if (filter.instituicaoId && funcionario.instituicaoId !== filter.instituicaoId) {
        throw new AppError('Acesso negado a este funcionário', 403);
      }
      
      updateData.funcionarioId = finalFuncionarioId;
    }
    
    if (mes !== undefined) {
      updateData.mes = parseInt(mes);
    }
    
    if (ano !== undefined) {
      updateData.ano = parseInt(ano);
    }
    
    // Salário base NÃO pode ser editado manualmente - sempre vem do funcionário/contrato
    // Removido: if (salarioBase !== undefined || salario_base !== undefined) { ... }
    
    // CORREÇÃO: Horas extras e valor devem ser sempre recalculados automaticamente da frequência
    // Não aceitar valores manuais - sempre buscar da frequência biométrica
    // Removido: if (horasExtras !== undefined || horas_extras !== undefined) { ... }
    // Removido: if (valorHorasExtras !== undefined || valor_horas_extras !== undefined) { ... }
    
    if (bonus !== undefined) {
      updateData.bonus = parseFloat(bonus || '0');
    }
    
    if (beneficioTransporte !== undefined || beneficio_transporte !== undefined) {
      updateData.beneficioTransporte = parseFloat(beneficioTransporte !== undefined ? beneficioTransporte : beneficio_transporte || '0');
    }
    
    if (beneficioAlimentacao !== undefined || beneficio_alimentacao !== undefined) {
      updateData.beneficioAlimentacao = parseFloat(beneficioAlimentacao !== undefined ? beneficioAlimentacao : beneficio_alimentacao || '0');
    }
    
    if (outrosBeneficios !== undefined || outros_beneficios !== undefined) {
      updateData.outrosBeneficios = parseFloat(outrosBeneficios !== undefined ? outrosBeneficios : outros_beneficios || '0');
    }
    
    if (inss !== undefined) {
      updateData.inss = parseFloat(inss || '0');
    }
    
    if (irt !== undefined) {
      updateData.irt = parseFloat(irt || '0');
    }
    
    // CORREÇÃO CRÍTICA: descontosFaltas NÃO pode ser editado manualmente - sempre recalcula automaticamente
    // Removido: if (descontosFaltas !== undefined || descontos_faltas !== undefined) { ... }
    
    if (outrosDescontos !== undefined || outros_descontos !== undefined) {
      updateData.outrosDescontos = parseFloat(outrosDescontos !== undefined ? outrosDescontos : outros_descontos || '0');
    }
    
    // Recalcular descontos por faltas automaticamente se mes/ano foram alterados ou se necessário
    // Sempre recalcula baseado nas faltas não justificadas
    let mesParaCalculo = existing.mes;
    let anoParaCalculo = existing.ano;
    if (mes !== undefined) {
      mesParaCalculo = parseInt(mes);
    }
    if (ano !== undefined) {
      anoParaCalculo = parseInt(ano);
    }
    
    // Recalcular desconto por faltas automaticamente
    const funcionarioIdParaCalculo = updateData.funcionarioId || existing.funcionarioId;
    
    // Buscar funcionário para obter instituicaoId
    const funcionarioParaCalc = await prisma.funcionario.findUnique({
      where: { id: funcionarioIdParaCalculo },
      select: { instituicaoId: true },
    });
    
    // Buscar salário base atualizado
    const salarioBaseAtualizado = await getSalarioBaseFuncionario(funcionarioIdParaCalculo);
    
    // Calcular dias úteis (excluindo sábados, domingos e feriados)
    const diasUteis = await calcularDiasUteis(mesParaCalculo, anoParaCalculo, funcionarioParaCalc?.instituicaoId || null);
    
    // Calcular valor por dia útil
    const valorDia = diasUteis > 0 ? salarioBaseAtualizado / diasUteis : 0;
    
    // Contar faltas não justificadas
    const totalFaltasNaoJustificadas = await contarFaltasNaoJustificadas(funcionarioIdParaCalculo, mesParaCalculo, anoParaCalculo);
    
    // Calcular desconto por faltas
    const descontosFaltasRecalculado = totalFaltasNaoJustificadas > 0 ? valorDia * totalFaltasNaoJustificadas : 0;
    
    // Calcular valor da hora trabalhada (assumindo 8 horas por dia)
    const horasDiarias = 8;
    const horasTotaisMes = diasUteis * horasDiarias;
    const valorHora = horasTotaisMes > 0 ? salarioBaseAtualizado / horasTotaisMes : 0;
    
    // Atualizar campos calculados
    updateData.diasUteis = diasUteis;
    updateData.valorDia = Math.round(valorDia * 100) / 100;
    updateData.totalFaltasNaoJustificadas = totalFaltasNaoJustificadas;
    updateData.valorHora = Math.round(valorHora * 100) / 100;
    updateData.descontosFaltas = Math.round(descontosFaltasRecalculado * 100) / 100;
    
    // CORREÇÃO CRÍTICA: Sempre recalcular horas extras e valor automaticamente da frequência biométrica
    // NUNCA aceitar valores manuais - sempre buscar da frequência
    const horasExtrasRecalculado = await contarHorasExtras(funcionarioIdParaCalculo, mesParaCalculo, anoParaCalculo);
    updateData.horasExtras = horasExtrasRecalculado;
    
    // SEMPRE recalcular o valor das horas extras automaticamente
    const valorHorasExtrasRecalculado = await calcularValorHorasExtras(
      funcionarioIdParaCalculo,
      mesParaCalculo,
      anoParaCalculo,
      horasExtrasRecalculado
    );
    updateData.valorHorasExtras = valorHorasExtrasRecalculado;
    
    // Recalcular salário líquido se algum campo relevante foi alterado
    const camposRelevantes = [
      'funcionarioId', 'mes', 'ano', 'bonus', 'valorHorasExtras', 'beneficioTransporte',
      'beneficioAlimentacao', 'outrosBeneficios', 'inss', 'irt', 'outrosDescontos'
    ];
    
    const precisaRecalcular = camposRelevantes.some(campo => updateData[campo] !== undefined);
    
    if (precisaRecalcular || true) { // Sempre recalcular para garantir consistência
      // Buscar salário base do funcionário (sempre atualizado)
      const salarioBaseAtualizado = await getSalarioBaseFuncionario(funcionarioIdParaCalculo);
      
      // Buscar valores atuais para calcular
      const folhaAtual = await prisma.folhaPagamento.findUnique({
        where: { id },
        select: {
          salarioBase: true,
          bonus: true,
          valorHorasExtras: true,
          beneficioTransporte: true,
          beneficioAlimentacao: true,
          outrosBeneficios: true,
          inss: true,
          irt: true,
          outrosDescontos: true,
        },
      });

      if (folhaAtual) {
        // Usar salário base atualizado do funcionário
        const salarioBaseFinal = salarioBaseAtualizado || parseFloat(folhaAtual.salarioBase.toString());
        
        // Atualizar salário base sempre (para garantir que está sincronizado)
        updateData.salarioBase = salarioBaseFinal;
        
        // INSS: Se fornecido explicitamente, usar; caso contrário, recalcular se salário base mudou
        let inssFinal = updateData.inss !== undefined 
          ? parseFloat(updateData.inss.toString()) 
          : parseFloat(folhaAtual.inss.toString());

        // Recalcular INSS (3% do salário base) se salário base mudou e INSS não foi fornecido explicitamente
        if (updateData.salarioBase !== undefined && updateData.inss === undefined) {
          inssFinal = salarioBaseFinal * 0.03;
          updateData.inss = inssFinal;
        } else if (updateData.inss === undefined && updateData.salarioBase !== undefined) {
          // Se salário base foi atualizado mas INSS não foi fornecido, recalcular
          inssFinal = salarioBaseFinal * 0.03;
          updateData.inss = inssFinal;
        }

        // Usar valor de horas extras recalculado automaticamente (já foi calculado acima)
        // SEMPRE usar o valor recalculado que está em updateData.valorHorasExtras
        const valorHorasExtrasFinal = updateData.valorHorasExtras !== undefined
          ? parseFloat(updateData.valorHorasExtras.toString())
          : parseFloat(folhaAtual.valorHorasExtras?.toString() || '0');
        
        const valoresFinais = {
          salarioBase: salarioBaseFinal,
          bonus: updateData.bonus !== undefined ? parseFloat(updateData.bonus.toString()) : parseFloat(folhaAtual.bonus.toString()),
          valorHorasExtras: valorHorasExtrasRecalculado, // SEMPRE usa o valor recalculado automaticamente
          beneficioTransporte: updateData.beneficioTransporte !== undefined ? parseFloat(updateData.beneficioTransporte.toString()) : parseFloat(folhaAtual.beneficioTransporte.toString()),
          beneficioAlimentacao: updateData.beneficioAlimentacao !== undefined ? parseFloat(updateData.beneficioAlimentacao.toString()) : parseFloat(folhaAtual.beneficioAlimentacao.toString()),
          outrosBeneficios: updateData.outrosBeneficios !== undefined ? parseFloat(updateData.outrosBeneficios.toString()) : parseFloat(folhaAtual.outrosBeneficios.toString()),
          descontoFaltas: descontosFaltasRecalculado, // SEMPRE usa o valor recalculado
          inss: inssFinal,
          irt: updateData.irt !== undefined ? parseFloat(updateData.irt.toString()) : parseFloat(folhaAtual.irt.toString()),
          outrosDescontos: updateData.outrosDescontos !== undefined ? parseFloat(updateData.outrosDescontos.toString()) : parseFloat(folhaAtual.outrosDescontos.toString()),
        };

        const salarioLiquidoRecalculado = calcularSalarioLiquido(valoresFinais);
        updateData.salarioLiquido = salarioLiquidoRecalculado;
      }
    }
    
    // CORREÇÃO: Validar transições de status
    if (status !== undefined) {
      const statusValidos = ['DRAFT', 'CALCULATED', 'CLOSED', 'PAID'];
      if (!statusValidos.includes(status)) {
        throw new AppError(`Status inválido. Valores permitidos: ${statusValidos.join(', ')}`, 400);
      }
      
      // Validar transições permitidas
      const transicoesPermitidas: { [key: string]: string[] } = {
        'DRAFT': ['CALCULATED', 'CLOSED'],
        'CALCULATED': ['DRAFT', 'CLOSED'],
        'CLOSED': [], // CLOSED só pode ser alterado via endpoint de reabertura
        'PAID': [] // PAID é imutável
      };
      
      const currentStatus = existing.status as string;
      if (currentStatus === 'CLOSED' && status !== 'CLOSED') {
        throw new AppError('Folha fechada não pode ter status alterado diretamente. Use o endpoint de reabertura.', 403);
      }
      
      if (currentStatus === 'PAID') {
        throw new AppError('Folha paga é imutável e não pode ser alterada', 403);
      }
      
      if (transicoesPermitidas[currentStatus] && !transicoesPermitidas[currentStatus].includes(status)) {
        throw new AppError(`Transição de status de '${existing.status}' para '${status}' não é permitida`, 400);
      }
      
      updateData.status = status;
    }
    
    if (dataPagamento !== undefined || data_pagamento !== undefined) {
      updateData.dataPagamento = dataPagamento || data_pagamento ? new Date(dataPagamento || data_pagamento) : null;
    }
    
    if (formaPagamento !== undefined || forma_pagamento !== undefined) {
      updateData.formaPagamento = formaPagamento !== undefined ? (formaPagamento || forma_pagamento) : null;
    }
    
    if (observacoes !== undefined) {
      updateData.observacoes = observacoes;
    }
    
    // Buscar dados antigos para audit log
    const folhaAntes = await prisma.folhaPagamento.findUnique({
      where: { id },
      select: {
        status: true,
        salarioBase: true,
        salarioLiquido: true,
      },
    });

    const folha = await prisma.folhaPagamento.update({
      where: { id },
      data: updateData,
      include: {
        funcionario: {
          include: {
            cargo: true,
            departamento: true,
          }
        }
      },
    });

    // Gerar audit log
    try {
      await AuditService.log(req, {
        modulo: 'FOLHA_PAGAMENTO',
        acao: 'UPDATE',
        entidade: 'FOLHA_PAGAMENTO',
        entidadeId: folha.id,
        dadosAnteriores: folhaAntes ? {
          status: folhaAntes.status,
          salarioBase: parseFloat(folhaAntes.salarioBase.toString()),
          salarioLiquido: parseFloat(folhaAntes.salarioLiquido.toString()),
        } : undefined,
        dadosNovos: {
          status: folha.status,
          salarioBase: parseFloat(folha.salarioBase.toString()),
          salarioLiquido: parseFloat(folha.salarioLiquido.toString()),
        },
        observacao: `Folha de pagamento atualizada - Funcionário: ${folha.funcionarioId}, Mês: ${folha.mes}/${folha.ano}`,
      });
    } catch (auditError) {
      console.error('Erro ao gerar audit log:', auditError);
    }
    
    // Convert to snake_case
    const formatted = {
      id: folha.id,
      funcionario_id: folha.funcionarioId,
      mes: folha.mes,
      ano: folha.ano,
      dias_uteis: (folha as any).diasUteis || 0,
      salario_base: parseFloat(folha.salarioBase.toString()),
      valor_dia: parseFloat((folha as any).valorDia?.toString() || '0'),
      total_faltas_nao_justificadas: (folha as any).totalFaltasNaoJustificadas || 0,
      horas_extras: parseFloat(folha.horasExtras.toString()),
      valor_hora: parseFloat((folha as any).valorHora?.toString() || '0'),
      valor_horas_extras: parseFloat(folha.valorHorasExtras.toString()),
      bonus: parseFloat(folha.bonus.toString()),
      beneficio_transporte: parseFloat(folha.beneficioTransporte.toString()),
      beneficio_alimentacao: parseFloat(folha.beneficioAlimentacao.toString()),
      outros_beneficios: parseFloat(folha.outrosBeneficios.toString()),
      inss: parseFloat(folha.inss.toString()),
      irt: parseFloat(folha.irt.toString()),
      descontos_faltas: parseFloat(folha.descontosFaltas.toString()),
      outros_descontos: parseFloat(folha.outrosDescontos.toString()),
      salario_liquido: parseFloat(folha.salarioLiquido.toString()),
      status: folha.status,
      fechado_em: folha.fechadoEm ? folha.fechadoEm.toISOString() : null,
      fechado_por: folha.fechadoPor,
      reaberto_em: folha.reabertoEm ? folha.reabertoEm.toISOString() : null,
      reaberto_por: folha.reabertoPor,
      justificativa_reabertura: folha.justificativaReabertura,
      pago_em: folha.pagoEm ? folha.pagoEm.toISOString() : null,
      pago_por: folha.pagoPor,
      metodo_pagamento: folha.metodoPagamento,
      referencia: folha.referencia,
      observacao_pagamento: folha.observacaoPagamento,
      data_pagamento: folha.dataPagamento ? folha.dataPagamento.toISOString().split('T')[0] : null,
      forma_pagamento: folha.formaPagamento,
      gerado_por: folha.geradoPor,
      aprovado_por: folha.aprovadoPor,
      observacoes: folha.observacoes,
      created_at: folha.createdAt,
      updated_at: folha.updatedAt,
      funcionario: {
        id: folha.funcionario.id,
        nome_completo: folha.funcionario.nomeCompleto,
        email: folha.funcionario.email,
        cargo: folha.funcionario.cargo?.nome || null,
        departamento: folha.funcionario.departamento?.nome || null,
      },
    };
    
    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    // Check if folha exists and belongs to institution
    const existing = await prisma.folhaPagamento.findFirst({
      where: { 
        id,
        ...(filter.instituicaoId ? {
          funcionario: {
            instituicaoId: filter.instituicaoId
          }
        } : {})
      },
      include: { funcionario: { select: { instituicaoId: true } } },
    });
    
    if (!existing) {
      throw new AppError('Folha de pagamento não encontrada', 404);
    }
    
    if (filter.instituicaoId && existing.funcionario.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado a esta folha de pagamento', 403);
    }

    // CORREÇÃO CRÍTICA: Bloquear DELETE se folha NÃO está em DRAFT
    // Apenas folhas em DRAFT podem ser deletadas
    if (existing.status !== 'DRAFT') {
      throw new AppError(`Não é possível excluir uma folha de pagamento com status '${existing.status}'. Apenas folhas em status DRAFT podem ser excluídas.`, 403);
    }

    // Gerar audit log antes de deletar
    const userId = req.user?.userId;
    try {
      await AuditService.log(req, {
      modulo: 'FOLHA_PAGAMENTO',
      acao: 'DELETE',
      entidade: 'FOLHA_PAGAMENTO',
      entidadeId: id,
      dadosAnteriores: {
        funcionarioId: existing.funcionarioId,
        mes: existing.mes,
        ano: existing.ano,
        status: existing.status,
      },
      observacao: `Folha de pagamento excluída - Funcionário: ${existing.funcionarioId}, Mês: ${existing.mes}/${existing.ano}`,
      });
    } catch (auditError) {
      // Log de auditoria não deve quebrar o fluxo
      console.error('Erro ao gerar audit log:', auditError);
    }
    
    await prisma.folhaPagamento.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * Endpoint para buscar o salário base de um funcionário
 * Usado pelo frontend para preencher automaticamente o campo de salário base
 */
export const getSalarioBase = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { funcionarioId } = req.params;
    const filter = addInstitutionFilter(req);
    
    if (!funcionarioId) {
      throw new AppError('ID do funcionário é obrigatório', 400);
    }
    
    // Verify funcionario exists and belongs to institution
    const funcionario = await prisma.funcionario.findUnique({
      where: { id: funcionarioId },
      select: { instituicaoId: true },
    });
    
    if (!funcionario) {
      throw new AppError('Funcionário não encontrado', 404);
    }
    
    if (filter.instituicaoId && funcionario.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado a este funcionário', 403);
    }
    
    // Buscar salário base automaticamente
    const salarioBase = await getSalarioBaseFuncionario(funcionarioId);
    
    res.json({
      funcionarioId,
      salarioBase,
      salario_base: salarioBase, // snake_case para compatibilidade
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Endpoint para calcular desconto por faltas automaticamente
 * Usado pelo frontend para mostrar o desconto antes de criar/atualizar a folha
 */
export const calcularDescontos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { funcionarioId, mes, ano } = req.query;
    const filter = addInstitutionFilter(req);
    
    if (!funcionarioId || !mes || !ano) {
      throw new AppError('funcionarioId, mes e ano são obrigatórios', 400);
    }
    
    const funcionarioIdStr = funcionarioId as string;
    const mesNumero = parseInt(mes as string);
    const anoNumero = parseInt(ano as string);
    
    if (mesNumero < 1 || mesNumero > 12) {
      throw new AppError('Mês deve estar entre 1 e 12', 400);
    }
    
    // Verify funcionario exists and belongs to institution
    const funcionario = await prisma.funcionario.findUnique({
      where: { id: funcionarioIdStr },
      select: { instituicaoId: true },
    });
    
    if (!funcionario) {
      throw new AppError('Funcionário não encontrado', 404);
    }
    
    if (filter.instituicaoId && funcionario.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado a este funcionário', 403);
    }
    
    // Buscar salário base
    const salarioBase = await getSalarioBaseFuncionario(funcionarioIdStr);
    
    // Buscar instituição do funcionário para calcular dias úteis com feriados
    const funcionarioParaCalc = await prisma.funcionario.findUnique({
      where: { id: funcionarioIdStr },
      select: { instituicaoId: true },
    });
    
    const instituicaoIdParaCalc = funcionarioParaCalc?.instituicaoId || null;
    
    // Calcular dias úteis (excluindo sábados, domingos e feriados)
    const diasUteis = await calcularDiasUteis(mesNumero, anoNumero, instituicaoIdParaCalc);
    
    // Contar faltas não justificadas
    const faltasNaoJustificadas = await contarFaltasNaoJustificadas(funcionarioIdStr, mesNumero, anoNumero);
    
    // Calcular desconto
    const desconto = await calcularDescontoFaltas(funcionarioIdStr, mesNumero, anoNumero);
    
    // Calcular valor por dia útil
    const valorDia = diasUteis > 0 ? salarioBase / diasUteis : 0;
    
    res.json({
      funcionarioId: funcionarioIdStr,
      mes: mesNumero,
      ano: anoNumero,
      salarioBase,
      salario_base: salarioBase,
      diasUteis,
      dias_uteis: diasUteis,
      faltasNaoJustificadas,
      faltas_nao_justificadas: faltasNaoJustificadas,
      valorDia,
      valor_dia: valorDia,
      desconto,
      descontos_faltas: desconto,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Calcular folha de pagamento automaticamente baseado em presenças biométricas
 * POST /folha-pagamento/calcular-automatico
 * 
 * Entrada:
 * - funcionarioId: string
 * - mes: number (1-12) ou string "YYYY-MM"
 * 
 * Retorna valores calculados automaticamente baseado em dados reais de presença biométrica
 */
export const calcularAutomatico = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { funcionarioId, mes } = req.body;

    if (!funcionarioId) {
      throw new AppError('funcionarioId é obrigatório', 400);
    }

    if (!mes) {
      throw new AppError('mes é obrigatório (formato: YYYY-MM ou número 1-12)', 400);
    }

    let mesNumero: number;
    let anoNumero: number;

    // Suportar formato "YYYY-MM" ou apenas número do mês (assumindo ano atual)
    if (typeof mes === 'string' && mes.includes('-')) {
      const [ano, mesStr] = mes.split('-');
      anoNumero = parseInt(ano);
      mesNumero = parseInt(mesStr);
      
      if (isNaN(anoNumero) || isNaN(mesNumero)) {
        throw new AppError('Formato de mês inválido. Use YYYY-MM ou número 1-12', 400);
      }
    } else {
      mesNumero = parseInt(mes as string);
      anoNumero = new Date().getFullYear();
    }

    if (mesNumero < 1 || mesNumero > 12) {
      throw new AppError('Mês deve estar entre 1 e 12', 400);
    }

    // Calcular folha automaticamente usando o serviço
    const calculo = await PayrollCalculationService.calcularFolhaAutomatico(
      funcionarioId,
      mesNumero,
      anoNumero,
      instituicaoId
    );

    // Gerar log de auditoria
    try {
      await AuditService.log(req, {
        modulo: 'FOLHA_PAGAMENTO',
        acao: 'CALCULATE',
        entidade: 'FOLHA_PAGAMENTO',
        dadosNovos: {
        funcionarioId,
        mes: mesNumero,
        ano: anoNumero,
        origem: 'PRESENCA_BIOMETRICA',
        calculo: {
          salarioBase: calculo.salarioBase,
          descontosFaltas: calculo.descontosFaltas,
          horasExtras: calculo.horasExtras,
          valorHorasExtras: calculo.valorHorasExtras,
          salarioLiquido: calculo.salarioLiquido,
        },
        dadosPresenca: calculo.dadosPresenca,
      },
      observacao: `Cálculo automático de folha baseado em presenças biométricas para ${mesNumero}/${anoNumero}`,
      });
    } catch (auditError) {
      // Log de auditoria não deve quebrar o fluxo
      console.error('Erro ao gerar audit log:', auditError);
    }

    // Retornar resultado formatado (compatível com snake_case e camelCase)
    res.json({
      ...calculo,
      // Duplicar campos principais para compatibilidade
      funcionario_id: funcionarioId,
      funcionarioId,
      mes: mesNumero,
      ano: anoNumero,
      salario_base: calculo.salarioBase,
      dias_uteis: calculo.diasUteis,
      valor_dia: calculo.valorDia,
      total_faltas_nao_justificadas: calculo.totalFaltasNaoJustificadas,
      descontos_faltas: calculo.descontosFaltas,
      horas_extras: calculo.horasExtras,
      valor_hora: calculo.valorHora,
      valor_horas_extras: calculo.valorHorasExtras,
      salario_bruto: calculo.salarioBruto,
      total_descontos: calculo.totalDescontos,
      salario_liquido: calculo.salarioLiquido,
      origem_calculo: calculo.origemCalculo,
      dados_presenca: calculo.dadosPresenca,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Fechar uma folha de pagamento
 * POST /folha-pagamento/:id/fechar
 * 
 * Bloqueia todas as edições e marca como imutável
 */
export const fecharFolha = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // Fechar folha via serviço
    const folhaFechada = await PayrollClosingService.fecharFolha(
      id,
      userId,
      instituicaoId
    );

    // Gerar audit log
    try {
      await AuditService.log(req, {
        modulo: 'FOLHA_PAGAMENTO',
        acao: 'CLOSE',
      entidade: 'FOLHA_PAGAMENTO',
      entidadeId: id,
      dadosNovos: {
        status: 'CLOSED',
        fechadoEm: folhaFechada.fechadoEm,
        fechadoPor: folhaFechada.fechadoPor,
        funcionarioId: folhaFechada.funcionarioId,
        mes: folhaFechada.mes,
        ano: folhaFechada.ano,
      },
      observacao: `Folha de pagamento fechada - Funcionário: ${folhaFechada.funcionarioId}, Mês: ${folhaFechada.mes}/${folhaFechada.ano}`,
      });
    } catch (auditError) {
      console.error('Erro ao gerar audit log:', auditError);
    }

    // Converter para snake_case
    const formatted = {
      id: folhaFechada.id,
      funcionario_id: folhaFechada.funcionarioId,
      mes: folhaFechada.mes,
      ano: folhaFechada.ano,
      dias_uteis: (folhaFechada as any).diasUteis || 0,
      salario_base: parseFloat(folhaFechada.salarioBase.toString()),
      salario_liquido: parseFloat(folhaFechada.salarioLiquido.toString()),
      status: folhaFechada.status,
      fechado_em: folhaFechada.fechadoEm?.toISOString() || null,
      fechado_por: folhaFechada.fechadoPor,
      funcionario: folhaFechada.funcionario ? {
        id: folhaFechada.funcionario.id,
        nome_completo: folhaFechada.funcionario.nomeCompleto,
        cargo: folhaFechada.funcionario.cargo?.nome || null,
        departamento: folhaFechada.funcionario.departamento?.nome || null,
      } : null,
    };

    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

/**
 * Reabrir uma folha de pagamento fechada
 * POST /folha-pagamento/:id/reabrir
 * 
 * Apenas ADMIN ou DIRECAO podem reabrir
 * Requer justificativa obrigatória
 */
export const reabrirFolha = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { justificativa } = req.body;
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;
    const userRole = req.user?.roles?.[0] || '';

    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    if (!justificativa || justificativa.trim().length === 0) {
      throw new AppError('Justificativa é obrigatória para reabertura', 400);
    }

    // Buscar folha atual para audit log
    const folhaAntes = await prisma.folhaPagamento.findUnique({
      where: { id },
      select: {
        status: true,
        funcionarioId: true,
        mes: true,
        ano: true,
      },
    });

    // Reabrir folha via serviço
    const folhaReaberta = await PayrollClosingService.reabrirFolha(
      id,
      userId,
      instituicaoId,
      justificativa,
      userRole
    );

    // Gerar audit log
    try {
      await AuditService.log(req, {
        modulo: 'FOLHA_PAGAMENTO',
        acao: 'REOPEN',
      entidade: 'FOLHA_PAGAMENTO',
      entidadeId: id,
      dadosAnteriores: {
        status: folhaAntes?.status,
      },
      dadosNovos: {
        status: folhaReaberta.status,
        reabertoEm: folhaReaberta.reabertoEm,
        reabertoPor: folhaReaberta.reabertoPor,
        justificativaReabertura: folhaReaberta.justificativaReabertura,
        funcionarioId: folhaReaberta.funcionarioId,
        mes: folhaReaberta.mes,
        ano: folhaReaberta.ano,
      },
      observacao: `Folha de pagamento reaberta - Justificativa: ${justificativa}`,
      });
    } catch (auditError) {
      console.error('Erro ao gerar audit log:', auditError);
    }

    // Converter para snake_case
    const formatted = {
      id: folhaReaberta.id,
      funcionario_id: folhaReaberta.funcionarioId,
      mes: folhaReaberta.mes,
      ano: folhaReaberta.ano,
      dias_uteis: (folhaReaberta as any).diasUteis || 0,
      salario_base: parseFloat(folhaReaberta.salarioBase.toString()),
      salario_liquido: parseFloat(folhaReaberta.salarioLiquido.toString()),
      status: folhaReaberta.status,
      fechado_em: folhaReaberta.fechadoEm?.toISOString() || null,
      fechado_por: folhaReaberta.fechadoPor,
      reaberto_em: folhaReaberta.reabertoEm?.toISOString() || null,
      reaberto_por: folhaReaberta.reabertoPor,
      justificativa_reabertura: folhaReaberta.justificativaReabertura,
      funcionario: folhaReaberta.funcionario ? {
        id: folhaReaberta.funcionario.id,
        nome_completo: folhaReaberta.funcionario.nomeCompleto,
        cargo: folhaReaberta.funcionario.cargo?.nome || null,
        departamento: folhaReaberta.funcionario.departamento?.nome || null,
      } : null,
    };

    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

/**
 * Marcar uma folha fechada como PAGA
 * POST /folha-pagamento/:id/pagar
 * 
 * Apenas folhas em status CLOSED podem ser pagas
 * Requer método de pagamento obrigatório
 */
export const pagarFolha = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { metodoPagamento, referencia, observacaoPagamento } = req.body;
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    if (!metodoPagamento) {
      throw new AppError('Método de pagamento é obrigatório', 400);
    }

    // Validar permissões (RH pode pagar se habilitado, ADMIN/DIRECAO sempre pode)
    const rolesPermitidos = ['ADMIN', 'SUPER_ADMIN', 'SECRETARIA', 'RH'] as const;
    const hasPermission = rolesPermitidos.some(r => req.user?.roles?.includes(r as any));
    if (!hasPermission) {
      // Gerar audit log de bloqueio
      try {
        await AuditService.log(req, {
          modulo: 'FOLHA_PAGAMENTO',
          acao: 'BLOCK',
          entidade: 'FOLHA_PAGAMENTO',
          entidadeId: id,
          observacao: `Tentativa de pagamento bloqueada - Roles: ${req.user?.roles?.join(',') || 'nenhuma'} não tem permissão`,
        });
      } catch (auditError) {
        console.error('Erro ao gerar audit log:', auditError);
      }
      throw new AppError('Você não tem permissão para pagar folhas de pagamento', 403);
    }

    // Pagar folha via serviço
    const folhaPagaResult = await PayrollPaymentService.pagarFolha(
      req,
      id,
      userId,
      instituicaoId,
      metodoPagamento,
      referencia,
      observacaoPagamento
    );

    if (!folhaPagaResult) {
      throw new AppError('Erro ao processar pagamento da folha', 500);
    }
    const folhaPaga = folhaPagaResult;

    // Converter para snake_case
    const formatted = {
      id: folhaPaga.id,
      funcionario_id: folhaPaga.funcionarioId,
      mes: folhaPaga.mes,
      ano: folhaPaga.ano,
      dias_uteis: (folhaPaga as any).diasUteis || 0,
      salario_base: parseFloat(folhaPaga.salarioBase.toString()),
      salario_liquido: parseFloat(folhaPaga.salarioLiquido.toString()),
      status: folhaPaga.status,
      fechado_em: folhaPaga.fechadoEm?.toISOString() || null,
      fechado_por: folhaPaga.fechadoPor,
      pago_em: folhaPaga.pagoEm?.toISOString() || null,
      pago_por: folhaPaga.pagoPor,
      metodo_pagamento: folhaPaga.metodoPagamento,
      referencia: folhaPaga.referencia,
      observacao_pagamento: folhaPaga.observacaoPagamento,
      // Campos legados (compatibilidade)
      data_pagamento: folhaPaga.dataPagamento?.toISOString().split('T')[0] || null,
      forma_pagamento: folhaPaga.formaPagamento,
      funcionario: folhaPaga.funcionario ? {
        id: folhaPaga.funcionario.id,
        nome_completo: folhaPaga.funcionario.nomeCompleto,
        cargo: folhaPaga.funcionario.cargo?.nome || null,
        departamento: folhaPaga.funcionario.departamento?.nome || null,
      } : null,
    };

    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

/**
 * Reverter pagamento de uma folha
 * POST /folha-pagamento/:id/reverter-pagamento
 * 
 * Apenas ADMIN/DIRECAO podem reverter
 * Requer justificativa obrigatória
 */
export const reverterPagamento = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { justificativa } = req.body;
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;
    const userRole = req.user?.roles?.[0] || ''; // Role principal para audit

    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    if (!justificativa || justificativa.trim().length === 0) {
      throw new AppError('Justificativa é obrigatória para reverter pagamento', 400);
    }

    // Reverter pagamento via serviço
    const folhaRevertida = await PayrollPaymentService.reverterPagamento(
      req,
      id,
      userId,
      instituicaoId,
      justificativa,
      userRole
    );

    // Converter para snake_case
    const formatted = {
      id: folhaRevertida.id,
      funcionario_id: folhaRevertida.funcionarioId,
      mes: folhaRevertida.mes,
      ano: folhaRevertida.ano,
      dias_uteis: (folhaRevertida as any).diasUteis || 0,
      salario_base: parseFloat(folhaRevertida.salarioBase.toString()),
      salario_liquido: parseFloat(folhaRevertida.salarioLiquido.toString()),
      status: folhaRevertida.status,
      fechado_em: folhaRevertida.fechadoEm?.toISOString() || null,
      fechado_por: folhaRevertida.fechadoPor,
      pago_em: folhaRevertida.pagoEm?.toISOString() || null,
      pago_por: folhaRevertida.pagoPor,
      metodo_pagamento: folhaRevertida.metodoPagamento,
      referencia: folhaRevertida.referencia,
      observacao_pagamento: folhaRevertida.observacaoPagamento,
      // Campos legados (compatibilidade)
      data_pagamento: folhaRevertida.dataPagamento?.toISOString().split('T')[0] || null,
      forma_pagamento: folhaRevertida.formaPagamento,
      funcionario: folhaRevertida.funcionario ? {
        id: folhaRevertida.funcionario.id,
        nome_completo: folhaRevertida.funcionario.nomeCompleto,
        cargo: folhaRevertida.funcionario.cargo?.nome || null,
        departamento: folhaRevertida.funcionario.departamento?.nome || null,
      } : null,
    };

    res.json(formatted);
  } catch (error) {
    next(error);
  }
};
