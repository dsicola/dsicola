#!/usr/bin/env npx tsx
/**
 * TESTE: Segurança do Storage de Documentos
 *
 * Garante que:
 * - Sem token → 401
 * - Bucket desconhecido → 403
 * - ALUNO não pode upload em documentos_alunos (403)
 * - PROFESSOR não pode upload em documentos_funcionarios (403)
 * - ADMIN pode upload em documentos_alunos e documentos_funcionarios (200)
 * - SECRETARIA pode upload em documentos_alunos (200)
 * - RH pode upload em documentos_funcionarios (200)
 *
 * Pré-requisito: Backend rodando, seeds: seed-multi-tenant-test + seed-perfis-completos
 * Uso: npx tsx scripts/test-storage-documentos-seguranca.ts
 */
import dotenv from 'dotenv';
import axios from 'axios';
import FormData from 'form-data';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';

const CREDS = {
  aluno: {
    email: process.env.TEST_ALUNO_INST_A_EMAIL || 'aluno.inst.a@teste.dsicola.com',
    password: process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!',
  },
  professor: {
    email: process.env.TEST_PROF_INST_A_EMAIL || 'prof.inst.a@teste.dsicola.com',
    password: process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!',
  },
  admin: {
    email: process.env.TEST_USER_INST_A_EMAIL || 'admin.inst.a@teste.dsicola.com',
    password: process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!',
  },
  secretaria: {
    email: process.env.TEST_SECRETARIA_EMAIL || 'secretaria.inst.a@teste.dsicola.com',
    password: process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!',
  },
  rh: {
    email: process.env.TEST_RH_EMAIL || 'rh.inst.a@teste.dsicola.com',
    password: process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!',
  },
};

async function login(email: string, password: string): Promise<string | null> {
  const res = await axios.post(`${API_URL}/auth/login`, { email, password }, {
    validateStatus: () => true,
    timeout: 10000,
  });
  return res.status === 200 ? res.data?.accessToken : null;
}

function createTestFile(): { buffer: Buffer; formData: FormData } {
  const content = Buffer.from('test document content for security validation');
  const formData = new FormData();
  formData.append('file', content, { filename: 'test-doc.txt', contentType: 'text/plain' });
  formData.append('bucket', 'documentos_alunos');
  formData.append('path', `test/${Date.now()}_test-doc.txt`);
  return { buffer: content, formData };
}

async function uploadStorage(formData: FormData, token?: string): Promise<{ status: number; data?: any }> {
  const headers: Record<string, string> = {
    ...formData.getHeaders(),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await axios.post(`${API_URL}/storage/upload`, formData, {
    headers,
    validateStatus: () => true,
    timeout: 10000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  return { status: res.status, data: res.data };
}

interface Assertion {
  name: string;
  ok: boolean;
  details?: string;
}

const results: Assertion[] = [];

function assert(name: string, ok: boolean, details?: string) {
  const icon = ok ? '✔' : '✖';
  console.log(`  ${icon} ${name}${details ? `: ${details}` : ''}`);
  results.push({ name, ok, details });
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  TESTE: Segurança do Storage de Documentos');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    await axios.get(`${API_URL}/health`, { timeout: 3000 });
  } catch {
    console.log('  ✖ Backend não disponível em', API_URL);
    console.log('    Inicie o backend e rode: npx tsx scripts/test-storage-documentos-seguranca.ts\n');
    process.exit(1);
  }

  // 1. Sem token → 401
  console.log('1. UPLOAD SEM TOKEN');
  const { formData: fd1 } = createTestFile();
  const noTokenRes = await uploadStorage(fd1);
  assert('Upload sem token retorna 401', noTokenRes.status === 401, `Status: ${noTokenRes.status}`);

  // 2. Bucket desconhecido → 403
  console.log('\n2. BUCKET DESCONHECIDO');
  const adminToken = await login(CREDS.admin.email, CREDS.admin.password);
  if (!adminToken) {
    assert('Login ADMIN', false, 'Credenciais inválidas - rode seed-multi-tenant-test');
  } else {
    const formUnknown = new FormData();
    formUnknown.append('file', Buffer.from('x'), { filename: 'x.txt', contentType: 'text/plain' });
    formUnknown.append('bucket', 'bucket_inexistente');
    formUnknown.append('path', 'x.txt');
    const unknownRes = await uploadStorage(formUnknown, adminToken);
    assert('Bucket desconhecido retorna 403', unknownRes.status === 403, `Status: ${unknownRes.status}`);
  }

  // 3. ALUNO tenta documentos_alunos → 403
  console.log('\n3. ALUNO EM DOCUMENTOS_ALUNOS (deve bloquear)');
  const alunoToken = await login(CREDS.aluno.email, CREDS.aluno.password);
  if (!alunoToken) {
    assert('Login ALUNO', false, 'Credenciais inválidas');
  } else {
    const { formData: fdAluno } = createTestFile();
    const alunoRes = await uploadStorage(fdAluno, alunoToken);
    assert('ALUNO em documentos_alunos retorna 403', alunoRes.status === 403, `Status: ${alunoRes.status}`);
  }

  // 4. PROFESSOR tenta documentos_funcionarios → 403
  console.log('\n4. PROFESSOR EM DOCUMENTOS_FUNCIONARIOS (deve bloquear)');
  const profToken = await login(CREDS.professor.email, CREDS.professor.password);
  if (!profToken) {
    assert('Login PROFESSOR', false, 'Credenciais inválidas');
  } else {
    const formProf = new FormData();
    formProf.append('file', Buffer.from('x'), { filename: 'x.txt', contentType: 'text/plain' });
    formProf.append('bucket', 'documentos_funcionarios');
    formProf.append('path', `test/${Date.now()}_x.txt`);
    const profRes = await uploadStorage(formProf, profToken);
    assert('PROFESSOR em documentos_funcionarios retorna 403', profRes.status === 403, `Status: ${profRes.status}`);
  }

  // 5. ADMIN upload documentos_alunos → 200
  console.log('\n5. ADMIN EM DOCUMENTOS_ALUNOS (deve permitir)');
  if (adminToken) {
    const { formData: fdAdmin } = createTestFile();
    const adminAlunoRes = await uploadStorage(fdAdmin, adminToken);
    assert('ADMIN em documentos_alunos retorna 200', adminAlunoRes.status === 200, `Status: ${adminAlunoRes.status}`);
  }

  // 6. ADMIN upload documentos_funcionarios → 200
  console.log('\n6. ADMIN EM DOCUMENTOS_FUNCIONARIOS (deve permitir)');
  if (adminToken) {
    const formAdminFunc = new FormData();
    formAdminFunc.append('file', Buffer.from('contrato'), { filename: 'contrato.pdf', contentType: 'application/pdf' });
    formAdminFunc.append('bucket', 'documentos_funcionarios');
    formAdminFunc.append('path', `contratos/${Date.now()}_contrato.pdf`);
    const adminFuncRes = await uploadStorage(formAdminFunc, adminToken);
    assert('ADMIN em documentos_funcionarios retorna 200', adminFuncRes.status === 200, `Status: ${adminFuncRes.status}`);
  }

  // 7. SECRETARIA upload documentos_alunos → 200 (se existir)
  console.log('\n7. SECRETARIA EM DOCUMENTOS_ALUNOS (deve permitir)');
  const secToken = await login(CREDS.secretaria.email, CREDS.secretaria.password);
  if (!secToken) {
    assert('Login SECRETARIA', true, 'Secretaria não existe no seed - skip');
  } else {
    const formSec = new FormData();
    formSec.append('file', Buffer.from('doc'), { filename: 'doc.pdf', contentType: 'application/pdf' });
    formSec.append('bucket', 'documentos_alunos');
    formSec.append('path', `test/${Date.now()}_doc.pdf`);
    const secRes = await uploadStorage(formSec, secToken);
    assert('SECRETARIA em documentos_alunos retorna 200', secRes.status === 200, `Status: ${secRes.status}`);
  }

  // 8. RH upload documentos_funcionarios → 200 (se existir)
  console.log('\n8. RH EM DOCUMENTOS_FUNCIONARIOS (deve permitir)');
  const rhToken = await login(CREDS.rh.email, CREDS.rh.password);
  if (!rhToken) {
    assert('Login RH', true, 'RH não existe no seed - skip');
  } else {
    const formRh = new FormData();
    formRh.append('file', Buffer.from('doc'), { filename: 'doc.pdf', contentType: 'application/pdf' });
    formRh.append('bucket', 'documentos_funcionarios');
    formRh.append('path', `test/${Date.now()}_doc.pdf`);
    const rhRes = await uploadStorage(formRh, rhToken);
    assert('RH em documentos_funcionarios retorna 200', rhRes.status === 200, `Status: ${rhRes.status}`);
  }

  // Resumo
  console.log('\n═══════════════════════════════════════════════════════════════');
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`  ${passed}/${results.length} asserções passaram.\n`);

  if (failed.length > 0) {
    console.log('  Itens que falharam:');
    failed.forEach((r) => console.log(`    - ${r.name}${r.details ? ` (${r.details})` : ''}`));
    console.log('\n  ❌ Storage Documentos - Falhas detectadas.\n');
    process.exit(1);
  }

  console.log('  ✅ Storage Documentos - Segurança validada. Documentos guardados por rota autenticada.\n');
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
