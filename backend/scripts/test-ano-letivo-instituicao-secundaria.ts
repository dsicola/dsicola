#!/usr/bin/env npx tsx
/**
 * TESTE: Criar ano letivo em instituição do ensino secundário
 *
 * Verifica que o bug "registro duplicado" foi corrigido:
 * - Antes: ano tinha @unique global → mesma ano (ex: 2025) não podia existir em 2 instituições
 * - Depois: unicidade por (instituicaoId, ano) → cada instituição pode ter seu próprio ano letivo
 *
 * Requer: Backend rodando, migração aplicada (prisma migrate deploy)
 * Uso: npx tsx scripts/test-ano-letivo-instituicao-secundaria.ts
 *      INSTITUICAO_ID=xxx npx tsx scripts/test-ano-letivo-instituicao-secundaria.ts  (testar instituição específica)
 */
import axios from 'axios';
import dotenv from 'dotenv';
import prisma from '../src/lib/prisma.js';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'superadmin@dsicola.com';
const ADMIN_PASS = process.env.TEST_ADMIN_PASS || 'SuperAdmin@123';
const INSTITUICAO_ID = process.env.INSTITUICAO_ID; // Opcional: forçar instituição

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  TESTE: Criar ano letivo em instituição do ensino secundário');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL}\n`);

  // 1. Buscar instituição secundária (ou a especificada em INSTITUICAO_ID)
  let instituicao: { id: string; nome: string; tipoAcademico: string | null; tipoInstituicao: string } | null;

  if (INSTITUICAO_ID) {
    instituicao = await prisma.instituicao.findUnique({
      where: { id: INSTITUICAO_ID },
      select: { id: true, nome: true, tipoAcademico: true, tipoInstituicao: true },
    });
  } else {
    // Buscar instituição secundária (tipoAcademico) ou ensino médio (tipoInstituicao)
    const lista = await prisma.instituicao.findMany({
      where: {
        OR: [
          { tipoAcademico: 'SECUNDARIO' },
          { tipoInstituicao: 'ENSINO_MEDIO' },
        ],
      },
      select: { id: true, nome: true, tipoAcademico: true, tipoInstituicao: true },
    });
    instituicao = lista[0] ?? (await prisma.instituicao.findFirst({ select: { id: true, nome: true, tipoAcademico: true, tipoInstituicao: true } }));
  }

  if (!instituicao) {
    console.error('❌ Nenhuma instituição encontrada.');
    if (INSTITUICAO_ID) {
      console.error(`   Instituição ${INSTITUICAO_ID} não existe.`);
    } else {
      console.error('   Crie uma instituição do ensino secundário primeiro.');
    }
    process.exit(1);
  }

  console.log(`Instituição: ${instituicao.nome} (${instituicao.id})`);
  console.log(`Tipo: ${instituicao.tipoAcademico ?? instituicao.tipoInstituicao ?? 'N/A'}\n`);

  // 2. Login
  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
    validateStatus: () => true,
  });

  const loginRes = await api.post('/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });

  if (loginRes.status === 403 && loginRes.data?.message === 'MUST_CHANGE_PASSWORD') {
    console.error('❌ Admin precisa trocar senha. Execute: npm run db:seed');
    process.exit(1);
  }

  if (loginRes.status !== 200 || !loginRes.data?.accessToken) {
    console.error('❌ Login falhou:', loginRes.data?.message || loginRes.statusText);
    process.exit(1);
  }

  api.defaults.headers.common['Authorization'] = `Bearer ${loginRes.data.accessToken}`;
  console.log('   ✅ Login OK\n');

  // 3. Verificar anos letivos existentes nesta instituição
  const anosExistentes = await prisma.anoLetivo.findMany({
    where: { instituicaoId: instituicao.id },
    select: { ano: true, status: true },
  });
  const anos = anosExistentes.map((a) => a.ano);
  console.log(`Anos letivos existentes na instituição: ${anos.length ? anos.join(', ') : 'nenhum'}`);

  // Escolher ano para criar (usar ano que ainda não existe)
  const anoAtual = new Date().getFullYear();
  let anoParaCriar = anoAtual;
  while (anos.includes(anoParaCriar)) {
    anoParaCriar++;
  }
  console.log(`Criando ano letivo: ${anoParaCriar}\n`);

  // 4. Criar ano letivo via API (com instituicaoId na query para SUPER_ADMIN)
  const dataInicio = `${anoParaCriar}-01-15`;
  const dataFim = `${anoParaCriar}-12-20`;

  const createRes = await api.post(
    `/anos-letivos?instituicaoId=${instituicao.id}`,
    {
      ano: anoParaCriar,
      dataInicio,
      dataFim,
      observacoes: 'Teste automático - instituição secundária',
    }
  );

  if (createRes.status >= 200 && createRes.status < 300) {
    console.log('   ✅ Ano letivo criado com sucesso!');
    console.log(`   ID: ${createRes.data?.id}`);
    console.log(`   Ano: ${createRes.data?.ano}`);
    console.log(`   Status: ${createRes.data?.status}`);
    console.log('\n✅ TESTE PASSOU: Não há mais "registro duplicado" ao criar ano letivo em instituição secundária.\n');
  } else {
    const msg = createRes.data?.message || JSON.stringify(createRes.data);
    console.error('   ❌ Erro ao criar ano letivo:', msg);

    if (msg.toLowerCase().includes('duplicad') || msg.toLowerCase().includes('já existe')) {
      console.error('\n   Possível causa: migração não aplicada. Execute:');
      console.error('   cd backend && npx prisma migrate deploy');
      console.error('\n   A migração remove o constraint único global em ano.');
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Erro:', err.message);
  process.exit(1);
});
