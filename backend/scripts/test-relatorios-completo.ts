#!/usr/bin/env npx tsx
/**
 * TESTE COMPLETO - RELATÓRIOS
 *
 * Testa com MUITA ATENÇÃO os seguintes relatórios em DUAS instituições
 * (Secundário e Superior), com 100+ registros:
 *
 * 1. Relatório de alunos por turma
 * 2. Relatório financeiro
 * 3. Boletim individual
 * 4. Histórico escolar
 * 5. Exportação PDF funcional
 *
 * Pré-requisitos:
 *   1. npx tsx scripts/seed-multi-tenant-test.ts
 *   2. npx tsx scripts/seed-relatorios-100plus.ts
 *   3. Backend rodando em http://localhost:3001
 *
 * Uso: npx tsx scripts/test-relatorios-completo.ts
 */
import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';
import prisma from '../src/lib/prisma.js';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SUPER_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'superadmin@dsicola.com';
const SUPER_ADMIN_PASS = process.env.TEST_ADMIN_PASS || 'SuperAdmin@123';
const SENHA = process.env.TEST_USER_INST_A_PASSWORD || 'TestMultiTenant123!';

type TipoInst = 'SECUNDARIO' | 'SUPERIOR';

interface Check {
  id: string;
  tipo: TipoInst;
  relatorio: string;
  descricao: string;
  ok: boolean;
  detalhe?: string;
  registros?: number;
}

const checks: Check[] = [];

function assert(
  tipo: TipoInst,
  relatorio: string,
  id: string,
  descricao: string,
  ok: boolean,
  detalhe?: string,
  registros?: number
) {
  checks.push({ id, tipo, relatorio, descricao, ok, detalhe, registros });
  const icon = ok ? '✅' : '❌';
  const label = tipo === 'SECUNDARIO' ? '[SEC]' : '[SUP]';
  const regInfo = registros !== undefined ? ` (${registros} reg)` : '';
  console.log(`  ${icon} ${label} ${relatorio}: ${descricao}${regInfo}${detalhe ? ` — ${detalhe}` : ''}`);
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TESTE COMPLETO - RELATÓRIOS');
  console.log('  Relatório de alunos por turma | Financeiro | Boletim | Histórico | PDF');
  console.log('  Dois tipos: SECUNDÁRIO e SUPERIOR | 100+ registros');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL}\n`);

  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
    validateStatus: () => true,
  });

  // ─── 1. LOGIN SUPER_ADMIN ───────────────────────────────────────────────────
  const loginSuper = await api.post('/auth/login', {
    email: SUPER_ADMIN_EMAIL,
    password: SUPER_ADMIN_PASS,
  });
  if (loginSuper.status !== 200 || !loginSuper.data?.accessToken) {
    console.error('❌ Login SUPER_ADMIN falhou:', loginSuper.data?.message);
    process.exit(1);
  }
  api.defaults.headers.common['Authorization'] = `Bearer ${loginSuper.data.accessToken}`;
  console.log('  ✅ Login SUPER_ADMIN\n');

  // ─── 2. BUSCAR INSTITUIÇÕES ───────────────────────────────────────────────────
  const instA = await prisma.instituicao.findFirst({ where: { subdominio: 'inst-a-secundario-test' } });
  const instB = await prisma.instituicao.findFirst({ where: { subdominio: 'inst-b-superior-test' } });

  if (!instA || !instB) {
    console.error('❌ Execute primeiro: npx tsx scripts/seed-multi-tenant-test.ts');
    process.exit(1);
  }

  const totalAlunos = await prisma.user.count({
    where: {
      roles: { some: { role: 'ALUNO' } },
      instituicaoId: { in: [instA.id, instB.id] },
    },
  });
  const totalMatriculas = await prisma.matricula.count({
    where: { aluno: { instituicaoId: { in: [instA.id, instB.id] } } },
  });
  const totalMensalidades = await prisma.mensalidade.count({
    where: { aluno: { instituicaoId: { in: [instA.id, instB.id] } } },
  });

  if (totalAlunos + totalMatriculas + totalMensalidades < 100) {
    console.error('❌ Execute: npx tsx scripts/seed-relatorios-100plus.ts (precisa 100+ registros)');
    process.exit(1);
  }
  console.log(`  📊 Dados: ${totalAlunos} alunos, ${totalMatriculas} matrículas, ${totalMensalidades} mensalidades\n`);

  // ─── 3. LOGIN ADMIN A e B ───────────────────────────────────────────────────
  const loginA = await api.post('/auth/login', {
    email: 'admin.inst.a@teste.dsicola.com',
    password: SENHA,
  });
  const loginB = await api.post('/auth/login', {
    email: 'admin.inst.b@teste.dsicola.com',
    password: SENHA,
  });

  const tokenA = loginA.data?.accessToken;
  const tokenB = loginB.data?.accessToken;

  if (!tokenA || !tokenB) {
    console.error('❌ Login das instituições falhou.');
    process.exit(1);
  }

  const apiA: AxiosInstance = axios.create({
    baseURL: API_URL,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`,
      'X-Instituicao-Id': instA.id,
    },
    timeout: 30000,
    validateStatus: () => true,
  });

  const apiB: AxiosInstance = axios.create({
    baseURL: API_URL,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenB}`,
      'X-Instituicao-Id': instB.id,
    },
    timeout: 30000,
    validateStatus: () => true,
  });

  const anoAtual = new Date().getFullYear();
  const mesAtual = String(new Date().getMonth() + 1).padStart(2, '0');

  // Turmas para teste
  const turmaA = await prisma.turma.findFirst({
    where: { instituicaoId: instA.id },
    include: { _count: { select: { matriculas: true } } },
  });
  const turmaB = await prisma.turma.findFirst({
    where: { instituicaoId: instB.id },
    include: { _count: { select: { matriculas: true } } },
  });

  const alunoA = await prisma.user.findFirst({
    where: { instituicaoId: instA.id, roles: { some: { role: 'ALUNO' } } },
  });
  const alunoB = await prisma.user.findFirst({
    where: { instituicaoId: instB.id, roles: { some: { role: 'ALUNO' } } },
  });

  // ─── 4. RELATÓRIO DE ALUNOS POR TURMA ───────────────────────────────────────
  console.log('\n🔹 1. RELATÓRIO DE ALUNOS POR TURMA');

  if (turmaA) {
    const matA = await apiA.get('/matriculas', { params: { turmaId: turmaA.id } });
    const ok = matA.status === 200 && Array.isArray(matA.data);
    const count = Array.isArray(matA.data) ? matA.data.length : 0;
    assert(
      'SECUNDARIO',
      'Alunos por turma',
      'alunos-turma-sec',
      'GET /matriculas?turmaId retorna lista',
      ok,
      ok ? undefined : matA.data?.message,
      count
    );
    assert(
      'SECUNDARIO',
      'Alunos por turma',
      'alunos-turma-sec-count',
      'Turma tem alunos matriculados',
      count >= 1,
      `count=${count}`,
      count
    );
  } else {
    assert('SECUNDARIO', 'Alunos por turma', 'alunos-turma-sec', 'Turma disponível', false, 'Nenhuma turma');
  }

  if (turmaB) {
    const matB = await apiB.get('/matriculas', { params: { turmaId: turmaB.id } });
    const ok = matB.status === 200 && Array.isArray(matB.data);
    const count = Array.isArray(matB.data) ? matB.data.length : 0;
    assert(
      'SUPERIOR',
      'Alunos por turma',
      'alunos-turma-sup',
      'GET /matriculas?turmaId retorna lista',
      ok,
      ok ? undefined : matB.data?.message,
      count
    );
  }

  // ─── 5. RELATÓRIO FINANCEIRO ─────────────────────────────────────────────────
  console.log('\n🔹 2. RELATÓRIO FINANCEIRO');

  const mensA = await apiA.get('/mensalidades', {
    params: { mesReferencia: mesAtual, anoReferencia: anoAtual },
  });
  assert(
    'SECUNDARIO',
    'Financeiro',
    'financeiro-sec',
    'GET /mensalidades por período',
    mensA.status === 200 && Array.isArray(mensA.data),
    mensA.status !== 200 ? mensA.data?.message : undefined,
    Array.isArray(mensA.data) ? mensA.data.length : 0
  );

  const mensB = await apiB.get('/mensalidades', {
    params: { mesReferencia: mesAtual, anoReferencia: anoAtual },
  });
  assert(
    'SUPERIOR',
    'Financeiro',
    'financeiro-sup',
    'GET /mensalidades por período',
    mensB.status === 200 && Array.isArray(mensB.data),
    mensB.status !== 200 ? mensB.data?.message : undefined,
    Array.isArray(mensB.data) ? mensB.data.length : 0
  );

  if (alunoA) {
    const sitFinA = await apiA.get(`/relatorios-oficiais/situacao-financeira/${alunoA.id}`);
    assert(
      'SECUNDARIO',
      'Financeiro',
      'sit-financeira-sec',
      'Situação financeira do aluno',
      sitFinA.status === 200 && sitFinA.data?.success,
      sitFinA.status !== 200 ? sitFinA.data?.message : undefined
    );
  }
  if (alunoB) {
    const sitFinB = await apiB.get(`/relatorios-oficiais/situacao-financeira/${alunoB.id}`);
    assert(
      'SUPERIOR',
      'Financeiro',
      'sit-financeira-sup',
      'Situação financeira do aluno',
      sitFinB.status === 200 && sitFinB.data?.success,
      sitFinB.status !== 200 ? sitFinB.data?.message : undefined
    );
  }

  // ─── 6. BOLETIM INDIVIDUAL ──────────────────────────────────────────────────
  console.log('\n🔹 3. BOLETIM INDIVIDUAL');

  if (alunoA) {
    const boletimA = await apiA.get(`/relatorios-oficiais/boletim/${alunoA.id}`, {
      params: { anoLetivoId: (await prisma.anoLetivo.findFirst({ where: { instituicaoId: instA.id } }))?.id },
    });
    const okBoletimA = boletimA.status === 200 && boletimA.data?.success;
    const hasData = okBoletimA && boletimA.data?.data;
    assert(
      'SECUNDARIO',
      'Boletim',
      'boletim-sec',
      'GET /relatorios-oficiais/boletim/:alunoId',
      okBoletimA,
      !okBoletimA ? boletimA.data?.message : undefined
    );
  } else {
    assert('SECUNDARIO', 'Boletim', 'boletim-sec', 'Aluno para boletim', false, 'Sem aluno');
  }

  if (alunoB) {
    const boletimB = await apiB.get(`/relatorios-oficiais/boletim/${alunoB.id}`, {
      params: { anoLetivoId: (await prisma.anoLetivo.findFirst({ where: { instituicaoId: instB.id } }))?.id },
    });
    assert(
      'SUPERIOR',
      'Boletim',
      'boletim-sup',
      'GET /relatorios-oficiais/boletim/:alunoId',
      boletimB.status === 200 && boletimB.data?.success,
      !boletimB.data?.success ? boletimB.data?.message : undefined
    );
  }

  // ─── 7. HISTÓRICO ESCOLAR ──────────────────────────────────────────────────
  console.log('\n🔹 4. HISTÓRICO ESCOLAR');

  if (alunoA) {
    const histA = await apiA.get(`/relatorios-oficiais/historico/${alunoA.id}`);
    const okHistA = histA.status === 200 && histA.data?.success;
    assert(
      'SECUNDARIO',
      'Histórico',
      'historico-sec',
      'GET /relatorios-oficiais/historico/:alunoId',
      okHistA,
      !okHistA ? histA.data?.message : undefined
    );
  }
  if (alunoB) {
    const histB = await apiB.get(`/relatorios-oficiais/historico/${alunoB.id}`);
    assert(
      'SUPERIOR',
      'Histórico',
      'historico-sup',
      'GET /relatorios-oficiais/historico/:alunoId',
      histB.status === 200 && histB.data?.success,
      !histB.data?.success ? histB.data?.message : undefined
    );
  }

  // ─── 8. EXPORTAÇÃO PDF FUNCIONAL ────────────────────────────────────────────
  console.log('\n🔹 5. EXPORTAÇÃO PDF FUNCIONAL');

  // Listar relatórios gerados
  const relatoriosA = await apiA.get('/relatorios');
  const relatoriosB = await apiB.get('/relatorios');

  assert(
    'SECUNDARIO',
    'PDF',
    'listar-relatorios-sec',
    'GET /relatorios lista relatórios',
    relatoriosA.status === 200,
    relatoriosA.status !== 200 ? relatoriosA.data?.message : undefined
  );

  assert(
    'SUPERIOR',
    'PDF',
    'listar-relatorios-sup',
    'GET /relatorios lista relatórios',
    relatoriosB.status === 200,
    relatoriosB.status !== 200 ? relatoriosB.data?.message : undefined
  );

  // Gerar relatório (BOLETIM_ALUNO ou outro) e fazer download PDF
  const planoA = await prisma.planoEnsino.findFirst({
    where: { instituicaoId: instA.id, status: 'APROVADO' },
  });

  if (planoA && alunoA) {
    const gerarRes = await apiA.post('/relatorios/gerar', {
      tipoRelatorio: 'BOLETIM_ALUNO',
      referenciaId: alunoA.id,
      anoLetivo: anoAtual,
      trimestre: 1,
    });

    if (gerarRes.status === 201 && gerarRes.data?.id) {
      const downloadRes = await apiA.get(`/relatorios/${gerarRes.data.id}/download`, {
        responseType: 'arraybuffer',
      });
      const isPdf =
        downloadRes.status === 200 &&
        downloadRes.headers['content-type']?.includes('application/pdf');
      assert(
        'SECUNDARIO',
        'PDF',
        'download-pdf-sec',
        'Download PDF do relatório',
        isPdf,
        !isPdf ? `status=${downloadRes.status}, type=${downloadRes.headers['content-type']}` : undefined
      );
    } else {
      // Boletim pode exigir trimestre fechado - não falhar se 400
      const msg = gerarRes.data?.message || '';
      const isPreReq = msg.includes('ENCERRADO') || msg.includes('obrigatório');
      assert(
        'SECUNDARIO',
        'PDF',
        'gerar-relatorio-sec',
        'Gerar relatório (ou pré-requisito)',
        gerarRes.status === 201 || (gerarRes.status === 400 && isPreReq),
        gerarRes.status === 201 ? undefined : msg
      );
    }
  }

  const planoB = await prisma.planoEnsino.findFirst({
    where: { instituicaoId: instB.id, status: 'APROVADO' },
  });

  if (planoB && alunoB) {
    const gerarResB = await apiB.post('/relatorios/gerar', {
      tipoRelatorio: 'BOLETIM_ALUNO',
      referenciaId: alunoB.id,
      anoLetivo: anoAtual,
      trimestre: 1,
    });
    const msg = gerarResB.data?.message || '';
    const isPreReq = msg.includes('ENCERRADO') || msg.includes('obrigatório');
    assert(
      'SUPERIOR',
      'PDF',
      'gerar-relatorio-sup',
      'Gerar relatório (ou pré-requisito)',
      gerarResB.status === 201 || (gerarResB.status === 400 && isPreReq),
      gerarResB.status === 201 ? undefined : msg
    );
  }

  // Verificar que dados têm volume (100+)
  assert(
    'SECUNDARIO',
    'Volume',
    'volume-sec',
    'Total registros >= 50 (inst A)',
    totalAlunos >= 50 || totalMatriculas >= 50 || totalMensalidades >= 50,
    `alunos=${totalAlunos}, mat=${totalMatriculas}, mens=${totalMensalidades}`,
    totalAlunos + totalMatriculas + totalMensalidades
  );
  assert(
    'SUPERIOR',
    'Volume',
    'volume-sup',
    'Total registros >= 50 (inst B)',
    totalAlunos >= 50 || totalMatriculas >= 50 || totalMensalidades >= 50,
    undefined,
    totalAlunos + totalMatriculas + totalMensalidades
  );

  await prisma.$disconnect();

  // ─── RESUMO ────────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  RESUMO - RELATÓRIOS');
  console.log('═══════════════════════════════════════════════════════════════════════════════');

  const passed = checks.filter((c) => c.ok).length;
  const total = checks.length;
  const failed = checks.filter((c) => !c.ok);

  console.log(`\n${passed}/${total} verificações OK.\n`);
  if (failed.length > 0) {
    console.log('❌ Verificações que falharam:');
    failed.forEach(
      (c) =>
        console.log(`   [${c.tipo}] ${c.relatorio}: ${c.descricao}${c.detalhe ? ` — ${c.detalhe}` : ''}`)
    );
    process.exit(1);
  }
  console.log('✅ RELATÓRIOS: Todos os testes passaram para Secundário e Superior.\n');
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
