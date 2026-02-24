/**
 * Testes: unicidade de email por instituição (multi-tenant).
 * Garante: login por (email, instituicao_id) em subdomínio; erro "Vários perfis" no central quando mesmo email em várias instituições.
 *
 * Execute: npx vitest run src/__tests__/email-unico-por-instituicao.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

type AuthServiceInstance = {
  login: (email: string, password: string, req?: any) => Promise<any>;
  register: (data: { email: string; password: string; nomeCompleto: string; instituicaoId?: string }) => Promise<any>;
};

const mockUserFindUnique = vi.fn();
const mockUserFindMany = vi.fn();
const mockUserFindFirst = vi.fn();
const mockUserCreate = vi.fn();
const mockLoginAttemptFindUnique = vi.fn();
const mockUserRoleCreate = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  default: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      findMany: (...args: unknown[]) => mockUserFindMany(...args),
      findFirst: (...args: unknown[]) => mockUserFindFirst(...args),
      create: (...args: unknown[]) => mockUserCreate(...args),
    },
    loginAttempt: {
      findUnique: (...args: unknown[]) => mockLoginAttemptFindUnique(...args),
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    instituicao: { findUnique: vi.fn() },
    userRole_: { create: (...args: unknown[]) => mockUserRoleCreate(...args) },
    passwordResetToken: { updateMany: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
  },
}));

// Evitar chamadas a email/audit durante os testes
vi.mock('../services/email.service.js', () => ({ EmailService: { sendEmail: vi.fn() } }));
vi.mock('../services/audit.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/audit.service.js')>();
  return {
    ...actual,
    AuditService: { log: vi.fn() },
  };
});

const fakeReq = () =>
  ({
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'user-agent': 'test' },
  }) as any;

describe('Email único por instituição - Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoginAttemptFindUnique.mockResolvedValue(null);
  });

  it('em subdomínio: busca usuário por (email, instituicao_id) via findUnique com instituicaoId_email', async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const authService = (await import('../services/auth.service.js')).default as unknown as AuthServiceInstance;
    const req = {
      ...fakeReq(),
      tenantDomainInstituicaoId: 'inst-a-uuid-123',
      tenantDomainMode: 'subdomain',
    };

    await expect(
      authService.login('aluno@escola.com', 'qualquersenha', req)
    ).rejects.toMatchObject({ statusCode: 401, message: /email ou senha inválidos/i });

    expect(mockUserFindUnique).toHaveBeenCalledTimes(1);
    expect(mockUserFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          instituicaoId_email: {
            instituicaoId: 'inst-a-uuid-123',
            email: 'aluno@escola.com',
          },
        },
      })
    );
    expect(mockUserFindMany).not.toHaveBeenCalled();
  });

  it('em domínio central com múltiplos usuários mesmo email: lança erro pedindo acesso pelo subdomínio', async () => {
    const user1 = {
      id: 'u1',
      email: 'mesmo@email.com',
      password: '$2a$12$fakehash',
      nomeCompleto: 'User 1',
      instituicaoId: 'inst-a',
      roles: [{ role: 'ALUNO' }],
      instituicao: { id: 'inst-a', nome: 'Escola A' },
    };
    const user2 = {
      id: 'u2',
      email: 'mesmo@email.com',
      password: '$2a$12$fakehash2',
      nomeCompleto: 'User 2',
      instituicaoId: 'inst-b',
      roles: [{ role: 'ALUNO' }],
      instituicao: { id: 'inst-b', nome: 'Escola B' },
    };
    mockUserFindMany.mockResolvedValue([user1, user2]);

    const authService = (await import('../services/auth.service.js')).default as unknown as AuthServiceInstance;
    const req = fakeReq(); // sem tenantDomainInstituicaoId (central ou localhost)

    await expect(
      authService.login('mesmo@email.com', 'senha', req)
    ).rejects.toMatchObject({
      statusCode: 400,
      message: /vários perfis encontrados|acesse pelo endereço da sua instituição/i,
    });

    expect(mockUserFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'mesmo@email.com' },
      })
    );
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it('em domínio central com um único usuário: usa findMany e segue fluxo (não lança por múltiplos perfis)', async () => {
    const user = {
      id: 'u1',
      email: 'unico@email.com',
      password: '$2a$12$fakehash',
      nomeCompleto: 'User',
      instituicaoId: 'inst-a',
      roles: [{ role: 'ALUNO' }],
      instituicao: { id: 'inst-a', nome: 'Escola A' },
    };
    mockUserFindMany.mockResolvedValue([user]);

    const authService = (await import('../services/auth.service.js')).default as unknown as AuthServiceInstance;
    const req = fakeReq(); // central

    // Deve falhar por senha inválida (não por múltiplos perfis)
    await expect(
      authService.login('unico@email.com', 'senhaerrada', req)
    ).rejects.toMatchObject({ statusCode: 401, message: /email ou senha inválidos/i });

    expect(mockUserFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'unico@email.com' },
      })
    );
  });
});

describe('Email único por instituição - Register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('register verifica duplicata por (email, instituicaoId)', async () => {
    mockUserFindFirst.mockResolvedValue({
      id: 'existente',
      email: 'aluno@escola.com',
      instituicaoId: 'inst-1',
    });

    const authService = (await import('../services/auth.service.js')).default as unknown as AuthServiceInstance;

    await expect(
      authService.register({
        email: 'aluno@escola.com',
        password: 'Senha123!',
        nomeCompleto: 'Aluno',
        instituicaoId: 'inst-1',
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: /já cadastrado nesta instituição/i,
    });

    expect(mockUserFindFirst).toHaveBeenCalledWith({
      where: {
        email: 'aluno@escola.com',
        instituicaoId: 'inst-1',
      },
    });
  });

  it('register permite mesmo email em instituição diferente (findFirst retorna null)', async () => {
    mockUserFindFirst.mockResolvedValue(null);
    mockUserCreate.mockResolvedValue({
      id: 'novo-id',
      email: 'aluno@escola.com',
      nomeCompleto: 'Aluno B',
      instituicaoId: 'inst-2',
    });
    mockUserRoleCreate.mockResolvedValue({});

    const authService = (await import('../services/auth.service.js')).default as unknown as AuthServiceInstance;
    const result = await authService.register({
      email: 'aluno@escola.com',
      password: 'Senha123!',
      nomeCompleto: 'Aluno B',
      instituicaoId: 'inst-2',
    });

    expect(mockUserFindFirst).toHaveBeenCalledWith({
      where: {
        email: 'aluno@escola.com',
        instituicaoId: 'inst-2',
      },
    });
    expect(result.message).toMatch(/sucesso/i);
    expect(result.user.email).toBe('aluno@escola.com');
  });
});
