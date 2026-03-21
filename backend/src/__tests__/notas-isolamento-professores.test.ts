/**
 * Teste: Isolamento entre professores na mesma turma
 *
 * CENÁRIO:
 * - 2 professores na mesma turma (João e Maria)
 * - Cada um lança nota para o mesmo estudante
 * - Notas devem ser independentes
 *
 * Usa supertest + app Express (sem servidor na porta 3001), alinhado a contabilidade/campus.
 *
 * Uso: npm run test:isolamento-professores
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../app.js';

const SENHA = 'TestMultiTenant123!';
const prisma = new PrismaClient();

async function login(email: string): Promise<string | null> {
  const res = await request(app).post('/auth/login').send({ email, password: SENHA });
  if (res.status !== 200 || !res.body?.accessToken) return null;
  return res.body.accessToken as string;
}

describe('Notas - Isolamento entre professores na mesma turma', () => {
  let turmaId: string;
  let alunoId: string;
  let profA: { id: string; email: string };
  let profB: { id: string; email: string };
  let planoA: { id: string };
  let planoB: { id: string };
  let avaliacaoA: { id: string };
  let avaliacaoB: { id: string };
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    execSync('npx tsx scripts/seed-fluxo-notas-completo.ts', {
      cwd: process.cwd(),
      stdio: 'pipe',
    });

    const instA = await prisma.instituicao.findFirst({
      where: { subdominio: 'inst-a-secundario-test' },
      select: { id: true },
    });
    if (!instA) throw new Error('Seed falhou: Inst A não encontrada');

    const userA = await prisma.user.findFirst({
      where: { email: 'prof.a1.mat@teste.dsicola.com', instituicaoId: instA.id },
      select: { id: true, email: true },
    });
    const userB = await prisma.user.findFirst({
      where: { email: 'prof.a2.inf@teste.dsicola.com', instituicaoId: instA.id },
      select: { id: true, email: true },
    });
    if (!userA || !userB) throw new Error('Seed falhou: Professores não encontrados');

    const pA = await prisma.professor.findFirstOrThrow({
      where: { userId: userA.id },
      select: { id: true },
    });
    const pB = await prisma.professor.findFirstOrThrow({
      where: { userId: userB.id },
      select: { id: true },
    });
    profA = { id: pA.id, email: userA.email };
    profB = { id: pB.id, email: userB.email };

    const turma = await prisma.turma.findFirst({
      where: { instituicaoId: instA.id },
      select: { id: true },
    });
    if (!turma) throw new Error('Seed falhou: Turma não encontrada');
    turmaId = turma.id;

    const aluno = await prisma.user.findFirst({
      where: { email: 'aluno.inst.a@teste.dsicola.com', instituicaoId: instA.id },
      select: { id: true },
    });
    if (!aluno) throw new Error('Seed falhou: Aluno não encontrado');
    alunoId = aluno.id;

    planoA = await prisma.planoEnsino.findFirstOrThrow({
      where: { professorId: profA.id, turmaId },
      select: { id: true },
    });
    planoB = await prisma.planoEnsino.findFirstOrThrow({
      where: { professorId: profB.id, turmaId },
      select: { id: true },
    });

    avaliacaoA = await prisma.avaliacao.findFirstOrThrow({
      where: { professorId: profA.id },
      select: { id: true },
    });
    avaliacaoB = await prisma.avaliacao.findFirstOrThrow({
      where: { professorId: profB.id },
      select: { id: true },
    });

    const tA = await login(profA.email);
    const tB = await login(profB.email);
    if (!tA || !tB) throw new Error('Login falhou');
    tokenA = tA;
    tokenB = tB;
  }, 30000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('professorA lança nota (valor 10)', async () => {
    const res = await request(app)
      .post('/notas/avaliacao/lote')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        avaliacaoId: avaliacaoA.id,
        notas: [{ alunoId, valor: 10 }],
      });
    expect(res.status).toBe(201);
  });

  it('professorB lança nota (valor 20)', async () => {
    const res = await request(app)
      .post('/notas/avaliacao/lote')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        avaliacaoId: avaliacaoB.id,
        notas: [{ alunoId, valor: 20 }],
      });
    expect(res.status).toBe(201);
  });

  it('buscar notas professorA - vê só sua nota (10)', async () => {
    const res = await request(app)
      .get('/notas/turma/alunos')
      .set('Authorization', `Bearer ${tokenA}`)
      .query({ turmaId, planoEnsinoId: planoA.id });
    expect(res.status).toBe(200);
    const rows = Array.isArray(res.body) ? res.body : res.body?.alunos ?? [];
    const row = rows.find((r: any) => (r.alunoId || r.aluno_id) === alunoId);
    expect(row).toBeDefined();
    const valor =
      row?.notas?.['1º Trimestre']?.valor ?? row?.notas?.['1° Trimestre']?.valor ?? row?.notas?.['P1']?.valor;
    expect(Number(valor)).toBe(10);
  });

  it('buscar notas professorB - vê só sua nota (20)', async () => {
    const res = await request(app)
      .get('/notas/turma/alunos')
      .set('Authorization', `Bearer ${tokenB}`)
      .query({ turmaId, planoEnsinoId: planoB.id });
    expect(res.status).toBe(200);
    const rows = Array.isArray(res.body) ? res.body : res.body?.alunos ?? [];
    const row = rows.find((r: any) => (r.alunoId || r.aluno_id) === alunoId);
    expect(row).toBeDefined();
    const valor =
      row?.notas?.['1º Trimestre']?.valor ?? row?.notas?.['1° Trimestre']?.valor ?? row?.notas?.['P1']?.valor;
    expect(Number(valor)).toBe(20);
  });

  it('validar valores diferentes - sem sobrescrita, sem conflito', async () => {
    const resA = await request(app)
      .get('/notas/turma/alunos')
      .set('Authorization', `Bearer ${tokenA}`)
      .query({ turmaId, planoEnsinoId: planoA.id });
    const resB = await request(app)
      .get('/notas/turma/alunos')
      .set('Authorization', `Bearer ${tokenB}`)
      .query({ turmaId, planoEnsinoId: planoB.id });

    const alunosA = Array.isArray(resA.body) ? resA.body : resA.body?.alunos ?? [];
    const alunosB = Array.isArray(resB.body) ? resB.body : resB.body?.alunos ?? [];
    const rowA = (alunosA as any[]).find((r: any) => (r.alunoId || r.aluno_id) === alunoId);
    const rowB = (alunosB as any[]).find((r: any) => (r.alunoId || r.aluno_id) === alunoId);

    const valorA =
      rowA?.notas?.['1º Trimestre']?.valor ?? rowA?.notas?.['1° Trimestre']?.valor ?? rowA?.notas?.['P1']?.valor;
    const valorB =
      rowB?.notas?.['1º Trimestre']?.valor ?? rowB?.notas?.['1° Trimestre']?.valor ?? rowB?.notas?.['P1']?.valor;

    expect(Number(valorA)).toBe(10);
    expect(Number(valorB)).toBe(20);
    expect(valorA).not.toBe(valorB);
  });

  it('banco: 2 notas distintas para o mesmo aluno (planos diferentes)', async () => {
    const notas = await prisma.nota.findMany({
      where: { alunoId },
      select: { valor: true, planoEnsinoId: true, professorId: true },
    });
    expect(notas.length).toBeGreaterThanOrEqual(2);
    const planos = new Set(notas.map((n) => n.planoEnsinoId));
    expect(planos.size).toBeGreaterThanOrEqual(2);
  });
});
