import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { obterTipoInstituicao, atualizarTipoAcademico } from '../services/instituicao.service.js';
import { EmailService } from '../services/email.service.js';
import { AuditService, ModuloAuditoria, EntidadeAuditoria, AcaoAuditoria } from '../services/audit.service.js';

// Regex para validar UUID v4
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Valida se o instituicaoId é um UUID válido (v4)
 * Retorna true se for válido ou null, false caso contrário
 */
function isValidUUIDOrNull(instituicaoId: string | null | undefined): boolean {
  if (instituicaoId === null || instituicaoId === undefined) {
    return true; // null é válido
  }
  return UUID_V4_REGEX.test(instituicaoId.trim());
}

export const getInstituicoes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // SUPER_ADMIN e COMERCIAL podem ver todas as instituições
    const podeVerTodas = req.user?.roles.includes('SUPER_ADMIN') || req.user?.roles.includes('COMERCIAL');
    if (!podeVerTodas) {
      // Non-super admins can only see their own institution
      if (req.user?.instituicaoId) {
        const instituicao = await prisma.instituicao.findUnique({
          where: { id: req.user.instituicaoId }
        });
        if (instituicao) {
        // Identificar tipo automaticamente
        const tipoIdentificado = await obterTipoInstituicao(instituicao.id);
        // Buscar instituição completa atualizada (incluindo tipoAcademico)
        const instituicaoAtualizada = await prisma.instituicao.findUnique({
          where: { id: instituicao.id },
          select: {
            id: true,
            nome: true,
            subdominio: true,
            logoUrl: true,
            emailContato: true,
            telefone: true,
            endereco: true,
            status: true,
            tipoInstituicao: true,
            tipoAcademico: true,
            multaPercentual: true,
            jurosDia: true,
            createdAt: true,
            updatedAt: true,
          }
        });
        return res.json([{ 
          ...instituicaoAtualizada, 
          tipoInstituicao: tipoIdentificado
        }]);
        }
        return res.json([]);
      }
      return res.json([]);
    }

    const instituicoes = await prisma.instituicao.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nome: true,
        subdominio: true,
        logoUrl: true,
        emailContato: true,
        telefone: true,
        endereco: true,
        status: true,
        tipoInstituicao: true,
        tipoAcademico: true,
        multaPercentual: true,
        jurosDia: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    // Identificar tipo automaticamente para cada instituição (com tratamento de erro)
    const instituicoesComTipo = await Promise.all(
      instituicoes.map(async (inst) => {
        try {
          // Tentar identificar tipo, mas não falhar se houver erro
          const tipoIdentificado = await obterTipoInstituicao(inst.id);
          // Buscar instituição atualizada após identificação (pode ter mudado tipoAcademico)
          const instituicaoAtualizada = await prisma.instituicao.findUnique({
            where: { id: inst.id },
            select: {
              id: true,
              nome: true,
              subdominio: true,
              logoUrl: true,
              emailContato: true,
              telefone: true,
              endereco: true,
              status: true,
              tipoInstituicao: true,
              tipoAcademico: true,
              multaPercentual: true,
              jurosDia: true,
              createdAt: true,
              updatedAt: true,
            }
          });
          return { 
            ...instituicaoAtualizada, 
            tipoInstituicao: tipoIdentificado
          };
        } catch (error) {
          // Se houver erro ao identificar tipo, retornar instituição com tipo atual do banco
          console.error(`[getInstituicoes] Erro ao identificar tipo para instituição ${inst.id}:`, error);
          return {
            ...inst,
            tipoInstituicao: inst.tipoInstituicao || 'EM_CONFIGURACAO'
          };
        }
      })
    );

    res.json(instituicoesComTipo);
  } catch (error) {
    next(error);
  }
};

export const getInstituicaoMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Verificar autenticação
    if (!req.user) {
      throw new AppError('Não autenticado', 401);
    }

    // Extrair instituicaoId apenas do JWT token
    // IMPORTANTE: NUNCA ler de req.params, req.query ou req.body
    // O middleware JWT já garante que req.user.instituicaoId é normalizado
    let instituicaoId = req.user.instituicaoId;

    if (!instituicaoId) {
      throw new AppError('Acesso negado: usuário não possui instituição associada', 403);
    }

    // Garantir que o UUID está normalizado (trimmed) primeiro
    instituicaoId = instituicaoId.trim();
    
    // Validação extra: garantir que instituicaoId é um UUID válido antes de usar no Prisma
    // Isso previne erros do Prisma com UUIDs inválidos que possam ter passado
    if (!isValidUUIDOrNull(instituicaoId)) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[INSTITUICAO] ❌ InstituicaoId inválido no token:', {
          instituicaoId,
          userId: req.user.userId,
          email: req.user.email,
        });
      }
      // Token inválido - retornar 401 para forçar re-login e obter token válido
      throw new AppError('Token inválido: ID de instituição inválido. Faça login novamente.', 401);
    }
    
    // Identificar tipo automaticamente primeiro (isso também atualiza tipoAcademico)
    const tipoIdentificado = await obterTipoInstituicao(instituicaoId);
    
    // Buscar instituição completa atualizada (incluindo tipoAcademico e relacionamentos)
    // IMPORTANTE: Não validar UUID aqui - o Prisma validará automaticamente
    let instituicao;
    try {
      instituicao = await prisma.instituicao.findUnique({
        where: { id: instituicaoId },
        include: {
          assinatura: {
            include: { plano: true }
          },
          configuracao: true
        }
      });
    } catch (dbError: any) {
      // Capturar erros do Prisma relacionados a UUID inválido
      // Isso é um fallback caso a validação acima falhe por algum motivo
      if (dbError?.name === 'PrismaClientValidationError' || 
          dbError?.message?.includes('Invalid value for argument') ||
          dbError?.message?.includes('Invalid uuid')) {
        // Se o UUID do JWT for inválido, retornar 401 (não 500) para forçar re-login
        if (process.env.NODE_ENV !== 'production') {
          console.error('[INSTITUICAO] ❌ Erro do Prisma: UUID inválido detectado:', {
            instituicaoId,
            userId: req.user?.userId,
            email: req.user?.email,
            error: dbError.message,
          });
        }
        throw new AppError('Token inválido: ID de instituição inválido. Faça login novamente.', 401);
      }
      throw dbError;
    }

    if (!instituicao) {
      throw new AppError('Instituição não encontrada', 404);
    }

    res.json({ 
      ...instituicao, 
      tipoInstituicao: tipoIdentificado
    });
  } catch (error) {
    next(error);
  }
};

export const getInstituicaoById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Validar formato do UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!id || !uuidRegex.test(id)) {
      throw new AppError('ID inválido. O ID deve ser um UUID válido.', 400);
    }

    // Verificar autenticação
    if (!req.user) {
      throw new AppError('Não autenticado', 401);
    }

    // SUPER_ADMIN pode acessar qualquer instituição
    const isSuperAdmin = req.user.roles.includes('SUPER_ADMIN');
    
    // Outros usuários só podem acessar sua própria instituição
    if (!isSuperAdmin) {
      if (!req.user.instituicaoId) {
        throw new AppError('Acesso negado: usuário não possui instituição associada', 403);
      }
      if (req.user.instituicaoId !== id) {
        throw new AppError('Acesso negado: você só pode acessar sua própria instituição', 403);
      }
    }

    try {
      // Identificar tipo automaticamente primeiro (isso também atualiza tipoAcademico)
      const tipoIdentificado = await obterTipoInstituicao(id);
      
      // Buscar instituição completa atualizada (incluindo tipoAcademico e relacionamentos)
      const instituicao = await prisma.instituicao.findUnique({
        where: { id },
        include: {
          assinatura: {
            include: { plano: true }
          },
          configuracao: true
        }
      });

      if (!instituicao) {
        throw new AppError('Instituição não encontrada', 404);
      }

      res.json({ 
        ...instituicao, 
        tipoInstituicao: tipoIdentificado
      });
    } catch (dbError: any) {
      // Capturar erros de validação do Prisma relacionados a UUID inválido
      // Mesmo que tenhamos validado antes, o Prisma pode ter validações adicionais
      if (dbError?.name === 'PrismaClientValidationError' || 
          dbError?.message?.includes('Invalid value for argument') ||
          dbError?.message?.includes('Invalid uuid')) {
        throw new AppError('ID inválido. O ID deve ser um UUID válido.', 400);
      }
      // Relançar outros erros
      throw dbError;
    }
  } catch (error) {
    next(error);
  }
};

export const getInstituicaoBySubdominio = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subdominio } = req.params;

    const instituicao = await prisma.instituicao.findUnique({
      where: { subdominio },
      include: {
        configuracao: true
      }
    });

    if (!instituicao) {
      throw new AppError('Instituição não encontrada', 404);
    }

    // Identificar tipo automaticamente
    const tipoIdentificado = await obterTipoInstituicao(instituicao.id);
    // Buscar instituição completa atualizada (incluindo tipoAcademico)
    const instituicaoAtualizada = await prisma.instituicao.findUnique({
      where: { id: instituicao.id },
      include: {
        configuracao: true
      }
    });

    // Public endpoint - only return non-sensitive data
    res.json({
      id: instituicaoAtualizada!.id,
      nome: instituicaoAtualizada!.nome,
      subdominio: instituicaoAtualizada!.subdominio,
      tipoInstituicao: tipoIdentificado,
      tipoAcademico: instituicaoAtualizada!.tipoAcademico,
      logoUrl: instituicaoAtualizada!.logoUrl,
      emailContato: instituicaoAtualizada!.emailContato,
      telefone: instituicaoAtualizada!.telefone,
      endereco: instituicaoAtualizada!.endereco,
      status: instituicaoAtualizada!.status,
      configuracao: instituicaoAtualizada!.configuracao
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /instituicoes/subdominio/:subdominio/opcoes-inscricao
 * Público - retorna cursos (Superior) ou classes (Secundário) para formulário de candidatura
 * Diferenciação crítica: Secundário = Classe, Superior = Curso
 */
export const getOpcoesInscricao = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subdominio } = req.params;
    const instituicao = await prisma.instituicao.findUnique({
      where: { subdominio },
      select: { id: true, tipoAcademico: true },
    });
    if (!instituicao) {
      throw new AppError('Instituição não encontrada', 404);
    }
    const tipoAcademico = instituicao.tipoAcademico || null;

    if (tipoAcademico === 'SECUNDARIO') {
      const classes = await prisma.classe.findMany({
        where: { instituicaoId: instituicao.id, ativo: true },
        select: { id: true, nome: true, codigo: true },
        orderBy: { nome: 'asc' },
      });
      return res.json({ tipoAcademico: 'SECUNDARIO', opcoes: classes });
    }

    // Superior ou null: retornar cursos
    const cursos = await prisma.curso.findMany({
      where: {
        instituicaoId: instituicao.id,
        ativo: true,
        tipo: { not: 'classe' },
      },
      select: { id: true, nome: true, codigo: true },
      orderBy: { nome: 'asc' },
    });
    return res.json({ tipoAcademico: tipoAcademico || 'SUPERIOR', opcoes: cursos });
  } catch (error) {
    next(error);
  }
};

export const createInstituicao = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nome, subdominio, emailContato, telefone, endereco, logoUrl } = req.body;

    // ============================================
    // VALIDAÇÃO DE INPUT
    // ============================================
    
    // Validação de campos obrigatórios
    if (!nome || typeof nome !== 'string' || nome.trim().length === 0) {
      throw new AppError('Nome é obrigatório e deve ser uma string não vazia', 400);
    }

    if (!subdominio || typeof subdominio !== 'string' || subdominio.trim().length === 0) {
      throw new AppError('Subdomínio é obrigatório e deve ser uma string não vazia', 400);
    }

    // Normalizar subdomínio
    const subdominioNormalizado = subdominio.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
    if (!subdominioNormalizado || subdominioNormalizado.length === 0) {
      throw new AppError('Subdomínio inválido: deve conter apenas letras minúsculas, números e hífens', 400);
    }

    // Validação de email se fornecido
    if (emailContato && typeof emailContato === 'string' && emailContato.trim().length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailContato.trim())) {
        throw new AppError('Email de contato inválido', 400);
      }
    }

    // Check if subdominio exists
    const existing = await prisma.instituicao.findUnique({
      where: { subdominio: subdominioNormalizado }
    });

    if (existing) {
      throw new AppError('Subdomínio já está em uso', 400);
    }

    // ============================================
    // CRIAÇÃO DA INSTITUIÇÃO
    // ============================================
    
    let instituicao;
    try {
      instituicao = await prisma.instituicao.create({
        data: {
          nome: nome.trim(),
          subdominio: subdominioNormalizado,
          tipoInstituicao: 'EM_CONFIGURACAO', // Valor inicial até identificar
          emailContato: emailContato?.trim() || null,
          telefone: telefone?.trim() || null,
          endereco: endereco?.trim() || null,
          logoUrl: logoUrl?.trim() || null,
          // status não é passado - usa default "ativa" do schema
        }
      });
    } catch (prismaError: any) {
      // Log detalhado do erro do Prisma
      console.error('[createInstituicao] Erro do Prisma ao criar instituição:', {
        code: prismaError.code,
        meta: prismaError.meta,
        message: prismaError.message,
        stack: prismaError.stack
      });
      
      // Erros comuns do Prisma
      if (prismaError.code === 'P2002') {
        const field = prismaError.meta?.target?.[0] || 'campo';
        throw new AppError(`${field} já está em uso`, 400);
      }
      
      if (prismaError.code === 'P2003') {
        throw new AppError('Erro de integridade referencial: verifique os dados fornecidos', 400);
      }
      
      throw new AppError(`Erro ao criar instituição: ${prismaError.message}`, 500);
    }

    // ============================================
    // ENVIO DE E-MAIL (NÃO CRÍTICO)
    // ============================================
    
    if (emailContato) {
      try {
        await EmailService.sendEmail(
          req,
          emailContato,
          'INSTITUICAO_CRIADA',
          {
            nomeInstituicao: nome,
            subdominio: subdominioNormalizado,
            emailContato,
          },
          {
            instituicaoId: instituicao.id,
          }
        );
      } catch (emailError: any) {
        // Log do erro mas não abortar criação
        console.error('[createInstituicao] Erro ao enviar e-mail (não crítico):', emailError.message);
      }
    }

    // Retornar a instituição criada
    // A identificação de tipo será feita posteriormente em endpoints de leitura ou onboarding
    res.status(201).json(instituicao);
  } catch (error: any) {
    // Log detalhado do erro
    console.error('[createInstituicao] Erro ao criar instituição:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      meta: error.meta,
      body: req.body
    });
    
    // Se já é AppError, apenas repassa
    if (error instanceof AppError) {
      return next(error);
    }

    // Se é erro do Prisma, logar detalhes e converter para AppError
    if (error.code && error.meta) {
      console.error('[createInstituicao] Erro do Prisma detalhado:', {
        code: error.code,
        meta: error.meta,
        message: error.message
      });
      
      // Erros comuns do Prisma
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0] || 'campo';
        return next(new AppError(`${field} já está em uso`, 400));
      }
      
      if (error.code === 'P2003') {
        return next(new AppError('Erro de integridade referencial: verifique os dados fornecidos', 400));
      }
      
      return next(new AppError(`Erro ao criar instituição: ${error.message}`, 500));
    }

    // Erro genérico - converter para AppError com mensagem clara
    return next(new AppError(`Erro ao criar instituição: ${error.message || 'Erro desconhecido'}`, 500));
  }
};

export const updateInstituicao = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Validar formato do UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!id || !uuidRegex.test(id)) {
      throw new AppError('ID inválido. O ID deve ser um UUID válido.', 400);
    }

    const updateData = { ...req.body };

    // Check access
    if (!req.user?.roles.includes('SUPER_ADMIN') && req.user?.instituicaoId !== id) {
      throw new AppError('Acesso negado', 403);
    }

    // Check if exists
    const existing = await prisma.instituicao.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Instituição não encontrada', 404);
    }

    // Remover tipoInstituicao do updateData - não pode ser alterado manualmente
    delete updateData.tipoInstituicao;

    // CRÍTICO: Validar tipoAcademico se fornecido (permite SUPER_ADMIN atualizar instituições antigas)
    if (updateData.tipoAcademico !== undefined) {
      if (!['SUPERIOR', 'SECUNDARIO', null].includes(updateData.tipoAcademico)) {
        throw new AppError('tipoAcademico deve ser "SUPERIOR", "SECUNDARIO" ou null', 400);
      }
      // Se tipoAcademico foi fornecido, atualizar tipoInstituicao automaticamente
      if (updateData.tipoAcademico === 'SUPERIOR') {
        updateData.tipoInstituicao = 'UNIVERSIDADE';
      } else if (updateData.tipoAcademico === 'SECUNDARIO') {
        updateData.tipoInstituicao = 'ENSINO_MEDIO';
      }
    }

    // Check subdominio uniqueness if changing
    if (updateData.subdominio && updateData.subdominio !== existing.subdominio) {
      const subdominioExists = await prisma.instituicao.findUnique({
        where: { subdominio: updateData.subdominio }
      });
      if (subdominioExists) {
        throw new AppError('Subdomínio já está em uso', 400);
      }
    }

    // CRÍTICO: Se tipoAcademico foi fornecido manualmente, não chamar obterTipoInstituicao
    // (que tentaria identificar automaticamente e poderia sobrescrever)
    const tipoAcademicoFoiFornecido = updateData.tipoAcademico !== undefined;

    const instituicao = await prisma.instituicao.update({
      where: { id },
      data: updateData
    });

    // Identificar tipo automaticamente APENAS se tipoAcademico não foi fornecido manualmente
    let tipoIdentificado;
    if (!tipoAcademicoFoiFornecido) {
      tipoIdentificado = await obterTipoInstituicao(id);
    } else {
      // Se tipoAcademico foi fornecido, usar tipoInstituicao do updateData
      tipoIdentificado = updateData.tipoInstituicao || instituicao.tipoInstituicao;
    }
    
    // Buscar instituição completa atualizada (incluindo tipoAcademico)
    const instituicaoAtualizada = await prisma.instituicao.findUnique({
      where: { id }
    });

    // Auditoria: Log UPDATE (ação crítica - alteração de configurações institucionais)
    await AuditService.logUpdate(req, {
      modulo: ModuloAuditoria.CONFIGURACAO,
      entidade: 'INSTITUICAO',
      entidadeId: id,
      dadosAnteriores: existing,
      dadosNovos: instituicaoAtualizada,
      observacao: `Configurações institucionais atualizadas: ${Object.keys(updateData).join(', ')}`,
    });

    res.json({ 
      ...instituicaoAtualizada, 
      tipoInstituicao: tipoIdentificado
    });
  } catch (error) {
    next(error);
  }
};

export const deleteInstituicao = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Validar formato do UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!id || !uuidRegex.test(id)) {
      throw new AppError('ID inválido. O ID deve ser um UUID válido.', 400);
    }

    // Only SUPER_ADMIN can delete institutions
    if (!req.user?.roles.includes('SUPER_ADMIN')) {
      throw new AppError('Acesso negado', 403);
    }

    const existing = await prisma.instituicao.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Instituição não encontrada', 404);
    }

    await prisma.instituicao.delete({ where: { id } });

    res.json({ message: 'Instituição excluída com sucesso' });
  } catch (error) {
    next(error);
  }
};

/**
 * Ativar ou desativar 2FA para uma instituição
 * PUT /instituicoes/:id/two-factor
 * Apenas ADMIN da instituição ou SUPER_ADMIN pode ativar/desativar
 */
export const toggleTwoFactor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    // Validar formato do UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!id || !uuidRegex.test(id)) {
      throw new AppError('ID inválido. O ID deve ser um UUID válido.', 400);
    }

    // Validar enabled
    if (typeof enabled !== 'boolean') {
      throw new AppError('Campo "enabled" deve ser um booleano (true/false)', 400);
    }

    // Verificar permissões: apenas ADMIN da instituição ou SUPER_ADMIN
    const isSuperAdmin = req.user?.roles.includes('SUPER_ADMIN');
    const isAdmin = req.user?.roles.includes('ADMIN');
    
    if (!isSuperAdmin && (!isAdmin || req.user?.instituicaoId !== id)) {
      throw new AppError('Acesso negado. Apenas administradores da instituição podem ativar/desativar 2FA.', 403);
    }

    // Verificar se instituição existe
    const instituicao = await prisma.instituicao.findUnique({ where: { id } });
    if (!instituicao) {
      throw new AppError('Instituição não encontrada', 404);
    }

    // Atualizar 2FA
    const instituicaoAtualizada = await prisma.instituicao.update({
      where: { id },
      data: {
        twoFactorEnabled: enabled,
      },
    });

    // Auditoria
    await AuditService.log(req, {
      modulo: ModuloAuditoria.SEGURANCA,
      acao: enabled ? AcaoAuditoria.ENABLE_2FA : AcaoAuditoria.DISABLE_2FA,
      entidade: EntidadeAuditoria.INSTITUICAO,
      entidadeId: id,
      dadosAnteriores: {
        twoFactorEnabled: instituicao.twoFactorEnabled,
      },
      dadosNovos: {
        twoFactorEnabled: enabled,
      },
      observacao: `2FA ${enabled ? 'ativado' : 'desativado'} para a instituição ${instituicao.nome}`,
    });

    res.json({
      message: `2FA ${enabled ? 'ativado' : 'desativado'} com sucesso`,
      twoFactorEnabled: instituicaoAtualizada.twoFactorEnabled,
    });
  } catch (error) {
    next(error);
  }
};
