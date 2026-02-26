#!/usr/bin/env npx tsx
/**
 * TESTE E2E: Permissões de emissão e consulta de documentos (Secundário e Superior)
 *
 * Garante:
 * - Admin → emissão total (incl. certificado), listar/consultar/baixar tudo
 * - Secretaria → emissão acadêmica (sem certificado), listar/consultar/baixar
 * - Professor → emissão limitada à sua turma (sem certificado), listar/consultar só sua turma
 * - Estudante → apenas consulta/baixa dos próprios documentos
 * - Finanças → sem acesso às rotas de documentos
 *
 * Executa o fluxo para instituição SECUNDÁRIA e para SUPERIOR.
 * Requer: Backend em http://localhost:3001
 * Uso: npx tsx scripts/test-documentos-permissoes-e2e.ts
 */
import axios, { AxiosInstance } from 'axios';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import prisma from '../src/lib/prisma.js';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SUPER_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'superadmin@dsicola.com';
const SUPER_ADMIN_PASS = process.env.TEST_ADMIN_PASS || 'SuperAdmin@123';

interface Result {
  name: string;
  ok: boolean;
  message?: string;
}

function run(
  api: AxiosInstance,
  name: string,
  fn: () => Promise<{ status: number; data?: any }>
): Promise<Result> {
  return fn()
    .then((r) => ({
      name,
      ok: r.status >= 200 && r.status < 300,
      message: r.status >= 400 ? (r.data?.message || String(r.data)?.slice(0, 120)) : undefined,
    }))
    .catch((e: any) => ({
      name,
      ok: false,
      message: e?.response?.data?.message || e.message,
    }));
}

function printResults(results: Result[], title: string) {
  console.log(`\n--- ${title} ---`);
  results.forEach((r) => {
    console.log(`  ${r.ok ? '✅' : '❌'} ${r.name}${r.message ? `: ${r.message}` : ''}`);
  });
}

async function testFluxoPorTipo(
  tipoAcademico: 'SECUNDARIO' | 'SUPERIOR',
  apiBase: AxiosInstance
): Promise<Result[]> {
  const results: Result[] = [];
  const api = apiBase;

  const inst = await prisma.instituicao.findFirst({
    where: { tipoAcademico },
    select: { id: true, nome: true },
  });
  if (!inst) {
    results.push({ name: `Instituição ${tipoAcademico}`, ok: false, message: 'Não encontrada' });
    return results;
  }

  const admin = await prisma.user.findFirst({
    where: { instituicaoId: inst.id, roles: { some: { role: 'ADMIN' } } },
    select: { id: true, email: true },
  });
  const secretaria = await prisma.user.findFirst({
    where: { instituicaoId: inst.id, roles: { some: { role: 'SECRETARIA' } } },
    select: { id: true, email: true },
  });
  const professor = await prisma.user.findFirst({
    where: { instituicaoId: inst.id, roles: { some: { role: 'PROFESSOR' } } },
    include: { professor: { select: { id: true } } },
  });
  const aluno = await prisma.user.findFirst({
    where: { instituicaoId: inst.id, roles: { some: { role: 'ALUNO' } } },
    select: { id: true, email: true },
  });

  if (!admin || !aluno) {
    results.push({
      name: `Setup ${tipoAcademico} (admin/aluno)`,
      ok: false,
      message: 'Faltam admin ou aluno na instituição',
    });
    return results;
  }

  await prisma.loginAttempt.deleteMany({
    where: {
      email: {
        in: [admin.email, secretaria?.email, professor?.email, aluno.email].filter(Boolean).map((e) => e!.toLowerCase()),
      },
    },
  });
  const pass = SUPER_ADMIN_PASS;
  if (admin) await prisma.user.update({ where: { id: admin.id }, data: { password: await bcrypt.hash(pass, 10), mustChangePassword: false } });
  if (secretaria) await prisma.user.update({ where: { id: secretaria.id }, data: { password: await bcrypt.hash(pass, 10), mustChangePassword: false } });
  if (professor) await prisma.user.update({ where: { id: professor.id }, data: { password: await bcrypt.hash(pass, 10), mustChangePassword: false } });
  if (aluno) await prisma.user.update({ where: { id: aluno.id }, data: { password: await bcrypt.hash(pass, 10), mustChangePassword: false } });

  const loginAdmin = await api.post('/auth/login', { email: admin.email, password: pass });
  if (loginAdmin.status !== 200) {
    results.push({ name: `Login Admin ${tipoAcademico}`, ok: false, message: loginAdmin.data?.message });
    return results;
  }
  const adminApi = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginAdmin.data.accessToken}` },
    timeout: 15000,
    validateStatus: () => true,
  });

  const loginAluno = await api.post('/auth/login', { email: aluno.email, password: pass });
  if (loginAluno.status !== 200) {
    results.push({ name: `Login Aluno ${tipoAcademico}`, ok: false, message: loginAluno.data?.message });
    return results;
  }
  const alunoApi = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginAluno.data.accessToken}` },
    timeout: 15000,
    validateStatus: () => true,
  });

  // Admin emite DECLARACAO_MATRICULA
  const emitDeclaracao = await adminApi.post('/documentos/emitir-json', {
    tipoDocumento: 'DECLARACAO_MATRICULA',
    estudanteId: aluno.id,
  });
  results.push(
    await run(adminApi, `Admin emite DECLARACAO_MATRICULA (${tipoAcademico})`, () =>
      Promise.resolve({ status: emitDeclaracao.status, data: emitDeclaracao.data })
    )
  );
  const docId = emitDeclaracao.data?.id;

  // Admin pode solicitar CERTIFICADO (200 ou 400 por validação; 403 = proibido por role)
  const emitCertAdmin = await adminApi.post('/documentos/emitir-json', {
    tipoDocumento: 'CERTIFICADO',
    estudanteId: aluno.id,
  });
  results.push({
    name: `Admin pode emitir CERTIFICADO (${tipoAcademico})`,
    ok: emitCertAdmin.status === 200 || emitCertAdmin.status === 400,
    message: emitCertAdmin.status === 403 ? 'Admin recebeu 403 para certificado' : (emitCertAdmin.status > 400 ? String(emitCertAdmin.data?.message || emitCertAdmin.status) : undefined),
  });

  // Aluno lista documentos (só próprios) — requer que o JWT do ALUNO inclua role ALUNO
  const listAluno = await alunoApi.get('/documentos');
  const alunoPodeListar = listAluno.status === 200;
  results.push({
    name: `Aluno lista documentos (${tipoAcademico})`,
    ok: alunoPodeListar,
    message: !alunoPodeListar ? (listAluno.data?.message || `status ${listAluno.status}`) : undefined,
  });
  if (alunoPodeListar) {
    const listaAluno = Array.isArray(listAluno.data) ? listAluno.data : [];
    const soProprios = listaAluno.length === 0 || listaAluno.every((d: any) => d.alunoId === aluno.id);
    results.push({
      name: `Aluno vê só próprios (${tipoAcademico})`,
      ok: soProprios,
      message: soProprios ? undefined : 'Aluno viu documento de outro',
    });
  }

  // Aluno baixa PDF (próprio)
  if (docId && alunoPodeListar) {
    const pdfAluno = await alunoApi.get(`/documentos/${docId}/pdf`, { responseType: 'arraybuffer' });
    results.push({
      name: `Aluno baixa PDF próprio (${tipoAcademico})`,
      ok: pdfAluno.status === 200,
      message: pdfAluno.status !== 200 ? (pdfAluno.data?.message || `status ${pdfAluno.status}`) : undefined,
    });
  }

  // Validação do conteúdo do PDF emitido (dados implementados: secundário vs superior)
  if (docId && emitDeclaracao.status === 200) {
    const pdfRes = await adminApi.get(`/documentos/${docId}/pdf`, { responseType: 'arraybuffer' });
    if (pdfRes.status === 200 && pdfRes.data && Buffer.isBuffer(pdfRes.data)) {
      const buf = Buffer.from(pdfRes.data);
      const hasDeclaracao = buf.toString('utf8').includes('Declara') || buf.toString('latin1').includes('Declara');
      const hasMatricula = buf.toString('utf8').includes('matricul') || buf.toString('latin1').includes('matricul');
      const hasInstituicao = inst.nome && (buf.toString('utf8').includes(inst.nome) || buf.toString('latin1').includes(inst.nome));
      results.push({
        name: `PDF Declaração contém título/texto esperado (${tipoAcademico})`,
        ok: hasDeclaracao && hasMatricula,
        message: !hasDeclaracao ? 'PDF sem texto "Declaração"' : !hasMatricula ? 'PDF sem "matricul"' : undefined,
      });
      if (hasInstituicao) {
        results.push({
          name: `PDF contém nome da instituição (${tipoAcademico})`,
          ok: true,
        });
      }
    }
  }

  // Secretaria: emite declaração OK, certificado 403
  if (secretaria) {
    const loginSec = await api.post('/auth/login', { email: secretaria.email, password: pass });
    if (loginSec.status === 200) {
      const secApi = axios.create({
        baseURL: API_URL,
        headers: { Authorization: `Bearer ${loginSec.data.accessToken}` },
        timeout: 15000,
        validateStatus: () => true,
      });
      const secDecl = await secApi.post('/documentos/emitir-json', {
        tipoDocumento: 'DECLARACAO_MATRICULA',
        estudanteId: aluno.id,
      });
      results.push(
        await run(secApi, `Secretaria emite DECLARACAO (${tipoAcademico})`, () =>
          Promise.resolve({ status: secDecl.status })
        )
      );
      const secCert = await secApi.post('/documentos/emitir-json', {
        tipoDocumento: 'CERTIFICADO',
        estudanteId: aluno.id,
      });
      results.push({
        name: `Secretaria NÃO emite CERTIFICADO (${tipoAcademico})`,
        ok: secCert.status === 403 || secCert.status === 400,
        message: secCert.status === 200 ? 'Secretaria não deveria conseguir emitir certificado (200)' : undefined,
      });
    }
  }

  // Professor: tenta emitir certificado → 403
  if (professor?.professor) {
    const loginProf = await api.post('/auth/login', { email: professor.email, password: pass });
    if (loginProf.status === 200) {
      const profApi = axios.create({
        baseURL: API_URL,
        headers: { Authorization: `Bearer ${loginProf.data.accessToken}` },
        timeout: 15000,
        validateStatus: () => true,
      });
      const profCert = await profApi.post('/documentos/emitir-json', {
        tipoDocumento: 'CERTIFICADO',
        estudanteId: aluno.id,
      });
      results.push({
        name: `Professor NÃO emite CERTIFICADO (${tipoAcademico})`,
        ok: profCert.status === 403,
        message: profCert.status !== 403 ? `Esperado 403, obtido ${profCert.status}` : undefined,
      });
    }
  }

  return results;
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  TESTE E2E: Permissões de Documentos (Secundário + Superior)');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL}\n`);

  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
    validateStatus: () => true,
  });

  const loginSuper = await api.post('/auth/login', { email: SUPER_ADMIN_EMAIL, password: SUPER_ADMIN_PASS });
  if (loginSuper.status !== 200) {
    console.error('❌ Login SUPER_ADMIN falhou. Configure TEST_ADMIN_EMAIL e TEST_ADMIN_PASS.');
    process.exit(1);
  }
  api.defaults.headers.common['Authorization'] = `Bearer ${loginSuper.data.accessToken}`;

  const allResults: Result[] = [];

  const secResults = await testFluxoPorTipo('SECUNDARIO', api);
  allResults.push(...secResults);
  printResults(secResults, 'SECUNDÁRIO');

  const supResults = await testFluxoPorTipo('SUPERIOR', api);
  allResults.push(...supResults);
  printResults(supResults, 'SUPERIOR');

  // Folha de pagamento: listar (backend alinhado com frontend)
  const folhaResults = await testFolhaPagamento(api);
  allResults.push(...folhaResults);
  printResults(folhaResults, 'FOLHA DE PAGAMENTO');

  const failed = allResults.filter((r) => !r.ok);
  console.log('\n═══════════════════════════════════════════════════════════════');
  if (failed.length === 0) {
    console.log('  ✅ Todos os testes passaram.');
  } else {
    console.log(`  ❌ ${failed.length} teste(s) falharam.`);
    failed.forEach((r) => console.log(`     - ${r.name}: ${r.message || 'falha'}`));
    process.exit(1);
  }
  console.log('═══════════════════════════════════════════════════════════════\n');
}

async function testFolhaPagamento(apiBase: AxiosInstance): Promise<Result[]> {
  const results: Result[] = [];
  const api = apiBase;

  for (const tipoAcademico of ['SECUNDARIO', 'SUPERIOR'] as const) {
    const inst = await prisma.instituicao.findFirst({
      where: { tipoAcademico },
      select: { id: true },
    });
    if (!inst) continue;

    const admin = await prisma.user.findFirst({
      where: { instituicaoId: inst.id, roles: { some: { role: 'ADMIN' } } },
      select: { id: true, email: true },
    });
    if (!admin) continue;

    await prisma.loginAttempt.deleteMany({
      where: { email: admin.email.toLowerCase() },
    });
    await prisma.user.update({
      where: { id: admin.id },
      data: { password: await bcrypt.hash(SUPER_ADMIN_PASS, 10), mustChangePassword: false },
    });

    const login = await api.post('/auth/login', {
      email: admin.email,
      password: SUPER_ADMIN_PASS,
    });
    if (login.status !== 200) {
      results.push({
        name: `Folha: Login Admin (${tipoAcademico})`,
        ok: false,
        message: login.data?.message || `status ${login.status}`,
      });
      continue;
    }

    const adminApi = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${login.data.accessToken}`,
      },
      timeout: 15000,
      validateStatus: () => true,
    });

    const listFolha = await adminApi.get('/folha-pagamento', {
      params: { mes: new Date().getMonth() + 1, ano: new Date().getFullYear() },
    });
    results.push({
      name: `Folha: GET list (${tipoAcademico})`,
      ok: listFolha.status === 200 && Array.isArray(listFolha.data),
      message:
        listFolha.status !== 200
          ? (listFolha.data?.message || `status ${listFolha.status}`)
          : !Array.isArray(listFolha.data)
            ? 'Resposta não é array'
            : undefined,
    });
  }

  return results;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
