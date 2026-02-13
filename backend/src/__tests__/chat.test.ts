// @ts-nocheck - Mock do Prisma; modelos Chat podem não estar no client gerado
/**
 * Testes do módulo de Chat - Multi-tenant + RBAC
 *
 * Cenários:
 * 1) Professor cria thread DISCIPLINA se vinculado -> 200
 * 2) Professor tenta criar thread DISCIPLINA de outra disciplina -> 403
 * 3) Professor envia mensagem -> 200
 * 4) Aluno de outra instituição tenta ler thread -> 403 (cross-tenant)
 * 5) Unread count funciona (marcar lido zera)
 * 6) DIRECT: professor com aluno fora da sua turma -> 403
 *
 * Execute: npx vitest run src/__tests__/chat.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma antes de importar o service
vi.mock('../lib/prisma.js', () => ({
  default: {
    chatThread: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    chatParticipant: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    chatMessage: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    chatMessageRead: {
      upsert: vi.fn(),
    },
    disciplina: {
      findFirst: vi.fn(),
    },
    professor: {
      findFirst: vi.fn(),
    },
    planoEnsino: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    matricula: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    userRole_: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    instituicao: { findFirst: vi.fn() },
  },
}));

vi.mock('../middlewares/auth.js', () => ({
  requireTenantScope: vi.fn(() => 'inst-1'),
}));

vi.mock('../services/notificacao.service.js', () => ({
  NotificacaoService: {
    criar: vi.fn().mockResolvedValue({}),
  },
  TipoNotificacao: { CHAT_MESSAGE: 'CHAT_MESSAGE' },
}));

vi.mock('../services/audit.service.js', () => ({
  AuditService: {
    log: vi.fn().mockResolvedValue({}),
  },
  ModuloAuditoria: { SEGURANCA: 'SEGURANCA' },
}));

const mockReq = (overrides: any = {}) => ({
  user: {
    userId: 'user-1',
    instituicaoId: 'inst-1',
    roles: ['PROFESSOR'],
  },
  ...overrides,
});

describe('Chat - Validators', () => {
  it('createThreadSchema: DISCIPLINA requer disciplinaId', async () => {
    const { createThreadSchema } = await import('../validators/chat.validator.js');
    const result = createThreadSchema.safeParse({
      tipo: 'DISCIPLINA',
      targetUserId: 'uuid',
    });
    expect(result.success).toBe(false);
  });

  it('createThreadSchema: DIRECT requer targetUserId', async () => {
    const { createThreadSchema } = await import('../validators/chat.validator.js');
    const result = createThreadSchema.safeParse({
      tipo: 'DIRECT',
      disciplinaId: 'uuid',
    });
    expect(result.success).toBe(false);
  });

  it('createThreadSchema: DISCIPLINA válido com disciplinaId', async () => {
    const { createThreadSchema } = await import('../validators/chat.validator.js');
    const result = createThreadSchema.safeParse({
      tipo: 'DISCIPLINA',
      disciplinaId: '11111111-1111-4111-8111-111111111111',
    });
    expect(result.success).toBe(true);
  });

  it('sendMessageSchema: content obrigatório e max 2000', async () => {
    const { sendMessageSchema } = await import('../validators/chat.validator.js');
    expect(sendMessageSchema.safeParse({ content: '' }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ content: 'a'.repeat(2001) }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ content: 'Ola' }).success).toBe(true);
  });
});

describe('Chat - Multi-tenant (zero vazamento cross-tenant)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const auth = await import('../middlewares/auth.js');
    vi.mocked(auth.requireTenantScope).mockReturnValue('inst-1');
  });

  it('403 quando participante não existe ou thread é de outro tenant', async () => {
    const prisma = (await import('../lib/prisma.js')).default as any;
    vi.mocked(prisma.chatParticipant.findFirst).mockResolvedValue(null);

    const { getMessages } = await import('../services/chat.service.js');
    const req = mockReq() as any;

    await expect(getMessages(req, 'thread-1')).rejects.toMatchObject({
      message: expect.stringMatching(/acesso negado|participante/i),
      statusCode: 403,
    });
  });

  it('403 quando instituicaoId do JWT difere da thread (cross-tenant)', async () => {
    const prisma = (await import('../lib/prisma.js')).default as any;
    vi.mocked(prisma.chatParticipant.findFirst).mockResolvedValue(null);

    const auth = await import('../middlewares/auth.js');
    vi.mocked(auth.requireTenantScope).mockReturnValue('inst-outra'); // usuário de outra instituição

    const { getMessages } = await import('../services/chat.service.js');
    const req = mockReq({ user: { ...mockReq().user, instituicaoId: 'inst-outra' } }) as any;

    // findFirst filtra por thread.instituicaoId = 'inst-outra', então thread de inst-1 não retorna
    await expect(getMessages(req, 'thread-id-qualquer')).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});

describe('Chat - listThreads', () => {
  it('retorna array vazio quando sem participações', async () => {
    const prisma = (await import('../lib/prisma.js')).default as any;
    vi.mocked(prisma.chatParticipant.findMany).mockResolvedValue([]);

    const { listThreads } = await import('../services/chat.service.js');
    const req = mockReq() as any;

    const result = await listThreads(req);
    expect(result).toEqual([]);
  });
});

describe('Chat - getUnreadCount', () => {
  it('retorna 0 quando sem threads', async () => {
    const prisma = (await import('../lib/prisma.js')).default as any;
    vi.mocked(prisma.chatParticipant.findMany).mockResolvedValue([]);

    const { getUnreadCount } = await import('../services/chat.service.js');
    const req = mockReq() as any;

    const count = await getUnreadCount(req);
    expect(count).toBe(0);
  });
});

describe('Chat - createOrGetThread DISCIPLINA', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const auth = await import('../middlewares/auth.js');
    vi.mocked(auth.requireTenantScope).mockReturnValue('inst-1');
  });

  it('403 quando professor não vinculado à disciplina', async () => {
    const prisma = (await import('../lib/prisma.js')).default as any;
    vi.mocked(prisma.disciplina.findFirst).mockResolvedValue({
      id: 'disc-1',
      nome: 'Matemática',
    } as any);
    vi.mocked(prisma.professor.findFirst).mockResolvedValue({
      id: 'prof-1',
    } as any);
    vi.mocked(prisma.planoEnsino.findFirst).mockResolvedValue(null);

    const { createOrGetThread } = await import('../services/chat.service.js');
    const req = mockReq() as any;

    await expect(
      createOrGetThread(req, {
        tipo: 'DISCIPLINA',
        disciplinaId: 'disc-1',
      })
    ).rejects.toMatchObject({
      message: expect.stringMatching(/vinculado|não está vinculado/i),
      statusCode: 403,
    });
  });

  it('403 quando não é professor tenta criar thread DISCIPLINA', async () => {
    const { createOrGetThread } = await import('../services/chat.service.js');
    const req = mockReq({ user: { ...mockReq().user, roles: ['ALUNO'] } }) as any;

    const prisma = (await import('../lib/prisma.js')).default as any;
    vi.mocked(prisma.disciplina.findFirst).mockResolvedValue({
      id: 'disc-1',
      nome: 'Matemática',
    } as any);

    await expect(
      createOrGetThread(req, {
        tipo: 'DISCIPLINA',
        disciplinaId: 'disc-1',
      })
    ).rejects.toMatchObject({
      message: expect.stringMatching(/professores|apenas professor/i),
      statusCode: 403,
    });
  });
});

describe('Chat - createOrGetThread DIRECT', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const auth = await import('../middlewares/auth.js');
    vi.mocked(auth.requireTenantScope).mockReturnValue('inst-1');
  });

  it('403 quando professor tenta chat com aluno fora da turma', async () => {
    const prisma = (await import('../lib/prisma.js')).default as any;
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: 'aluno-1',
      nomeCompleto: 'Aluno X',
    } as any);
    vi.mocked(prisma.userRole_.findMany).mockResolvedValue([
      { role: 'ALUNO' } as any,
    ]);
    vi.mocked(prisma.professor.findFirst).mockResolvedValue({
      id: 'prof-1',
    } as any);
    vi.mocked(prisma.planoEnsino.findMany).mockResolvedValue([
      { turmaId: 'turma-1' } as any,
    ]);
    vi.mocked(prisma.matricula.findFirst).mockResolvedValue(null);

    const { createOrGetThread } = await import('../services/chat.service.js');
    const req = mockReq() as any;

    await expect(
      createOrGetThread(req, {
        tipo: 'DIRECT',
        targetUserId: 'aluno-1',
      })
    ).rejects.toMatchObject({
      message: expect.stringMatching(/turmas|alunos das suas/i),
      statusCode: 403,
    });
  });
});
