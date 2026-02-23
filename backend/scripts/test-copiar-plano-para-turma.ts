#!/usr/bin/env npx tsx
/**
 * TESTE: Fluxo completo "Copiar plano para outra turma"
 *
 * Valida:
 * 1. Criar plano com turma A (aulas + bibliografia)
 * 2. POST copiar-para-turma para turma B (mesmo ano/curso/classe) → 201
 * 3. Novo plano tem turmaId = turma B, mesmos dados pedagógicos
 * 4. Aulas e bibliografias copiadas
 * 5. Copiar para mesma turma → 400
 * 6. Copiar quando já existe plano para prof+disciplina+turmaB → 400
 *
 * Requer: Backend rodando, seed-multi-tenant-test executado
 * Uso: npx tsx scripts/test-copiar-plano-para-turma.ts
 */
import 'dotenv/config';
import axios, { AxiosInstance } from 'axios';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = process.env.API_URL || 'http://localhost:3001';
const SENHA = process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!';

function criarApi(): AxiosInstance {
  return axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
    validateStatus: () => true,
  });
}

async function login(api: AxiosInstance, email: string, password: string = SENHA): Promise<boolean> {
  try {
    const res = await api.post('/auth/login', { email, password });
    if (res.status !== 200 || !res.data?.accessToken) return false;
    api.defaults.headers.common['Authorization'] = `Bearer ${res.data.accessToken}`;
    return true;
  } catch (e: any) {
    if (e?.code === 'ECONNREFUSED' || e?.message?.includes('connect')) {
      throw new Error(`Backend não está rodando em ${API_URL}. Inicie com: npm run dev`);
    }
    throw e;
  }
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  TESTE: Fluxo Copiar Plano para Outra Turma');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Buscar Inst A (secundário para ter curso+classe)
  const instA = await prisma.instituicao.findFirst({
    where: { subdominio: 'inst-a-secundario-test' },
    include: {
      anosLetivos: { take: 1, orderBy: { ano: 'desc' } },
    },
  });

  if (!instA) {
    console.error('   ❌ Execute: npx tsx scripts/seed-multi-tenant-test.ts');
    process.exit(1);
  }

  const admin = await prisma.user.findFirst({
    where: {
      instituicaoId: instA.id,
      roles: { some: { role: 'ADMIN' } },
    },
  });
  const prof = await prisma.user.findFirst({
    where: {
      instituicaoId: instA.id,
      roles: { some: { role: 'PROFESSOR' } },
    },
  });
  const anoLetivo = instA.anosLetivos[0];

  if (!admin || !prof || !anoLetivo) {
    console.error('   ❌ Admin, Professor ou Ano Letivo não encontrados.');
    process.exit(1);
  }

  let professorEnt = await prisma.professor.findFirst({
    where: { userId: prof.id, instituicaoId: instA.id },
  });
  if (!professorEnt) {
    professorEnt = await prisma.professor.create({
      data: { userId: prof.id, instituicaoId: instA.id },
    });
  }

  const hash = await bcrypt.hash(SENHA, 10);
  await prisma.user.updateMany({
    where: { id: { in: [admin.id, prof.id] } },
    data: { password: hash, mustChangePassword: false },
  });
  await prisma.loginAttempt.deleteMany({
    where: { email: { in: [admin.email!, prof.email!].map((e) => e?.toLowerCase()) } },
  });

  const curso = await prisma.curso.findFirst({ where: { instituicaoId: instA.id } });
  const classe = await prisma.classe.findFirst({ where: { instituicaoId: instA.id } });
  const disciplina = await prisma.disciplina.findFirst({ where: { instituicaoId: instA.id } });
  const turno = await prisma.turno.findFirst({ where: { instituicaoId: instA.id } });
  if (!curso || !classe || !disciplina || !turno) {
    console.error('   ❌ Curso, classe, disciplina ou turno não encontrados. Execute seed-multi-tenant.');
    process.exit(1);
  }

  // Criar duas turmas compatíveis (mesmo ano, curso, classe)
  let turmaA = await prisma.turma.findFirst({
    where: {
      instituicaoId: instA.id,
      anoLetivoId: anoLetivo.id,
      cursoId: curso.id,
      classeId: classe.id,
      nome: 'Turma A Copiar Test',
    },
  });
  if (!turmaA) {
    turmaA = await prisma.turma.create({
      data: {
        instituicaoId: instA.id,
        anoLetivoId: anoLetivo.id,
        nome: 'Turma A Copiar Test',
        cursoId: curso.id,
        classeId: classe.id,
        turnoId: turno.id,
        capacidade: 30,
      },
    });
  }

  let turmaB = await prisma.turma.findFirst({
    where: {
      instituicaoId: instA.id,
      anoLetivoId: anoLetivo.id,
      cursoId: curso.id,
      classeId: classe.id,
      nome: 'Turma B Copiar Test',
    },
  });
  if (!turmaB) {
    turmaB = await prisma.turma.create({
      data: {
        instituicaoId: instA.id,
        anoLetivoId: anoLetivo.id,
        nome: 'Turma B Copiar Test',
        cursoId: curso.id,
        classeId: classe.id,
        turnoId: turno.id,
        capacidade: 30,
      },
    });
  }

  const apiAdmin = criarApi();
  if (!(await login(apiAdmin, admin.email!))) {
    console.error('   ❌ Login admin falhou');
    process.exit(1);
  }

  const results: { name: string; ok: boolean; message?: string }[] = [];

  // ─── 1. Criar plano na turma A (via API ou Prisma direto)
  let planoOriginal = await prisma.planoEnsino.findFirst({
    where: {
      turmaId: turmaA.id,
      anoLetivoId: anoLetivo.id,
      professorId: professorEnt.id,
      disciplinaId: disciplina.id,
      instituicaoId: instA.id,
    },
    include: { aulas: true, bibliografias: true },
  });

  if (!planoOriginal) {
    planoOriginal = await prisma.planoEnsino.create({
      data: {
        turmaId: turmaA.id,
        anoLetivoId: anoLetivo.id,
        anoLetivo: anoLetivo.ano,
        professorId: professorEnt.id,
        disciplinaId: disciplina.id,
        cursoId: curso.id,
        classeId: classe.id,
        classeOuAno: classe.nome,
        instituicaoId: instA.id,
        metodologia: 'Metodologia teste copiar',
        objetivos: 'Objetivos teste',
        conteudoProgramatico: 'Conteúdo teste',
        criteriosAvaliacao: 'Provas',
        ementa: 'Ementa teste',
      },
      include: { aulas: true, bibliografias: true },
    });
  }

  // Garantir pelo menos 1 aula e 1 bibliografia
  if (planoOriginal.aulas.length === 0) {
    await prisma.planoAula.create({
      data: {
        planoEnsinoId: planoOriginal.id,
        ordem: 1,
        titulo: 'Aula 1 teste',
        descricao: 'Descrição aula 1',
        tipo: 'TEORICA',
        trimestre: 1,
        quantidadeAulas: 2,
      },
    });
    planoOriginal = await prisma.planoEnsino.findUniqueOrThrow({
      where: { id: planoOriginal.id },
      include: { aulas: true, bibliografias: true },
    });
  }
  if (planoOriginal.bibliografias.length === 0) {
    await prisma.bibliografiaPlano.create({
      data: {
        planoEnsinoId: planoOriginal.id,
        titulo: 'Livro teste',
        autor: 'Autor teste',
        tipo: 'BIBLIOGRAFIA_BASICA',
      },
    });
    planoOriginal = await prisma.planoEnsino.findUniqueOrThrow({
      where: { id: planoOriginal.id },
      include: { aulas: true, bibliografias: true },
    });
  }

  results.push({
    name: 'Plano original existe com aula(s) e bibliografia(s)',
    ok: planoOriginal.aulas.length >= 1 && planoOriginal.bibliografias.length >= 1,
  });

  // ─── 2. Copiar para turma B (via API)
  console.log('2. POST copiar-para-turma (turma B)...');
  const copiarRes = await apiAdmin.post(`/plano-ensino/${planoOriginal.id}/copiar-para-turma`, {
    novaTurmaId: turmaB.id,
  });

  results.push({
    name: 'Copiar para turma B retorna 201',
    ok: copiarRes.status === 201,
    message: copiarRes.status !== 201 ? copiarRes.data?.message : undefined,
  });

  if (copiarRes.status !== 201) {
    console.error('   Resposta:', JSON.stringify(copiarRes.data, null, 2));
    printResults(results);
    process.exit(1);
  }

  const novoPlano = copiarRes.data;

  results.push({
    name: 'Novo plano tem turmaId = turma B',
    ok: novoPlano.turmaId === turmaB.id,
  });
  results.push({
    name: 'Novo plano tem mesmo professor',
    ok: novoPlano.professorId === planoOriginal.professorId,
  });
  results.push({
    name: 'Novo plano tem mesma disciplina',
    ok: novoPlano.disciplinaId === planoOriginal.disciplinaId,
  });
  results.push({
    name: 'Novo plano tem metodologia copiada',
    ok: novoPlano.metodologia === planoOriginal.metodologia,
  });
  results.push({
    name: 'Novo plano tem aulas copiadas',
    ok:
      Array.isArray(novoPlano.aulas) &&
      novoPlano.aulas.length === planoOriginal.aulas.length,
  });
  results.push({
    name: 'Novo plano tem bibliografias copiadas',
    ok:
      Array.isArray(novoPlano.bibliografias) &&
      novoPlano.bibliografias.length === planoOriginal.bibliografias.length,
  });

  // Verificar no banco
  const novoPlanoDb = await prisma.planoEnsino.findFirst({
    where: { id: novoPlano.id, instituicaoId: instA.id },
    include: { aulas: true, bibliografias: true },
  });
  results.push({
    name: 'Novo plano no banco com turma correta',
    ok: novoPlanoDb?.turmaId === turmaB.id,
  });
  results.push({
    name: 'Aulas no banco com plano novo',
    ok: novoPlanoDb && novoPlanoDb.aulas.every((a) => a.planoEnsinoId === novoPlano.id),
  });

  // ─── 3. Copiar para mesma turma → 400
  console.log('3. Copiar para mesma turma (esperado: 400)...');
  const mesmaTurmaRes = await apiAdmin.post(
    `/plano-ensino/${planoOriginal.id}/copiar-para-turma`,
    { novaTurmaId: turmaA.id }
  );
  results.push({
    name: 'Copiar para mesma turma retorna 400',
    ok: mesmaTurmaRes.status === 400,
    message: mesmaTurmaRes.status !== 400 ? mesmaTurmaRes.data?.message : undefined,
  });

  // ─── 4. Copiar novamente para turma B (já existe plano) → 400
  console.log('4. Copiar novamente para turma B (já existe plano, esperado: 400)...');
  const duplicadoRes = await apiAdmin.post(
    `/plano-ensino/${planoOriginal.id}/copiar-para-turma`,
    { novaTurmaId: turmaB.id }
  );
  results.push({
    name: 'Copiar quando já existe plano retorna 400',
    ok: duplicadoRes.status === 400,
    message: duplicadoRes.status !== 400 ? duplicadoRes.data?.message : undefined,
  });

  await prisma.$disconnect();

  printResults(results);
  const falhas = results.filter((r) => !r.ok);
  if (falhas.length > 0) {
    process.exit(1);
  }
  console.log('\n✅ TESTE PASSOU: Fluxo Copiar Plano para Outra Turma.\n');
}

function printResults(results: { name: string; ok: boolean; message?: string }[]) {
  console.log('\n--- RESULTADOS ---');
  for (const r of results) {
    const icon = r.ok ? '✅' : '❌';
    console.log(`  ${icon} ${r.name}${r.message ? `: ${r.message}` : ''}`);
  }
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
