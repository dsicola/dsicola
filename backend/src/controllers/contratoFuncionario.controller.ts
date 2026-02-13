import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter } from '../middlewares/auth.js';
import { getSalarioBaseParaContrato } from '../services/rh.service.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { funcionarioId, status } = req.query;
    
    const where: any = {};
    
    // Filter by institution through funcionario
    if (filter.instituicaoId) {
      where.funcionario = { instituicaoId: filter.instituicaoId };
    }
    
    // Additional filters
    if (funcionarioId) {
      where.funcionarioId = funcionarioId as string;
    }
    
    if (status) {
      where.status = status as string;
    }
    
    const contratos = await prisma.contratoFuncionario.findMany({
      where,
      include: { 
        funcionario: {
          include: {
            cargo: true,
            departamento: true,
          }
        },
        cargo: true,
      },
      orderBy: { dataInicio: 'desc' },
    });
    
    // Convert to snake_case for frontend compatibility
    const formatted = contratos.map(contrato => ({
      id: contrato.id,
      funcionario_id: contrato.funcionarioId,
      cargo_id: contrato.cargoId,
      tipo_contrato: contrato.tipoContrato,
      data_inicio: contrato.dataInicio.toISOString().split('T')[0],
      data_fim: contrato.dataFim ? contrato.dataFim.toISOString().split('T')[0] : null,
      salario: contrato.salario ? parseFloat(contrato.salario.toString()) : null, // READ-ONLY: pode ser null
      carga_horaria: contrato.cargaHoraria,
      status: contrato.status,
      arquivo_url: contrato.arquivoUrl,
      nome_arquivo: contrato.nomeArquivo,
      renovado_de: contrato.renovadoDe,
      observacoes: contrato.observacoes,
      created_at: contrato.createdAt,
      updated_at: contrato.updatedAt,
      funcionario: contrato.funcionario ? {
        id: contrato.funcionario.id,
        nome_completo: contrato.funcionario.nomeCompleto,
        email: contrato.funcionario.email,
        cargo: contrato.funcionario.cargo?.nome || null,
        departamento: contrato.funcionario.departamento?.nome || null,
      } : null,
      cargo: contrato.cargo ? {
        id: contrato.cargo.id,
        nome: contrato.cargo.nome,
      } : null,
    }));
    
    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

export const getByFuncionarioIds = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { funcionarioIds } = req.body;
    
    if (!Array.isArray(funcionarioIds) || funcionarioIds.length === 0) {
      throw new AppError('Lista de IDs de funcionários é obrigatória', 400);
    }
    
    const where: any = {
      funcionarioId: { in: funcionarioIds },
    };
    
    // Filter by institution through funcionario
    if (filter.instituicaoId) {
      where.funcionario = { instituicaoId: filter.instituicaoId };
    }
    
    const contratos = await prisma.contratoFuncionario.findMany({
      where,
      include: { 
        funcionario: {
          include: {
            cargo: true,
            departamento: true,
          }
        },
        cargo: true,
      },
      orderBy: { dataInicio: 'desc' },
    });
    
    // Convert to snake_case for frontend compatibility
    const formatted = contratos.map(contrato => ({
      id: contrato.id,
      funcionario_id: contrato.funcionarioId,
      cargo_id: contrato.cargoId,
      tipo_contrato: contrato.tipoContrato,
      data_inicio: contrato.dataInicio.toISOString().split('T')[0],
      data_fim: contrato.dataFim ? contrato.dataFim.toISOString().split('T')[0] : null,
      salario: contrato.salario ? parseFloat(contrato.salario.toString()) : null, // READ-ONLY: pode ser null
      carga_horaria: contrato.cargaHoraria,
      status: contrato.status,
      arquivo_url: contrato.arquivoUrl,
      nome_arquivo: contrato.nomeArquivo,
      renovado_de: contrato.renovadoDe,
      observacoes: contrato.observacoes,
      created_at: contrato.createdAt,
      updated_at: contrato.updatedAt,
      funcionario: contrato.funcionario ? {
        id: contrato.funcionario.id,
        nome_completo: contrato.funcionario.nomeCompleto,
        email: contrato.funcionario.email,
        cargo: contrato.funcionario.cargo?.nome || null,
        departamento: contrato.funcionario.departamento?.nome || null,
      } : null,
      cargo: contrato.cargo ? {
        id: contrato.cargo.id,
        nome: contrato.cargo.nome,
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
    
    const contrato = await prisma.contratoFuncionario.findUnique({
      where: { id },
      include: { 
        funcionario: {
          include: {
            cargo: true,
            departamento: true,
          }
        },
        cargo: true,
      },
    });
    
    if (!contrato) {
      throw new AppError('Contrato não encontrado', 404);
    }
    
    // Check institution access
    if (filter.instituicaoId && contrato.funcionario.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado a este contrato', 403);
    }
    
    // Convert to snake_case
    const formatted = {
      id: contrato.id,
      funcionario_id: contrato.funcionarioId,
      cargo_id: contrato.cargoId,
      tipo_contrato: contrato.tipoContrato,
      data_inicio: contrato.dataInicio.toISOString().split('T')[0],
      data_fim: contrato.dataFim ? contrato.dataFim.toISOString().split('T')[0] : null,
      salario: contrato.salario ? parseFloat(contrato.salario.toString()) : null, // READ-ONLY: pode ser null
      carga_horaria: contrato.cargaHoraria,
      status: contrato.status,
      arquivo_url: contrato.arquivoUrl,
      nome_arquivo: contrato.nomeArquivo,
      renovado_de: contrato.renovadoDe,
      observacoes: contrato.observacoes,
      created_at: contrato.createdAt,
      updated_at: contrato.updatedAt,
      funcionario: {
        id: contrato.funcionario.id,
        nome_completo: contrato.funcionario.nomeCompleto,
        email: contrato.funcionario.email,
        cargo: contrato.funcionario.cargo?.nome || null,
        departamento: contrato.funcionario.departamento?.nome || null,
      },
      cargo: contrato.cargo ? {
        id: contrato.cargo.id,
        nome: contrato.cargo.nome,
      } : null,
    };
    
    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // VALIDAÇÃO MULTI-TENANT: Rejeitar explicitamente instituicaoId do body (segurança)
    if (req.body.instituicaoId !== undefined || req.body.instituicao_id !== undefined) {
      throw new AppError('Não é permitido alterar a instituição. O sistema usa a instituição do usuário autenticado.', 400);
    }

    const filter = addInstitutionFilter(req);
    
    // Map snake_case to camelCase
    const {
      funcionario_id,
      funcionarioId,
      tipo_contrato,
      tipoContrato = 'CLT',
      data_inicio,
      dataInicio,
      data_fim,
      dataFim,
      salario,
      carga_horaria,
      cargaHoraria = '40h',
      status = 'ativo',
      arquivo_url,
      arquivoUrl,
      nome_arquivo,
      nomeArquivo,
      renovado_de,
      renovadoDe,
      observacoes,
    } = req.body;
    
    const finalFuncionarioId = funcionarioId || funcionario_id;
    if (!finalFuncionarioId) {
      throw new AppError('Funcionário é obrigatório', 400);
    }
    
    const finalDataInicio = dataInicio || data_inicio;
    if (!finalDataInicio) {
      throw new AppError('Data de início é obrigatória', 400);
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

    // Verificar se já existe um contrato ATIVO para este funcionário
    const contratoAtivoExistente = await prisma.contratoFuncionario.findFirst({
      where: {
        funcionarioId: finalFuncionarioId,
        status: 'ATIVO',
      },
    });

    if (contratoAtivoExistente && (status === 'ativo' || status === 'ATIVO')) {
      throw new AppError('Já existe um contrato ativo para este funcionário. Encerre o contrato atual antes de criar um novo.', 409);
    }
    
    // Buscar salário automaticamente do funcionário ou cargo
    // IMPORTANTE: Ignoramos qualquer salário vindo do body para garantir consistência
    // Nota: Para contratos, usamos getSalarioBaseParaContrato que busca funcionário/cargo
    // (não contrato, para evitar circularidade ao criar novos contratos)
    const salarioAutomatico = await getSalarioBaseParaContrato(finalFuncionarioId);
    
    // Get cargoId if provided
    const cargoId = req.body.cargoId || req.body.cargo_id;
    
    // Prepare data
    const createData: any = {
      funcionarioId: finalFuncionarioId,
      cargoId: cargoId || null, // Cargo é opcional
      tipoContrato: tipoContrato || tipo_contrato || 'CLT',
      dataInicio: new Date(finalDataInicio),
      salario: salarioAutomatico > 0 ? salarioAutomatico : null, // READ-ONLY: vem do funcionário
      cargaHoraria: cargaHoraria || carga_horaria || '40h',
      status: 'ATIVO', // Novo contrato é sempre ativo
    };
    
    if (dataFim || data_fim) {
      createData.dataFim = new Date(dataFim || data_fim);
    }
    
    if (arquivoUrl || arquivo_url) {
      createData.arquivoUrl = arquivoUrl || arquivo_url;
    }
    
    if (nomeArquivo || nome_arquivo) {
      createData.nomeArquivo = nomeArquivo || nome_arquivo;
    }
    
    if (renovadoDe || renovado_de) {
      createData.renovadoDe = renovadoDe || renovado_de;
    }
    
    if (observacoes) {
      createData.observacoes = observacoes;
    }
    
    const contrato = await prisma.contratoFuncionario.create({
      data: createData,
      include: {
        funcionario: {
          include: {
            cargo: true,
            departamento: true,
          }
        },
        cargo: true,
      },
    });
    
    // Convert to snake_case
    const formatted = {
      id: contrato.id,
      funcionario_id: contrato.funcionarioId,
      cargo_id: contrato.cargoId,
      tipo_contrato: contrato.tipoContrato,
      data_inicio: contrato.dataInicio.toISOString().split('T')[0],
      data_fim: contrato.dataFim ? contrato.dataFim.toISOString().split('T')[0] : null,
      salario: contrato.salario ? parseFloat(contrato.salario.toString()) : null, // READ-ONLY
      carga_horaria: contrato.cargaHoraria,
      status: contrato.status,
      arquivo_url: contrato.arquivoUrl,
      nome_arquivo: contrato.nomeArquivo,
      renovado_de: contrato.renovadoDe,
      observacoes: contrato.observacoes,
      created_at: contrato.createdAt,
      updated_at: contrato.updatedAt,
      funcionario: {
        id: contrato.funcionario.id,
        nome_completo: contrato.funcionario.nomeCompleto,
        email: contrato.funcionario.email,
        cargo: contrato.funcionario.cargo?.nome || null,
        departamento: contrato.funcionario.departamento?.nome || null,
      },
      cargo: contrato.cargo ? {
        id: contrato.cargo.id,
        nome: contrato.cargo.nome,
      } : null,
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
    
    // Check if contrato exists and belongs to institution
    const existing = await prisma.contratoFuncionario.findUnique({
      where: { id },
      include: { funcionario: { select: { instituicaoId: true } } },
    });
    
    if (!existing) {
      throw new AppError('Contrato não encontrado', 404);
    }
    
    if (filter.instituicaoId && existing.funcionario.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado a este contrato', 403);
    }
    
    // Map snake_case to camelCase
    // Note: salario is intentionally ignored - it cannot be updated in existing contracts (READ-ONLY)
    const {
      funcionario_id,
      funcionarioId,
      cargo_id,
      cargoId,
      tipo_contrato,
      tipoContrato,
      data_inicio,
      dataInicio,
      data_fim,
      dataFim,
      carga_horaria,
      cargaHoraria,
      status,
      arquivo_url,
      arquivoUrl,
      nome_arquivo,
      nomeArquivo,
      renovado_de,
      renovadoDe,
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
    
    // Handle cargoId
    if (cargoId !== undefined || cargo_id !== undefined) {
      const finalCargoId = cargoId || cargo_id;
      // If finalCargoId is null or empty string, set to null
      updateData.cargoId = finalCargoId || null;
    }
    
    if (tipoContrato || tipo_contrato) {
      updateData.tipoContrato = tipoContrato || tipo_contrato;
    }
    
    if (dataInicio || data_inicio) {
      updateData.dataInicio = new Date(dataInicio || data_inicio);
    }
    
    if (dataFim !== undefined || data_fim !== undefined) {
      updateData.dataFim = dataFim || data_fim ? new Date(dataFim || data_fim) : null;
    }
    
    // Salário não pode ser editado em contratos existentes
    // Removido: if (salario !== undefined) { updateData.salario = salario; }
    
    if (cargaHoraria !== undefined || carga_horaria !== undefined) {
      updateData.cargaHoraria = cargaHoraria || carga_horaria;
    }
    
    if (status !== undefined) {
      updateData.status = status;
    }
    
    if (arquivoUrl !== undefined || arquivo_url !== undefined) {
      updateData.arquivoUrl = arquivoUrl !== undefined ? (arquivoUrl || arquivo_url) : null;
    }
    
    if (nomeArquivo !== undefined || nome_arquivo !== undefined) {
      updateData.nomeArquivo = nomeArquivo !== undefined ? (nomeArquivo || nome_arquivo) : null;
    }
    
    if (renovadoDe !== undefined || renovado_de !== undefined) {
      updateData.renovadoDe = renovadoDe !== undefined ? (renovadoDe || renovado_de) : null;
    }
    
    if (observacoes !== undefined) {
      updateData.observacoes = observacoes;
    }
    
    const contrato = await prisma.contratoFuncionario.update({
      where: { id },
      data: updateData,
      include: {
        funcionario: {
          include: {
            cargo: true,
            departamento: true,
          }
        },
        cargo: true,
      },
    });
    
    // Convert to snake_case
    const formatted = {
      id: contrato.id,
      funcionario_id: contrato.funcionarioId,
      cargo_id: contrato.cargoId,
      tipo_contrato: contrato.tipoContrato,
      data_inicio: contrato.dataInicio.toISOString().split('T')[0],
      data_fim: contrato.dataFim ? contrato.dataFim.toISOString().split('T')[0] : null,
      salario: contrato.salario ? parseFloat(contrato.salario.toString()) : null, // READ-ONLY: pode ser null
      carga_horaria: contrato.cargaHoraria,
      status: contrato.status,
      arquivo_url: contrato.arquivoUrl,
      nome_arquivo: contrato.nomeArquivo,
      renovado_de: contrato.renovadoDe,
      observacoes: contrato.observacoes,
      created_at: contrato.createdAt,
      updated_at: contrato.updatedAt,
      funcionario: {
        id: contrato.funcionario.id,
        nome_completo: contrato.funcionario.nomeCompleto,
        email: contrato.funcionario.email,
        cargo: contrato.funcionario.cargo?.nome || null,
        departamento: contrato.funcionario.departamento?.nome || null,
      },
      cargo: contrato.cargo ? {
        id: contrato.cargo.id,
        nome: contrato.cargo.nome,
      } : null,
    };
    
    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

export const encerrar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    const { data_fim, dataFim, observacoes } = req.body;
    
    // Check if contrato exists and belongs to institution
    const existing = await prisma.contratoFuncionario.findUnique({
      where: { id },
      include: { funcionario: { select: { instituicaoId: true } } },
    });
    
    if (!existing) {
      throw new AppError('Contrato não encontrado', 404);
    }
    
    if (filter.instituicaoId && existing.funcionario.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado a este contrato', 403);
    }

    if (existing.status === 'ENCERRADO') {
      throw new AppError('Este contrato já está encerrado', 400);
    }

    const dataFimValue = dataFim || data_fim || new Date();
    
    const contrato = await prisma.contratoFuncionario.update({
      where: { id },
      data: {
        status: 'ENCERRADO',
        dataFim: new Date(dataFimValue),
        observacoes: observacoes || existing.observacoes,
      },
      include: {
        funcionario: {
          include: {
            cargo: true,
            departamento: true,
          }
        },
        cargo: true,
      },
    });

    // Convert to snake_case
    const formatted = {
      id: contrato.id,
      funcionario_id: contrato.funcionarioId,
      cargo_id: contrato.cargoId,
      tipo_contrato: contrato.tipoContrato,
      data_inicio: contrato.dataInicio.toISOString().split('T')[0],
      data_fim: contrato.dataFim ? contrato.dataFim.toISOString().split('T')[0] : null,
      salario: contrato.salario ? parseFloat(contrato.salario.toString()) : null, // READ-ONLY: pode ser null
      carga_horaria: contrato.cargaHoraria,
      status: contrato.status,
      arquivo_url: contrato.arquivoUrl,
      nome_arquivo: contrato.nomeArquivo,
      renovado_de: contrato.renovadoDe,
      observacoes: contrato.observacoes,
      created_at: contrato.createdAt,
      updated_at: contrato.updatedAt,
      funcionario: {
        id: contrato.funcionario.id,
        nome_completo: contrato.funcionario.nomeCompleto,
        email: contrato.funcionario.email,
        cargo: contrato.funcionario.cargo?.nome || null,
        departamento: contrato.funcionario.departamento?.nome || null,
      },
      cargo: contrato.cargo ? {
        id: contrato.cargo.id,
        nome: contrato.cargo.nome,
      } : null,
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
    
    // Check if contrato exists and belongs to institution
    const existing = await prisma.contratoFuncionario.findUnique({
      where: { id },
      include: { funcionario: { select: { instituicaoId: true } } },
    });
    
    if (!existing) {
      throw new AppError('Contrato não encontrado', 404);
    }
    
    if (filter.instituicaoId && existing.funcionario.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado a este contrato', 403);
    }
    
    await prisma.contratoFuncionario.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
