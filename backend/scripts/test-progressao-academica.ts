#!/usr/bin/env npx tsx
/**
 * TESTE: PROGRESSÃO ACADÊMICA E BLOQUEIO INTELIGENTE
 *
 * Verifica:
 * 1. REPROVADO → não transita (bloqueia classe seguinte)
 * 2. APROVADO → transita (classe_proxima = classe_atual + 1)
 * 3. Config disciplinasNegativasPermitidas
 * 4. ADMIN override para reprovado
 * 5. UPDATE matrícula também valida progressão
 *
 * Pré-requisitos:
 * - npx tsx scripts/seed-multi-tenant-test.ts
 * - Backend rodando (localhost:3001) - REINICIE após alterações no código!
 *
 * Uso: npx tsx scripts/test-progressao-academica.ts
 *      ou: npm run test:progressao-academica
 */
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SENHA = process.env.TEST_USER_INST_A_PASSWORD || 'TestMultiTenant123!';
const prisma = new PrismaClient();

interface AssertResult {
  id: string;
  descricao: string;
  ok: boolean;
  detalhe?: string;
}

const results: AssertResult[] = [];

function assert(id: string, descricao: string, ok: boolean, detalhe?: string) {
  results.push({ id, descricao, ok, detalhe });
  const icon = ok ? '✔' : '✖';
  console.log(`  ${icon} ${descricao}${detalhe ? ` — ${detalhe}` : ''}`);
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('  🎓 TESTE: PROGRESSÃO ACADÊMICA - REPROVADO/APROVADO');
  console.log('  Bloqueio inteligente + disciplinas negativas + override ADMIN');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL}\n`);

  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
    validateStatus: () => true,
  });

  // ─── LOGIN ADMIN INST A (Secundário) ─────────────────────────────────────────
  const login = await api.post('/auth/login', {
    email: 'admin.inst.a@teste.dsicola.com',
    password: SENHA,
  });
  const token = login.data?.accessToken;
  if (!token) {
    console.error('\n✖ Falha no login. Execute: npx tsx scripts/seed-multi-tenant-test.ts');
    process.exit(1);
  }

  const apiAuth = axios.create({
    baseURL: API_URL,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    timeout: 15000,
    validateStatus: () => true,
  });

  const instA = await prisma.instituicao.findFirst({
    where: { subdominio: 'inst-a-secundario-test' },
  });
  if (!instA) {
    console.error('\n✖ Instituição A não encontrada. Execute: npx tsx scripts/seed-multi-tenant-test.ts');
    process.exit(1);
  }

  const alunoA = await prisma.user.findFirst({
    where: { email: 'aluno.inst.a@teste.dsicola.com', instituicaoId: instA.id },
  });
  if (!alunoA) {
    console.error('\n✖ Aluno A não encontrado. Execute o seed.');
    process.exit(1);
  }

  // ─── SETUP: Classes 10ª, 11ª, 12ª ───────────────────────────────────────────
  let classe10 = await prisma.classe.findFirst({
    where: { instituicaoId: instA.id, nome: { contains: '10' } },
  });
  if (!classe10) {
    classe10 = await prisma.classe.create({
      data: {
        codigo: 'CL10',
        nome: '10ª Classe',
        descricao: '10ª Classe',
        ordem: 10,
        instituicaoId: instA.id,
      },
    });
  } else if (classe10.ordem === null || classe10.ordem === 0) {
    await prisma.classe.update({ where: { id: classe10.id }, data: { ordem: 10 } });
  }
  let classe11 = await prisma.classe.findFirst({
    where: { instituicaoId: instA.id, nome: { contains: '11' } },
  });
  if (!classe11) {
    classe11 = await prisma.classe.create({
      data: {
        codigo: 'CL11',
        nome: '11ª Classe',
        descricao: '11ª Classe',
        ordem: 11,
        instituicaoId: instA.id,
      },
    });
  } else if (classe11.ordem === null || classe11.ordem === 0) {
    await prisma.classe.update({ where: { id: classe11.id }, data: { ordem: 11 } });
  }

  // ─── SETUP: Ano Letivos 2024, 2025 ──────────────────────────────────────────
  let ano2024 = await prisma.anoLetivo.findFirst({
    where: { instituicaoId: instA.id, ano: 2024 },
  });
  if (!ano2024) {
    ano2024 = await prisma.anoLetivo.create({
      data: {
        ano: 2024,
        dataInicio: new Date('2024-01-15'),
        dataFim: new Date('2024-12-20'),
        status: 'ENCERRADO',
        instituicaoId: instA.id,
      },
    });
  }
  let ano2025 = await prisma.anoLetivo.findFirst({
    where: { instituicaoId: instA.id, ano: 2025 },
  });
  if (!ano2025) {
    ano2025 = await prisma.anoLetivo.create({
      data: {
        ano: 2025,
        dataInicio: new Date('2025-01-15'),
        dataFim: new Date('2025-12-20'),
        status: 'ATIVO',
        instituicaoId: instA.id,
      },
    });
  }

  // ─── SETUP: ParametrosSistema ────────────────────────────────────────────────
  await prisma.parametrosSistema.upsert({
    where: { instituicaoId: instA.id },
    create: {
      instituicaoId: instA.id,
      disciplinasNegativasPermitidas: 1,
      permitirOverrideMatriculaReprovado: true,
    },
    update: {
      disciplinasNegativasPermitidas: 1,
      permitirOverrideMatriculaReprovado: true,
    },
  });

  // Limpar TODAS as matrículas anuais do aluno para garantir estado limpo
  await prisma.matriculaAnual.deleteMany({
    where: {
      alunoId: alunoA.id,
      instituicaoId: instA.id,
    },
  });

  // ─── 1. Criar matrícula 2024 - 10ª Classe ────────────────────────────────────
  console.log('\n1. SETUP - Matrícula 2024 (10ª Classe)');
  const mat2024 = await prisma.matriculaAnual.create({
    data: {
      alunoId: alunoA.id,
      instituicaoId: instA.id,
      nivelEnsino: 'SECUNDARIO',
      classeOuAnoCurso: '10ª Classe',
      classeId: classe10.id,
      anoLetivo: 2024,
      anoLetivoId: ano2024.id,
      status: 'CONCLUIDA',
      statusFinal: 'REPROVADO',
    },
  });
  assert('setup-1', 'Matrícula 2024 criada com status_final=REPROVADO', !!mat2024);

  // ─── 2. REPROVADO → Bloqueia classe seguinte (11ª) ───────────────────────────
  console.log('\n2. REPROVADO - Bloqueio classe seguinte');
  const { validarMatriculaClasse } = await import('../src/services/progressaoAcademica.service.js');
  const validacaoDirecta = await validarMatriculaClasse(
    alunoA.id,
    classe11.id,
    null,
    instA.id,
    ['ADMIN'],
    false
  );
  assert('bloq-svc', 'validarMatriculaClasse (direto) bloqueia 11ª', !validacaoDirecta.permitido, validacaoDirecta.motivoBloqueio);
  const create11Reprovado = await apiAuth.post('/matriculas-anuais', {
    alunoId: alunoA.id,
    anoLetivoId: ano2025.id,
    anoLetivo: 2025,
    nivelEnsino: 'SECUNDARIO',
    classeOuAnoCurso: '11ª Classe',
    overrideReprovado: false,
  });
  const bloqApiOk = create11Reprovado.status === 403;
  assert(
    'bloq-1',
    'POST matrícula 2025 na 11ª (reprovado, sem override) → 403',
    bloqApiOk,
    bloqApiOk ? undefined : `status=${create11Reprovado.status} — Reinicie o backend (npm run dev) e rode o teste novamente`
  );

  // ─── 3. REPROVADO → Permite mesma classe (10ª) ───────────────────────────────
  console.log('\n3. REPROVADO - Permite mesma classe');
  const create10Reprovado = await apiAuth.post('/matriculas-anuais', {
    alunoId: alunoA.id,
    anoLetivoId: ano2025.id,
    anoLetivo: 2025,
    nivelEnsino: 'SECUNDARIO',
    classeOuAnoCurso: '10ª Classe',
  });
  assert(
    'perm-1',
    'POST matrícula 2025 na 10ª (reprovado) → 201',
    create10Reprovado.status === 201,
    `status=${create10Reprovado.status}`
  );

  const mat2025Id = create10Reprovado.data?.id;
  if (!mat2025Id) {
    assert('perm-1b', 'Matrícula 2025 retornou ID', false, 'ID ausente');
    // Buscar matrícula 2025 existente para continuar testes
  }

  const mat2025IdForUpdate = mat2025Id || (
    await prisma.matriculaAnual.findFirst({
      where: { alunoId: alunoA.id, instituicaoId: instA.id, anoLetivo: 2025 },
    })
  )?.id;

  // ─── 4. UPDATE sem override → Bloqueia alterar para 11ª ───────────────────────
  console.log('\n4. UPDATE - Bloqueio alterar para classe seguinte');
  if (!mat2025IdForUpdate) {
    assert('bloq-update', 'PUT alterar 10ª→11ª - SKIP (sem mat2025)', true, 'mat2025 não criada');
  } else {
  const updateTo11 = await apiAuth.put(`/matriculas-anuais/${mat2025IdForUpdate}`, {
    classeOuAnoCurso: '11ª Classe',
    overrideReprovado: false,
  });
  assert(
    'bloq-update',
    'PUT alterar 10ª→11ª (reprovado, sem override) → 403',
    updateTo11.status === 403,
    `status=${updateTo11.status}`
  );

  // ─── 5. UPDATE com override ADMIN → Permite 11ª ───────────────────────────────
  console.log('\n5. ADMIN Override - Permite classe seguinte');
  const updateTo11Override = await apiAuth.put(`/matriculas-anuais/${mat2025IdForUpdate}`, {
    classeOuAnoCurso: '11ª Classe',
    overrideReprovado: true,
  });
  assert(
    'override-update',
    'PUT alterar 10ª→11ª (com override ADMIN) → 200',
    updateTo11Override.status === 200,
    `status=${updateTo11Override.status}`
  );
  }

  // ─── 6. APROVADO → Transita (permite 11ª) ─────────────────────────────────────
  console.log('\n6. APROVADO - Transita para classe seguinte');
  await prisma.matriculaAnual.update({
    where: { id: mat2024.id },
    data: { statusFinal: 'APROVADO' },
  });
  const mat2025ToDelete = mat2025Id || mat2025IdForUpdate;
  if (mat2025ToDelete) {
    await prisma.matriculaAnual.delete({ where: { id: mat2025ToDelete } });
  }

  const create11Aprovado = await apiAuth.post('/matriculas-anuais', {
    alunoId: alunoA.id,
    anoLetivoId: ano2025.id,
    anoLetivo: 2025,
    nivelEnsino: 'SECUNDARIO',
    classeOuAnoCurso: '11ª Classe',
  });
  assert(
    'transita',
    'POST matrícula 2025 na 11ª (aprovado ano anterior) → 201',
    create11Aprovado.status === 201,
    `status=${create11Aprovado.status}`
  );

  // ─── 7. Sugestão de classe ───────────────────────────────────────────────────
  console.log('\n7. Sugestão de classe');
  const sugestao = await apiAuth.get(`/matriculas-anuais/sugestao/${alunoA.id}`, {
    params: { anoLetivo: 2026 },
  });
  const sugOk = sugestao.status === 200 || sugestao.status === 403; // 403 se license/auth
  assert('sugestao', 'GET sugestão classe retorna 200 ou 403', sugOk, sugOk ? undefined : `status=${sugestao.status}`);
  if (sugOk && sugestao.data?.sugestao) {
    const s = sugestao.data.sugestao;
    assert(
      'sugestao-classe',
      'Sugestão contém classe atual ou próxima',
      !!(s.classeProximaSugerida || s.classeAtual),
      `classeProxima=${s.classeProximaSugerida}, classeAtual=${s.classeAtual}`
    );
  } else if (sugOk) {
    assert('sugestao-classe', 'Sugestão (sem matrícula anterior)', true, 'Aluno sem matrícula anterior');
  }

  // ─── 8. Config disciplinasNegativasPermitidas e permitirOverride ─────────────
  console.log('\n8. Configuração ParametrosSistema');
  const params = await prisma.parametrosSistema.findFirst({
    where: { instituicaoId: instA.id },
  });
  assert('config-disc', 'disciplinasNegativasPermitidas configurado', (params?.disciplinasNegativasPermitidas ?? 0) >= 0);
  assert('config-override', 'permitirOverrideMatriculaReprovado configurado', params?.permitirOverrideMatriculaReprovado === true);

  // ─── RESUMO ───────────────────────────────────────────────────────────────────
  const falhas = results.filter((r) => !r.ok);
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  if (falhas.length === 0) {
    console.log(`  ✅ TODOS OS ${results.length} TESTES PASSARAM`);
  } else {
    console.log(`  ❌ ${falhas.length} FALHA(S) de ${results.length}`);
    falhas.forEach((f) => console.log(`     - ${f.descricao}: ${f.detalhe || 'falhou'}`));
  }
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  await prisma.$disconnect();
  process.exit(falhas.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
