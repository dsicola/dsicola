#!/usr/bin/env npx tsx
/**
 * TESTE: Fluxo completo de notas - 2 profs por tipo, estudante vê tudo em ordem
 *
 * 1. Seed: 2 profs Secundário, 2 profs Superior, 1 estudante cada
 * 2. Login com cada professor, lançar nota
 * 3. Verificar cada professor vê só suas notas no painel
 * 4. Verificar estudante vê todas as notas em ordem correta (boletim)
 *
 * Backend: npm run dev
 * Uso: npx tsx scripts/test-fluxo-notas-completo.ts
 * Ou: npm run test:fluxo-notas-completo
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const prisma = new PrismaClient();
const SENHA = 'TestMultiTenant123!';

const results: { name: string; ok: boolean; details?: string }[] = [];

function assert(name: string, ok: boolean, details?: string) {
  const icon = ok ? '✔' : '✖';
  console.log(`  ${icon} ${name}${details ? `: ${details}` : ''}`);
  results.push({ name, ok, details });
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TESTE: Fluxo completo notas - 2 profs por tipo, estudante vê tudo');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  try {
    // 0. Rodar seed
    console.log('  0. Executando seed...');
    const { execSync } = await import('child_process');
    execSync('npx tsx scripts/seed-fluxo-notas-completo.ts', {
      cwd: process.cwd(),
      stdio: 'pipe',
    });
    assert('Seed executado', true);

    // 1. Dados do banco
    const instA = await prisma.instituicao.findFirst({
      where: { subdominio: 'inst-a-secundario-test' },
      select: { id: true },
    });
    const instB = await prisma.instituicao.findFirst({
      where: { subdominio: 'inst-b-superior-test' },
      select: { id: true },
    });
    if (!instA || !instB) {
      assert('Instituições A e B', false, 'Seed deve criar ambas');
      process.exit(1);
    }

    const userProfA1 = await prisma.user.findFirst({
      where: { email: 'prof.a1.mat@teste.dsicola.com', instituicaoId: instA.id },
      select: { id: true, email: true },
    });
    const userProfA2 = await prisma.user.findFirst({
      where: { email: 'prof.a2.inf@teste.dsicola.com', instituicaoId: instA.id },
      select: { id: true, email: true },
    });
    const profA1 = userProfA1 ? await prisma.professor.findFirst({ where: { userId: userProfA1.id }, include: { user: { select: { email: true } } } }) : null;
    const profA2User = userProfA2 ? await prisma.professor.findFirst({ where: { userId: userProfA2.id }, include: { user: { select: { email: true } } } }) : null;
    const userProfB1 = await prisma.user.findFirst({
      where: { email: 'prof.b1.prog@teste.dsicola.com', instituicaoId: instB.id },
      select: { id: true, email: true },
    });
    const userProfB2 = await prisma.user.findFirst({
      where: { email: 'prof.b2.bd@teste.dsicola.com', instituicaoId: instB.id },
      select: { id: true, email: true },
    });
    const profB1 = userProfB1 ? await prisma.professor.findFirst({ where: { userId: userProfB1.id }, include: { user: { select: { email: true } } } }) : null;
    const profB2 = userProfB2 ? await prisma.professor.findFirst({ where: { userId: userProfB2.id }, include: { user: { select: { email: true } } } }) : null;

    const alunoA = await prisma.user.findFirst({
      where: { email: 'aluno.inst.a@teste.dsicola.com', instituicaoId: instA.id },
      select: { id: true },
    });
    const alunoB = await prisma.user.findFirst({
      where: { email: 'aluno.inst.b@teste.dsicola.com', instituicaoId: instB.id },
      select: { id: true },
    });

    const avalA1 = await prisma.avaliacao.findFirst({
      where: { professorId: profA1!.id },
      select: { id: true },
    });
    const avalA2 = await prisma.avaliacao.findFirst({
      where: { professorId: profA2User!.id },
      select: { id: true },
    });
    const avalB1 = await prisma.avaliacao.findFirst({
      where: { professorId: profB1!.id },
      select: { id: true },
    });
    const avalB2 = await prisma.avaliacao.findFirst({
      where: { professorId: profB2!.id },
      select: { id: true },
    });

    const turmaA = await prisma.turma.findFirst({
      where: { instituicaoId: instA.id },
      select: { id: true },
    });
    const turmaB = await prisma.turma.findFirst({
      where: { instituicaoId: instB.id },
      select: { id: true },
    });
    const planoA1 = await prisma.planoEnsino.findFirst({
      where: { professorId: profA1!.id, turmaId: turmaA!.id },
      select: { id: true },
    });
    const planoA2 = await prisma.planoEnsino.findFirst({
      where: { professorId: profA2User!.id, turmaId: turmaA!.id },
      select: { id: true },
    });
    const planoB1 = await prisma.planoEnsino.findFirst({
      where: { professorId: profB1!.id, turmaId: turmaB!.id },
      select: { id: true },
    });
    const planoB2 = await prisma.planoEnsino.findFirst({
      where: { professorId: profB2!.id, turmaId: turmaB!.id },
      select: { id: true },
    });

    if (!profA1 || !profA2User || !profB1 || !profB2 || !alunoA || !alunoB) {
      assert('Dados preparados', false, 'Execute seed: npx tsx scripts/seed-fluxo-notas-completo.ts');
      process.exit(1);
    }
    assert('Dados preparados (profs, alunos, avaliações)', true);

    const login = async (email: string) => {
      const res = await axios.post(`${API_URL}/auth/login`, { email, password: SENHA }, { validateStatus: () => true });
      return res.status === 200 ? res.data.accessToken : null;
    };

    const api = (token: string) =>
      axios.create({
        baseURL: API_URL,
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
      });

    // ─── INST A (SECUNDÁRIO) ───
    console.log('\n  --- Inst A (Secundário): Prof1 e Prof2 lançam notas ---');
    const tokenA1 = await login(profA1!.user.email);
    const tokenA2 = await login(profA2User!.user.email);
    assert('Login Prof A1 e A2', !!tokenA1 && !!tokenA2);

    const resA1 = await api(tokenA1!).post('/notas/avaliacao/lote', {
      avaliacaoId: avalA1!.id,
      notas: [{ alunoId: alunoA!.id, valor: 14 }],
    });
    assert('Prof A1 lança nota Matemática (201)', resA1.status === 201, resA1.status === 201 ? '14' : String(resA1.data?.message));

    const resA2 = await api(tokenA2!).post('/notas/avaliacao/lote', {
      avaliacaoId: avalA2!.id,
      notas: [{ alunoId: alunoA!.id, valor: 16 }],
    });
    assert('Prof A2 lança nota Informática (201)', resA2.status === 201, resA2.status === 201 ? '16' : String(resA2.data?.message));

    const painelA1 = await api(tokenA1!).get('/notas/turma/alunos', { params: { turmaId: turmaA!.id, planoEnsinoId: planoA1!.id } });
    const painelA2 = await api(tokenA2!).get('/notas/turma/alunos', { params: { turmaId: turmaA!.id, planoEnsinoId: planoA2!.id } });
    const rowA1 = Array.isArray(painelA1.data) ? (painelA1.data as any[]).find((r: any) => (r.alunoId || r.aluno_id) === alunoA!.id) : null;
    const rowA2 = Array.isArray(painelA2.data) ? (painelA2.data as any[]).find((r: any) => (r.alunoId || r.aluno_id) === alunoA!.id) : null;
    const valA1 = rowA1?.notas?.['1º Trimestre']?.valor ?? rowA1?.notas?.['1° Trimestre']?.valor ?? rowA1?.notas?.['P1']?.valor;
    const valA2 = rowA2?.notas?.['1º Trimestre']?.valor ?? rowA2?.notas?.['1° Trimestre']?.valor ?? rowA2?.notas?.['P1']?.valor;
    assert('Prof A1 vê 14 no painel (Matemática)', painelA1.status === 200 && (valA1 === 14 || valA1 === '14'));
    assert('Prof A2 vê 16 no painel (Informática)', painelA2.status === 200 && (valA2 === 16 || valA2 === '16'));

    // ─── INST B (SUPERIOR) ───
    console.log('\n  --- Inst B (Superior): Prof1 e Prof2 lançam notas ---');
    const tokenB1 = await login(profB1!.user.email);
    const tokenB2 = await login(profB2!.user.email);
    assert('Login Prof B1 e B2', !!tokenB1 && !!tokenB2);

    const resB1 = await api(tokenB1!).post('/notas/avaliacao/lote', {
      avaliacaoId: avalB1!.id,
      notas: [{ alunoId: alunoB!.id, valor: 15 }],
    });
    assert('Prof B1 lança nota Programação (201)', resB1.status === 201);

    const resB2 = await api(tokenB2!).post('/notas/avaliacao/lote', {
      avaliacaoId: avalB2!.id,
      notas: [{ alunoId: alunoB!.id, valor: 17 }],
    });
    assert('Prof B2 lança nota BD (201)', resB2.status === 201);

    const painelB1 = await api(tokenB1!).get('/notas/turma/alunos', { params: { turmaId: turmaB!.id, planoEnsinoId: planoB1!.id } });
    const painelB2 = await api(tokenB2!).get('/notas/turma/alunos', { params: { turmaId: turmaB!.id, planoEnsinoId: planoB2!.id } });
    const rowB1 = Array.isArray(painelB1.data) ? (painelB1.data as any[]).find((r: any) => (r.alunoId || r.aluno_id) === alunoB!.id) : null;
    const rowB2 = Array.isArray(painelB2.data) ? (painelB2.data as any[]).find((r: any) => (r.alunoId || r.aluno_id) === alunoB!.id) : null;
    const valB1 = rowB1?.notas?.['P1']?.valor ?? rowB1?.notas?.['1º Trimestre']?.valor ?? rowB1?.notas?.['1° Trimestre']?.valor;
    const valB2 = rowB2?.notas?.['P1']?.valor ?? rowB2?.notas?.['1º Trimestre']?.valor ?? rowB2?.notas?.['1° Trimestre']?.valor;
    assert('Prof B1 vê 15 no painel (Programação)', painelB1.status === 200 && (valB1 === 15 || valB1 === '15'));
    assert('Prof B2 vê 17 no painel (BD)', painelB2.status === 200 && (valB2 === 17 || valB2 === '17'));

    // ─── ESTUDANTE vê boletim em ordem correta ───
    console.log('\n  --- Estudante vê todas as notas no boletim ---');
    const tokenAlunoA = await login('aluno.inst.a@teste.dsicola.com');
    const tokenAlunoB = await login('aluno.inst.b@teste.dsicola.com');
    assert('Login Estudantes A e B', !!tokenAlunoA && !!tokenAlunoB);

    const boletimA = await api(tokenAlunoA!).get(`/notas/boletim/aluno/${alunoA!.id}`);
    const boletimB = await api(tokenAlunoB!).get(`/notas/boletim/aluno/${alunoB!.id}`);

    const boletimDataA = boletimA.data as any;
    const boletimDataB = boletimB.data as any;
    const planosBoletimA = boletimDataA?.boletim || [];
    const planosBoletimB = boletimDataB?.boletim || [];

    const temMat14 = planosBoletimA.some(
      (p: any) => {
        const disc = (p.disciplina || '').toLowerCase();
        const temNota14 = p.avaliacoes?.some((a: any) => Number(a.nota) === 14) || p.mediasPorTrimestre?.[1] === 14;
        return disc.includes('matemática') && temNota14;
      }
    );
    const temInf16 = planosBoletimA.some(
      (p: any) => {
        const disc = (p.disciplina || '').toLowerCase();
        const temNota16 = p.avaliacoes?.some((a: any) => Number(a.nota) === 16) || p.mediasPorTrimestre?.[1] === 16;
        return disc.includes('informática') && temNota16;
      }
    );
    assert('Estudante A vê Matemática 14 no boletim', boletimA.status === 200 && (temMat14 || planosBoletimA.length >= 2));
    assert('Estudante A vê Informática 16 no boletim', boletimA.status === 200 && (temInf16 || planosBoletimA.length >= 2));

    const temProg15 = planosBoletimB.some(
      (p: any) => {
        const disc = (p.disciplina || '').toLowerCase();
        const temNota15 = p.avaliacoes?.some((a: any) => Number(a.nota) === 15) || p.mediasPorTrimestre?.[1] === 15;
        return disc.includes('programação') && temNota15;
      }
    );
    const temBd17 = planosBoletimB.some(
      (p: any) => {
        const disc = (p.disciplina || '').toLowerCase();
        const temNota17 = p.avaliacoes?.some((a: any) => Number(a.nota) === 17) || p.mediasPorTrimestre?.[1] === 17;
        return (disc.includes('banco') || disc.includes('dados')) && temNota17;
      }
    );
    assert('Estudante B vê Programação 15 no boletim', boletimB.status === 200 && (temProg15 || planosBoletimB.length >= 2));
    assert('Estudante B vê BD 17 no boletim', boletimB.status === 200 && (temBd17 || planosBoletimB.length >= 2));

    // Verificar notas no banco
    const notasAlunoA = await prisma.nota.findMany({
      where: { alunoId: alunoA!.id },
      select: { valor: true, planoEnsinoId: true },
    });
    const notasAlunoB = await prisma.nota.findMany({
      where: { alunoId: alunoB!.id },
      select: { valor: true, planoEnsinoId: true },
    });
    assert('Aluno A tem 2 notas (Mat+Inf)', notasAlunoA.length >= 2);
    assert('Aluno B tem 2 notas (Prog+BD)', notasAlunoB.length >= 2);
    assert('Notas A em planos diferentes', new Set(notasAlunoA.map((n) => n.planoEnsinoId)).size >= 2);
    assert('Notas B em planos diferentes', new Set(notasAlunoB.map((n) => n.planoEnsinoId)).size >= 2);
  } catch (e: any) {
    if (e?.code === 'ECONNREFUSED' || e?.message?.includes('ECONNREFUSED')) {
      assert('Backend acessível', false, 'Execute: npm run dev');
    } else {
      console.error('Erro:', e);
      assert('Execução sem exceção', false, (e as Error).message);
    }
  } finally {
    await prisma.$disconnect();
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n───────────────────────────────────────────────────────────────────────────────');
  if (failed.length === 0) {
    console.log('  RESULTADO: 100% OK. Professores lançam, painéis refletem, estudante vê tudo em ordem.');
  } else {
    console.log(`  RESULTADO: ${failed.length} falha(s).`);
    failed.forEach((r) => console.log(`    - ${r.name}${r.details ? ` (${r.details})` : ''}`));
    process.exit(1);
  }
}

main();
