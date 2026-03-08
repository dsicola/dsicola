#!/usr/bin/env npx tsx
/**
 * TESTE: Fluxo de Certificados Multi-tenant e Dois Tipos
 *
 * Valida:
 * - Multi-tenant: cada instituição usa sua config
 * - SECUNDARIO: modelo Certificado de Habilitações (Angola II Ciclo)
 * - SUPERIOR: modelo Certificado Licenciatura (Angola)
 * - Preview endpoint retorna HTML correto por tipo
 *
 * Pré-requisitos:
 *   1. npx tsx scripts/seed-multi-tenant-test.ts
 *   2. Backend rodando (API_URL ou localhost:3001)
 *
 * Uso: npx tsx scripts/test-certificados-multitenant-fluxo.ts
 */

import axios from 'axios';
import dotenv from 'dotenv';
import prisma from '../src/lib/prisma.js';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SENHA = process.env.TEST_USER_INST_A_PASSWORD || 'TestMultiTenant123!';

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  TESTE: Certificados Multi-tenant e Dois Tipos');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
    validateStatus: () => true,
  });

  // 1. Buscar instituições
  const instSec = await prisma.instituicao.findFirst({
    where: { subdominio: 'inst-a-secundario-test' },
  });
  const instSup = await prisma.instituicao.findFirst({
    where: { subdominio: 'inst-b-superior-test' },
  });

  if (!instSec || !instSup) {
    console.error('❌ Execute: npx tsx scripts/seed-multi-tenant-test.ts');
    process.exit(1);
  }

  // 2. Garantir config por tipo
  await prisma.configuracaoInstituicao.upsert({
    where: { instituicaoId: instSec.id },
    create: {
      instituicaoId: instSec.id,
      nomeInstituicao: instSec.nome,
      tipoInstituicao: 'ENSINO_MEDIO',
      republicaAngola: 'REPÚBLICA DE ANGOLA',
      governoProvincia: 'GOVERNO DA PROVINCIA DE LUANDA',
      escolaNomeNumero: 'ESCOLA TESTE SECUNDÁRIO N° 5106',
      tituloCertificadoSecundario: 'CERTIFICADO DE HABILITAÇÕES',
    },
    update: {
      republicaAngola: 'REPÚBLICA DE ANGOLA',
      escolaNomeNumero: 'ESCOLA TESTE SECUNDÁRIO N° 5106',
      tituloCertificadoSecundario: 'CERTIFICADO DE HABILITAÇÕES',
    },
  });

  await prisma.configuracaoInstituicao.upsert({
    where: { instituicaoId: instSup.id },
    create: {
      instituicaoId: instSup.id,
      nomeInstituicao: instSup.nome,
      tipoInstituicao: 'UNIVERSIDADE',
      ministerioSuperior: 'Ministério do Ensino Superior, Ciência, Tecnologia e Inovação',
      decretoCriacao: 'Decreto n.º 7/09, de 12 de Maio',
    },
    update: {
      ministerioSuperior: 'Ministério do Ensino Superior, Ciência, Tecnologia e Inovação',
      decretoCriacao: 'Decreto n.º 7/09, de 12 de Maio',
    },
  });

  // 3. Login como Admin de cada instituição
  const loginSec = await api.post('/auth/login', {
    email: 'admin.inst.a@teste.dsicola.com',
    password: SENHA,
  });
  const loginSup = await api.post('/auth/login', {
    email: 'admin.inst.b@teste.dsicola.com',
    password: SENHA,
  });

  if (loginSec.status !== 200 || loginSup.status !== 200) {
    console.error('❌ Login falhou. Verifique credenciais e backend em', API_URL);
    process.exit(1);
  }

  let ok = 0;
  let fail = 0;

  // 4. Preview SECUNDARIO
  const prevSec = await api.post(
    '/configuracoes-instituicao/preview-documento',
    { tipo: 'CERTIFICADO', tipoAcademico: 'SECUNDARIO' },
    { headers: { Authorization: `Bearer ${loginSec.data.accessToken}` } }
  );

  if (prevSec.status === 200 && prevSec.data?.html) {
    const html = prevSec.data.html;
    const hasSec = html.includes('CERTIFICADO DE HABILITAÇÕES') && html.includes('REPÚBLICA DE ANGOLA');
    const noSup = !html.includes('O CHEFE DO DAA');
    if (hasSec && noSup) {
      console.log('  ✅ SECUNDARIO: preview retorna modelo Angola II Ciclo');
      ok++;
    } else {
      console.log('  ❌ SECUNDARIO: HTML não contém elementos esperados');
      fail++;
    }
  } else {
    console.log('  ❌ SECUNDARIO: preview falhou', prevSec.status, prevSec.data?.message);
    fail++;
  }

  // 5. Preview SUPERIOR (com token da inst B)
  const prevSup = await api.post(
    '/configuracoes-instituicao/preview-documento',
    { tipo: 'CERTIFICADO', tipoAcademico: 'SUPERIOR' },
    { headers: { Authorization: `Bearer ${loginSup.data.accessToken}` } }
  );

  if (prevSup.status === 200 && prevSup.data?.html) {
    const html = prevSup.data.html;
    const hasSup = html.includes('Ministério do Ensino Superior') && html.includes('O CHEFE DO DAA');
    const noSec = !html.includes('CERTIFICADO DE HABILITAÇÕES');
    if (hasSup && noSec) {
      console.log('  ✅ SUPERIOR: preview retorna modelo Licenciatura Angola');
      ok++;
    } else {
      console.log('  ❌ SUPERIOR: HTML não contém elementos esperados');
      fail++;
    }
  } else {
    console.log('  ❌ SUPERIOR: preview falhou', prevSup.status, prevSup.data?.message);
    fail++;
  }

  // 6. Multi-tenant: Admin A não deve ver config da inst B
  const configBcomTokenA = await api.get('/configuracoes-instituicao', {
    headers: { Authorization: `Bearer ${loginSec.data.accessToken}` },
  });
  if (configBcomTokenA.status === 200 && configBcomTokenA.data?.instituicaoId === instSec.id) {
    console.log('  ✅ Multi-tenant: Admin A obtém apenas config da sua instituição');
    ok++;
  } else {
    console.log('  ❌ Multi-tenant: isolamento de config falhou');
    fail++;
  }

  console.log('\n───────────────────────────────────────────────────────────────');
  console.log(`  Resultado: ${ok} OK, ${fail} falhas`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (fail > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
