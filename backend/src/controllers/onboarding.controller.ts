import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import bcrypt from 'bcryptjs';
import { obterTipoInstituicao } from '../services/instituicao.service.js';
import { EmailService } from '../services/email.service.js';
import authService from '../services/auth.service.js';

/**
 * Verificar status do onboarding
 * GET /onboarding/status
 */
export const getStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user || !user.userId) {
      throw new AppError('Não autenticado', 401);
    }

    // Buscar usuário
    const usuario = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        onboardingConcluido: true,
        onboardingConcluidoEm: true,
      },
    });

    if (!usuario) {
      throw new AppError('Usuário não encontrado', 404);
    }

    res.json({
      onboardingConcluido: usuario.onboardingConcluido || false,
      onboardingConcluidoEm: usuario.onboardingConcluidoEm,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Finalizar onboarding (apenas se todas as aulas obrigatórias foram assistidas)
 * POST /onboarding/finalizar
 */
export const finalizar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user || !user.userId) {
      throw new AppError('Não autenticado', 401);
    }

    // Obter roles do usuário
    const userRoles = user.roles || [];
    if (userRoles.length === 0) {
      throw new AppError('Usuário sem perfil definido', 400);
    }

    // Prioridade: ADMIN > SECRETARIA > PROFESSOR > outros
    const rolePrioridade: Record<string, number> = {
      'ADMIN': 1,
      'SECRETARIA': 2,
      'PROFESSOR': 3,
      'COORDENADOR': 4,
      'DIRECAO': 5,
    };

    const rolePrincipal = userRoles
      .map(role => ({ role, prioridade: rolePrioridade[role] || 999 }))
      .sort((a, b) => a.prioridade - b.prioridade)[0]?.role || userRoles[0];

    // Buscar trilha ativa para o perfil
    const trilha = await prisma.treinamentoTrilha.findFirst({
      where: {
        perfil: rolePrincipal as any,
        ativo: true,
      },
      include: {
        aulas: {
          include: {
            videoAula: {
              include: {
                progressos: {
                  where: {
                    userId: user.userId,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!trilha) {
      // Se não há trilha, permitir finalizar (usuário sem trilha específica)
      await prisma.user.update({
        where: { id: user.userId },
        data: {
          onboardingConcluido: true,
          onboardingConcluidoEm: new Date(),
        },
      });

      return res.json({
        message: 'Onboarding finalizado com sucesso',
        onboardingConcluido: true,
      });
    }

    // Verificar se todas as aulas foram assistidas (>= 90%)
    const totalAulas = trilha.aulas.length;
    if (totalAulas === 0) {
      // Trilha sem aulas, permitir finalizar
      await prisma.user.update({
        where: { id: user.userId },
        data: {
          onboardingConcluido: true,
          onboardingConcluidoEm: new Date(),
        },
      });

      return res.json({
        message: 'Onboarding finalizado com sucesso',
        onboardingConcluido: true,
      });
    }

    const aulasConcluidas = trilha.aulas.filter(aula => {
      const progresso = aula.videoAula.progressos[0];
      return progresso && progresso.percentualAssistido >= 90;
    }).length;

    const percentualConcluido = Math.round((aulasConcluidas / totalAulas) * 100);

    if (percentualConcluido < 90) {
      throw new AppError(
        `Você precisa assistir pelo menos 90% das aulas obrigatórias para finalizar o onboarding. Progresso atual: ${percentualConcluido}%`,
        400
      );
    }

    // Marcar onboarding como concluído
    await prisma.user.update({
      where: { id: user.userId },
      data: {
        onboardingConcluido: true,
        onboardingConcluidoEm: new Date(),
      },
    });

    res.json({
      message: 'Onboarding finalizado com sucesso',
      onboardingConcluido: true,
      progresso: {
        totalAulas,
        aulasConcluidas,
        percentualConcluido,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Criar instituição e admin via onboarding (SUPER_ADMIN only)
 * POST /onboarding/instituicao
 */
export const criarInstituicao = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nomeInstituicao, nome, subdominio, tipoAcademico, emailContato, telefone, endereco, logoUrl, emailAdmin, senhaAdmin, nomeAdmin, planoId } = req.body;

    // ============================================
    // VALIDAÇÃO DE INPUT
    // ============================================
    
    // Normalizar nome da instituição (aceita nomeInstituicao ou nome)
    const nomeFinal = nomeInstituicao || nome;
    if (!nomeFinal || typeof nomeFinal !== 'string' || nomeFinal.trim().length === 0) {
      throw new AppError('Nome da instituição é obrigatório e deve ser uma string não vazia', 400);
    }

    if (!subdominio || typeof subdominio !== 'string' || subdominio.trim().length === 0) {
      throw new AppError('Subdomínio é obrigatório e deve ser uma string não vazia', 400);
    }

    if (!emailAdmin || typeof emailAdmin !== 'string' || emailAdmin.trim().length === 0) {
      throw new AppError('Email do administrador é obrigatório e deve ser uma string não vazia', 400);
    }

    if (!senhaAdmin || typeof senhaAdmin !== 'string' || senhaAdmin.trim().length === 0) {
      throw new AppError('Senha do administrador é obrigatória e deve ser uma string não vazia', 400);
    }

    // VALIDAÇÃO DE SENHA FORTE: ADMIN exige senha forte
    // Validar antes de fazer hash (segurança)
    try {
      authService.validateStrongPassword(senhaAdmin.trim(), ['ADMIN']);
    } catch (error: any) {
      // Re-throw AppError como está
      if (error instanceof AppError) {
        throw error;
      }
      // Se não for AppError, transformar em AppError
      throw new AppError(error.message || 'Senha muito fraca. Escolha uma senha mais segura.', 400);
    }

    if (!nomeAdmin || typeof nomeAdmin !== 'string' || nomeAdmin.trim().length === 0) {
      throw new AppError('Nome do administrador é obrigatório e deve ser uma string não vazia', 400);
    }

    // CRÍTICO: tipoAcademico é OBRIGATÓRIO
    if (!tipoAcademico || !['SUPERIOR', 'SECUNDARIO'].includes(tipoAcademico)) {
      throw new AppError('Tipo acadêmico é obrigatório e deve ser "SUPERIOR" ou "SECUNDARIO"', 400);
    }

    // Normalizar subdomínio ANTES de verificar
    const subdominioNormalizado = subdominio.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
    if (!subdominioNormalizado || subdominioNormalizado.length === 0) {
      throw new AppError('Subdomínio inválido: deve conter apenas letras minúsculas, números e hífens', 400);
    }

    // Validação de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailNormalizado = emailAdmin.toLowerCase().trim();
    if (!emailRegex.test(emailNormalizado)) {
      throw new AppError('Email do administrador inválido', 400);
    }

    // Validação de email de contato se fornecido
    if (emailContato && typeof emailContato === 'string' && emailContato.trim().length > 0) {
      if (!emailRegex.test(emailContato.trim())) {
        throw new AppError('Email de contato inválido', 400);
      }
    }

    // ============================================
    // VERIFICAÇÕES DE DUPLICIDADE
    // ============================================
    
    // Verificar se subdomínio já existe (usando o normalizado)
    const existingInstituicao = await prisma.instituicao.findUnique({
      where: { subdominio: subdominioNormalizado }
    });

    if (existingInstituicao) {
      throw new AppError('Subdomínio já está em uso', 400);
    }

    // Verificar se email do admin já existe
    const existingUser = await prisma.user.findUnique({ where: { email: emailNormalizado } });
    if (existingUser) {
      throw new AppError('Email do administrador já está cadastrado', 400);
    }

    // ============================================
    // CRIAÇÃO DA INSTITUIÇÃO E ADMIN (TRANSACTION)
    // ============================================
    
    let resultado;
    try {
      // Usar transação para garantir atomicidade
      resultado = await prisma.$transaction(async (tx) => {
        // 1. Criar instituição - status e tipoInstituicao têm defaults no schema
        let instituicao;
        try {
          // Determinar tipoInstituicao baseado em tipoAcademico
          let tipoInstituicaoFinal = 'EM_CONFIGURACAO';
          if (tipoAcademico === 'SUPERIOR') {
            tipoInstituicaoFinal = 'UNIVERSIDADE';
          } else if (tipoAcademico === 'SECUNDARIO') {
            tipoInstituicaoFinal = 'ENSINO_MEDIO';
          }

          instituicao = await tx.instituicao.create({
            data: {
              nome: nomeFinal.trim(),
              subdominio: subdominioNormalizado,
              tipoInstituicao: tipoInstituicaoFinal,
              tipoAcademico: tipoAcademico || null, // CRÍTICO: Definir tipoAcademico na criação
              emailContato: emailContato?.trim() || null,
              telefone: telefone?.trim() || null,
              endereco: endereco?.trim() || null,
              logoUrl: logoUrl?.trim() || null,
              // status não é passado - usa default "ativa" do schema
            }
          });
        } catch (prismaError: any) {
          // Log detalhado do erro do Prisma
          console.error('[criarInstituicao] Erro do Prisma ao criar instituição:', {
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

        // 2. Hash da senha do admin
        const passwordHash = await bcrypt.hash(senhaAdmin.trim(), 12);

        // 3. Criar usuário admin
        let admin;
        try {
          admin = await tx.user.create({
            data: {
              email: emailNormalizado,
              password: passwordHash,
              nomeCompleto: nomeAdmin.trim(),
              instituicaoId: instituicao.id,
              roles: {
                create: {
                  role: 'ADMIN',
                  instituicaoId: instituicao.id,
                },
              },
            },
            include: {
              roles: true,
            },
          });
        } catch (prismaError: any) {
          console.error('[criarInstituicao] Erro do Prisma ao criar usuário admin:', {
            code: prismaError.code,
            meta: prismaError.meta,
            message: prismaError.message,
            stack: prismaError.stack
          });
          
          if (prismaError.code === 'P2002') {
            const field = prismaError.meta?.target?.[0] || 'campo';
            throw new AppError(`${field} do administrador já está em uso`, 400);
          }
          
          if (prismaError.code === 'P2003') {
            throw new AppError('Erro de integridade referencial ao criar administrador: verifique os dados fornecidos', 400);
          }
          
          throw new AppError(`Erro ao criar usuário administrador: ${prismaError.message}`, 500);
        }

        // 4. Criar assinatura se planoId for fornecido (opcional)
        if (planoId) {
          try {
            await tx.assinatura.create({
              data: {
                instituicaoId: instituicao.id,
                planoId: planoId,
                status: 'ativa',
                dataInicio: new Date(),
              },
            });
          } catch (error: any) {
            // Log mas não abortar se falhar criação de assinatura
            console.error('[criarInstituicao] Erro ao criar assinatura (não crítico):', {
              message: error.message,
              stack: error.stack,
              code: error.code,
              meta: error.meta
            });
          }
        }

        // Buscar instituição criada
        const instituicaoAtualizada = await tx.instituicao.findUnique({
          where: { id: instituicao.id }
        });

        if (!instituicaoAtualizada) {
          throw new AppError('Erro ao buscar instituição criada', 500);
        }

        return { instituicao: instituicaoAtualizada, admin };
      });
    } catch (transactionError: any) {
      // Se já é AppError, apenas repassa
      if (transactionError instanceof AppError) {
        throw transactionError;
      }
      
      // Log detalhado de erro na transação
      console.error('[criarInstituicao] Erro na transação:', {
        message: transactionError.message,
        stack: transactionError.stack,
        code: transactionError.code,
        meta: transactionError.meta
      });
      
      throw transactionError;
    }

    // Identificar tipo automaticamente APÓS a transação (não crítico)
    // Isso atualiza tipoAcademico, mas não deve quebrar o onboarding se falhar
    try {
      await obterTipoInstituicao(resultado.instituicao.id);
      // Buscar novamente para pegar tipoAcademico atualizado
      const instituicaoComTipo = await prisma.instituicao.findUnique({
        where: { id: resultado.instituicao.id }
      });
      if (instituicaoComTipo) {
        resultado.instituicao = instituicaoComTipo;
      }
    } catch (tipoError: any) {
      // Log do erro mas não abortar criação
      console.error('[criarInstituicao] Erro ao identificar tipo de instituição (não crítico):', {
        message: tipoError.message,
        stack: tipoError.stack,
        instituicaoId: resultado.instituicao.id
      });
    }

    // Enviar e-mail de confirmação (não abortar se falhar)
    let emailSent = false;
    let emailError: string | undefined;
    if (emailContato || emailAdmin) {
      try {
        await EmailService.sendEmail(
          req,
          emailAdmin,
          'INSTITUICAO_CRIADA',
          {
            nomeInstituicao: nomeFinal,
            subdominio: subdominioNormalizado,
            emailContato: emailContato || emailAdmin,
            nomeAdmin: nomeAdmin,
          },
          {
            instituicaoId: resultado.instituicao!.id,
          }
        );
        emailSent = true;
      } catch (error: any) {
        emailError = error.message;
        console.error('[criarInstituicao] Erro ao enviar e-mail (não crítico):', error);
      }
    }

    // Notificar SUPER_ADMIN sobre criação de nova instituição
    try {
      await EmailService.notificarSuperAdmins(
        req,
        'NOTIFICACAO_GERAL',
        {
          titulo: 'Nova Instituição Criada',
          mensagem: `
            <p>Uma nova instituição foi criada no sistema:</p>
            <div class="info-box">
              <p><strong>Nome:</strong> ${nomeFinal}</p>
              <p><strong>Subdomínio:</strong> ${subdominioNormalizado}</p>
              <p><strong>Email de contato:</strong> ${emailContato || emailAdmin}</p>
              <p><strong>Administrador:</strong> ${nomeAdmin} (${emailAdmin})</p>
            </div>
          `,
        },
        `Nova Instituição: ${nomeFinal}`
      );
    } catch (error: any) {
      console.error('[criarInstituicao] Erro ao notificar SUPER_ADMIN (não crítico):', error.message);
    }

    res.status(201).json({
      message: 'Instituição e administrador criados com sucesso',
      instituicao: resultado.instituicao,
      admin: {
        id: resultado.admin.id,
        email: resultado.admin.email,
        nomeCompleto: resultado.admin.nomeCompleto,
      },
      email_sent: emailSent,
      email_error: emailError,
    });
  } catch (error: any) {
    // Log detalhado do erro
    console.error('[criarInstituicao] Erro ao criar instituição via onboarding:', {
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
      console.error('[criarInstituicao] Erro do Prisma detalhado:', {
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

/**
 * Criar admin para instituição existente (SUPER_ADMIN only)
 * POST /onboarding/instituicao/admin
 */
export const criarAdminInstituicao = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { instituicaoId, emailAdmin, senhaAdmin, nomeAdmin } = req.body;

    if (!instituicaoId || !emailAdmin || !senhaAdmin || !nomeAdmin) {
      throw new AppError('Todos os campos são obrigatórios', 400);
    }

    // Verificar se instituição existe
    const instituicao = await prisma.instituicao.findUnique({
      where: { id: instituicaoId }
    });

    if (!instituicao) {
      throw new AppError('Instituição não encontrada', 404);
    }

    // Verificar se email já existe
    const emailNormalizado = emailAdmin.toLowerCase().trim();
    const existingUser = await prisma.user.findUnique({ where: { email: emailNormalizado } });
    if (existingUser) {
      throw new AppError('Email já está cadastrado', 400);
    }

    // VALIDAÇÃO DE SENHA FORTE: ADMIN exige senha forte
    // Validar antes de fazer hash (segurança)
    try {
      authService.validateStrongPassword(senhaAdmin.trim(), ['ADMIN']);
    } catch (error: any) {
      // Re-throw AppError como está
      if (error instanceof AppError) {
        throw error;
      }
      // Se não for AppError, transformar em AppError
      throw new AppError(error.message || 'Senha muito fraca. Escolha uma senha mais segura.', 400);
    }

    // Hash da senha
    const passwordHash = await bcrypt.hash(senhaAdmin.trim(), 12);

    // Criar usuário admin
    const admin = await prisma.user.create({
      data: {
        email: emailNormalizado,
        password: passwordHash,
        nomeCompleto: nomeAdmin,
        instituicaoId: instituicao.id,
        roles: {
          create: {
            role: 'ADMIN',
            instituicaoId: instituicao.id,
          },
        },
      },
      include: {
        roles: true,
      },
    });

    res.status(201).json({
      message: 'Administrador criado com sucesso',
      admin: {
        id: admin.id,
        email: admin.email,
        nomeCompleto: admin.nomeCompleto,
      },
    });
  } catch (error) {
    next(error);
  }
};
