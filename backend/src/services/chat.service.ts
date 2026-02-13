/**
 * Serviço de Chat interno estilo WhatsApp
 * Multi-tenant 100% - instituicaoId sempre do JWT
 * RBAC: DISCIPLINA (professor+alunos), DIRECT (professor↔aluno, admin↔qualquer)
 */
import { Request } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';
import { NotificacaoService, TipoNotificacao } from './notificacao.service.js';
import { AuditService, ModuloAuditoria } from './audit.service.js';

export type ChatThreadTipo = 'DISCIPLINA' | 'DIRECT';
export type ChatMessageStatus = 'SENT' | 'DELIVERED' | 'READ';

const CONTENT_MIN = 1;
const CONTENT_MAX = 2000;

/**
 * Sanitizar conteúdo - remover HTML/script
 */
function sanitizeContent(content: string): string {
  return content
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

/**
 * Obter role principal do usuário (snapshot para auditoria)
 */
function getRoleSnapshot(roles: string[]): string {
  const priority = ['ADMIN', 'SECRETARIA', 'COORDENADOR', 'DIRECAO', 'PROFESSOR', 'ALUNO', 'RH', 'FINANCEIRO', 'AUDITOR', 'POS', 'RESPONSAVEL'];
  for (const r of priority) {
    if (roles.includes(r)) return r;
  }
  return roles[0] || 'ALUNO';
}

/**
 * Registrar tentativa de acesso indevido (403)
 */
async function logAccessDenied(
  req: Request,
  context: { userId: string; role: string; threadId?: string; message: string }
): Promise<void> {
  try {
    await AuditService.log(req, {
      modulo: ModuloAuditoria.SEGURANCA,
      acao: 'ACCESS_DENIED',
      entidade: 'ChatThread',
      entidadeId: context.threadId || 'N/A',
      dadosNovos: context,
    });
  } catch {
    console.warn('[ChatService] Falha ao registrar acesso indevido:', context);
  }
}

/**
 * Validar que usuário é participante da thread e tenant
 */
async function requireParticipant(
  req: Request,
  threadId: string
): Promise<{ thread: any; participant: any }> {
  const instituicaoId = requireTenantScope(req);
  const userId = req.user!.userId;
  const roles = req.user!.roles.map((r: any) => typeof r === 'string' ? r : r.role || r.name).filter(Boolean);

  const participant = await prisma.chatParticipant.findFirst({
    where: {
      threadId,
      userId,
      thread: {
        instituicaoId,
      },
    },
    include: {
      thread: {
        include: {
          disciplina: { select: { id: true, nome: true } },
        },
      },
    },
  });

  if (!participant) {
    await logAccessDenied(req, {
      userId,
      role: getRoleSnapshot(roles),
      threadId,
      message: 'Participante não encontrado ou cross-tenant',
    });
    throw new AppError('Acesso negado: você não é participante desta conversa', 403);
  }

  return { thread: participant.thread, participant };
}

/**
 * Listar contatos disponíveis para conversa DIRECT
 * ADMIN/SECRETARIA: todos professores e alunos da instituição
 * PROFESSOR: alunos das suas turmas
 * ALUNO: professores das suas turmas
 */
export async function getAvailableContacts(req: Request) {
  const instituicaoId = requireTenantScope(req);
  const userId = req.user!.userId;
  const roles = req.user!.roles.map((r: any) => (typeof r === 'string' ? r : r.role || r.name)) as string[];
  const isAdmin = roles.includes('ADMIN') || roles.includes('SECRETARIA');
  const isProfessor = roles.includes('PROFESSOR');
  const isAluno = roles.includes('ALUNO');

  const result: Array<{ id: string; nomeCompleto: string; email: string; tipo: 'PROFESSOR' | 'ALUNO' | 'ADMIN' }> = [];

  if (isAdmin) {
    const professores = await prisma.professor.findMany({
      where: { instituicaoId },
      include: { user: { select: { id: true, nomeCompleto: true, email: true } } },
    });
    const alunos = await prisma.user.findMany({
      where: {
        instituicaoId,
        roles: { some: { role: 'ALUNO' } },
      },
      select: { id: true, nomeCompleto: true, email: true },
    });
    for (const p of professores) {
      if (p.user?.id && p.user.id !== userId) {
        result.push({
          id: p.user.id,
          nomeCompleto: p.user.nomeCompleto || p.user.email || 'Professor',
          email: p.user.email || '',
          tipo: 'PROFESSOR',
        });
      }
    }
    for (const a of alunos) {
      if (a.id !== userId) {
        result.push({
          id: a.id,
          nomeCompleto: a.nomeCompleto || a.email || 'Aluno',
          email: a.email || '',
          tipo: 'ALUNO',
        });
      }
    }
    return result;
  }

  if (isProfessor) {
    const professor = await prisma.professor.findFirst({
      where: { userId, instituicaoId },
      select: { id: true },
    });
    if (!professor) return [];
    const planos = await prisma.planoEnsino.findMany({
      where: { professorId: professor.id, instituicaoId, turmaId: { not: null } },
      select: { turmaId: true },
    });
    const turmaIds = planos.map((p) => p.turmaId).filter((id): id is string => id != null);
    if (turmaIds.length === 0) return [];
    const matriculas = await prisma.matricula.findMany({
      where: { turmaId: { in: turmaIds }, status: 'Ativa' },
      include: { aluno: { select: { id: true, nomeCompleto: true, email: true } } },
    });
    const seen = new Set<string>();
    for (const m of matriculas) {
      const uid = m.aluno?.id;
      if (uid && uid !== userId && !seen.has(uid)) {
        seen.add(uid);
        result.push({
          id: uid,
          nomeCompleto: m.aluno?.nomeCompleto || m.aluno?.email || 'Aluno',
          email: m.aluno?.email || '',
          tipo: 'ALUNO',
        });
      }
    }
    return result;
  }

  if (isAluno) {
    const seen = new Set<string>();
    const matriculas = await prisma.matricula.findMany({
      where: { alunoId: userId, status: 'Ativa' },
      select: { turmaId: true },
    });
    const turmaIds = matriculas.map((m) => m.turmaId).filter(Boolean);
    if (turmaIds.length > 0) {
      const planos = await prisma.planoEnsino.findMany({
        where: { turmaId: { in: turmaIds }, instituicaoId },
        include: { professor: { include: { user: { select: { id: true, nomeCompleto: true, email: true } } } } },
      });
      for (const pl of planos) {
        const uid = pl.professor?.user?.id;
        if (uid && uid !== userId && !seen.has(uid)) {
          seen.add(uid);
          result.push({
            id: uid,
            nomeCompleto: pl.professor?.user?.nomeCompleto || pl.professor?.user?.email || 'Professor',
            email: pl.professor?.user?.email || '',
            tipo: 'PROFESSOR',
          });
        }
      }
    }
    const admins = await prisma.user.findMany({
      where: {
        instituicaoId,
        OR: [
          { roles: { some: { role: 'ADMIN' } } },
          { roles: { some: { role: 'SECRETARIA' } } },
        ],
      },
      select: { id: true, nomeCompleto: true, email: true },
    });
    for (const a of admins) {
      if (a.id !== userId && !seen.has(a.id)) {
        seen.add(a.id);
        result.push({
          id: a.id,
          nomeCompleto: a.nomeCompleto || a.email || 'Administrativo',
          email: a.email || '',
          tipo: 'ADMIN',
        });
      }
    }
    return result;
  }

  return [];
}

/**
 * Listar threads do usuário
 */
export async function listThreads(req: Request) {
  const instituicaoId = requireTenantScope(req);
  const userId = req.user!.userId;

  const participants = await prisma.chatParticipant.findMany({
    where: {
      userId,
      thread: { instituicaoId },
    },
    include: {
      thread: {
        include: {
          disciplina: { select: { id: true, nome: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, content: true, createdAt: true, status: true, senderUserId: true },
          },
          _count: { select: { messages: true } },
        },
      },
    },
    orderBy: { thread: { updatedAt: 'desc' } },
  });

  const threads = await Promise.all(
    participants.map(async (p) => {
      const lastMsg = p.thread.messages[0];
      const unreadCount = await prisma.chatMessage.count({
        where: {
          threadId: p.thread.id,
          senderUserId: { not: userId },
          deletedAt: null,
          ...(p.lastReadAt && {
            createdAt: { gt: p.lastReadAt },
          }),
        },
      });

      return {
        id: p.thread.id,
        tipo: p.thread.tipo,
        disciplinaId: p.thread.disciplinaId,
        disciplina: p.thread.disciplina,
        lastMessage: lastMsg
          ? {
              id: lastMsg.id,
              content: lastMsg.content.substring(0, 100),
              createdAt: lastMsg.createdAt,
              status: lastMsg.status,
              isFromMe: lastMsg.senderUserId === userId,
            }
          : null,
        unreadCount,
        updatedAt: p.thread.updatedAt,
        lastReadAt: p.lastReadAt,
      };
    })
  );

  return threads;
}

/**
 * Validar que professor está vinculado à disciplina
 */
async function validarProfessorDisciplina(
  disciplinaId: string,
  professorId: string,
  instituicaoId: string
): Promise<boolean> {
  const existe = await prisma.planoEnsino.findFirst({
    where: {
      disciplinaId,
      professorId,
      instituicaoId,
    },
    select: { id: true },
  });
  return !!existe;
}

/**
 * Validar que professor pode abrir chat DIRECT com aluno (aluno em turma/disciplina do professor)
 */
async function professorPodeChatComAluno(
  professorId: string,
  alunoId: string,
  instituicaoId: string
): Promise<boolean> {
  const planos = await prisma.planoEnsino.findMany({
    where: {
      professorId,
      instituicaoId,
      turmaId: { not: null },
    },
    select: { turmaId: true },
  });
  const turmaIds = planos.map((p) => p.turmaId).filter((id): id is string => id != null);
  if (turmaIds.length === 0) return false;

  const matricula = await prisma.matricula.findFirst({
    where: {
      alunoId,
      turmaId: { in: turmaIds },
      status: 'Ativa',
    },
  });
  return !!matricula;
}

/**
 * Validar que aluno pode abrir chat DIRECT com professor (aluno em turma do professor)
 */
async function alunoPodeChatComProfessor(
  alunoId: string,
  professorId: string,
  instituicaoId: string
): Promise<boolean> {
  return professorPodeChatComAluno(professorId, alunoId, instituicaoId);
}

/**
 * Criar ou obter thread existente
 */
export async function createOrGetThread(
  req: Request,
  body: { tipo: ChatThreadTipo; disciplinaId?: string; targetUserId?: string }
) {
  const instituicaoId = requireTenantScope(req);
  const userId = req.user!.userId;
  const roles = req.user!.roles.map((r: any) => (typeof r === 'string' ? r : r.role || r.name)) as string[];
  const roleSnapshot = getRoleSnapshot(roles);
  const isAdmin = roles.includes('ADMIN') || roles.includes('SECRETARIA');
  const isProfessor = roles.includes('PROFESSOR');
  const isAluno = roles.includes('ALUNO');

  if (body.tipo === 'DISCIPLINA') {
    if (!body.disciplinaId) {
      throw new AppError('disciplinaId é obrigatório para thread tipo DISCIPLINA', 400);
    }

    const disciplina = await prisma.disciplina.findFirst({
      where: { id: body.disciplinaId, instituicaoId },
      select: { id: true, nome: true },
    });
    if (!disciplina) {
      throw new AppError('Disciplina não encontrada ou acesso negado', 404);
    }

    if (!isProfessor) {
      await logAccessDenied(req, {
        userId,
        role: roleSnapshot,
        message: 'Apenas professor pode criar thread DISCIPLINA',
      });
      throw new AppError('Apenas professores podem criar chat de disciplina', 403);
    }

    const professor = await prisma.professor.findFirst({
      where: { userId, instituicaoId },
      select: { id: true },
    });
    if (!professor) {
      throw new AppError('Professor não encontrado', 403);
    }

    const vinculado = await validarProfessorDisciplina(
      body.disciplinaId,
      professor.id,
      instituicaoId
    );
    if (!vinculado) {
      await logAccessDenied(req, {
        userId,
        role: roleSnapshot,
        message: 'Professor não vinculado à disciplina',
      });
      throw new AppError('Você não está vinculado a esta disciplina', 403);
    }

    let thread = await prisma.chatThread.findFirst({
      where: {
        instituicaoId,
        tipo: 'DISCIPLINA',
        disciplinaId: body.disciplinaId,
      },
      include: {
        participants: true,
        disciplina: { select: { id: true, nome: true } },
      },
    });

    if (thread) {
      const jaParticipante = thread.participants.some((p) => p.userId === userId);
      if (!jaParticipante) {
        await prisma.chatParticipant.create({
          data: {
            threadId: thread.id,
            userId,
            roleSnapshot,
          },
        });
      }
      return {
        ...thread,
        participants: await prisma.chatParticipant.findMany({
          where: { threadId: thread!.id },
          include: { user: { select: { id: true, nomeCompleto: true, avatarUrl: true } } },
        }),
      };
    }

    thread = await prisma.chatThread.create({
      data: {
        instituicaoId,
        tipo: 'DISCIPLINA',
        disciplinaId: body.disciplinaId,
        createdByUserId: userId,
      },
      include: {
        disciplina: { select: { id: true, nome: true } },
      },
    });

    await prisma.chatParticipant.create({
      data: { threadId: thread.id, userId, roleSnapshot },
    });

    const planos = await prisma.planoEnsino.findMany({
      where: {
        disciplinaId: body.disciplinaId,
        instituicaoId,
        turmaId: { not: null },
      },
      select: { turmaId: true },
      distinct: ['turmaId'],
    });
    const turmaIds = planos.map((p) => p.turmaId).filter((id): id is string => id != null);
    const matriculas = await prisma.matricula.findMany({
      where: {
        turmaId: { in: turmaIds },
        status: 'Ativa',
      },
      select: { alunoId: true },
      distinct: ['alunoId'],
    });
    const alunoIds = [...new Set(matriculas.map((m) => m.alunoId))];
    const alunoRoles = await prisma.userRole_.findMany({
      where: {
        userId: { in: alunoIds },
        role: 'ALUNO',
      },
      select: { userId: true },
    });
    const alunosComRole = alunoRoles.map((r) => r.userId);

    for (const alunoId of alunosComRole) {
      if (alunoId === userId) continue;
      await prisma.chatParticipant.create({
        data: {
          threadId: thread.id,
          userId: alunoId,
          roleSnapshot: 'ALUNO',
        },
      });
    }

    const professores = await prisma.planoEnsino.findMany({
      where: {
        disciplinaId: body.disciplinaId,
        instituicaoId,
      },
      select: { professor: { select: { userId: true } } },
      distinct: ['professorId'],
    });
    for (const p of professores) {
      if (p.professor.userId !== userId) {
        const profRole = await prisma.userRole_.findFirst({
          where: { userId: p.professor.userId },
          select: { role: true },
        });
        await prisma.chatParticipant.create({
          data: {
            threadId: thread.id,
            userId: p.professor.userId,
            roleSnapshot: profRole?.role || 'PROFESSOR',
          },
        });
      }
    }

    return prisma.chatThread.findUnique({
      where: { id: thread.id },
      include: {
        participants: {
          include: { user: { select: { id: true, nomeCompleto: true, avatarUrl: true } } },
        },
        disciplina: { select: { id: true, nome: true } },
      },
    });
  }

  if (body.tipo === 'DIRECT') {
    if (!body.targetUserId) {
      throw new AppError('targetUserId é obrigatório para thread tipo DIRECT', 400);
    }

    const targetUser = await prisma.user.findFirst({
      where: {
        id: body.targetUserId,
        instituicaoId,
      },
      select: { id: true, nomeCompleto: true },
    });
    if (!targetUser) {
      throw new AppError('Usuário não encontrado ou de outra instituição', 404);
    }

    const targetRoles = await prisma.userRole_.findMany({
      where: { userId: body.targetUserId },
      select: { role: true },
    });
    const targetRoleNames = targetRoles.map((r) => r.role);
    const targetIsAluno = targetRoleNames.includes('ALUNO');
    const targetIsProfessor = targetRoleNames.includes('PROFESSOR');
    const targetIsAdmin = targetRoleNames.includes('ADMIN') || targetRoleNames.includes('SECRETARIA');

    if (isAdmin) {
      // Admin pode abrir chat com qualquer usuário do tenant
    } else if (isProfessor && targetIsAluno) {
      const professor = await prisma.professor.findFirst({
        where: { userId, instituicaoId },
        select: { id: true },
      });
      if (!professor) throw new AppError('Professor não encontrado', 403);
      const pode = await professorPodeChatComAluno(
        professor.id,
        body.targetUserId,
        instituicaoId
      );
      if (!pode) {
        await logAccessDenied(req, {
          userId,
          role: roleSnapshot,
          message: 'Professor não pode chat com aluno fora da turma',
        });
        throw new AppError('Você só pode abrir chat com alunos das suas turmas', 403);
      }
    } else if (isAluno && (targetIsProfessor || targetIsAdmin)) {
      if (targetIsProfessor) {
        const professor = await prisma.professor.findFirst({
          where: { userId: body.targetUserId, instituicaoId },
          select: { id: true },
        });
        if (!professor) throw new AppError('Professor não encontrado', 404);
        const pode = await alunoPodeChatComProfessor(
          userId,
          professor.id,
          instituicaoId
        );
        if (!pode) {
          await logAccessDenied(req, {
            userId,
            role: roleSnapshot,
            message: 'Aluno não pode chat com professor fora da turma',
          });
          throw new AppError('Você só pode abrir chat com professores das suas turmas', 403);
          }
      }
    } else {
      await logAccessDenied(req, {
        userId,
        role: roleSnapshot,
        message: 'Combinação de roles não permitida para DIRECT',
      });
      throw new AppError('Operação não permitida para este tipo de conversa', 403);
    }

    const existingThread = await prisma.chatThread.findFirst({
      where: {
        instituicaoId,
        tipo: 'DIRECT',
        disciplinaId: null,
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: body.targetUserId } } },
        ],
      },
      include: {
        participants: {
          include: { user: { select: { id: true, nomeCompleto: true, avatarUrl: true } } },
        },
      },
    });

    if (existingThread) {
      const count = await prisma.chatParticipant.count({
        where: { threadId: existingThread.id },
      });
      if (count === 2) return existingThread;
    }

    const newThread = await prisma.chatThread.create({
      data: {
        instituicaoId,
        tipo: 'DIRECT',
        createdByUserId: userId,
      },
      include: {
        participants: {
          include: { user: { select: { id: true, nomeCompleto: true, avatarUrl: true } } },
        },
      },
    });

    await prisma.chatParticipant.createMany({
      data: [
        { threadId: newThread.id, userId, roleSnapshot },
        {
          threadId: newThread.id,
          userId: body.targetUserId,
          roleSnapshot: getRoleSnapshot(targetRoleNames),
        },
      ],
    });

    return prisma.chatThread.findUnique({
      where: { id: newThread.id },
      include: {
        participants: {
          include: { user: { select: { id: true, nomeCompleto: true, avatarUrl: true } } },
        },
      },
    });
  }

  throw new AppError('tipo inválido: use DISCIPLINA ou DIRECT', 400);
}

/**
 * Buscar mensagens com paginação cursor
 */
export async function getMessages(
  req: Request,
  threadId: string,
  cursor?: string,
  limit = 50
) {
  const { participant } = await requireParticipant(req, threadId);
  const userId = req.user!.userId;

  const messages = await prisma.chatMessage.findMany({
    where: {
      threadId,
      deletedAt: null,
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 100),
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    select: {
      id: true,
      content: true,
      senderUserId: true,
      senderRoleSnapshot: true,
      status: true,
      attachments: true,
      createdAt: true,
      deletedAt: true,
    },
  });

  const senderIds = [...new Set(messages.map((m) => m.senderUserId))];
  const users = await prisma.user.findMany({
    where: { id: { in: senderIds } },
    select: { id: true, nomeCompleto: true, avatarUrl: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  return messages.map((m) => ({
    ...m,
    id: m.id,
    sender: userMap[m.senderUserId] || { id: m.senderUserId, nomeCompleto: 'Desconhecido', avatarUrl: null },
    isFromMe: m.senderUserId === userId,
  }));
}

/**
 * Enviar mensagem
 */
export async function sendMessage(
  req: Request,
  threadId: string,
  body: { content: string; attachments?: Array<{ url: string; type?: string; name?: string; size?: number }> }
) {
  const instituicaoId = requireTenantScope(req);
  const { thread, participant } = await requireParticipant(req, threadId);
  const userId = req.user!.userId;
  const roleSnapshot = getRoleSnapshot(req.user!.roles.map((r: any) => (typeof r === 'string' ? r : r.role || r.name)));

  const content = sanitizeContent(body.content || '');
  const hasAttachments = body.attachments && Array.isArray(body.attachments) && body.attachments.length > 0;
  if (content.length < CONTENT_MIN && !hasAttachments) {
    throw new AppError('Informe um texto ou anexe pelo menos um arquivo (foto, PDF ou vídeo)', 400);
  }
  if (content.length > CONTENT_MAX) {
    throw new AppError(`Conteúdo deve ter no máximo ${CONTENT_MAX} caracteres`, 400);
  }

  const finalContent = content.trim() || (hasAttachments ? '📎 Anexo' : '');
  const message = await prisma.chatMessage.create({
    data: {
      threadId,
      instituicaoId,
      senderUserId: userId,
      senderRoleSnapshot: roleSnapshot,
      content: finalContent,
      attachments: body.attachments ? (body.attachments as object) : [],
      status: 'SENT',
    },
  });

  await prisma.chatThread.update({
    where: { id: threadId },
    data: { updatedAt: new Date() },
  });

  const otherParticipants = await prisma.chatParticipant.findMany({
    where: {
      threadId,
      userId: { not: userId },
    },
    select: { userId: true },
  });

  for (const p of otherParticipants) {
    NotificacaoService.criar(req, {
      userId: p.userId,
      titulo: 'Nova mensagem',
      mensagem: `Você recebeu uma nova mensagem no chat.`,
      tipo: TipoNotificacao.CHAT_MESSAGE,
      link: `/chat/${threadId}`,
      instituicaoId,
    });
  }

  const sender = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, nomeCompleto: true, avatarUrl: true },
  });

  // INTEGRAÇÃO WEBSOCKET (opcional): Se o projeto tiver Socket.IO:
  // io.to(`tenant:${instituicaoId}:thread:${threadId}`).emit('chat:message:new', message);
  // io.to(`tenant:${instituicaoId}:user:${userId}`).emit('chat:message:new', message);
  // Rooms: tenant:{instituicaoId}:thread:{threadId}, tenant:{instituicaoId}:user:{userId}
  // Autenticar socket com JWT e validar tenant na conexão

  return {
    ...message,
    sender: sender || { id: userId, nomeCompleto: 'Desconhecido', avatarUrl: null },
    isFromMe: true,
  };
}

/**
 * Marcar como lido
 */
export async function markAsRead(req: Request, threadId: string) {
  const { participant } = await requireParticipant(req, threadId);
  const userId = req.user!.userId;

  const now = new Date();
  await prisma.chatParticipant.update({
    where: { id: participant.id },
    data: { lastReadAt: now },
  });

  const messages = await prisma.chatMessage.findMany({
    where: {
      threadId,
      senderUserId: { not: userId },
      deletedAt: null,
    },
    select: { id: true },
  });

  for (const m of messages) {
    await prisma.chatMessageRead.upsert({
      where: {
        messageId_userId: { messageId: m.id, userId },
      },
      create: {
        messageId: m.id,
        userId,
        instituicaoId: requireTenantScope(req),
      },
      update: {},
    });
    await prisma.chatMessage.update({
      where: { id: m.id },
      data: { status: 'READ' },
    });
  }

  return { ok: true };
}

/**
 * Contagem de não lidas
 */
export async function getUnreadCount(req: Request): Promise<number> {
  const instituicaoId = requireTenantScope(req);
  const userId = req.user!.userId;

  const participants = await prisma.chatParticipant.findMany({
    where: {
      userId,
      thread: { instituicaoId },
    },
    include: {
      thread: {
        include: {
          messages: {
            where: {
              senderUserId: { not: userId },
              deletedAt: null,
            },
            select: { id: true, createdAt: true },
          },
        },
      },
    },
  });

  let total = 0;
  for (const p of participants) {
    if (!p.lastReadAt) {
      total += p.thread.messages.length;
    } else {
      total += p.thread.messages.filter((m) => m.createdAt > p.lastReadAt!).length;
    }
  }
  return total;
}
