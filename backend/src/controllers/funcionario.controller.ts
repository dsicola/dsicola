import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter } from '../middlewares/auth.js';
import { FuncionarioService } from '../services/funcionario.service.js';
import { parseListQuery, listMeta } from '../utils/parseListQuery.js';

function formatFuncionario(func: any, userMap: Map<string, any>) {
  const formatted: any = {
    id: func.id,
    nome_completo: func.nomeCompleto || '',
    email: func.email,
    telefone: func.telefone,
    numero_identificacao: func.numeroIdentificacao,
    genero: func.genero,
    morada: func.morada,
    cidade: func.cidade,
    pais: func.pais,
    provincia: func.provincia,
    municipio: func.municipio,
    nome_pai: func.nomePai,
    nome_mae: func.nomeMae,
    foto_url: func.fotoUrl,
    grau_academico: func.grauAcademico,
    grau_academico_outro: func.grauAcademicoOutro,
    instituicao_id: func.instituicaoId,
    cargo_id: func.cargoId,
    departamento_id: func.departamentoId,
    user_id: func.userId,
    created_at: func.createdAt,
    updated_at: func.updatedAt,
    data_admissao: func.dataAdmissao ? func.dataAdmissao.toISOString().split('T')[0] : null,
    data_demissao: func.dataDemissao ? func.dataDemissao.toISOString().split('T')[0] : null,
    data_nascimento: func.dataNascimento ? func.dataNascimento.toISOString().split('T')[0] : null,
    status: func.status,
    tipo_vinculo: func.tipoVinculo,
    regime_trabalho: func.regimeTrabalho,
    carga_horaria_semanal: func.cargaHorariaSemanal,
    categoria_docente: func.categoriaDocente,
  };
  if (func.salarioBase !== null && func.salarioBase !== undefined) {
    const salarioValue = typeof func.salarioBase === 'object' ? parseFloat(func.salarioBase.toString()) : func.salarioBase;
    formatted.salario_base = salarioValue;
    formatted.salario = salarioValue;
  } else {
    formatted.salario = 0;
  }
  if (func.userId) {
    const user = userMap.get(func.userId);
    if (user) {
      formatted.profiles = {
        nome_completo: user.nomeCompleto || func.nomeCompleto || '',
        email: user.email || func.email,
        telefone: user.telefone || func.telefone || null,
        numero_identificacao: user.numeroIdentificacao || func.numeroIdentificacao || null,
        avatar_url: user.avatarUrl || null,
      };
    }
  }
  if (func.cargo) {
    const cargoData = { id: func.cargo.id, nome: func.cargo.nome, descricao: func.cargo.descricao, salario_base: func.cargo.salarioBase, instituicao_id: func.cargo.instituicaoId, created_at: func.cargo.createdAt, updated_at: func.cargo.updatedAt, ativo: func.cargo.ativo };
    formatted.cargo = cargoData;
    formatted.cargos = cargoData;
  }
  if (func.departamento) {
    const deptData = { id: func.departamento.id, nome: func.departamento.nome, descricao: func.departamento.descricao, instituicao_id: func.departamento.instituicaoId, created_at: func.departamento.createdAt, updated_at: func.departamento.updatedAt, ativo: func.departamento.ativo };
    formatted.departamento = deptData;
    formatted.departamentos = deptData;
  }
  return formatted;
}

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { page, pageSize, skip, take, search, sortBy, sortOrder, filters } = parseListQuery(req.query);

    const where: Prisma.FuncionarioWhereInput = { ...filter };

    if (filters.status) {
      const s = filters.status.toUpperCase();
      if (s === 'ATIVO' || s === 'SUSPENSO' || s === 'ENCERRADO') {
        where.status = s as 'ATIVO' | 'SUSPENSO' | 'ENCERRADO';
      }
    } else {
      where.status = 'ATIVO';
    }

    if (filters.cargoId) where.cargoId = filters.cargoId;
    if (filters.departamentoId) where.departamentoId = filters.departamentoId;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(filters.from);
      if (filters.to) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(filters.to + 'T23:59:59.999Z');
    }

    if (search) {
      where.OR = [
        { nomeCompleto: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { numeroIdentificacao: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderField = sortBy === 'email' ? 'email' : sortBy === 'numero' ? 'numeroIdentificacao' : 'nomeCompleto';
    const orderBy: Prisma.FuncionarioOrderByWithRelationInput = { [orderField]: sortOrder };

    const [funcionarios, total] = await Promise.all([
      prisma.funcionario.findMany({
        where,
        skip,
        take,
        orderBy,
        include: { cargo: true, departamento: true },
      }),
      prisma.funcionario.count({ where }),
    ]);

    const userIds = funcionarios.filter((f) => f.userId).map((f) => f.userId!);
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true, nomeCompleto: true, telefone: true, numeroIdentificacao: true, avatarUrl: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const data = funcionarios.map((func) => formatFuncionario(func, userMap));
    res.json({ data, meta: listMeta(page, pageSize, total) });
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    // Verify funcionario exists and belongs to institution
    const funcionario = await prisma.funcionario.findFirst({
      where: { id, ...filter },
      include: { cargo: true, departamento: true },
    });
    
    if (!funcionario) {
      throw new AppError('Funcionário não encontrado', 404);
    }
    
    // Fetch user data if userId exists
    let user = null;
    if (funcionario.userId) {
      user = await prisma.user.findUnique({
        where: { id: funcionario.userId },
        select: {
          id: true,
          email: true,
          nomeCompleto: true,
          telefone: true,
          numeroIdentificacao: true,
          avatarUrl: true,
        }
      });
    }
    
    // Convert to snake_case for frontend compatibility
    const funcionarioFormatted: any = {
      id: funcionario.id,
      nome_completo: funcionario.nomeCompleto || '',
      email: funcionario.email,
      telefone: funcionario.telefone,
      numero_identificacao: funcionario.numeroIdentificacao,
      genero: funcionario.genero,
      morada: funcionario.morada,
      cidade: funcionario.cidade,
      pais: funcionario.pais,
      provincia: funcionario.provincia,
      municipio: funcionario.municipio,
      nome_pai: funcionario.nomePai,
      nome_mae: funcionario.nomeMae,
      foto_url: funcionario.fotoUrl,
      grau_academico: funcionario.grauAcademico,
      grau_academico_outro: funcionario.grauAcademicoOutro,
      instituicao_id: funcionario.instituicaoId,
      cargo_id: funcionario.cargoId,
      departamento_id: funcionario.departamentoId,
      user_id: funcionario.userId,
      created_at: funcionario.createdAt,
      updated_at: funcionario.updatedAt,
      data_admissao: funcionario.dataAdmissao ? funcionario.dataAdmissao.toISOString().split('T')[0] : null,
      data_demissao: funcionario.dataDemissao ? funcionario.dataDemissao.toISOString().split('T')[0] : null,
      data_nascimento: funcionario.dataNascimento ? funcionario.dataNascimento.toISOString().split('T')[0] : null,
      status: funcionario.status,
      tipo_vinculo: funcionario.tipoVinculo,
      regime_trabalho: funcionario.regimeTrabalho,
      carga_horaria_semanal: funcionario.cargaHorariaSemanal,
      categoria_docente: funcionario.categoriaDocente,
    };
    
    // Add salario (from salario_base)
    if (funcionario.salarioBase !== null && funcionario.salarioBase !== undefined) {
      const salarioValue = typeof funcionario.salarioBase === 'object' 
        ? parseFloat(funcionario.salarioBase.toString()) 
        : funcionario.salarioBase;
      funcionarioFormatted.salario_base = salarioValue;
      funcionarioFormatted.salario = salarioValue;
    } else {
      funcionarioFormatted.salario = 0;
    }
    
    // Add profiles (user data) if user exists
    if (user) {
      funcionarioFormatted.profiles = {
        nome_completo: user.nomeCompleto || funcionario.nomeCompleto || '',
        email: user.email || funcionario.email,
        telefone: user.telefone || funcionario.telefone || null,
        numero_identificacao: user.numeroIdentificacao || funcionario.numeroIdentificacao || null,
        avatar_url: user.avatarUrl || null,
      };
    }
    
    // Add cargo as both singular and plural for compatibility
    if (funcionario.cargo) {
      const cargoData = {
        id: funcionario.cargo.id,
        nome: funcionario.cargo.nome,
        descricao: funcionario.cargo.descricao,
        salario_base: funcionario.cargo.salarioBase,
        instituicao_id: funcionario.cargo.instituicaoId,
        created_at: funcionario.cargo.createdAt,
        updated_at: funcionario.cargo.updatedAt,
        ativo: funcionario.cargo.ativo,
      };
      funcionarioFormatted.cargo = cargoData;
      funcionarioFormatted.cargos = cargoData;
    }
    
    // Add departamento as both singular and plural for compatibility
    if (funcionario.departamento) {
      const deptData = {
        id: funcionario.departamento.id,
        nome: funcionario.departamento.nome,
        descricao: funcionario.departamento.descricao,
        instituicao_id: funcionario.departamento.instituicaoId,
        created_at: funcionario.departamento.createdAt,
        updated_at: funcionario.departamento.updatedAt,
        ativo: funcionario.departamento.ativo,
      };
      funcionarioFormatted.departamento = deptData;
      funcionarioFormatted.departamentos = deptData;
    }
    
    res.json(funcionarioFormatted);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get instituicaoId from authenticated user (NEVER trust frontend)
    if (!req.user) {
      throw new AppError('Usuário não autenticado', 401);
    }
    
    const isSuperAdmin = req.user.roles?.includes('SUPER_ADMIN') || false;
    const instituicaoId = req.user.instituicaoId;
    
    if (!instituicaoId && !isSuperAdmin) {
      throw new AppError('Instituição não identificada', 400);
    }

    // Get user data if userId is provided (para preencher nome/email se não vierem)
    let userData: { nomeCompleto: string; email: string; telefone?: string | null; numeroIdentificacao?: string | null } | null = null;
    const userId = req.body.userId ?? req.body.user_id;
    
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          nomeCompleto: true,
          email: true,
          telefone: true,
          numeroIdentificacao: true,
        }
      });
      
      if (user) {
        userData = user;
      }
    }

    // Preparar dados usando Service (normalização e defaults)
    const rawData = {
      ...req.body,
      instituicaoId, // SEMPRE do token, nunca do body
      // Preencher com dados do user se não vierem no body
      nomeCompleto: req.body.nomeCompleto ?? req.body.nome_completo ?? userData?.nomeCompleto,
      email: req.body.email ?? userData?.email,
      telefone: req.body.telefone ?? userData?.telefone,
      numeroIdentificacao: req.body.numeroIdentificacao ?? req.body.numero_identificacao ?? userData?.numeroIdentificacao,
    };

    const data = await FuncionarioService.prepareCreateData(
      rawData,
      req.user.roles || []
    );
    
    // Criar funcionário
    const funcionario = await prisma.funcionario.create({ 
      data,
      include: { cargo: true, departamento: true },
    });
    
    // Fetch user data if userId exists
    let user = null;
    if (funcionario.userId) {
      user = await prisma.user.findUnique({
        where: { id: funcionario.userId },
        select: {
          id: true,
          email: true,
          nomeCompleto: true,
          telefone: true,
          numeroIdentificacao: true,
          avatarUrl: true,
        }
      });
    }
    
    // Convert to snake_case for frontend compatibility (same format as getAll)
    const funcionarioFormatted: any = {
      id: funcionario.id,
      nome_completo: funcionario.nomeCompleto || '',
      email: funcionario.email,
      telefone: funcionario.telefone,
      numero_identificacao: funcionario.numeroIdentificacao,
      genero: funcionario.genero,
      morada: funcionario.morada,
      cidade: funcionario.cidade,
      pais: funcionario.pais,
      provincia: funcionario.provincia,
      municipio: funcionario.municipio,
      nome_pai: funcionario.nomePai,
      nome_mae: funcionario.nomeMae,
      foto_url: funcionario.fotoUrl,
      grau_academico: funcionario.grauAcademico,
      grau_academico_outro: funcionario.grauAcademicoOutro,
      instituicao_id: funcionario.instituicaoId,
      cargo_id: funcionario.cargoId,
      departamento_id: funcionario.departamentoId,
      user_id: funcionario.userId,
      created_at: funcionario.createdAt,
      updated_at: funcionario.updatedAt,
      data_admissao: funcionario.dataAdmissao ? funcionario.dataAdmissao.toISOString().split('T')[0] : null,
      data_demissao: funcionario.dataDemissao ? funcionario.dataDemissao.toISOString().split('T')[0] : null,
      data_nascimento: funcionario.dataNascimento ? funcionario.dataNascimento.toISOString().split('T')[0] : null,
      status: funcionario.status,
      tipo_vinculo: funcionario.tipoVinculo,
      regime_trabalho: funcionario.regimeTrabalho,
      carga_horaria_semanal: funcionario.cargaHorariaSemanal,
      categoria_docente: funcionario.categoriaDocente,
    };
    
    // Add salario (from salario_base)
    if (funcionario.salarioBase !== null && funcionario.salarioBase !== undefined) {
      const salarioValue = typeof funcionario.salarioBase === 'object' 
        ? parseFloat(funcionario.salarioBase.toString()) 
        : funcionario.salarioBase;
      funcionarioFormatted.salario_base = salarioValue;
      funcionarioFormatted.salario = salarioValue;
    } else {
      funcionarioFormatted.salario = 0;
    }
    
    // Add profiles (user data) if user exists
    if (user) {
      funcionarioFormatted.profiles = {
        nome_completo: user.nomeCompleto || funcionario.nomeCompleto || '',
        email: user.email || funcionario.email,
        telefone: user.telefone || funcionario.telefone || null,
        numero_identificacao: user.numeroIdentificacao || funcionario.numeroIdentificacao || null,
        avatar_url: user.avatarUrl || null,
      };
    }
    
    // Add cargo as both singular and plural for compatibility
    if (funcionario.cargo) {
      const cargoData = {
        id: funcionario.cargo.id,
        nome: funcionario.cargo.nome,
        descricao: funcionario.cargo.descricao,
        salario_base: funcionario.cargo.salarioBase,
        instituicao_id: funcionario.cargo.instituicaoId,
        created_at: funcionario.cargo.createdAt,
        updated_at: funcionario.cargo.updatedAt,
        ativo: funcionario.cargo.ativo,
      };
      funcionarioFormatted.cargo = cargoData;
      funcionarioFormatted.cargos = cargoData;
    }
    
    // Add departamento as both singular and plural for compatibility
    if (funcionario.departamento) {
      const deptData = {
        id: funcionario.departamento.id,
        nome: funcionario.departamento.nome,
        descricao: funcionario.departamento.descricao,
        instituicao_id: funcionario.departamento.instituicaoId,
        created_at: funcionario.departamento.createdAt,
        updated_at: funcionario.departamento.updatedAt,
        ativo: funcionario.departamento.ativo,
      };
      funcionarioFormatted.departamento = deptData;
      funcionarioFormatted.departamentos = deptData;
    }
    
    res.status(201).json(funcionarioFormatted);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    if (!req.user) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // Preparar dados usando Service (normalização e defaults)
    const rawData = {
      ...req.body,
      id,
      instituicaoId: req.user.instituicaoId, // SEMPRE do token, nunca do body
    };

    const data = await FuncionarioService.prepareUpdateData(
      id,
      rawData,
      req.user.roles || []
    );

    // Verificar se há dados para atualizar
    if (Object.keys(data).length === 0) {
      throw new AppError('Nenhum campo fornecido para atualização', 400);
    }
    
    // Atualizar funcionário
    const funcionario = await prisma.funcionario.update({
      where: { id },
      data,
      include: { cargo: true, departamento: true },
    });
    
    // Fetch user data if userId exists
    let user = null;
    if (funcionario.userId) {
      user = await prisma.user.findUnique({
        where: { id: funcionario.userId },
        select: {
          id: true,
          email: true,
          nomeCompleto: true,
          telefone: true,
          numeroIdentificacao: true,
          avatarUrl: true,
        }
      });
    }
    
    // Convert to snake_case for frontend compatibility (same format as getAll and getById)
    const funcionarioFormatted: any = {
      id: funcionario.id,
      nome_completo: funcionario.nomeCompleto || '',
      email: funcionario.email,
      telefone: funcionario.telefone,
      numero_identificacao: funcionario.numeroIdentificacao,
      genero: funcionario.genero,
      morada: funcionario.morada,
      cidade: funcionario.cidade,
      pais: funcionario.pais,
      provincia: funcionario.provincia,
      municipio: funcionario.municipio,
      nome_pai: funcionario.nomePai,
      nome_mae: funcionario.nomeMae,
      foto_url: funcionario.fotoUrl,
      grau_academico: funcionario.grauAcademico,
      grau_academico_outro: funcionario.grauAcademicoOutro,
      instituicao_id: funcionario.instituicaoId,
      cargo_id: funcionario.cargoId,
      departamento_id: funcionario.departamentoId,
      user_id: funcionario.userId,
      created_at: funcionario.createdAt,
      updated_at: funcionario.updatedAt,
      data_admissao: funcionario.dataAdmissao ? funcionario.dataAdmissao.toISOString().split('T')[0] : null,
      data_demissao: funcionario.dataDemissao ? funcionario.dataDemissao.toISOString().split('T')[0] : null,
      data_nascimento: funcionario.dataNascimento ? funcionario.dataNascimento.toISOString().split('T')[0] : null,
      status: funcionario.status,
      tipo_vinculo: funcionario.tipoVinculo,
      regime_trabalho: funcionario.regimeTrabalho,
      carga_horaria_semanal: funcionario.cargaHorariaSemanal,
      categoria_docente: funcionario.categoriaDocente,
    };
    
    // Add salario (from salario_base)
    if (funcionario.salarioBase !== null && funcionario.salarioBase !== undefined) {
      const salarioValue = typeof funcionario.salarioBase === 'object' 
        ? parseFloat(funcionario.salarioBase.toString()) 
        : funcionario.salarioBase;
      funcionarioFormatted.salario_base = salarioValue;
      funcionarioFormatted.salario = salarioValue;
    } else {
      funcionarioFormatted.salario = 0;
    }
    
    // Add profiles (user data) if user exists
    if (user) {
      funcionarioFormatted.profiles = {
        nome_completo: user.nomeCompleto || funcionario.nomeCompleto || '',
        email: user.email || funcionario.email,
        telefone: user.telefone || funcionario.telefone || null,
        numero_identificacao: user.numeroIdentificacao || funcionario.numeroIdentificacao || null,
        avatar_url: user.avatarUrl || null,
      };
    }
    
    // Add cargo as both singular and plural for compatibility
    if (funcionario.cargo) {
      const cargoData = {
        id: funcionario.cargo.id,
        nome: funcionario.cargo.nome,
        descricao: funcionario.cargo.descricao,
        salario_base: funcionario.cargo.salarioBase,
        instituicao_id: funcionario.cargo.instituicaoId,
        created_at: funcionario.cargo.createdAt,
        updated_at: funcionario.cargo.updatedAt,
        ativo: funcionario.cargo.ativo,
      };
      funcionarioFormatted.cargo = cargoData;
      funcionarioFormatted.cargos = cargoData;
    }
    
    // Add departamento as both singular and plural for compatibility
    if (funcionario.departamento) {
      const deptData = {
        id: funcionario.departamento.id,
        nome: funcionario.departamento.nome,
        descricao: funcionario.departamento.descricao,
        instituicao_id: funcionario.departamento.instituicaoId,
        created_at: funcionario.departamento.createdAt,
        updated_at: funcionario.departamento.updatedAt,
        ativo: funcionario.departamento.ativo,
      };
      funcionarioFormatted.departamento = deptData;
      funcionarioFormatted.departamentos = deptData;
    }
    
    res.json(funcionarioFormatted);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    // Verify funcionario exists and belongs to institution
    const existing = await prisma.funcionario.findFirst({
      where: { id, ...filter }
    });
    
    if (!existing) {
      throw new AppError('Funcionário não encontrado', 404);
    }
    
    await prisma.funcionario.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};