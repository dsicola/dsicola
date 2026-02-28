/**
 * Teste: Isolamento entre professores na mesma turma
 *
 * CENÁRIO:
 * - 2 professores na mesma turma (João e Maria)
 * - Cada um lança nota para o mesmo estudante
 * - Notas devem ser independentes
 *
 * EXPECT:
 * - Sem sobrescrita
 * - Sem conflito
 * - Professor A vê só suas notas
 * - Professor B vê só suas notas
 * - Valores diferentes quando buscados separadamente
 *
 * Pré-requisito: Backend a correr (npm run dev)
 * Uso: npm run test -- src/__tests__/notas-isolamento-professores.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SENHA = 'TestMultiTenant123!';
const prisma = new PrismaClient();

const api = (token: string) =>
  axios.create({
    baseURL: API_URL,
    headers: { Authorization: `Bearer ${token}` },
    validateStatus: () => true,
  });

async function login(email: string): Promise<string | null> {
  const res = await axios.post(`${API_URL}/auth/login`, { email, password: SENHA }, { validateStatus: () => true });
  return res.status === 200 ? res.data.accessToken : null;
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
    // Verificar se backend está acessível
    try {
      await axios.get(`${API_URL}/health`, { timeout: 2000, validateStatus: () => true });
    } catch {
      console.warn('Backend não acessível. Execute: npm run dev');
    }

    // Seed (cwd = backend root ao correr vitest)
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
    const res = await api(tokenA!).post('/notas/avaliacao/lote', {
      avaliacaoId: avaliacaoA.id,
      notas: [{ alunoId, valor: 10 }],
    });
    expect(res.status).toBe(201);
  });

  it('professorB lança nota (valor 20)', async () => {
    const res = await api(tokenB!).post('/notas/avaliacao/lote', {
      avaliacaoId: avaliacaoB.id,
      notas: [{ alunoId, valor: 20 }],
    });
    expect(res.status).toBe(201);
  });

  it('buscar notas professorA - vê só sua nota (10)', async () => {
    const res = await api(tokenA!).get('/notas/turma/alunos', {
      params: { turmaId, planoEnsinoId: planoA.id },
    });
    expect(res.status).toBe(200);
    const rows = Array.isArray(res.data) ? res.data : [];
    const row = rows.find((r: any) => (r.alunoId || r.aluno_id) === alunoId);
    expect(row).toBeDefined();
    const valor = row?.notas?.['1º Trimestre']?.valor ?? row?.notas?.['1° Trimestre']?.valor ?? row?.notas?.['P1']?.valor;
    expect(Number(valor)).toBe(10);
  });

  it('buscar notas professorB - vê só sua nota (20)', async () => {
    const res = await api(tokenB!).get('/notas/turma/alunos', {
      params: { turmaId, planoEnsinoId: planoB.id },
    });
    expect(res.status).toBe(200);
    const rows = Array.isArray(res.data) ? res.data : [];
    const row = rows.find((r: any) => (r.alunoId || r.aluno_id) === alunoId);
    expect(row).toBeDefined();
    const valor = row?.notas?.['1º Trimestre']?.valor ?? row?.notas?.['1° Trimestre']?.valor ?? row?.notas?.['P1']?.valor;
    expect(Number(valor)).toBe(20);
  });

  it('validar valores diferentes - sem sobrescrita, sem conflito', async () => {
    const resA = await api(tokenA!).get('/notas/turma/alunos', {
      params: { turmaId, planoEnsinoId: planoA.id },
    });
    const resB = await api(tokenB!).get('/notas/turma/alunos', {
      params: { turmaId, planoEnsinoId: planoB.id },
    });

    const rowA = (Array.isArray(resA.data) ? resA.data : []).find((r: any) => (r.alunoId || r.aluno_id) === alunoId);
    const rowB = (Array.isArray(resB.data) ? resB.data : []).find((r: any) => (r.alunoId || r.aluno_id) === alunoId);

    const valorA = rowA?.notas?.['1º Trimestre']?.valor ?? rowA?.notas?.['1° Trimestre']?.valor ?? rowA?.notas?.['P1']?.valor;
    const valorB = rowB?.notas?.['1º Trimestre']?.valor ?? rowB?.notas?.['1° Trimestre']?.valor ?? rowB?.notas?.['P1']?.valor;

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
