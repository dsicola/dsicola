import { Router } from 'express';
import { authenticate, authorize, addInstitutionFilter } from '../middlewares/auth.js';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { messages } from '../utils/messages.js';
import { UserRole } from '@prisma/client';
import { validarNomeCompleto } from '../services/user.service.js';

const router = Router();

/**
 * Determina a role principal de um usuário baseado na hierarquia de importância
 * Prioridade: SUPER_ADMIN > ADMIN > PROFESSOR > SECRETARIA > POS > ALUNO > RESPONSAVEL > outros
 */
function getPrimaryRole(roles: UserRole[]): UserRole | null {
  if (!roles || roles.length === 0) return null;
  
  const rolePriority: Record<UserRole, number> = {
    SUPER_ADMIN: 1,
    COMERCIAL: 2,
    ADMIN: 3,
    PROFESSOR: 4,
    SECRETARIA: 5,
    POS: 6,
    ALUNO: 7,
    RESPONSAVEL: 8,
    DIRECAO: 9,
    COORDENADOR: 10,
    AUDITOR: 11,
    RH: 12,
    FINANCEIRO: 13,
  };
  
  // Ordenar roles por prioridade e retornar a mais importante
  const sortedRoles = [...roles].sort((a, b) => {
    const priorityA = rolePriority[a] || 999;
    const priorityB = rolePriority[b] || 999;
    return priorityA - priorityB;
  });
  
  return sortedRoles[0];
}

// All routes require authentication
router.use(authenticate);

// Get all profiles (with institution filter)
// POS needs access to search for students when processing payments
router.get('/', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN', 'PROFESSOR', 'POS'), async (req, res, next) => {
  try {
    // Debug log
    if (process.env.NODE_ENV !== 'production') {
      console.log('[PROFILES] Request received:', {
        userRoles: req.user?.roles,
        query: req.query,
        hasUser: !!req.user
      });
    }

    const filter = addInstitutionFilter(req);
    const { role, status } = req.query;

    let whereClause: any = { ...filter };

    // Filter by status if provided
    if (status) {
      // Normalize status values (case insensitive)
      const statusNormalized = String(status).toLowerCase();
      if (statusNormalized === 'ativo') {
        // Para "Ativo", usar OR para incluir null ou valores não inativos
        // Combinar com filtro existente usando AND
        const statusFilter = {
          OR: [
            { statusAluno: null },
            { statusAluno: 'Ativo' },
            { statusAluno: { notIn: ['Inativo', 'Inativo por inadimplência'] } }
          ]
        };
        
        // Se já existe filtro de instituição, combinar com AND
        if (whereClause.instituicaoId) {
          whereClause.AND = [
            { instituicaoId: whereClause.instituicaoId },
            statusFilter
          ];
          delete whereClause.instituicaoId;
        } else {
          Object.assign(whereClause, statusFilter);
        }
      } else if (statusNormalized === 'inativo') {
        whereClause.statusAluno = { in: ['Inativo', 'Inativo por inadimplência'] };
      } else {
        // Use exact match for other status values
        whereClause.statusAluno = status;
      }
    }

    // If role filter is provided, join with user_roles
    // REGRA SIGA/SIGAE: Incluir professor.id quando role for PROFESSOR
    const profiles = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        nomeCompleto: true,
        telefone: true,
        avatarUrl: true,
        dataNascimento: true,
        genero: true,
        numeroIdentificacao: true,
        numeroIdentificacaoPublica: true,
        morada: true,
        cidade: true,
        pais: true,
        statusAluno: true,
        instituicaoId: true,
        createdAt: true,
        updatedAt: true,
        roles: {
          select: {
            role: true
          }
        },
        // REGRA SIGA/SIGAE: Incluir professor.id quando role for PROFESSOR
        professor: {
          select: {
            id: true // professores.id
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Filter by role if provided
    let result = profiles;
    if (role) {
      result = profiles.filter(p => p.roles.some(r => r.role === role));
    }

    // Convert to snake_case for frontend compatibility
    // REGRA SIGA/SIGAE: Incluir professor.id quando role for PROFESSOR
    const profilesFormatted = result.map(profile => {
      const roles = profile.roles.map((r: any) => r.role) as UserRole[];
      const primaryRole = getPrimaryRole(roles);
      const isProfessor = roles.includes('PROFESSOR');
      
      return {
        id: profile.id, // users.id (mantido para compatibilidade)
        email: profile.email,
        nome_completo: profile.nomeCompleto,
        nomeCompleto: profile.nomeCompleto,
        telefone: profile.telefone,
        avatar_url: profile.avatarUrl,
        avatarUrl: profile.avatarUrl,
        data_nascimento: profile.dataNascimento ? profile.dataNascimento.toISOString().split('T')[0] : null,
        dataNascimento: profile.dataNascimento,
        genero: profile.genero,
        numero_identificacao: profile.numeroIdentificacao,
        numeroIdentificacao: profile.numeroIdentificacao,
        numero_identificacao_publica: profile.numeroIdentificacaoPublica,
        numeroIdentificacaoPublica: profile.numeroIdentificacaoPublica,
        morada: profile.morada,
        cidade: profile.cidade,
        pais: profile.pais,
        status_aluno: profile.statusAluno,
        statusAluno: profile.statusAluno,
        instituicao_id: profile.instituicaoId,
        instituicaoId: profile.instituicaoId,
        created_at: profile.createdAt,
        createdAt: profile.createdAt,
        updated_at: profile.updatedAt,
        updatedAt: profile.updatedAt,
        roles: roles,
        role: primaryRole, // Role principal baseada na hierarquia
        // REGRA SIGA/SIGAE: Incluir professor.id quando role for PROFESSOR
        // Frontend deve usar professor.id (professores.id) em vez de id (users.id) para criar Plano de Ensino
        ...(isProfessor && profile.professor ? { 
          professor_id: profile.professor.id, // professores.id
          professorId: profile.professor.id  // professores.id (camelCase)
        } : {}),
      };
    });

    res.json(profilesFormatted);
  } catch (error) {
    next(error);
  }
});

// Get profiles by IDs (POST to handle array of IDs)
// POS needs access to fetch multiple student profiles when processing payments
router.post('/by-ids', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN', 'PROFESSOR', 'POS'), async (req, res, next) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.json([]);
    }

    const filter = addInstitutionFilter(req);
    
    const profiles = await prisma.user.findMany({
      where: {
        id: { in: ids },
        ...filter
      },
      select: {
        id: true,
        email: true,
        nomeCompleto: true,
        telefone: true,
        avatarUrl: true,
        dataNascimento: true,
        genero: true,
        numeroIdentificacao: true,
        numeroIdentificacaoPublica: true,
        morada: true,
        cidade: true,
        pais: true,
        statusAluno: true,
        instituicaoId: true,
        createdAt: true,
        updatedAt: true,
        roles: {
          select: {
            role: true
          }
        },
        // REGRA SIGA/SIGAE: Incluir professor.id quando role for PROFESSOR
        professor: {
          select: {
            id: true // professores.id
          }
        }
      },
      orderBy: { nomeCompleto: 'asc' }
    });

    // Convert to snake_case for frontend compatibility
    // REGRA SIGA/SIGAE: Incluir professor.id quando role for PROFESSOR
    const profilesFormatted = profiles.map(profile => {
      const roles = profile.roles.map((r: any) => r.role) as UserRole[];
      const primaryRole = getPrimaryRole(roles);
      const isProfessor = roles.includes('PROFESSOR');
      
      return {
        id: profile.id, // users.id (mantido para compatibilidade)
        email: profile.email,
        nome_completo: profile.nomeCompleto,
        nomeCompleto: profile.nomeCompleto,
        telefone: profile.telefone,
        avatar_url: profile.avatarUrl,
        avatarUrl: profile.avatarUrl,
        data_nascimento: profile.dataNascimento ? profile.dataNascimento.toISOString().split('T')[0] : null,
        dataNascimento: profile.dataNascimento,
        genero: profile.genero,
        numero_identificacao: profile.numeroIdentificacao,
        numeroIdentificacao: profile.numeroIdentificacao,
        numero_identificacao_publica: profile.numeroIdentificacaoPublica,
        numeroIdentificacaoPublica: profile.numeroIdentificacaoPublica,
        morada: profile.morada,
        cidade: profile.cidade,
        pais: profile.pais,
        status_aluno: profile.statusAluno,
        statusAluno: profile.statusAluno,
        instituicao_id: profile.instituicaoId,
        instituicaoId: profile.instituicaoId,
        created_at: profile.createdAt,
        createdAt: profile.createdAt,
        updated_at: profile.updatedAt,
        updatedAt: profile.updatedAt,
        roles: roles,
        role: primaryRole, // Role principal baseada na hierarquia
        // REGRA SIGA/SIGAE: Incluir professor.id quando role for PROFESSOR
        // Frontend deve usar professor.id (professores.id) em vez de id (users.id) para criar Plano de Ensino
        ...(isProfessor && profile.professor ? { 
          professor_id: profile.professor.id, // professores.id
          professorId: profile.professor.id  // professores.id (camelCase)
        } : {}),
      };
    });

    res.json(profilesFormatted);
  } catch (error) {
    next(error);
  }
});

// Get profile by ID (qualquer autenticado pode consultar próprio perfil ou outros da instituição)
router.get('/:id', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN', 'PROFESSOR', 'POS', 'ALUNO', 'COORDENADOR', 'DIRECAO', 'RESPONSAVEL', 'RH', 'FINANCEIRO', 'AUDITOR'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const isOwnProfile = req.user?.userId === id;
    const isSuperAdmin = req.user?.roles?.includes('SUPER_ADMIN');
    // SUPER_ADMIN e próprio perfil: sem filtro de instituição (usuário pode ter instituicaoId null)
    const filter = (isOwnProfile || isSuperAdmin) ? {} : addInstitutionFilter(req);

    const profile = await prisma.user.findFirst({
      where: { id, ...filter },
      select: {
        id: true,
        email: true,
        nomeCompleto: true,
        telefone: true,
        avatarUrl: true,
        dataNascimento: true,
        genero: true,
        numeroIdentificacao: true,
        numeroIdentificacaoPublica: true,
        morada: true,
        cidade: true,
        pais: true,
        statusAluno: true,
        instituicaoId: true,
        createdAt: true,
        updatedAt: true,
        roles: {
          select: {
            role: true
          }
        },
        instituicao: true
      }
    });

    if (!profile) {
      throw new AppError(messages.notFound.profile, 404);
    }

    // Convert to snake_case for frontend compatibility
    const roles = profile.roles.map((r: any) => r.role) as UserRole[];
    const primaryRole = getPrimaryRole(roles);
    const profileFormatted = {
      id: profile.id,
      email: profile.email,
      nome_completo: profile.nomeCompleto,
      nomeCompleto: profile.nomeCompleto,
      telefone: profile.telefone,
      avatar_url: profile.avatarUrl,
      avatarUrl: profile.avatarUrl,
      data_nascimento: profile.dataNascimento ? profile.dataNascimento.toISOString().split('T')[0] : null,
      dataNascimento: profile.dataNascimento,
      genero: profile.genero,
      numero_identificacao: profile.numeroIdentificacao,
      numeroIdentificacao: profile.numeroIdentificacao,
      numero_identificacao_publica: profile.numeroIdentificacaoPublica,
      numeroIdentificacaoPublica: profile.numeroIdentificacaoPublica,
      morada: profile.morada,
      cidade: profile.cidade,
      pais: profile.pais,
      status_aluno: profile.statusAluno,
      statusAluno: profile.statusAluno,
      instituicao_id: profile.instituicaoId,
      instituicaoId: profile.instituicaoId,
      created_at: profile.createdAt,
      createdAt: profile.createdAt,
      updated_at: profile.updatedAt,
      updatedAt: profile.updatedAt,
      roles: roles,
      role: primaryRole, // Role principal baseada na hierarquia
      instituicao: profile.instituicao,
    };

    res.json(profileFormatted);
  } catch (error) {
    next(error);
  }
});

// Update profile (próprio ou ADMIN)
router.put('/:id', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN', 'PROFESSOR', 'POS', 'ALUNO', 'COORDENADOR', 'DIRECAO', 'RESPONSAVEL', 'RH', 'FINANCEIRO', 'AUDITOR'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    const filter = addInstitutionFilter(req);

    // Debug log (apenas em desenvolvimento)
    if (process.env.NODE_ENV !== 'production') {
      console.log('[profile.update] Dados recebidos:', JSON.stringify(updateData, null, 2));
    }

    // Only allow updating own profile or if admin
    const isAdmin = req.user?.roles.includes('ADMIN') || req.user?.roles.includes('SUPER_ADMIN');
    const isOwnProfile = req.user?.userId === id;
    if (!isAdmin && !isOwnProfile) {
      throw new AppError(messages.forbidden.generic, 403);
    }

    // Check if user exists (pular filtro de instituição ao editar próprio perfil)
    const whereFilter = isOwnProfile ? { id } : { id, ...filter };
    const existing = await prisma.user.findFirst({
      where: whereFilter
    });

    if (!existing) {
      throw new AppError(messages.notFound.profile, 404);
    }

    // Remove sensitive fields that shouldn't be updated
    delete updateData.id;
    delete updateData.password;
    // Email: apenas ADMIN pode atualizar (verificar abaixo)
    if (!isAdmin) {
      delete updateData.email;
    }
    delete updateData.roles;
    delete updateData.instituicaoId;
    delete updateData.instituicao_id;
    delete updateData.numeroIdentificacaoPublica;
    delete updateData.numero_identificacao_publica;

    // Validar nome completo se estiver sendo atualizado
    if (updateData.nomeCompleto || updateData.nome_completo) {
      const nomeCompleto = updateData.nomeCompleto || updateData.nome_completo;
      try {
        updateData.nomeCompleto = validarNomeCompleto(nomeCompleto);
        delete updateData.nome_completo; // Usar apenas nomeCompleto
      } catch (error: any) {
        throw new AppError(error.message || messages.validation.invalidName, 400);
      }
    }

    // Validar email se ADMIN estiver atualizando
    const cleanUpdateData: any = {};
    if (isAdmin && updateData.email) {
      const emailNormalizado = (updateData.email as string).toLowerCase().trim();
      
      // Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailNormalizado)) {
        throw new AppError(messages.validation.invalidEmail, 400);
      }
      
      // Verificar se email já existe (exceto para o próprio usuário)
      const existingEmail = await prisma.user.findUnique({
        where: { email: emailNormalizado }
      });
      
      if (existingEmail && existingEmail.id !== id) {
        throw new AppError(messages.validation.emailInUse, 400);
      }
      
      // Adicionar email normalizado aos dados de atualização
      cleanUpdateData.email = emailNormalizado;
    }

    // Map snake_case to camelCase and filter valid fields only
    // Fields that don't exist in User model (like tipoSanguineo, qualificacao, etc.) are silently ignored
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
      codigoPostal: 'codigoPostal',
      codigo_postal: 'codigoPostal',
      avatarUrl: 'avatarUrl',
      avatar_url: 'avatarUrl',
      statusAluno: 'statusAluno',
      status_aluno: 'statusAluno',
      // Nota: nomePai, nomeMae e profissao não existem no modelo User do Prisma
      // Esses campos são ignorados silenciosamente (armazenados em outras tabelas se necessário)
    };

    // Fields that should be silently ignored (don't exist in User model)
    // Esses campos pertencem a outras entidades (Funcionario, Professor, etc.)
    const ignoredFields = new Set([
      'tipoSanguineo', 'tipo_sanguineo', // Pertence a Funcionario
      'qualificacao', // Pertence a Funcionario
      'dataAdmissao', 'data_admissao', // Pertence a Funcionario
      'dataSaida', 'data_saida', // Pertence a Funcionario
      'cargoAtual', 'cargo_atual', // Pertence a Funcionario
      'codigoFuncionario', 'codigo_funcionario', // Pertence a Funcionario
      'horasTrabalho', 'horas_trabalho', // Pertence a Funcionario
      'municipio', // Campo não existe no modelo User
      // Campos de responsáveis não existem no modelo User (podem ser armazenados em outras tabelas)
      'nomePai', 'nome_pai',
      'nomeMae', 'nome_mae',
      'profissao',
      // Campos relacionados a Professor (entidade acadêmica separada)
      'professorId', 'professor_id',
      // Campos relacionados a cargo/departamento (devem ser atualizados via endpoints específicos)
      'cargoId', 'cargo_id',
      'departamentoId', 'departamento_id',
    ]);
    
    // Rastrear campos ignorados para log
    const camposIgnoradosEncontrados: string[] = [];
    const camposNaoReconhecidos: string[] = [];
    
    Object.keys(updateData).forEach(key => {
      // Skip ignored fields silently
      if (ignoredFields.has(key)) {
        camposIgnoradosEncontrados.push(key);
        return;
      }

      const value = updateData[key];
      const fieldName = allowedFields[key];
      
      // Only process if field is in allowedFields
      if (fieldName) {
        // Include the field if value is defined (null is valid for optional fields)
        // IMPORTANTE: null !== undefined, então campos null devem ser incluídos
        if (value !== undefined) {
          // Handle date fields
          if (fieldName === 'dataNascimento') {
            // Se value for string vazia ou null, converter para null
            // Se value for string de data válida, converter para Date
            cleanUpdateData.dataNascimento = (value && value !== '') ? new Date(value) : null;
          } else if (fieldName === 'avatarUrl') {
            // Avatar pode ser null (para remover) ou string (URL)
            // Se value for string vazia, converter para null
            cleanUpdateData[fieldName] = (value && value !== '') ? value : null;
          } else if (value === '') {
            // Empty strings são convertidos para null para campos opcionais
            cleanUpdateData[fieldName] = null;
          } else {
            // Incluir valor (pode ser null, string, number, etc.)
            cleanUpdateData[fieldName] = value;
          }
        }
      } else {
        // Campo não está nem em allowedFields nem em ignoredFields
        camposNaoReconhecidos.push(key);
        // Log campos não reconhecidos para debug (mas não falhar)
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[profile.update] Campo não reconhecido ignorado: ${key}`);
        }
      }
    });

    // Debug log (apenas em desenvolvimento)
    if (process.env.NODE_ENV !== 'production') {
      console.log('[profile.update] Campos processados:', JSON.stringify(cleanUpdateData, null, 2));
      if (camposIgnoradosEncontrados.length > 0) {
        console.log(`[profile.update] Campos ignorados (pertencem a outras entidades): ${camposIgnoradosEncontrados.join(', ')}`);
      }
      if (camposNaoReconhecidos.length > 0) {
        console.warn(`[profile.update] Campos não reconhecidos: ${camposNaoReconhecidos.join(', ')}`);
      }
      console.log(`[profile.update] Campos válidos processados: ${Object.keys(cleanUpdateData).join(', ') || 'nenhum'}`);
    }

    // Only update if there are fields to update
    if (Object.keys(cleanUpdateData).length === 0) {
      // Log detalhado para debug
      const camposRecebidos = Object.keys(updateData);
      
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[profile.update] Nenhum campo válido para atualizar.');
        console.warn('[profile.update] Campos recebidos:', camposRecebidos);
        console.warn('[profile.update] Campos ignorados (não existem no modelo User):', camposIgnoradosEncontrados);
        console.warn('[profile.update] Campos não reconhecidos:', camposNaoReconhecidos);
        console.warn('[profile.update] Campos permitidos:', Object.keys(allowedFields));
      }
      
      // Mensagem de erro mais informativa
      let mensagemErro = 'Os dados fornecidos não são válidos. Verifique os campos enviados.';
      if (camposIgnoradosEncontrados.length > 0) {
        mensagemErro += ` Campos ignorados (não existem no modelo User e pertencem a outras entidades como Funcionario): ${camposIgnoradosEncontrados.join(', ')}.`;
      }
      if (camposNaoReconhecidos.length > 0) {
        mensagemErro += ` Campos não reconhecidos: ${camposNaoReconhecidos.join(', ')}.`;
      }
      mensagemErro += ` Campos permitidos para atualização: ${Object.keys(allowedFields).join(', ')}.`;
      
      throw new AppError(mensagemErro, 400);
    }

    const profile = await prisma.user.update({
      where: { id },
      data: cleanUpdateData,
      select: {
        id: true,
        email: true,
        nomeCompleto: true,
        telefone: true,
        avatarUrl: true,
        dataNascimento: true,
        genero: true,
        numeroIdentificacao: true,
        numeroIdentificacaoPublica: true,
        morada: true,
        cidade: true,
        pais: true,
        statusAluno: true,
        instituicaoId: true,
        createdAt: true,
        updatedAt: true,
        roles: {
          select: {
            role: true
          }
        }
      }
    });

    // Convert to snake_case for frontend compatibility
    const roles = profile.roles.map((r: any) => r.role) as UserRole[];
    const primaryRole = getPrimaryRole(roles);
    const profileFormatted = {
      id: profile.id,
      email: profile.email,
      nome_completo: profile.nomeCompleto,
      nomeCompleto: profile.nomeCompleto,
      telefone: profile.telefone,
      avatar_url: profile.avatarUrl,
      avatarUrl: profile.avatarUrl,
      data_nascimento: profile.dataNascimento ? profile.dataNascimento.toISOString().split('T')[0] : null,
      dataNascimento: profile.dataNascimento,
      genero: profile.genero,
      numero_identificacao: profile.numeroIdentificacao,
      numeroIdentificacao: profile.numeroIdentificacao,
      numero_identificacao_publica: profile.numeroIdentificacaoPublica,
      numeroIdentificacaoPublica: profile.numeroIdentificacaoPublica,
      morada: profile.morada,
      cidade: profile.cidade,
      pais: profile.pais,
      status_aluno: profile.statusAluno,
      statusAluno: profile.statusAluno,
      instituicao_id: profile.instituicaoId,
      instituicaoId: profile.instituicaoId,
      created_at: profile.createdAt,
      createdAt: profile.createdAt,
      updated_at: profile.updatedAt,
      updatedAt: profile.updatedAt,
      roles: roles,
      role: primaryRole, // Role principal baseada na hierarquia
    };

    res.json(profileFormatted);
  } catch (error) {
    next(error);
  }
});

export default router;
