import { Request, Response, NextFunction } from 'express';
import { Prisma, UserRole } from '@prisma/client';
import prisma from '../lib/prisma.js';
import bcrypt from 'bcryptjs';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, getInstituicaoIdFromAuth, requireTenantScope } from '../middlewares/auth.js';
import { validatePlanLimits } from '../middlewares/license.middleware.js';
import { gerarNumeroIdentificacaoPublica, validarNomeCompleto } from '../services/user.service.js';
import { validarCargoDepartamentoCompleto } from '../services/cargo-departamento.service.js';
// REMOVIDO: buscarAnoLetivoAtivo - não é mais necessário (aluno é entidade administrativa)
import authService from '../services/auth.service.js';

export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role } = req.query;
    const filter = addInstitutionFilter(req);

    // VALIDAÇÃO MULTI-TENANT: NUNCA aceitar instituicaoId do query (segurança)
    // O filtro vem exclusivamente do JWT token via addInstitutionFilter

    // Debug log
    console.log('[getUsers] Request:', {
      userInstituicaoId: req.user?.instituicaoId,
      filter,
      role,
    });

    // Always use filter from req.user - ignore instituicaoId from query
    const where: any = { ...filter };

    // OTIMIZAÇÃO: Filtrar por role no banco de dados, não no frontend
    // Isso evita buscar todos os usuários quando só queremos alunos, por exemplo
    if (role) {
      where.roles = {
        some: {
          role: role as UserRole
        }
      };
    }

    console.log('[getUsers] Where clause:', JSON.stringify(where, null, 2));

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        nomeCompleto: true,
        telefone: true,
        numeroIdentificacao: true,
        numeroIdentificacaoPublica: true,
        dataNascimento: true,
        genero: true,
        morada: true,
        cidade: true,
        pais: true,
        avatarUrl: true,
        statusAluno: true,
        instituicaoId: true,
        cargoId: true,
        departamentoId: true,
        createdAt: true,
        updatedAt: true,
        roles: {
          select: { role: true }
        },
        instituicao: {
          select: { id: true, nome: true }
        },
        cargo: {
          select: { id: true, nome: true, tipo: true }
        },
        departamento: {
          select: { id: true, nome: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`[getUsers] Found ${users.length} users${role ? ` with role ${role}` : ''}`);
    if (users.length > 0) {
      console.log('[getUsers] Users IDs:', users.map(u => u.id).join(', '));
    } else {
      console.warn('[getUsers] ⚠️  NENHUM USUÁRIO RETORNADO!');
    }

    // Já filtrado por role no banco, não precisa filtrar novamente
    const filteredUsers = users;

    const result = filteredUsers.map(user => ({
      id: user.id,
      email: user.email,
      nomeCompleto: user.nomeCompleto || '',
      nome_completo: user.nomeCompleto || '',
      telefone: user.telefone || null,
      numeroIdentificacao: user.numeroIdentificacao || null,
      numero_identificacao: user.numeroIdentificacao || null,
      numeroIdentificacaoPublica: user.numeroIdentificacaoPublica || null,
      numero_identificacao_publica: user.numeroIdentificacaoPublica || null,
      dataNascimento: user.dataNascimento ? user.dataNascimento.toISOString().split('T')[0] : null,
      data_nascimento: user.dataNascimento ? user.dataNascimento.toISOString().split('T')[0] : null,
      genero: user.genero || null,
      morada: user.morada || null,
      cidade: user.cidade || null,
      pais: user.pais || null,
      statusAluno: user.statusAluno || null,
      status_aluno: user.statusAluno || null,
      instituicaoId: user.instituicaoId || null,
      instituicao_id: user.instituicaoId || null,
      instituicao: user.instituicao || null,
      cargoId: user.cargoId || null,
      cargo_id: user.cargoId || null,
      cargo: user.cargo || null,
      departamentoId: user.departamentoId || null,
      departamento_id: user.departamentoId || null,
      departamento: user.departamento || null,
      roles: user.roles.map(r => r.role),
      createdAt: user.createdAt,
      created_at: user.createdAt,
      updatedAt: user.updatedAt,
      updated_at: user.updatedAt,
      avatarUrl: user.avatarUrl || null,
      avatar_url: user.avatarUrl || null,
    }));

    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const user = await prisma.user.findFirst({
      where: { id, ...filter },
      select: {
        id: true,
        email: true,
        nomeCompleto: true,
        telefone: true,
        numeroIdentificacao: true,
        numeroIdentificacaoPublica: true,
        dataNascimento: true,
        genero: true,
        morada: true,
        cidade: true,
        pais: true,
        avatarUrl: true,
        statusAluno: true,
        instituicaoId: true,
        cargoId: true,
        departamentoId: true,
        createdAt: true,
        updatedAt: true,
        roles: { select: { role: true } },
        instituicao: { select: { id: true, nome: true } },
        cargo: { select: { id: true, nome: true, tipo: true } },
        departamento: { select: { id: true, nome: true } }
      }
    });

    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    res.json({
      id: user.id,
      email: user.email,
      nomeCompleto: user.nomeCompleto || '',
      nome_completo: user.nomeCompleto || '',
      telefone: user.telefone || null,
      numeroIdentificacao: user.numeroIdentificacao || null,
      numero_identificacao: user.numeroIdentificacao || null,
      numeroIdentificacaoPublica: user.numeroIdentificacaoPublica || null,
      numero_identificacao_publica: user.numeroIdentificacaoPublica || null,
      dataNascimento: user.dataNascimento ? user.dataNascimento.toISOString().split('T')[0] : null,
      data_nascimento: user.dataNascimento ? user.dataNascimento.toISOString().split('T')[0] : null,
      genero: user.genero || null,
      morada: user.morada || null,
      cidade: user.cidade || null,
      pais: user.pais || null,
      statusAluno: user.statusAluno || null,
      status_aluno: user.statusAluno || null,
      instituicaoId: user.instituicaoId || null,
      instituicao_id: user.instituicaoId || null,
      instituicao: user.instituicao || null,
      cargoId: user.cargoId || null,
      cargo_id: user.cargoId || null,
      cargo: user.cargo || null,
      departamentoId: user.departamentoId || null,
      departamento_id: user.departamentoId || null,
      departamento: user.departamento || null,
      roles: user.roles.map(r => r.role),
      createdAt: user.createdAt,
      created_at: user.createdAt,
      updatedAt: user.updatedAt,
      updated_at: user.updatedAt,
      avatarUrl: user.avatarUrl || null,
      avatar_url: user.avatarUrl || null,
    });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
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
    
    // SECURITY NOTE: For SUPER_ADMIN only, allow instituicaoId from body
    // This is necessary for SUPER_ADMIN to create users for other institutions during multi-tenant management.
    // For all other roles, instituicaoId is ALWAYS taken from JWT token (req.user.instituicaoId).
    // This is a controlled exception that does NOT compromise multi-tenant security because:
    // 1. Only SUPER_ADMIN can use this
    // 2. SUPER_ADMIN is explicitly checked via authorize() middleware
    // 3. Normal institutions/users CANNOT abuse this
    const finalInstituicaoId = isSuperAdmin && req.body.instituicaoId 
      ? req.body.instituicaoId 
      : instituicaoId;

    const { email, password, senha, nomeCompleto, nome_completo, role, cargoId, cargo_id, departamentoId, departamento_id, ...profileData } = req.body;
    
    // Normalizar senha (aceita 'password' ou 'senha' do frontend)
    const finalPassword = password || senha || null;
    
    // Normalizar cargoId e departamentoId
    const finalCargoId = cargoId || cargo_id || null;
    const finalDepartamentoId = departamentoId || departamento_id || null;

    // Validar email
    if (!email || typeof email !== 'string' || !email.trim()) {
      throw new AppError('Email é obrigatório', 400);
    }

    // Validar e normalizar nome completo
    const finalNomeCompleto = nomeCompleto || nome_completo;
    if (!finalNomeCompleto || (typeof finalNomeCompleto === 'string' && !finalNomeCompleto.trim())) {
      throw new AppError('Nome completo é obrigatório', 400);
    }
    
    let nomeCompletoValidado: string;
    try {
      nomeCompletoValidado = validarNomeCompleto(finalNomeCompleto);
    } catch (error: any) {
      throw new AppError(error.message || 'Nome completo inválido', 400);
    }

    // Check if email exists
    const emailNormalizado = email.toLowerCase().trim();
    const existingUser = await prisma.user.findUnique({ where: { email: emailNormalizado } });
    if (existingUser) {
      throw new AppError('Email já cadastrado', 400);
    }

    // Determinar role final - GARANTIR que ALUNO seja o padrão
    const roleFinal = (role || 'ALUNO') as UserRole;
    
    // REMOVIDO: Validação de Ano Letivo para criar ALUNO
    // REGRA MÃE: Aluno (cadastro base) é entidade ADMINISTRATIVA
    // Ano Letivo é exigido apenas para MATRÍCULA (processo acadêmico), não para cadastro de aluno
    
    // IMPORTANTE: Criar senha se fornecida, senão deixar vazio (pode criar depois)
    // Para ALUNO: Se senha fornecida, criar. Se não, deixar vazio para criar depois.
    // Para outros roles: Se senha fornecida, criar. Se não, gerar temporária.
    let passwordHash = '';
    const senhaFornecida = finalPassword && typeof finalPassword === 'string' && finalPassword.trim() !== '';
    
    if (senhaFornecida) {
      // Validar senha forte baseado na role (antes de fazer hash)
      // Para roles ADMIN, PROFESSOR, SECRETARIA, POS, SUPER_ADMIN: exige senha forte (maiúscula + caractere especial)
      // Para ALUNO: apenas comprimento mínimo
      const rolesExigemSenhaForte = ['ADMIN', 'PROFESSOR', 'SECRETARIA', 'SUPER_ADMIN', 'POS'];
      if (rolesExigemSenhaForte.includes(roleFinal)) {
        authService.validateStrongPassword(finalPassword.trim(), [roleFinal]);
      }
      
      // Hash password se fornecida
      passwordHash = await bcrypt.hash(finalPassword.trim(), 12);
      
      // VALIDAÇÃO: Garantir que senha foi hasheada corretamente
      if (!passwordHash || !passwordHash.startsWith('$2')) {
        throw new AppError('Erro ao criptografar senha', 500);
      }
    } else if (roleFinal !== 'ALUNO') {
      // Para não-ALUNO sem senha, gerar temporária
      console.warn(`[createUser] Senha não fornecida para ${emailNormalizado}, usando senha temporária`);
      passwordHash = await bcrypt.hash('temp123', 12);
    } else {
      // Para ALUNO sem senha, gerar hash temporário (não pode ser string vazia - Prisma requer string válida)
      // A senha será redefinida depois via aba de acesso
      console.log(`[createUser] Aluno ${emailNormalizado} criado sem senha. Gerando hash temporário. Conta de acesso será criada separadamente.`);
      // Gerar hash temporário que será invalidado quando o aluno criar senha real
      passwordHash = await bcrypt.hash('TEMP_PASSWORD_' + Date.now(), 12);
    }
    
    // VALIDAÇÃO: Garantir que role é válida
    const rolesValidas: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'DIRECAO', 'COORDENADOR', 'PROFESSOR', 'ALUNO', 'SECRETARIA', 'AUDITOR', 'POS', 'RESPONSAVEL'];
    if (!rolesValidas.includes(roleFinal)) {
      throw new AppError(`Role inválida: ${roleFinal}`, 400);
    }

    // VALIDAÇÃO DE LIMITES: Verificar se pode criar mais usuários deste tipo
    if (roleFinal === 'ALUNO' || roleFinal === 'PROFESSOR') {
      try {
        await validatePlanLimits(req, roleFinal === 'ALUNO' ? 'alunos' : 'professores');
      } catch (limitError) {
        // Re-throw para manter o erro original
        return next(limitError);
      }
    }

    // Gerar número de identificação pública se não fornecido
    let numeroIdentificacaoPublica = profileData.numeroIdentificacaoPublica || profileData.numero_identificacao_publica;
    if (!numeroIdentificacaoPublica) {
      try {
        numeroIdentificacaoPublica = await gerarNumeroIdentificacaoPublica(roleFinal, finalInstituicaoId);
      } catch (error) {
        console.error('Erro ao gerar número de identificação pública:', error);
        // Não falhar o cadastro se não conseguir gerar, mas logar o erro
      }
    }

    // Mapear campos do frontend para o formato do Prisma (camelCase)
    const fieldMapping: Record<string, string> = {
      numero_identificacao: 'numeroIdentificacao',
      telefone: 'telefone',
      data_nascimento: 'dataNascimento',
      avatar_url: 'avatarUrl',
      status_aluno: 'statusAluno',
      instituicao_id: 'instituicaoId',
    };

    // Campos válidos do modelo User (campos que podem ser salvos)
    const validUserFields = new Set([
      'telefone', 'dataNascimento', 'data_nascimento', 'genero', 
      'numeroIdentificacao', 'numero_identificacao', 'morada', 
      'cidade', 'pais', 'provincia', 'avatarUrl', 'avatar_url',
      'statusAluno', 'status_aluno'
    ]);

    // Campos a ignorar (não existem no modelo User)
    const fieldsToIgnore = new Set([
      'numeroIdentificacaoPublica', 'numero_identificacao_publica',
      'profissao', 'tipoSanguineo', 'tipo_sanguineo',
      'codigoPostal', 'codigo_postal', 'turmaId', 'turma_id', 'senha',
      'password', 'instituicao_id', 'instituicaoId', 'nomePai', 'nomeMae'
    ]);

    // Normalizar numeroIdentificacao (aceita ambos os formatos) - processar ANTES de ignorar
    const numeroIdentificacao = profileData.numeroIdentificacao || profileData.numero_identificacao;

    // Filter out undefined values from profileData and map field names
    const cleanProfileData: any = {};
    Object.keys(profileData).forEach(key => {
      // Ignorar campos que não existem no modelo User
      if (fieldsToIgnore.has(key)) {
        return;
      }
      
      const value = profileData[key];
      // Verificar se é um campo válido do User
      const mappedKey = fieldMapping[key] || key;
      if (validUserFields.has(key) || validUserFields.has(mappedKey)) {
        // Evitar duplicação - não sobrescrever se já existe em camelCase
        if (!cleanProfileData[mappedKey]) {
          // Converter data_nascimento para Date se necessário
          if ((key === 'dataNascimento' || key === 'data_nascimento')) {
            if (value !== undefined && value !== null && value !== '') {
              cleanProfileData.dataNascimento = new Date(value);
            }
          } else if (value !== undefined && value !== null && value !== '') {
            cleanProfileData[mappedKey] = value;
          }
        }
      }
    });
    
    // Garantir que numeroIdentificacao seja incluído se fornecido (processar DEPOIS para não ser ignorado)
    if (numeroIdentificacao && typeof numeroIdentificacao === 'string' && numeroIdentificacao.trim() !== '') {
      cleanProfileData.numeroIdentificacao = numeroIdentificacao.trim();
    }

    // Adicionar número de identificação pública se gerado
    if (numeroIdentificacaoPublica) {
      cleanProfileData.numeroIdentificacaoPublica = numeroIdentificacaoPublica;
    }

    // Validar cargo e departamento (se fornecidos)
    const userRoles = [roleFinal];
    if (finalCargoId || finalDepartamentoId) {
      await validarCargoDepartamentoCompleto(
        finalCargoId,
        finalDepartamentoId,
        userRoles,
        finalInstituicaoId!
      );
    }

    // Create user with role - USAR TRANSAÇÃO para garantir atomicidade
    const user = await prisma.$transaction(async (tx) => {
      // 1. Criar usuário
      // Para ALUNO, password fica vazio (será criado depois via aba de acesso)
      // POLÍTICA DE SEGURANÇA: ADMIN e PROFESSOR devem trocar senha no primeiro acesso
      const rolesExigemTrocaObrigatoria = ['ADMIN', 'PROFESSOR'];
      const mustChangePassword = rolesExigemTrocaObrigatoria.includes(roleFinal);
      
      const novoUser = await tx.user.create({
        data: {
          email: emailNormalizado,
          password: passwordHash, // Hash temporário para ALUNO sem senha, será redefinido depois
          nomeCompleto: nomeCompletoValidado,
          instituicaoId: finalInstituicaoId,
          cargoId: finalCargoId,
          departamentoId: finalDepartamentoId,
          mustChangePassword: mustChangePassword, // ADMIN e PROFESSOR devem trocar senha no primeiro acesso
          passwordUpdatedAt: mustChangePassword ? null : new Date(), // Se não precisa trocar, marcar como atualizado agora
          ...cleanProfileData,
        }
      });

      // 2. Criar role ALUNO (ou role especificada) - GARANTIR que sempre seja criada
      // REGRA ARQUITETURAL SIGA/SIGAE (OPÇÃO B):
      // - Role é para autenticação/autorização (RBAC)
      // - P0: Se role for PROFESSOR, criar entidade Professor automaticamente para professor ver atribuições no dashboard
      await tx.userRole_.create({
        data: {
          userId: novoUser.id,
          role: roleFinal,
          instituicaoId: finalInstituicaoId
        }
      });

      // 2b. P0 FIX: Criar Professor (tabela professores) automaticamente quando role é PROFESSOR
      // Sem isso, resolveProfessor falha e professor não vê atribuições/planos no dashboard
      if (roleFinal === 'PROFESSOR' && finalInstituicaoId) {
        await tx.professor.create({
          data: {
            userId: novoUser.id,
            instituicaoId: finalInstituicaoId
          }
        });
      }

      // 3. Buscar usuário completo com roles para retornar
      const userCompleto = await tx.user.findUnique({
        where: { id: novoUser.id },
        include: {
          roles: { select: { role: true } },
          cargo: { select: { id: true, nome: true, tipo: true } },
          departamento: { select: { id: true, nome: true } }
        }
      });

      if (!userCompleto) {
        throw new AppError('Erro ao criar usuário', 500);
      }

      // VALIDAÇÃO FINAL: Verificar se email, senha e role foram salvos corretamente
      if (!userCompleto.email || userCompleto.email !== emailNormalizado) {
        throw new AppError('Erro: Email não foi salvo corretamente', 500);
      }
      
      // Para ALUNO, senha pode ficar vazia (será criada depois via aba de acesso)
      // Para outros roles, senha deve estar no formato bcrypt
      if (roleFinal !== 'ALUNO') {
        if (!userCompleto.password || !userCompleto.password.startsWith('$2')) {
          throw new AppError('Erro: Senha não foi salva corretamente', 500);
        }
      } else {
        // Para ALUNO, senha vazia é aceitável
        if (userCompleto.password && userCompleto.password.trim() !== '' && !userCompleto.password.startsWith('$2')) {
          throw new AppError('Erro: Senha não está no formato correto', 500);
        }
      }
      
      const rolesSalvas = userCompleto.roles.map(r => r.role);
      if (!rolesSalvas.includes(roleFinal)) {
        throw new AppError(`Erro: Role ${roleFinal} não foi salva corretamente`, 500);
      }

      // Log de sucesso (apenas em desenvolvimento)
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[createUser] ✅ Usuário criado com sucesso:`, {
          id: userCompleto.id,
          email: userCompleto.email,
          role: roleFinal,
          temSenha: !!userCompleto.password,
          senhaFormato: userCompleto.password.substring(0, 7),
          roles: rolesSalvas
        });
      }

      return userCompleto;
    });

    res.status(201).json({
      id: user.id,
      email: user.email,
      nomeCompleto: user.nomeCompleto || '',
      nome_completo: user.nomeCompleto || '',
      telefone: user.telefone,
      numeroIdentificacao: user.numeroIdentificacao,
      numero_identificacao: user.numeroIdentificacao,
      numeroIdentificacaoPublica: user.numeroIdentificacaoPublica,
      numero_identificacao_publica: user.numeroIdentificacaoPublica,
      roles: user.roles.map(r => r.role),
      instituicaoId: user.instituicaoId,
      instituicao_id: user.instituicaoId,
      cargoId: user.cargoId,
      cargo_id: user.cargoId,
      cargo: user.cargo,
      departamentoId: user.departamentoId,
      departamento_id: user.departamentoId,
      departamento: user.departamento,
      userId: user.id, // For frontend compatibility
      user_id: user.id, // For frontend compatibility
    });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    const updateData = { ...req.body };

    // Check user exists and belongs to institution
    const existing = await prisma.user.findFirst({
      where: { id, ...filter }
    });

    if (!existing) {
      throw new AppError('Usuário não encontrado', 404);
    }

    // Remove fields that shouldn't be updated directly
    delete updateData.id;
    // Email: apenas ADMIN pode atualizar (verificar abaixo)
    const isAdmin = req.user?.roles?.includes('ADMIN') || req.user?.roles?.includes('SUPER_ADMIN');
    if (!isAdmin) {
      delete updateData.email;
    }
    delete updateData.passwordHash;
    delete updateData.password;
    delete updateData.roles;
    delete updateData.instituicaoId;
    delete updateData.instituicao_id;
    delete updateData.numeroIdentificacaoPublica; // Não permitir atualização direta
    delete updateData.numero_identificacao_publica; // Não permitir atualização direta

    // Validar nome completo se estiver sendo atualizado
    if (updateData.nomeCompleto || updateData.nome_completo) {
      const nomeCompleto = updateData.nomeCompleto || updateData.nome_completo;
      try {
        updateData.nomeCompleto = validarNomeCompleto(nomeCompleto);
        delete updateData.nome_completo; // Usar apenas nomeCompleto
      } catch (error: any) {
        throw new AppError(error.message || 'Nome completo inválido', 400);
      }
    }

    // Map snake_case to camelCase and filter valid fields only
    const allowedFields: Record<string, string> = {
      nomeCompleto: 'nomeCompleto',
      nome_completo: 'nomeCompleto',
      telefone: 'telefone',
      dataNascimento: 'dataNascimento',
      data_nascimento: 'dataNascimento',
      genero: 'genero',
      numeroIdentificacao: 'numeroIdentificacao',
      numero_identificacao: 'numeroIdentificacao',
      morada: 'morada',
      cidade: 'cidade',
      pais: 'pais',
      provincia: 'provincia',
      avatarUrl: 'avatarUrl',
      statusAluno: 'statusAluno',
      status_aluno: 'statusAluno',
      cargoId: 'cargoId',
      cargo_id: 'cargoId',
      departamentoId: 'departamentoId',
      departamento_id: 'departamentoId'
    };

    const cleanUpdateData: any = {};
    Object.keys(updateData).forEach(key => {
      const value = updateData[key];
      const fieldName = allowedFields[key];
      if (fieldName) {
        // Handle date fields
        if (fieldName === 'dataNascimento') {
          if (value !== undefined) {
            cleanUpdateData.dataNascimento = value ? new Date(value) : null;
          }
        } else if (fieldName === 'morada' || fieldName === 'cidade' || fieldName === 'pais' || fieldName === 'provincia') {
          // Allow null/empty for address fields (optional)
          if (value !== undefined) {
            cleanUpdateData[fieldName] = value || null;
          }
        } else if (value !== undefined && value !== null && value !== '') {
          cleanUpdateData[fieldName] = value;
        }
      }
    });

    // Validar email se ADMIN estiver atualizando
    if (isAdmin && updateData.email) {
      const emailNormalizado = (updateData.email as string).toLowerCase().trim();
      
      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailNormalizado)) {
        throw new AppError('Email inválido', 400);
      }
      
      // Verificar se email já existe (exceto para o próprio usuário)
      const existingEmail = await prisma.user.findUnique({
        where: { email: emailNormalizado }
      });
      
      if (existingEmail && existingEmail.id !== id) {
        throw new AppError('Email já cadastrado', 400);
      }
      
      // Adicionar email normalizado aos dados de atualização
      cleanUpdateData.email = emailNormalizado;
    }

    // Extrair cargoId e departamentoId do updateData
    const finalCargoId = updateData.cargoId || updateData.cargo_id || undefined;
    const finalDepartamentoId = updateData.departamentoId || updateData.departamento_id || undefined;

    // Validar cargo e departamento se fornecidos
    if (finalCargoId !== undefined || finalDepartamentoId !== undefined) {
      // Buscar roles do usuário existente
      const userWithRoles = await prisma.user.findFirst({
        where: { id, ...filter },
        include: { roles: { select: { role: true } } }
      });
      const userRoles = userWithRoles?.roles?.map((r: any) => r.role) || [];
      
      await validarCargoDepartamentoCompleto(
        finalCargoId || null,
        finalDepartamentoId || null,
        userRoles,
        filter.instituicaoId || req.user?.instituicaoId || ''
      );
    }

    // Only update if there are fields to update
    if (Object.keys(cleanUpdateData).length === 0) {
      throw new AppError('Nenhum campo válido para atualizar', 400);
    }

    const user = await prisma.user.update({
      where: { id },
      data: cleanUpdateData,
      include: {
        roles: { select: { role: true } },
        instituicao: { select: { id: true, nome: true } },
        cargo: { select: { id: true, nome: true, tipo: true } },
        departamento: { select: { id: true, nome: true } }
      }
    });

    res.json({
      id: user.id,
      email: user.email,
      nomeCompleto: user.nomeCompleto || '',
      nome_completo: user.nomeCompleto || '',
      telefone: user.telefone,
      numeroIdentificacao: user.numeroIdentificacao,
      numero_identificacao: user.numeroIdentificacao,
      numeroIdentificacaoPublica: user.numeroIdentificacaoPublica,
      numero_identificacao_publica: user.numeroIdentificacaoPublica,
      roles: user.roles.map(r => r.role),
      instituicaoId: user.instituicaoId,
      instituicao_id: user.instituicaoId,
      cargoId: user.cargoId,
      cargo_id: user.cargoId,
      cargo: user.cargo,
      departamentoId: user.departamentoId,
      departamento_id: user.departamentoId,
      departamento: user.departamento,
    });
  } catch (error: any) {
    // Log error for debugging
    console.error('Error updating user:', error);
    
    // If it's a Prisma error, let the error handler deal with it
    if (error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientValidationError) {
      return next(error);
    }
    
    // If it's already an AppError, pass it through
    if (error instanceof AppError) {
      return next(error);
    }
    
    // Otherwise, wrap in AppError
    next(new AppError(error?.message || 'Erro ao atualizar usuário', 500));
  }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    // Check user exists
    const existing = await prisma.user.findFirst({
      where: { id, ...filter },
      include: {
        roles: {
          select: {
            role: true
          }
        }
      }
    });

    if (!existing) {
      throw new AppError('Usuário não encontrado', 404);
    }

    // Se o usuário é um professor, verificar se há planos de ensino vinculados
    const isProfessor = existing.roles?.some((r: any) => r.role === 'PROFESSOR');
    if (isProfessor) {
      // Buscar o registro de professor vinculado a este usuário
      const professor = await prisma.professor.findFirst({
        where: {
          userId: id,
          ...(filter.instituicaoId ? { instituicaoId: filter.instituicaoId } : {})
        }
      });

      if (professor) {
        // Verificar se há planos de ensino vinculados a este professor
        const planosCount = await prisma.planoEnsino.count({
          where: {
            professorId: professor.id,
            ...(filter.instituicaoId ? { instituicaoId: filter.instituicaoId } : {})
          }
        });

        if (planosCount > 0) {
          throw new AppError(
            `Não é possível excluir este professor pois existem ${planosCount} plano(s) de ensino vinculado(s). Remova os planos de ensino primeiro.`,
            400
          );
        }
      }
    }

    // Delete user (cascades to roles)
    await prisma.user.delete({ where: { id } });

    res.json({ message: 'Usuário excluído com sucesso' });
  } catch (error) {
    next(error);
  }
};

export const updateUserRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const filter = addInstitutionFilter(req);

    // Check user exists and belongs to institution
    const user = await prisma.user.findFirst({
      where: {
        id,
        ...filter
      },
      include: { roles: true }
    });

    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    // REGRA ARQUITETURAL SIGA/SIGAE (OPÇÃO B):
    // - Role PROFESSOR: P0 - criar Professor automaticamente para professor ver atribuições no dashboard
    // - Sem isso, resolveProfessor falha e professor não vê turmas/planos

    // Update or create role
    await prisma.userRole_.upsert({
      where: {
        userId_role: { userId: id, role }
      },
      update: {},
      create: {
        userId: id,
        role,
        instituicaoId: user.instituicaoId
      }
    });

    // P0 FIX: Se role for PROFESSOR, criar Professor (tabela professores) automaticamente
    if (role === 'PROFESSOR' && user.instituicaoId) {
      const professorExistente = await prisma.professor.findFirst({
        where: { userId: id, instituicaoId: user.instituicaoId }
      });
      if (!professorExistente) {
        await prisma.professor.create({
          data: { userId: id, instituicaoId: user.instituicaoId }
        });
      }
    }

    res.json({ message: 'Role atualizada com sucesso' });
  } catch (error) {
    next(error);
  }
};

/**
 * Criar Professor explicitamente (entidade acadêmica)
 * 
 * REGRA ARQUITETURAL SIGA/SIGAE (OPÇÃO B):
 * - Professor é ENTIDADE ACADÊMICA separada (tabela professores)
 * - User com role PROFESSOR NÃO cria Professor automaticamente
 * - ADMIN deve criar Professor explicitamente após criar User com role PROFESSOR
 * - professores.user_id → users.id (FK)
 * - professores.instituicao_id obrigatório (multi-tenant)
 * 
 * @route POST /users/:id/professor
 * @access ADMIN, SUPER_ADMIN
 */
export const createProfessor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params; // users.id
    const filter = addInstitutionFilter(req);
    const instituicaoId = requireTenantScope(req);

    if (!instituicaoId) {
      throw new AppError('Instituição não identificada', 400);
    }

    // 1. Verificar se usuário existe e pertence à instituição
    const user = await prisma.user.findFirst({
      where: {
        id,
        ...filter
      },
      include: {
        roles: { select: { role: true } }
      }
    });

    if (!user) {
      throw new AppError('Usuário não encontrado ou não pertence à sua instituição', 404);
    }

    // 2. Verificar se usuário tem role PROFESSOR
    const hasProfessorRole = user.roles.some(r => r.role === 'PROFESSOR');
    if (!hasProfessorRole) {
      throw new AppError(
        'Usuário deve ter role PROFESSOR antes de criar entidade Professor. Atualize a role do usuário primeiro.',
        400
      );
    }

    // 3. Verificar se Professor já existe
    const professorExistente = await prisma.professor.findFirst({
      where: {
        userId: id,
        instituicaoId
      }
    });

    if (professorExistente) {
      throw new AppError(
        'Professor já existe para este usuário nesta instituição. Use o endpoint GET /users/:id para obter o professorId.',
        409
      );
    }

    // 4. Criar Professor (entidade acadêmica)
    const professor = await prisma.professor.create({
      data: {
        userId: id,
        instituicaoId
      },
      include: {
        user: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true
          }
        }
      }
    });

    res.status(201).json({
      id: professor.id, // professores.id (NÃO users.id)
      userId: professor.userId, // users.id (referência)
      instituicaoId: professor.instituicaoId,
      user: professor.user,
      message: 'Professor criado com sucesso'
    });
  } catch (error) {
    next(error);
  }
};

export const getProfessorComprovativo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params; // users.id
    let instituicaoId = getInstituicaoIdFromAuth(req);

    // Security: If user is PROFESSOR, they can only view their own certificate
    if (req.user && req.user.roles?.includes('PROFESSOR') && !req.user.roles?.some(r => ['ADMIN', 'SECRETARIA', 'SUPER_ADMIN'].includes(r))) {
      if (req.user.userId !== id) {
        throw new AppError('Acesso negado. Você só pode visualizar seu próprio comprovativo.', 403);
      }
    }

    // Buscar Professor (entidade acadêmica) — fonte de verdade para instituição
    const professorWhere: { userId: string; instituicaoId?: string } = { userId: id };
    if (instituicaoId) {
      professorWhere.instituicaoId = instituicaoId;
    }
    const professorRecord = await prisma.professor.findFirst({
      where: professorWhere,
      select: { id: true, instituicaoId: true },
    });

    if (!professorRecord) {
      throw new AppError('Professor não encontrado ou não pertence à sua instituição.', 404);
    }

    // SUPER_ADMIN sem instituicaoId: usar instituição do professor
    if (!instituicaoId) {
      instituicaoId = professorRecord.instituicaoId;
    }

    // Get professor user data (User pode ter instituicaoId null — Professor.instituicaoId é a fonte)
    const professor = await prisma.user.findFirst({
      where: {
        id,
        roles: {
          some: {
            role: 'PROFESSOR'
          }
        }
      },
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
        telefone: true,
        numeroIdentificacao: true,
        instituicaoId: true,
        instituicao: {
          select: {
            id: true,
            nome: true,
            endereco: true,
            telefone: true,
            emailContato: true,
          }
        }
      }
    });

    if (!professor) {
      throw new AppError('Professor não encontrado', 404);
    }

    const professorInstituicaoId = instituicaoId ?? professorRecord.instituicaoId ?? professor.instituicaoId;

    // Obter instituição quando User.instituicao é null (professor.instituicao vem do User)
    let instituicao = professor.instituicao;
    if (!instituicao && professorInstituicaoId) {
      instituicao = await prisma.instituicao.findUnique({
        where: { id: professorInstituicaoId },
        select: { id: true, nome: true, endereco: true, telefone: true, emailContato: true },
      });
    }

    // Get funcionario data for academic degree (grauAcademico)
    const funcionario = await prisma.funcionario.findFirst({
      where: {
        userId: id,
        instituicaoId: professorInstituicaoId
      },
      select: {
        grauAcademico: true,
        grauAcademicoOutro: true,
      }
    });

    // REGRA SIGA/SIGAE: Atribuições vêm exclusivamente de PlanoEnsino
    // Apenas planos APROVADOS aparecem no comprovativo oficial
    const planosEnsino = await prisma.planoEnsino.findMany({
      where: {
        instituicaoId: professorInstituicaoId,
        professorId: professorRecord.id,
        disciplinaId: { not: null } as any,
        status: 'APROVADO',
      },
      include: {
        disciplina: {
          select: {
            id: true,
            nome: true,
            codigo: true,
            cargaHoraria: true,
          },
        },
        curso: {
          select: {
            nome: true,
            codigo: true,
          },
        },
        turma: {
          select: {
            id: true,
            nome: true,
            ano: true,
            semestre: true,
          },
        },
        anoLetivoRef: {
          select: {
            ano: true,
          },
        },
      },
      orderBy: [
        { anoLetivo: 'desc' },
        { semestre: 'asc' },
      ],
    });

    // Group assignments by disciplina, ano, semestre
    const disciplinasMap = new Map<string, {
      disciplina: {
        id: string;
        nome: string;
        curso: { nome: string; codigo: string } | null;
      };
      anos: Set<number>;
      semestres: Set<string>;
      turmas: string[];
    }>();

    const todosAnosSet = new Set<number>();
    const todosSemestresSet = new Set<string>();

    planosEnsino.forEach((plano) => {
      if (!plano.disciplina) return;

      const disciplinaId = plano.disciplina.id;
      const key = disciplinaId;

      if (!disciplinasMap.has(key)) {
        disciplinasMap.set(key, {
          disciplina: {
            id: plano.disciplina.id,
            nome: plano.disciplina.nome,
            curso: plano.curso ? {
              nome: plano.curso.nome,
              codigo: plano.curso.codigo,
            } : null,
          },
          anos: new Set(),
          semestres: new Set(),
          turmas: [],
        });
      }

      const entry = disciplinasMap.get(key)!;
      const ano = plano.anoLetivoRef?.ano ?? plano.anoLetivo;
      if (ano !== null && ano !== undefined) {
        entry.anos.add(ano);
        todosAnosSet.add(ano);
      }
      const semestre = plano.semestre ?? plano.turma?.semestre;
      if (semestre) {
        entry.semestres.add(String(semestre));
        todosSemestresSet.add(String(semestre));
      }
      if (plano.turma?.nome) {
        entry.turmas.push(plano.turma.nome);
      }
    });

    // Convert to array format
    const disciplinas = Array.from(disciplinasMap.values()).map(entry => ({
      disciplina: entry.disciplina,
      anos: Array.from(entry.anos).sort((a, b) => b - a),
      semestres: Array.from(entry.semestres).sort(),
      turmas: [...new Set(entry.turmas)],
    }));

    const todosAnos = Array.from(todosAnosSet).sort((a, b) => b - a);
    const todosSemestres = Array.from(todosSemestresSet).sort();

    // Determine academic degree
    let grauAcademico = funcionario?.grauAcademico || null;
    if (grauAcademico === 'Outro' && funcionario?.grauAcademicoOutro) {
      grauAcademico = funcionario.grauAcademicoOutro;
    }

    // Build response
    const comprovativo = {
      professor: {
        id: professor.id,
        nome_completo: professor.nomeCompleto,
        nomeCompleto: professor.nomeCompleto,
        email: professor.email,
        telefone: professor.telefone,
        numero_identificacao: professor.numeroIdentificacao,
        grau_academico: grauAcademico,
      },
      instituicao: instituicao ? {
        id: instituicao.id,
        nome: instituicao.nome,
        endereco: instituicao.endereco,
        telefone: instituicao.telefone,
        email: instituicao.emailContato,
      } : null,
      disciplinas,
      anos: todosAnos,
      semestres: todosSemestres,
      data_emissao: new Date().toISOString(),
    };

    res.json(comprovativo);
  } catch (error) {
    next(error);
  }
};
