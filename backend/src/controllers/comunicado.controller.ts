import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import { UserRole } from '@prisma/client';
import { resolveProfessorId } from '../utils/professorResolver.js';

const COMUNICADOS_UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'comunicados');

export const getComunicados = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { tipo, ativo, destinatarios } = req.query;

    const where: any = { ...filter };
    if (tipo) where.tipo = tipo as string;
    if (ativo !== undefined) where.ativo = ativo === 'true';
    if (destinatarios) where.destinatarios = destinatarios as string;

    const comunicados = await prisma.comunicado.findMany({
      where,
      include: {
        destinatariosDetalhe: true,
        leituras: {
          select: {
            userId: true,
            dataLeitura: true
          }
        }
      },
      orderBy: { dataPublicacao: 'desc' }
    });

    res.json(comunicados);
  } catch (error) {
    next(error);
  }
};

export const getComunicadoById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const comunicado = await prisma.comunicado.findFirst({
      where: { id, ...filter },
      include: {
        destinatariosDetalhe: true,
        leituras: {
          select: {
            userId: true,
            dataLeitura: true
          }
        }
      }
    });

    if (!comunicado) {
      throw new AppError('Comunicado não encontrado', 404);
    }

    res.json(comunicado);
  } catch (error) {
    next(error);
  }
};

/**
 * Upload de anexo para comunicado - multi-tenant (instituicaoId do JWT)
 * Retorna { filename, url, type, name, size } para incluir em anexos ao criar comunicado
 */
export const uploadComunicadoAnexo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = (req as any).file;
    if (!file) {
      throw new AppError('Nenhum arquivo enviado', 400);
    }
    requireTenantScope(req);
    res.status(201).json({
      filename: file.filename,
      type: file.mimetype,
      name: file.originalname,
      size: file.size,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Download de anexo - multi-tenant: verifica que utilizador tem acesso ao comunicado
 * Rota: GET /comunicados/:id/anexo/:filename
 */
export const downloadComunicadoAnexo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const comunicadoId = req.params.id;
    const filename = decodeURIComponent(req.params.filename || '');
    const userId = req.user?.userId;
    const instituicaoId = req.user?.instituicaoId;

    if (!userId || !instituicaoId || !filename) {
      throw new AppError('Acesso negado', 403);
    }

    const filePath = path.join(COMUNICADOS_UPLOAD_DIR, instituicaoId, filename);
    if (!path.normalize(filePath).startsWith(path.normalize(COMUNICADOS_UPLOAD_DIR))) {
      throw new AppError('Caminho inválido', 400);
    }
    if (!fs.existsSync(filePath)) {
      throw new AppError('Anexo não encontrado', 404);
    }

    // Verificar que comunicado existe e utilizador tem acesso (via getComunicadosPublicos logic)
    const comunicado = await prisma.comunicado.findFirst({
      where: { id: comunicadoId, instituicaoId, ativo: true },
      include: { destinatariosDetalhe: true },
    });
    if (!comunicado) {
      throw new AppError('Comunicado não encontrado', 404);
    }

    // Verificar anexos do comunicado contém este filename
    const anexos = (comunicado as any).anexos;
    const anexosArray = Array.isArray(anexos) ? anexos : (typeof anexos === 'string' ? JSON.parse(anexos || '[]') : []);
    const anexoInfo = anexosArray.find((a: any) => a.filename === filename || (a.url && a.url.includes(filename)));
    if (!anexoInfo) {
      throw new AppError('Anexo não pertence a este comunicado', 404);
    }

    const originalName = anexoInfo.name || path.basename(filePath);

    // Verificar se utilizador é destinatário (reutilizar lógica getComunicadosPublicos)
    const userRoles = (req.user?.roles || []).map((r: any) => typeof r === 'string' ? r : r.role || r.name);
    const matriculas = await prisma.matricula.findMany({
      where: { alunoId: userId, status: 'Ativa' },
      select: { turmaId: true, turma: { select: { cursoId: true } } },
    });
    const turmaIds = matriculas.map(m => m.turmaId).filter(Boolean);
    const cursoIds = [...new Set(matriculas.map(m => m.turma?.cursoId).filter(Boolean))];
    let turmasProfessor: string[] = [];
    if (userRoles.includes('PROFESSOR')) {
      const prof = await prisma.professor.findFirst({
        where: { userId, instituicaoId },
        select: { id: true },
      });
      if (prof) {
        const t = await prisma.turma.findMany({
          where: { planosEnsino: { some: { professorId: prof.id, instituicaoId } } },
          select: { id: true, cursoId: true },
        });
        turmasProfessor = t.map(x => x.id);
      }
    }
    const allTurmaIds = [...new Set([...turmaIds, ...turmasProfessor])];
    const allCursoIds = [...new Set(cursoIds)];

    const isGerais = ['GERAL', 'Todos', 'todos'].includes(comunicado.tipoEnvio) || !comunicado.destinatariosDetalhe?.length;
    const isRole = comunicado.destinatariosDetalhe?.some(d => d.tipo === 'ROLE' && userRoles.includes(d.referenciaId || ''));
    const isAluno = comunicado.destinatariosDetalhe?.some(d => d.tipo === 'ALUNO' && d.referenciaId === userId);
    const isTurma = comunicado.destinatariosDetalhe?.some(d => d.tipo === 'TURMA' && allTurmaIds.includes(d.referenciaId || ''));
    const isCurso = comunicado.destinatariosDetalhe?.some(d => d.tipo === 'CURSO' && allCursoIds.includes(d.referenciaId || ''));

    const temAcesso = isGerais || isRole || isAluno || isTurma || isCurso || userRoles.includes('ADMIN') || userRoles.includes('SECRETARIA');
    if (!temAcesso) {
      throw new AppError('Acesso negado a este comunicado', 403);
    }

    res.download(filePath, originalName);
  } catch (error) {
    next(error);
  }
};

export const createComunicado = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { titulo, conteudo, tipo, tipoEnvio, destinatarios, destinatariosDetalhe, dataExpiracao, anexos } = req.body;
    const autorId = req.user?.userId;
    const professor = req.professor;
    const isProfessor = req.user?.roles?.includes('PROFESSOR') && !req.user?.roles?.includes('ADMIN') && !req.user?.roles?.includes('SUPER_ADMIN');
    const instituicaoId = professor?.instituicaoId ?? req.user?.instituicaoId;

    if (!titulo || !conteudo) {
      throw new AppError('Título e conteúdo são obrigatórios', 400);
    }

    if (!instituicaoId) {
      throw new AppError('Instituição não identificada', 400);
    }

    // REGRA PROFESSOR: Só pode criar comunicados para turmas/curso em que leciona (via PlanoEnsino)
    if (isProfessor && professor) {
      if (!tipoEnvio || (tipoEnvio !== 'TURMA' && tipoEnvio !== 'CURSO')) {
        throw new AppError('Professor só pode publicar avisos para turma ou curso específico. Use tipoEnvio: TURMA ou CURSO.', 400);
      }
      if (!destinatariosDetalhe || !Array.isArray(destinatariosDetalhe) || destinatariosDetalhe.length === 0) {
        throw new AppError('Professor deve informar destinatários (turmas ou cursos) em destinatariosDetalhe.', 400);
      }

      const turmasProfessor = await prisma.turma.findMany({
        where: {
          planosEnsino: {
            some: {
              professorId: professor.id,
              instituicaoId: professor.instituicaoId
            }
          }
        },
        select: { id: true, cursoId: true }
      });
      const turmaIdsProfessor = turmasProfessor.map(t => t.id);
      const cursoIdsProfessor = [...new Set(turmasProfessor.map(t => t.cursoId).filter(Boolean))] as string[];

      const validDestinatarios = destinatariosDetalhe.filter((dest: any) => dest.tipo && dest.referenciaId);
      for (const dest of validDestinatarios) {
        if (dest.tipo !== tipoEnvio) {
          throw new AppError(`Destinatário inválido: tipo deve ser ${tipoEnvio}.`, 400);
        }
        const permitido = tipoEnvio === 'TURMA'
          ? turmaIdsProfessor.includes(dest.referenciaId)
          : cursoIdsProfessor.includes(dest.referenciaId);
        if (!permitido) {
          throw new AppError(`Professor não leciona a ${tipoEnvio === 'TURMA' ? 'turma' : 'curso'} informada.`, 403);
        }
      }
    }

    const anexosData = Array.isArray(anexos) ? anexos : [];
    const anexosJson = anexosData.length > 0 ? anexosData : undefined;

    // Use transaction to create comunicado and destinatarios
    const comunicado = await prisma.$transaction(async (tx) => {
      const novoComunicado = await tx.comunicado.create({
        data: {
          titulo,
          conteudo,
          tipo: tipo || 'Geral',
          tipoEnvio: tipoEnvio || 'GERAL',
          destinatarios: destinatarios || 'Todos',
          anexos: anexosJson ? (anexosJson as object) : [],
          dataPublicacao: new Date(),
          dataExpiracao: dataExpiracao ? new Date(dataExpiracao) : null,
          ativo: true,
          autorId,
          instituicaoId
        }
      });

      // If tipoEnvio is not GERAL, create destinatariosDetalhe
      if (tipoEnvio && tipoEnvio !== 'GERAL' && destinatariosDetalhe && Array.isArray(destinatariosDetalhe) && destinatariosDetalhe.length > 0) {
        // Filter out items without tipo or referenciaId
        const validDestinatarios = destinatariosDetalhe.filter((dest: any) => dest.tipo && dest.referenciaId);
        
        if (validDestinatarios.length > 0) {
          await tx.comunicadoDestinatario.createMany({
            data: validDestinatarios.map((dest: any) => ({
              comunicadoId: novoComunicado.id,
              tipo: dest.tipo, // ROLE, ALUNO, TURMA, CURSO
              referenciaId: dest.referenciaId
            }))
          });
        }
      }

      return novoComunicado;
    });

    const comunicadoCompleto = await prisma.comunicado.findUnique({
      where: { id: comunicado.id },
      include: {
        destinatariosDetalhe: true
      }
    });

    res.status(201).json(comunicadoCompleto);
  } catch (error) {
    next(error);
  }
};

export const updateComunicado = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    const { titulo, conteudo, tipo, tipoEnvio, destinatarios, destinatariosDetalhe, dataExpiracao, ativo } = req.body;

    const existing = await prisma.comunicado.findFirst({
      where: { id, ...filter }
    });

    if (!existing) {
      throw new AppError('Comunicado não encontrado', 404);
    }

    // Use transaction to update comunicado and destinatarios
    const comunicado = await prisma.$transaction(async (tx) => {
      // Update comunicado
      const updated = await tx.comunicado.update({
        where: { id },
        data: {
          ...(titulo && { titulo }),
          ...(conteudo && { conteudo }),
          ...(tipo && { tipo }),
          ...(tipoEnvio && { tipoEnvio }),
          ...(destinatarios && { destinatarios }),
          ...(dataExpiracao !== undefined && { dataExpiracao: dataExpiracao ? new Date(dataExpiracao) : null }),
          ...(ativo !== undefined && { ativo })
        }
      });

      // Update destinatariosDetalhe if provided
      if (destinatariosDetalhe !== undefined) {
        // Delete existing destinatarios
        await tx.comunicadoDestinatario.deleteMany({
          where: { comunicadoId: id }
        });

        // Create new destinatarios if not GERAL
        if (tipoEnvio && tipoEnvio !== 'GERAL' && Array.isArray(destinatariosDetalhe)) {
          await tx.comunicadoDestinatario.createMany({
            data: destinatariosDetalhe.map((dest: any) => ({
              comunicadoId: id,
              tipo: dest.tipo,
              referenciaId: dest.referenciaId || null
            }))
          });
        }
      }

      return updated;
    });

    const comunicadoCompleto = await prisma.comunicado.findUnique({
      where: { id },
      include: {
        destinatariosDetalhe: true
      }
    });

    res.json(comunicadoCompleto);
  } catch (error) {
    next(error);
  }
};

export const deleteComunicado = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const existing = await prisma.comunicado.findFirst({
      where: { id, ...filter }
    });

    if (!existing) {
      throw new AppError('Comunicado não encontrado', 404);
    }

    await prisma.comunicado.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * Get comunicados for the logged-in user
 * Filters based on:
 * - Institution
 * - User roles
 * - User's turmas
 * - User's cursos (via turmas)
 * - Direct user assignments
 */
export const getComunicadosPublicos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const userRoles = req.user?.roles || [];
    const instituicaoId = req.user?.instituicaoId;

    if (!userId || !instituicaoId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // Get user's turmas (if ALUNO)
    const matriculas = await prisma.matricula.findMany({
      where: {
        alunoId: userId,
        status: 'Ativa'
      },
      include: {
        turma: {
          include: {
            curso: true
          }
        }
      }
    });

    const turmaIds = matriculas.map(m => m.turmaId).filter((id): id is string => id != null);
    const cursoIds = matriculas.map(m => m.turma.cursoId).filter((id): id is string => id != null && id !== '');
    const cursoIdsUnique = [...new Set(cursoIds)];

    // Get user's turmas as professor
    // REGRA: Usar req.professor.id se disponível (middleware aplicado), senão resolver manualmente
    let turmasComoProfessor: any[] = [];
    if (userRoles.includes('PROFESSOR')) {
      let professorId: string | undefined;
      if (req.professor?.id) {
        // Middleware resolveProfessor aplicado - usar req.professor.id
        professorId = req.professor.id;
      } else {
        // Fallback: resolver manualmente (rota sem middleware obrigatório)
        try {
          professorId = await resolveProfessorId(userId, instituicaoId);
        } catch (error) {
          // Se não encontrar professor, não retornar turmas
          turmasComoProfessor = [];
        }
      }
      
      if (professorId) {
        // REGRA ARQUITETURAL: Usar apenas professores.id (req.professor.id)
        // REMOVIDO: Código legacy que buscava por users.id
        turmasComoProfessor = await prisma.turma.findMany({
          where: {
            // Buscar turmas através de PlanoEnsino (fonte da verdade)
            planosEnsino: {
              some: {
                professorId: professorId, // professores.id
                instituicaoId: instituicaoId
              }
            }
          },
          select: {
            id: true,
            cursoId: true
          }
        });
      }
    }

    const turmaIdsProfessor = turmasComoProfessor.map(t => t.id).filter((id): id is string => id != null);
    const cursoIdsProfessor = turmasComoProfessor.map(t => t.cursoId).filter((id): id is string => id != null && id !== '');

    // Combine all turma and curso IDs (filter nulls to avoid Prisma validation errors)
    const allTurmaIds = [...new Set([...turmaIds, ...turmaIdsProfessor])].filter((id): id is string => id != null);
    const allCursoIds = [...new Set([...cursoIdsUnique, ...cursoIdsProfessor])].filter((id): id is string => id != null && id !== '');

    // Build conditions for comunicados the user should see
    const conditions: any[] = [];

    // 1. GERAL comunicados (for all institution) - includes old format
    conditions.push({
      AND: [
        { instituicaoId: instituicaoId },
        { ativo: true },
        {
          OR: [
            { tipoEnvio: 'GERAL' },
            { destinatarios: 'Todos' }, // Old format
            { destinatarios: 'todos' } // Old format lowercase
          ]
        },
        {
          OR: [
            { dataExpiracao: null },
            { dataExpiracao: { gte: new Date() } }
          ]
        }
      ]
    });

    // 2. ROLE comunicados (for user's roles)
    if (userRoles.length > 0) {
      // New format with tipoEnvio
      conditions.push({
        AND: [
          { tipoEnvio: 'ROLE', instituicaoId: instituicaoId, ativo: true },
          { destinatariosDetalhe: { some: { tipo: 'ROLE', referenciaId: { in: userRoles } } } },
          { OR: [{ dataExpiracao: null }, { dataExpiracao: { gte: new Date() } }] }
        ]
      });

      // Old format - backward compatibility
      const destinatarioConditions: string[] = [];
      if (userRoles.includes('ALUNO')) destinatarioConditions.push('Alunos', 'alunos');
      if (userRoles.includes('PROFESSOR')) destinatarioConditions.push('Professores', 'professores');
      if (userRoles.includes('SECRETARIA') || userRoles.includes('ADMIN')) {
        destinatarioConditions.push('Funcionários', 'funcionários', 'Administradores', 'administradores');
      }
      
      if (destinatarioConditions.length > 0) {
        conditions.push({
          AND: [
            { instituicaoId: instituicaoId },
            { ativo: true },
            {
              tipoEnvio: { notIn: ['ALUNO', 'TURMA', 'CURSO'] } // Old format: GERAL, ROLE, etc.
            },
            { destinatarios: { in: destinatarioConditions } },
            {
              OR: [
                { dataExpiracao: null },
                { dataExpiracao: { gte: new Date() } }
              ]
            }
          ]
        });
      }
    }

    // 3. ALUNO comunicados (directly for this user)
    conditions.push({
      AND: [
        { tipoEnvio: 'ALUNO', instituicaoId: instituicaoId, ativo: true },
        { destinatariosDetalhe: { some: { tipo: 'ALUNO', referenciaId: userId } } },
        { OR: [{ dataExpiracao: null }, { dataExpiracao: { gte: new Date() } }] }
      ]
    });

    // 4. TURMA comunicados (for user's turmas)
    if (allTurmaIds.length > 0) {
      conditions.push({
        AND: [
          { tipoEnvio: 'TURMA', instituicaoId: instituicaoId, ativo: true },
          { destinatariosDetalhe: { some: { tipo: 'TURMA', referenciaId: { in: allTurmaIds } } } },
          { OR: [{ dataExpiracao: null }, { dataExpiracao: { gte: new Date() } }] }
        ]
      });
    }

    // 5. CURSO comunicados (for user's cursos)
    if (allCursoIds.length > 0) {
      conditions.push({
        AND: [
          { tipoEnvio: 'CURSO', instituicaoId: instituicaoId, ativo: true },
          { destinatariosDetalhe: { some: { tipo: 'CURSO', referenciaId: { in: allCursoIds } } } },
          { OR: [{ dataExpiracao: null }, { dataExpiracao: { gte: new Date() } }] }
        ]
      });
    }

    // Get comunicados
    const comunicados = await prisma.comunicado.findMany({
      where: {
        OR: conditions
      },
      include: {
        destinatariosDetalhe: true,
        leituras: {
          where: {
            userId: userId
          },
          select: {
            userId: true,
            dataLeitura: true
          }
        }
      },
      orderBy: { dataPublicacao: 'desc' }
    });

    // Format response to include read status
    const formatted = comunicados.map(comunicado => ({
      ...comunicado,
      lido: comunicado.leituras.length > 0,
      dataLeitura: comunicado.leituras[0]?.dataLeitura || null
    }));

    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

/**
 * Mark a comunicado as read by the current user
 */
export const markComunicadoAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const instituicaoId = req.user?.instituicaoId;

    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // Verify comunicado exists and belongs to user's institution
    const comunicado = await prisma.comunicado.findFirst({
      where: {
        id,
        instituicaoId: instituicaoId
      }
    });

    if (!comunicado) {
      throw new AppError('Comunicado não encontrado', 404);
    }

    // Check if already read
    const existingLeitura = await prisma.comunicadoLeitura.findUnique({
      where: {
        comunicadoId_userId: {
          comunicadoId: id,
          userId: userId
        }
      }
    });

    if (existingLeitura) {
      return res.json({ message: 'Comunicado já foi marcado como lido', leitura: existingLeitura });
    }

    // Mark as read
    const leitura = await prisma.comunicadoLeitura.create({
      data: {
        comunicadoId: id,
        userId: userId,
        dataLeitura: new Date()
      }
    });

    res.json({ message: 'Comunicado marcado como lido', leitura });
  } catch (error) {
    next(error);
  }
};