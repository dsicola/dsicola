import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { StatusFrequenciaFuncionario } from '@prisma/client';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import { AuditService, ModuloAuditoria, EntidadeAuditoria } from '../services/audit.service.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { funcionarioId, dataInicio, dataFim, status } = req.query;
    
    const where: any = {};
    
    // Filter by institution through funcionario
    if (filter.instituicaoId) {
      where.funcionario = { instituicaoId: filter.instituicaoId };
    }
    
    // Additional filters
    if (funcionarioId) {
      where.funcionarioId = funcionarioId as string;
    }
    
    if (dataInicio && dataFim) {
      where.data = {
        gte: new Date(dataInicio as string),
        lte: new Date(dataFim as string),
      };
    } else if (dataInicio) {
      where.data = { gte: new Date(dataInicio as string) };
    } else if (dataFim) {
      where.data = { lte: new Date(dataFim as string) };
    }
    
    // Filter by status if provided
    if (status) {
      where.status = status as string;
    }
    
    const frequencias = await prisma.frequenciaFuncionario.findMany({
      where,
      include: { 
        funcionario: {
          include: {
            cargo: true,
            departamento: true,
          }
        }
      },
      orderBy: { data: 'desc' },
    });
    
    // Convert to snake_case for frontend compatibility
    const formatted = frequencias.map(freq => ({
      id: freq.id,
      funcionario_id: freq.funcionarioId,
      data: freq.data.toISOString().split('T')[0],
      hora_entrada: freq.horaEntrada,
      hora_saida: freq.horaSaida,
      horas_trabalhadas: freq.horasTrabalhadas ? parseFloat(freq.horasTrabalhadas.toString()) : null,
      horas_extras: freq.horasExtras ? parseFloat(freq.horasExtras.toString()) : 0,
      status: freq.status,
      tipo: freq.status, // Mantido para compatibilidade com frontend antigo
      observacoes: freq.observacoes,
      instituicao_id: freq.instituicaoId,
      created_at: freq.createdAt,
      updated_at: freq.updatedAt,
      funcionario: freq.funcionario ? {
        id: freq.funcionario.id,
        nome_completo: freq.funcionario.nomeCompleto,
        email: freq.funcionario.email,
        cargo: freq.funcionario.cargo?.nome || null,
        departamento: freq.funcionario.departamento?.nome || null,
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
    
    const frequencia = await prisma.frequenciaFuncionario.findUnique({
      where: { id },
      include: { 
        funcionario: {
          include: {
            cargo: true,
            departamento: true,
          }
        }
      },
    });
    
    if (!frequencia) {
      throw new AppError('Frequência não encontrada', 404);
    }
    
    // Check institution access
    if (filter.instituicaoId && frequencia.funcionario.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado a esta frequência', 403);
    }
    
    // Convert to snake_case
    const formatted = {
      id: frequencia.id,
      funcionario_id: frequencia.funcionarioId,
      data: frequencia.data.toISOString().split('T')[0],
      hora_entrada: frequencia.horaEntrada,
      hora_saida: frequencia.horaSaida,
      horas_trabalhadas: frequencia.horasTrabalhadas ? parseFloat(frequencia.horasTrabalhadas.toString()) : null,
      status: frequencia.status,
      tipo: frequencia.status, // Mantido para compatibilidade com frontend antigo
      observacoes: frequencia.observacoes,
      created_at: frequencia.createdAt,
      updated_at: frequencia.updatedAt,
      funcionario: {
        id: frequencia.funcionario.id,
        nome_completo: frequencia.funcionario.nomeCompleto,
        email: frequencia.funcionario.email,
        cargo: frequencia.funcionario.cargo?.nome || null,
        departamento: frequencia.funcionario.departamento?.nome || null,
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
    const {
      funcionario_id,
      funcionarioId,
      data,
      hora_entrada,
      horaEntrada,
      hora_saida,
      horaSaida,
      horas_trabalhadas,
      horasTrabalhadas,
      horas_extras,
      horasExtras,
      status,
      tipo, // Aceita tipo para compatibilidade, mas converte para status
      observacoes,
      origem, // Permitir origem apenas se for MANUAL (não permitir BIOMETRIA)
    } = req.body;
    
    const finalFuncionarioId = funcionarioId || funcionario_id;
    if (!finalFuncionarioId) {
      throw new AppError('Funcionário é obrigatório', 400);
    }
    
    if (!data) {
      throw new AppError('Data é obrigatória', 400);
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

    // BLOQUEIO: Não permitir criar presença manual com origem BIOMETRIA
    if (origem === 'BIOMETRIA') {
      throw new AppError('Presenças biométricas só podem ser criadas através do sistema de integração com dispositivos biométricos', 403);
    }

    // BLOQUEIO: Verificar se já existe presença biométrica para esta data
    const dataFormatada = new Date(data);
    dataFormatada.setHours(0, 0, 0, 0);

    const presencaExistente = await prisma.frequenciaFuncionario.findUnique({
      where: {
        funcionarioId_data: {
          funcionarioId: finalFuncionarioId,
          data: dataFormatada,
        },
      },
    });

    if (presencaExistente && presencaExistente.origem === 'BIOMETRIA') {
      await AuditService.log(req, {
        modulo: ModuloAuditoria.FOLHA_PAGAMENTO,
        entidade: EntidadeAuditoria.FREQUENCIA_FUNCIONARIO,
        entidadeId: presencaExistente.id,
        acao: 'BLOCK',
        dadosAnteriores: {
          origem: presencaExistente.origem,
          status: presencaExistente.status,
        },
        dadosNovos: null,
        observacao: `Tentativa de criação manual bloqueada: Já existe presença biométrica para esta data.`,
      });

      throw new AppError('Já existe uma presença biométrica registrada para esta data. Não é possível criar presença manual para substituir.', 409);
    }
    
    // Obter instituicaoId do funcionário (obrigatório para frequência)
    const instituicaoIdFinal = funcionario.instituicaoId;
    if (!instituicaoIdFinal) {
      throw new AppError('Funcionário deve ter uma instituição associada', 400);
    }
    
    // Converter tipo antigo para status novo (compatibilidade)
    let statusFinalStr = status || 'PRESENTE';
    if (tipo && !status) {
      // Converter valores antigos para novos
      if (tipo === 'presente' || tipo === 'normal') {
        statusFinalStr = 'PRESENTE';
      } else if (tipo === 'falta_justificada' || tipo === 'falta-justificada') {
        statusFinalStr = 'FALTA_JUSTIFICADA';
      } else if (tipo === 'falta' || tipo === 'falta_nao_justificada' || tipo === 'falta-nao-justificada') {
        statusFinalStr = 'FALTA_NAO_JUSTIFICADA';
      } else {
        statusFinalStr = 'PRESENTE'; // Default
      }
    }
    
    // Validar e converter para enum do Prisma
    const statusEnum = statusFinalStr.toUpperCase() as StatusFrequenciaFuncionario;
    if (!Object.values(StatusFrequenciaFuncionario).includes(statusEnum)) {
      throw new AppError('Status inválido. Use: PRESENTE, FALTA_JUSTIFICADA ou FALTA_NAO_JUSTIFICADA', 400);
    }
    
    // Validar horas extras (apenas se status for PRESENTE)
    let horasExtrasFinal = horasExtras !== undefined ? horasExtras : horas_extras;
    if (horasExtrasFinal === undefined || horasExtrasFinal === null) {
      horasExtrasFinal = 0;
    }
    
    if (horasExtrasFinal < 0) {
      throw new AppError('Horas extras não podem ser negativas', 400);
    }
    
    // Horas extras só podem ser registradas se status for PRESENTE
    if (horasExtrasFinal > 0 && statusEnum !== StatusFrequenciaFuncionario.PRESENTE) {
      throw new AppError('Horas extras só podem ser registradas para presenças', 400);
    }
    
    // Prepare data
    const createData: any = {
      funcionarioId: finalFuncionarioId,
      data: dataFormatada,
      status: statusEnum,
      instituicaoId: instituicaoIdFinal,
      horasExtras: horasExtrasFinal > 0 ? horasExtrasFinal : 0,
      origem: origem && origem !== 'BIOMETRIA' ? origem : 'MANUAL', // Sempre MANUAL para criações manuais
    };
    
    if (horaEntrada || hora_entrada) {
      createData.horaEntrada = horaEntrada || hora_entrada;
    }
    
    if (horaSaida || hora_saida) {
      createData.horaSaida = horaSaida || hora_saida;
    }
    
    if (horasTrabalhadas !== undefined || horas_trabalhadas !== undefined) {
      createData.horasTrabalhadas = horasTrabalhadas || horas_trabalhadas;
    }
    
    if (observacoes) {
      createData.observacoes = observacoes;
    }
    
    const frequencia = await prisma.frequenciaFuncionario.create({
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
    
    // Auditoria: Log CREATE
    await AuditService.logCreate(req, {
      modulo: ModuloAuditoria.FOLHA_PAGAMENTO,
      entidade: EntidadeAuditoria.FREQUENCIA_FUNCIONARIO,
      entidadeId: frequencia.id,
      dadosNovos: {
        funcionarioId: frequencia.funcionarioId,
        data: frequencia.data,
        status: frequencia.status,
        horaEntrada: frequencia.horaEntrada,
        horaSaida: frequencia.horaSaida,
      },
      observacao: `Presença registrada: ${statusEnum} - Funcionário: ${frequencia.funcionarioId}`,
    });
    
    // Convert to snake_case
    const formatted = {
      id: frequencia.id,
      funcionario_id: frequencia.funcionarioId,
      data: frequencia.data.toISOString().split('T')[0],
      hora_entrada: frequencia.horaEntrada,
      hora_saida: frequencia.horaSaida,
      horas_trabalhadas: frequencia.horasTrabalhadas ? parseFloat(frequencia.horasTrabalhadas.toString()) : null,
      status: frequencia.status,
      tipo: frequencia.status, // Mantido para compatibilidade com frontend antigo
      observacoes: frequencia.observacoes,
      created_at: frequencia.createdAt,
      updated_at: frequencia.updatedAt,
      funcionario: {
        id: frequencia.funcionario.id,
        nome_completo: frequencia.funcionario.nomeCompleto,
        email: frequencia.funcionario.email,
        cargo: frequencia.funcionario.cargo?.nome || null,
        departamento: frequencia.funcionario.departamento?.nome || null,
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
    
    // Check if frequencia exists and belongs to institution
    const existing = await prisma.frequenciaFuncionario.findUnique({
      where: { id },
      include: { funcionario: { select: { instituicaoId: true } } },
    });
    
    if (!existing) {
      throw new AppError('Frequência não encontrada', 404);
    }
    
    if (filter.instituicaoId && existing.funcionario.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado a esta frequência', 403);
    }

    // BLOQUEIO CRÍTICO: Não permitir edição manual de presenças com origem BIOMETRIA
    if (existing.origem === 'BIOMETRIA') {
      // Registrar tentativa de edição bloqueada
      await AuditService.log(req, {
        modulo: ModuloAuditoria.FOLHA_PAGAMENTO,
        entidade: EntidadeAuditoria.FREQUENCIA_FUNCIONARIO,
        entidadeId: id,
        acao: 'BLOCK',
        dadosAnteriores: {
          origem: existing.origem,
          status: existing.status,
          horaEntrada: existing.horaEntrada,
          horaSaida: existing.horaSaida,
        },
        dadosNovos: null,
        observacao: `Tentativa de edição manual bloqueada: Presença biométrica não pode ser editada manualmente. Use justificativas para alterar status.`,
      });

      throw new AppError('Presenças com origem BIOMETRIA não podem ser editadas manualmente. Use o módulo de justificativas para solicitar alteração de status.', 403);
    }
    
    // Map snake_case to camelCase
    const {
      funcionario_id,
      funcionarioId,
      data,
      hora_entrada,
      horaEntrada,
      hora_saida,
      horaSaida,
      horas_trabalhadas,
      horasTrabalhadas,
      horas_extras,
      horasExtras,
      status,
      tipo, // Aceita tipo para compatibilidade, mas converte para status
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
    
    if (data) {
      updateData.data = new Date(data);
    }
    
    if (horaEntrada !== undefined || hora_entrada !== undefined) {
      updateData.horaEntrada = horaEntrada !== null ? (horaEntrada || hora_entrada) : null;
    }
    
    if (horaSaida !== undefined || hora_saida !== undefined) {
      updateData.horaSaida = horaSaida !== null ? (horaSaida || hora_saida) : null;
    }
    
    if (horasTrabalhadas !== undefined || horas_trabalhadas !== undefined) {
      updateData.horasTrabalhadas = horasTrabalhadas !== null ? (horasTrabalhadas || horas_trabalhadas) : null;
    }
    
    // Tratar horas extras
    if (horasExtras !== undefined || horas_extras !== undefined) {
      const horasExtrasFinal = horasExtras !== undefined ? horasExtras : horas_extras;
      
      if (horasExtrasFinal < 0) {
        throw new AppError('Horas extras não podem ser negativas', 400);
      }
      
      // Horas extras só podem ser registradas se status for PRESENTE
      const statusAtual = updateData.status || existing.status;
      if (horasExtrasFinal > 0 && statusAtual !== 'PRESENTE') {
        throw new AppError('Horas extras só podem ser registradas para presenças', 400);
      }
      
      updateData.horasExtras = horasExtrasFinal || 0;
    }
    
    // Tratar status (com conversão de tipo para compatibilidade)
    if (status !== undefined || tipo !== undefined) {
      let statusFinal = status;
      if (tipo && !status) {
        // Converter valores antigos para novos
        if (tipo === 'presente' || tipo === 'normal') {
          statusFinal = 'PRESENTE';
        } else if (tipo === 'falta_justificada' || tipo === 'falta-justificada') {
          statusFinal = 'FALTA_JUSTIFICADA';
        } else if (tipo === 'falta' || tipo === 'falta_nao_justificada' || tipo === 'falta-nao-justificada') {
          statusFinal = 'FALTA_NAO_JUSTIFICADA';
        } else {
          statusFinal = statusFinal || 'PRESENTE';
        }
      }
      
      // Validar e converter para enum do Prisma
      if (statusFinal) {
        const statusEnumUpdate = statusFinal.toUpperCase() as StatusFrequenciaFuncionario;
        if (!Object.values(StatusFrequenciaFuncionario).includes(statusEnumUpdate)) {
          throw new AppError('Status inválido. Use: PRESENTE, FALTA_JUSTIFICADA ou FALTA_NAO_JUSTIFICADA', 400);
        }
        updateData.status = statusEnumUpdate;
      }
      
      if (statusFinal) {
        updateData.status = statusFinal;
      }
    }
    
    if (observacoes !== undefined) {
      updateData.observacoes = observacoes;
    }
    
    // Dados antigos para auditoria
    const dadosAnteriores = {
      status: existing.status,
      horaEntrada: existing.horaEntrada,
      horaSaida: existing.horaSaida,
      horasTrabalhadas: existing.horasTrabalhadas,
      horasExtras: existing.horasExtras,
    };

    const frequencia = await prisma.frequenciaFuncionario.update({
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
    
    // Auditoria: Log UPDATE
    await AuditService.logUpdate(req, {
      modulo: ModuloAuditoria.FOLHA_PAGAMENTO,
      entidade: EntidadeAuditoria.FREQUENCIA_FUNCIONARIO,
      entidadeId: id,
      dadosAnteriores: dadosAnteriores,
      dadosNovos: {
        status: frequencia.status,
        horaEntrada: frequencia.horaEntrada,
        horaSaida: frequencia.horaSaida,
        horasTrabalhadas: frequencia.horasTrabalhadas,
        horasExtras: frequencia.horasExtras,
      },
      observacao: `Presença atualizada: Funcionário: ${frequencia.funcionarioId}`,
    });
    
    // Convert to snake_case
    const formatted = {
      id: frequencia.id,
      funcionario_id: frequencia.funcionarioId,
      data: frequencia.data.toISOString().split('T')[0],
      hora_entrada: frequencia.horaEntrada,
      hora_saida: frequencia.horaSaida,
      horas_trabalhadas: frequencia.horasTrabalhadas ? parseFloat(frequencia.horasTrabalhadas.toString()) : null,
      horas_extras: frequencia.horasExtras ? parseFloat(frequencia.horasExtras.toString()) : 0,
      status: frequencia.status,
      tipo: frequencia.status, // Mantido para compatibilidade
      observacoes: frequencia.observacoes,
      instituicao_id: frequencia.instituicaoId,
      created_at: frequencia.createdAt,
      updated_at: frequencia.updatedAt,
      funcionario: {
        id: frequencia.funcionario.id,
        nome_completo: frequencia.funcionario.nomeCompleto,
        email: frequencia.funcionario.email,
        cargo: frequencia.funcionario.cargo?.nome || null,
        departamento: frequencia.funcionario.departamento?.nome || null,
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
    
    // Check if frequencia exists and belongs to institution
    const existing = await prisma.frequenciaFuncionario.findUnique({
      where: { id },
      include: { funcionario: { select: { instituicaoId: true } } },
    });
    
    if (!existing) {
      throw new AppError('Frequência não encontrada', 404);
    }
    
    if (filter.instituicaoId && existing.funcionario.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado a esta frequência', 403);
    }

    // BLOQUEIO CRÍTICO: Não permitir exclusão de presenças com origem BIOMETRIA
    if (existing.origem === 'BIOMETRIA') {
      // Registrar tentativa de exclusão bloqueada
      await AuditService.log(req, {
        modulo: ModuloAuditoria.FOLHA_PAGAMENTO,
        entidade: EntidadeAuditoria.FREQUENCIA_FUNCIONARIO,
        entidadeId: id,
        acao: 'BLOCK',
        dadosAnteriores: {
          origem: existing.origem,
          status: existing.status,
          funcionarioId: existing.funcionarioId,
          data: existing.data,
        },
        dadosNovos: null,
        observacao: `Tentativa de exclusão bloqueada: Presença biométrica não pode ser excluída manualmente.`,
      });

      throw new AppError('Presenças com origem BIOMETRIA não podem ser excluídas manualmente. Use o módulo de justificativas para alterar o status se necessário.', 403);
    }
    
    // Auditoria: Log DELETE
    await AuditService.logDelete(req, {
      modulo: ModuloAuditoria.FOLHA_PAGAMENTO,
      entidade: EntidadeAuditoria.FREQUENCIA_FUNCIONARIO,
      entidadeId: id,
      dadosAnteriores: existing,
      observacao: `Presença excluída: Funcionário: ${existing.funcionarioId}`,
    });
    
    await prisma.frequenciaFuncionario.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
