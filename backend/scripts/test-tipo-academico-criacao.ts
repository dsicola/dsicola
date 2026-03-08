#!/usr/bin/env npx tsx
/**
 * TESTE: Tipo Acadêmico na Criação de Instituições (Super Admin)
 *
 * Valida que ao criar instituições via POST /instituicoes (superadmin/comercial):
 * - tipoAcademico é obrigatório
 * - 2 instituições SUPERIOR e 2 SECUNDARIO são criadas com tipo correto
 * - Todas carregam tipoAcademico e tipoInstituicao automaticamente no GET
 *
 * Uso: npx tsx scripts/test-tipo-academico-criacao.ts
 *      API_URL=http://localhost:3001 npx tsx scripts/test-tipo-academico-criacao.ts
 */
import axios from 'axios';
import 'dotenv/config';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'superadmin@dsicola.com';
const SUPER_ADMIN_PASS = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';

const TS = Date.now();

function createApi(token?: string) {
  return axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    timeout: 15000,
    validateStatus: () => true,
  });
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  📋 TESTE: Tipo Acadêmico na Criação (Super Admin)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const api = createApi();

  // 1. Login SUPER_ADMIN
  const loginRes = await api.post('/auth/login', { email: SUPER_ADMIN_EMAIL, password: SUPER_ADMIN_PASS });
  if (loginRes.status === 403 && loginRes.data?.message === 'MUST_CHANGE_PASSWORD') {
    console.error('✖ Super Admin precisa trocar senha. Execute: npm run db:seed');
    process.exit(1);
  }
  if (loginRes.status !== 200 || !loginRes.data?.accessToken) {
    console.error('✖ Login SUPER_ADMIN falhou:', loginRes.data?.message);
    process.exit(1);
  }
  const apiSuper = createApi(loginRes.data.accessToken);
  console.log('✓ Login SUPER_ADMIN');

  // 2. Tentar criar SEM tipoAcademico (deve falhar)
  console.log('\n2. Criar instituição SEM tipoAcademico (deve retornar 400)...');
  const semTipoRes = await apiSuper.post('/instituicoes', {
    nome: 'Inst Sem Tipo',
    subdominio: `sem-tipo-${TS}`,
  });
  if (semTipoRes.status !== 400) {
    console.error('✖ Esperado 400 ao criar sem tipoAcademico. Recebido:', semTipoRes.status);
    process.exit(1);
  }
  console.log('✓ Corretamente rejeitado (400)');

  // 3. Criar 2 SUPERIOR
  const idsSuperior: string[] = [];
  for (let i = 1; i <= 2; i++) {
    const sub = `sup-test-${TS}-${i}`;
    const res = await apiSuper.post('/instituicoes', {
      nome: `Inst Superior Teste ${i}`,
      subdominio: sub,
      tipoAcademico: 'SUPERIOR',
    });
    if (res.status !== 201 || !res.data?.id) {
      console.error(`✖ Falha ao criar instituição SUPERIOR ${i}:`, res.data?.message || res.status);
      process.exit(1);
    }
    idsSuperior.push(res.data.id);
    const ta = res.data.tipoAcademico ?? res.data.tipo_academico;
    const ti = res.data.tipoInstituicao ?? res.data.tipo_instituicao;
    if (ta !== 'SUPERIOR' || ti !== 'UNIVERSIDADE') {
      console.error(`✖ Instituição SUPERIOR ${i} criada com tipo incorreto: tipoAcademico=${ta}, tipoInstituicao=${ti}`);
      process.exit(1);
    }
    console.log(`✓ Instituição SUPERIOR ${i} criada: ${res.data.nome} (tipoAcademico=${ta}, tipoInstituicao=${ti})`);
  }

  // 4. Criar 2 SECUNDARIO
  const idsSecundario: string[] = [];
  for (let i = 1; i <= 2; i++) {
    const sub = `sec-test-${TS}-${i}`;
    const res = await apiSuper.post('/instituicoes', {
      nome: `Inst Secundário Teste ${i}`,
      subdominio: sub,
      tipoAcademico: 'SECUNDARIO',
    });
    if (res.status !== 201 || !res.data?.id) {
      console.error(`✖ Falha ao criar instituição SECUNDARIO ${i}:`, res.data?.message || res.status);
      process.exit(1);
    }
    idsSecundario.push(res.data.id);
    const ta = res.data.tipoAcademico ?? res.data.tipo_academico;
    const ti = res.data.tipoInstituicao ?? res.data.tipo_instituicao;
    if (ta !== 'SECUNDARIO' || ti !== 'ENSINO_MEDIO') {
      console.error(`✖ Instituição SECUNDARIO ${i} criada com tipo incorreto: tipoAcademico=${ta}, tipoInstituicao=${ti}`);
      process.exit(1);
    }
    console.log(`✓ Instituição SECUNDARIO ${i} criada: ${res.data.nome} (tipoAcademico=${ta}, tipoInstituicao=${ti})`);
  }

  // 5. GET /instituicoes - verificar que todas carregam com tipo correto
  console.log('\n5. GET /instituicoes - verificar carregamento automático do tipo...');
  const listRes = await apiSuper.get('/instituicoes');
  if (listRes.status !== 200 || !Array.isArray(listRes.data)) {
    console.error('✖ Falha ao listar instituições:', listRes.status);
    process.exit(1);
  }

  const todasIds = [...idsSuperior, ...idsSecundario];
  for (const id of todasIds) {
    const inst = listRes.data.find((i: any) => i.id === id);
    if (!inst) {
      console.error(`✖ Instituição ${id} não encontrada na lista`);
      process.exit(1);
    }
    const ta = inst.tipoAcademico ?? inst.tipo_academico;
    const ti = inst.tipoInstituicao ?? inst.tipo_instituicao;
    if (!ta || !ti) {
      console.error(`✖ Instituição ${inst.nome} (${id}) sem tipo: tipoAcademico=${ta}, tipoInstituicao=${ti}`);
      process.exit(1);
    }
    const esperadoSuperior = idsSuperior.includes(id);
    if (esperadoSuperior && (ta !== 'SUPERIOR' || ti !== 'UNIVERSIDADE')) {
      console.error(`✖ Instituição ${inst.nome} deveria ser SUPERIOR/UNIVERSIDADE, obteve: ${ta}/${ti}`);
      process.exit(1);
    }
    if (!esperadoSuperior && (ta !== 'SECUNDARIO' || ti !== 'ENSINO_MEDIO')) {
      console.error(`✖ Instituição ${inst.nome} deveria ser SECUNDARIO/ENSINO_MEDIO, obteve: ${ta}/${ti}`);
      process.exit(1);
    }
    console.log(`  ✓ ${inst.nome}: tipoAcademico=${ta}, tipoInstituicao=${ti}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  ✅ TESTE TIPO ACADÊMICO CRIAÇÃO OK');
  console.log('  - tipoAcademico obrigatório ao criar');
  console.log('  - 2 SUPERIOR e 2 SECUNDARIO criadas corretamente');
  console.log('  - Todas carregam tipo automaticamente no GET');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
