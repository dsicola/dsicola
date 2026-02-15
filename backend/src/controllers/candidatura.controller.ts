import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import { validatePlanLimits } from '../middlewares/license.middleware.js';
import bcrypt from 'bcryptjs';
import { gerarNumeroIdentificacaoPublica } from '../services/user.service.js';
import { validarNomeCompleto } from '../services/user.service.js';
import { EmailService } from '../services/email.service.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Não autenticado', 401);
    }

    const { status } = req.query;
    
    // MULTI-TENANT: instituicaoId SEMPRE vem do JWT (req.user.instituicaoId)
    // NUNCA aceitar instituicaoId do query - violação de segurança multi-tenant
    // SUPER_ADMIN também deve usar instituicaoId do token para garantir isolamento
    const instituicaoId = requireTenantScope(req);
    
    // Construir filtro de instituição (sempre do JWT)
    const instituicaoFilter: any = { instituicaoId };
    
    // Construir filtro de status se fornecido
    const statusFilter = status ? { status: (status as string).toLowerCase() } : {};
    
    const candidaturas = await prisma.candidatura.findMany({
      where: {
        ...instituicaoFilter,
        ...statusFilter,
      },
      include: {
        instituicao: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    // Enriquecer com informações do curso se disponível
    const candidaturasComCurso = await Promise.all(
      candidaturas.map(async (candidatura) => {
        if (candidatura.cursoPretendido) {
          try {
            const curso = await prisma.curso.findUnique({
              where: { id: candidatura.cursoPretendido },
              select: { id: true, nome: true, codigo: true },
            });
            return {
              ...candidatura,
              curso: curso || null,
            };
          } catch (error) {
            // Se não encontrar o curso, continuar sem ele
            return { ...candidatura, curso: null };
          }
        }
        return { ...candidatura, curso: null };
      })
    );
    
    res.json(candidaturasComCurso);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const candidatura = await prisma.candidatura.findUnique({ 
      where: { id },
      include: {
        instituicao: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });
    
    if (!candidatura) {
      throw new AppError('Candidatura não encontrada', 404);
    }
    
    res.json(candidatura);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      nomeCompleto,
      email,
      telefone,
      numeroIdentificacao,
      dataNascimento,
      genero,
      morada,
      cidade,
      pais,
      cursoPretendido,
      classePretendida,
      turnoPreferido,
      instituicaoId,
      documentosUrl,
    } = req.body;

    // Validações obrigatórias
    if (!nomeCompleto || typeof nomeCompleto !== 'string' || !nomeCompleto.trim()) {
      throw new AppError('Nome completo é obrigatório', 400);
    }

    if (!email || typeof email !== 'string' || !email.trim()) {
      throw new AppError('Email é obrigatório', 400);
    }

    // Validar formato de email básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw new AppError('Email inválido', 400);
    }

    if (!numeroIdentificacao || typeof numeroIdentificacao !== 'string' || !numeroIdentificacao.trim()) {
      throw new AppError('Número de identificação (BI) é obrigatório', 400);
    }

    // Validar e normalizar nome completo
    let nomeCompletoValidado: string;
    try {
      nomeCompletoValidado = validarNomeCompleto(nomeCompleto.trim());
    } catch (error: any) {
      throw new AppError(error.message || 'Nome completo inválido', 400);
    }

    // Verificar se já existe candidatura com mesmo email ou BI para a mesma instituição
    const emailNormalizado = email.toLowerCase().trim();
    const numeroIdentificacaoTrimmed = numeroIdentificacao.trim();
    
    // Verificar duplicatas separadamente para dar mensagens mais específicas
    const existingByEmail = await prisma.candidatura.findFirst({
      where: {
        email: emailNormalizado,
        instituicaoId: instituicaoId || undefined,
        status: {
          in: ['pendente', 'aprovada'],
        },
      },
    });

    const existingByBI = await prisma.candidatura.findFirst({
      where: {
        numeroIdentificacao: numeroIdentificacaoTrimmed,
        instituicaoId: instituicaoId || undefined,
        status: {
          in: ['pendente', 'aprovada'],
        },
      },
    });

    if (existingByEmail && existingByBI) {
      throw new AppError('Já existe uma candidatura ativa com este email e número de identificação. Por favor, verifique os dados informados ou entre em contato com a instituição.', 409);
    } else if (existingByEmail) {
      throw new AppError('Já existe uma candidatura ativa com este email. Por favor, verifique o email informado ou entre em contato com a instituição.', 409);
    } else if (existingByBI) {
      throw new AppError('Já existe uma candidatura ativa com este número de identificação (BI). Por favor, verifique o número informado ou entre em contato com a instituição.', 409);
    }

    // Preparar dados para criação
    const candidaturaData: any = {
      nomeCompleto: nomeCompletoValidado,
      email: emailNormalizado,
      numeroIdentificacao: numeroIdentificacao.trim(),
      status: 'pendente', // Sempre começa como pendente (lowercase)
      instituicaoId: instituicaoId || null,
    };

    // Campos opcionais
    if (telefone && telefone.trim()) {
      candidaturaData.telefone = telefone.trim();
    }

    if (dataNascimento) {
      const dataNasc = new Date(dataNascimento);
      if (!isNaN(dataNasc.getTime())) {
        candidaturaData.dataNascimento = dataNasc;
      }
    }

    if (genero && genero.trim()) {
      candidaturaData.genero = genero.trim();
    }

    if (morada && morada.trim()) {
      candidaturaData.morada = morada.trim();
    }

    if (cidade && cidade.trim()) {
      candidaturaData.cidade = cidade.trim();
    }

    if (pais && pais.trim()) {
      candidaturaData.pais = pais.trim();
    }

    // DIFERENCIAÇÃO Secundário vs Superior: cursoPretendido (Superior) ou classePretendida (Secundário)
    const inst = instituicaoId ? await prisma.instituicao.findUnique({
      where: { id: instituicaoId },
      select: { tipoAcademico: true },
    }) : null;
    const tipoAcademico = inst?.tipoAcademico || null;

    if (tipoAcademico === 'SECUNDARIO' && classePretendida && classePretendida.trim()) {
      const classe = await prisma.classe.findFirst({
        where: {
          id: classePretendida,
          instituicaoId: instituicaoId || undefined,
          ativo: true,
        },
      });
      if (!classe) {
        throw new AppError('Classe pretendida não encontrada ou não pertence à instituição', 400);
      }
      candidaturaData.classePretendida = classePretendida.trim();
      // Secundário: cursoPretendido não é usado (opcional como área)
    } else if (cursoPretendido && cursoPretendido.trim()) {
      const curso = await prisma.curso.findFirst({
        where: {
          id: cursoPretendido,
          instituicaoId: instituicaoId || undefined,
        },
      });
      if (!curso) {
        throw new AppError('Curso pretendido não encontrado ou não pertence à instituição', 400);
      }
      candidaturaData.cursoPretendido = cursoPretendido;
    }

    if (turnoPreferido && turnoPreferido.trim()) {
      candidaturaData.turnoPreferido = turnoPreferido.trim();
    }

    if (documentosUrl && Array.isArray(documentosUrl) && documentosUrl.length > 0) {
      candidaturaData.documentosUrl = documentosUrl.filter((url: string) => url && url.trim());
    }

    // Criar candidatura
    const candidatura = await prisma.candidatura.create({
      data: candidaturaData,
      include: {
        instituicao: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });

    res.status(201).json(candidatura);
  } catch (error: any) {
    // Tratar erros do Prisma
    if (error.code === 'P2002') {
      // Unique constraint violation
      throw new AppError('Já existe uma candidatura com estes dados', 409);
    }
    
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError(error.message || 'Erro ao criar candidatura', 500));
    }
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    // Verificar se a candidatura existe e pertence à instituição
    const existing = await prisma.candidatura.findFirst({
      where: { id, ...filter },
    });

    if (!existing) {
      throw new AppError('Candidatura não encontrada', 404);
    }

    // Não permitir alterar status diretamente via update (usar aprovar/rejeitar)
    const updateData: any = { ...req.body };
    delete updateData.status;
    delete updateData.id;
    delete updateData.email; // Email não pode ser alterado
    delete updateData.numeroIdentificacao; // BI não pode ser alterado

    // Normalizar status se fornecido (mas não permitir via update)
    if (req.body.status) {
      throw new AppError('Use os endpoints /aprovar ou /rejeitar para alterar o status', 400);
    }

    // Atualizar observações e outros campos permitidos
    const candidatura = await prisma.candidatura.update({
      where: { id },
      data: updateData,
      include: {
        instituicao: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });
    
    res.json(candidatura);
  } catch (error: any) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError(error.message || 'Erro ao atualizar candidatura', 500));
    }
  }
};

export const aprovar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    const userId = req.user?.userId;

    // Buscar candidatura
    const candidatura = await prisma.candidatura.findFirst({
      where: { id, ...filter },
      include: {
        instituicao: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });

    if (!candidatura) {
      throw new AppError('Candidatura não encontrada', 404);
    }

    if (candidatura.status === 'aprovada') {
      throw new AppError('Candidatura já foi aprovada', 400);
    }

    if (candidatura.status === 'rejeitada') {
      throw new AppError('Candidatura rejeitada não pode ser aprovada. Crie uma nova candidatura.', 400);
    }

    // VALIDAÇÃO DE LIMITES: Bloquear se plano atingiu limite de alunos
    if (candidatura.instituicaoId) {
      try {
        await validatePlanLimits(req, 'alunos', undefined, candidatura.instituicaoId);
      } catch (limitError) {
        return next(limitError);
      }
    }

    // Verificar se já existe usuário com este email ou BI
    const emailNormalizado = candidatura.email.toLowerCase().trim();
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: emailNormalizado },
          { numeroIdentificacao: candidatura.numeroIdentificacao },
        ],
      },
      include: {
        roles: { select: { role: true } },
      },
    });

    if (existingUser) {
      // Verificar se já tem role ALUNO
      const temRoleAluno = existingUser.roles.some(r => r.role === 'ALUNO');
      if (temRoleAluno) {
        throw new AppError('Já existe um aluno cadastrado com este email ou número de identificação', 409);
      }
    }

    // Usar transação para garantir atomicidade
    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Atualizar status da candidatura
      const candidaturaAtualizada = await tx.candidatura.update({
        where: { id },
        data: {
          status: 'aprovada',
          dataAnalise: new Date(),
          analisadoPor: userId || null,
          observacoes: req.body.observacoes || candidatura.observacoes,
        },
      });

      // 2. Criar ou atualizar usuário
      let alunoId: string;
      let senhaGerada: string | null = null;

      if (existingUser) {
        // Se usuário existe mas não tem role ALUNO, adicionar role
        alunoId = existingUser.id;
        
        const temRoleAluno = existingUser.roles.some(r => r.role === 'ALUNO');
        if (!temRoleAluno) {
          await tx.userRole_.create({
            data: {
              userId: existingUser.id,
              role: 'ALUNO',
              instituicaoId: candidatura.instituicaoId || null,
            },
          });
        }

        // Atualizar dados do perfil se necessário
        await tx.user.update({
          where: { id: existingUser.id },
          data: {
            nomeCompleto: candidatura.nomeCompleto,
            telefone: candidatura.telefone || existingUser.telefone,
            numeroIdentificacao: candidatura.numeroIdentificacao,
            dataNascimento: candidatura.dataNascimento || existingUser.dataNascimento,
            genero: candidatura.genero || existingUser.genero,
            morada: candidatura.morada || existingUser.morada,
            cidade: candidatura.cidade || existingUser.cidade,
            pais: candidatura.pais || existingUser.pais,
            instituicaoId: candidatura.instituicaoId || existingUser.instituicaoId,
          },
        });
      } else {
        // Criar novo usuário
        const senhaProvisoria = Math.random().toString(36).slice(-12) + 'A1!';
        senhaGerada = senhaProvisoria;
        const passwordHash = await bcrypt.hash(senhaProvisoria, 12);

        // Gerar número de identificação pública
        let numeroIdentificacaoPublica: string | undefined;
        try {
          numeroIdentificacaoPublica = await gerarNumeroIdentificacaoPublica('ALUNO', candidatura.instituicaoId);
        } catch (error) {
          console.error('Erro ao gerar número de identificação pública:', error);
          // Continuar sem número público se falhar
        }

        const novoUsuario = await tx.user.create({
          data: {
            email: emailNormalizado,
            password: passwordHash,
            nomeCompleto: candidatura.nomeCompleto,
            telefone: candidatura.telefone || null,
            numeroIdentificacao: candidatura.numeroIdentificacao,
            dataNascimento: candidatura.dataNascimento || null,
            genero: candidatura.genero || null,
            morada: candidatura.morada || null,
            cidade: candidatura.cidade || null,
            pais: candidatura.pais || null,
            instituicaoId: candidatura.instituicaoId || null,
            numeroIdentificacaoPublica: numeroIdentificacaoPublica,
            roles: {
              create: {
                role: 'ALUNO',
                instituicaoId: candidatura.instituicaoId || null,
              },
            },
          },
        });

        alunoId = novoUsuario.id;
      }

      // 3. Criar matrícula se curso e turma estiverem disponíveis
      let matricula = null;
      if (candidatura.cursoPretendido) {
        // Buscar primeira turma ativa do curso
        const turma = await tx.turma.findFirst({
          where: {
            cursoId: candidatura.cursoPretendido,
            instituicaoId: candidatura.instituicaoId || undefined,
            capacidade: {
              gt: 0,
            },
          },
          include: {
            _count: {
              select: { matriculas: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        if (turma && turma._count.matriculas < turma.capacidade) {
          // Verificar se já não está matriculado
          const matriculaExistente = await tx.matricula.findFirst({
            where: {
              alunoId,
              turmaId: turma.id,
            },
          });

          if (!matriculaExistente) {
            matricula = await tx.matricula.create({
              data: {
                alunoId,
                turmaId: turma.id,
                anoLetivoId: turma.anoLetivoId,
                status: 'Ativa',
                anoLetivo: new Date().getFullYear(),
              },
              include: {
                turma: {
                  include: {
                    curso: { select: { nome: true } },
                  },
                },
              },
            });
          }
        }
      }

      return {
        candidatura: candidaturaAtualizada,
        alunoId,
        senhaGerada,
        matricula,
      };
    });

    // Enviar e-mail de candidatura aprovada (não abortar se falhar)
    try {
      await EmailService.sendEmail(
        req,
        candidatura.email,
        'CANDIDATURA_APROVADA',
        {
          nomeAluno: candidatura.nomeCompleto,
          emailAluno: candidatura.email,
          senhaGerada: resultado.senhaGerada,
          credenciais: !!resultado.senhaGerada,
          curso: resultado.matricula?.turma?.curso?.nome || null,
          turma: resultado.matricula?.turma?.nome || null,
        },
        {
          destinatarioNome: candidatura.nomeCompleto,
          instituicaoId: candidatura.instituicaoId || undefined,
        }
      );
    } catch (emailError: any) {
      // Log do erro mas não abortar aprovação
      console.error('[aprovar] Erro ao enviar e-mail (não crítico):', emailError.message);
    }

    res.json({
      message: 'Candidatura aprovada com sucesso',
      candidatura: resultado.candidatura,
      aluno: {
        id: resultado.alunoId,
        email: candidatura.email,
        nomeCompleto: candidatura.nomeCompleto,
      },
      matricula: resultado.matricula,
      credenciais: resultado.senhaGerada ? {
        email: candidatura.email,
        senha: resultado.senhaGerada,
        mensagem: 'Credenciais geradas. Enviar por email ao candidato.',
      } : null,
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError(error.message || 'Erro ao aprovar candidatura', 500));
    }
  }
};

export const rejeitar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    const userId = req.user?.userId;
    const { observacoes, motivo } = req.body;
    
    // Buscar candidatura
    const candidatura = await prisma.candidatura.findFirst({
      where: { id, ...filter },
    });

    if (!candidatura) {
      throw new AppError('Candidatura não encontrada', 404);
    }

    if (candidatura.status === 'rejeitada') {
      throw new AppError('Candidatura já foi rejeitada', 400);
    }

    if (candidatura.status === 'aprovada') {
      throw new AppError('Candidatura aprovada não pode ser rejeitada', 400);
    }

    const observacoesFinais = observacoes || motivo || 'Candidatura rejeitada pela secretaria.';
    
    const candidaturaAtualizada = await prisma.candidatura.update({
      where: { id },
      data: {
        status: 'rejeitada',
        observacoes: observacoesFinais,
        dataAnalise: new Date(),
        analisadoPor: userId || null,
      },
      include: {
        instituicao: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });
    
    res.json({
      message: 'Candidatura rejeitada',
      candidatura: candidaturaAtualizada,
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError(error.message || 'Erro ao rejeitar candidatura', 500));
    }
  }
};
