#!/usr/bin/env npx tsx
/**
 * TESTE: Fluxo Comercial Completo (perfil COMERCIAL)
 *
 * 1. Lead → Landing page (público)
 * 2. SUPER_ADMIN → Cria usuário COMERCIAL
 * 3. SUPER_ADMIN → Contrato fechado (status convertido) [leads só SUPER_ADMIN]
 * 4. COMERCIAL → Cria instituição via onboarding
 * 5. ADMIN instituição → Cria pagamento PENDING
 * 6. COMERCIAL → Confirma pagamento
 * 7. Sistema → Email ASSINATURA_ATIVADA
 * 8. COMERCIAL → Listar instituições, bloqueado em /stats/super-admin
 * 9. Instituição → Acessa plataforma
 *
 * Requer: Backend rodando (localhost:3001 ou API_URL)
 * Uso: npm run test:fluxo-comercial
 *      ou: npx tsx scripts/test-fluxo-comercial-completo.ts
 */
import axios, { AxiosInstance } from 'axios';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import prisma from '../src/lib/prisma.js';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SUPER_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || process.env.SUPER_ADMIN_EMAIL || 'superadmin@dsicola.com';
const SUPER_ADMIN_PASS = process.env.TEST_ADMIN_PASS || process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';

const TS = Date.now();
const SUBDOMINIO = `teste-comercial-${TS}`.slice(0, 50);
const INST_NOME = `Instituição Teste Comercial ${TS}`;
const ADMIN_EMAIL = `admin.comercial.${TS}@teste.dsicola.com`;
const ADMIN_PASS = 'TesteComercial@123';
const COMERCIAL_EMAIL = `comercial.fluxo.${TS}@teste.dsicola.com`;
const COMERCIAL_PASS = 'ComercialFluxo@123';

function createApi(token?: string): AxiosInstance {
  return axios.create({
    baseURL: API_URL,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    timeout: 20000,
    validateStatus: () => true,
  });
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  FLUXO COMERCIAL COMPLETO - TESTE PARA PRODUÇÃO');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL}`);
  console.log(`Subdomínio: ${SUBDOMINIO}.dsicola.com\n`);

  let leadId: string;
  let instituicaoId: string;
  let pagamentoId: string;
  let adminToken: string;

  const api = createApi();

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. LEAD via formulário da landing (público)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('1. LEAD → Formulário da landing page (POST /leads - público)');
  const leadRes = await api.post('/leads', {
    nomeInstituicao: INST_NOME,
    nomeResponsavel: 'Responsável Teste',
    email: ADMIN_EMAIL,
    telefone: '+244 900 000 000',
    cidade: 'Luanda',
    mensagem: 'Interesse em adquirir o DSICOLA',
    tipoInstituicao: 'SUPERIOR',
  });
  if (leadRes.status !== 201 && leadRes.status !== 200) {
    console.error('   ✖ Falha ao criar lead:', leadRes.data);
    process.exit(1);
  }
  leadId = leadRes.data.id;
  console.log(`   ✓ Lead criado: ${leadId}\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Login SUPER_ADMIN
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('2. Login SUPER_ADMIN (área comercial)');
  const loginRes = await api.post('/auth/login', {
    email: SUPER_ADMIN_EMAIL,
    password: SUPER_ADMIN_PASS,
  });
  if (loginRes.status !== 200 || !loginRes.data?.accessToken) {
    console.error('   ✖ Login falhou:', loginRes.data?.message || loginRes.data);
    process.exit(1);
  }
  const superAdminToken = loginRes.data.accessToken;
  const apiSuper = createApi(superAdminToken);
  console.log('   ✓ Login OK\n');

  // ═══════════════════════════════════════════════════════════════════════════
  // 2b. SUPER_ADMIN cria usuário COMERCIAL
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('2b. SUPER_ADMIN → Criar usuário COMERCIAL (POST /users)');
  const createComercialRes = await apiSuper.post('/users', {
    email: COMERCIAL_EMAIL,
    password: COMERCIAL_PASS,
    nomeCompleto: `Comercial Fluxo ${TS}`,
    role: 'COMERCIAL',
  });
  if (createComercialRes.status !== 201 && createComercialRes.status !== 200) {
    console.error('   ✖ Falha ao criar COMERCIAL:', createComercialRes.data?.message || createComercialRes.data);
    process.exit(1);
  }
  console.log('   ✓ Usuário COMERCIAL criado\n');

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. SUPER_ADMIN → Contrato fechado (leads: só SUPER_ADMIN pode atualizar)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('3. SUPER_ADMIN → Contrato fechado (PUT /leads - status convertido)');
  const updateLeadRes = await apiSuper.put(`/leads/${leadId}`, {
    status: 'convertido',
    notas: 'Contrato fechado - teste automatizado',
  });
  if (updateLeadRes.status !== 200) {
    console.error('   ✖ Falha ao atualizar lead:', updateLeadRes.data);
    process.exit(1);
  }
  console.log('   ✓ Lead marcado como convertido\n');

  // ═══════════════════════════════════════════════════════════════════════════
  // 3b. Login COMERCIAL
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('3b. Login COMERCIAL');
  const loginComercialRes = await api.post('/auth/login', {
    email: COMERCIAL_EMAIL,
    password: COMERCIAL_PASS,
  });
  if (loginComercialRes.status !== 200 || !loginComercialRes.data?.accessToken) {
    console.error('   ✖ Login COMERCIAL falhou:', loginComercialRes.data?.message);
    process.exit(1);
  }
  const comercialToken = loginComercialRes.data.accessToken;
  const apiComercial = createApi(comercialToken);
  const roles = loginComercialRes.data?.user?.roles || [];
  if (!roles.includes('COMERCIAL')) {
    console.error('   ✖ JWT sem role COMERCIAL:', roles);
    process.exit(1);
  }
  console.log('   ✓ Login COMERCIAL OK\n');

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. COMERCIAL → Criar instituição via onboarding
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('4. COMERCIAL → Criar instituição via onboarding (POST /onboarding/instituicao)');
  let plano = await prisma.plano.findFirst({ where: { ativo: true } });
  if (!plano) {
    console.log('   ⚠ Nenhum plano ativo - criando plano BASIC para teste');
    plano = await prisma.plano.create({
      data: {
        nome: 'BASIC',
        descricao: 'Plano básico para teste',
        valorMensal: 50,
        valorAnual: 500,
        ativo: true,
      },
    });
  }
  const onboardingRes = await apiComercial.post('/onboarding/instituicao', {
    nomeInstituicao: INST_NOME,
    subdominio: SUBDOMINIO,
    tipoAcademico: 'SUPERIOR',
    emailContato: ADMIN_EMAIL,
    telefone: '+244 900 000 000',
    emailAdmin: ADMIN_EMAIL,
    senhaAdmin: ADMIN_PASS,
    nomeAdmin: 'Admin Teste Comercial',
    planoId: plano.id,
  });
  if (onboardingRes.status !== 201 || !onboardingRes.data?.instituicao?.id) {
    console.error('   ✖ Falha ao criar instituição:', onboardingRes.data?.message || onboardingRes.data);
    process.exit(1);
  }
  instituicaoId = onboardingRes.data.instituicao.id;
  console.log(`   ✓ Instituição criada: ${instituicaoId}`);
  console.log(`   ✓ Subdomínio: ${SUBDOMINIO}.dsicola.com\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Pagamento → Instituição cria PENDING (transferência)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('5. PAGAMENTO → Instituição cria pagamento PENDING (transferência)');
  const loginAdminRes = await api.post('/auth/login', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASS,
  });
  if (loginAdminRes.status !== 200 || !loginAdminRes.data?.accessToken) {
    console.error('   ✖ Login admin instituição falhou:', loginAdminRes.data?.message);
    process.exit(1);
  }
  adminToken = loginAdminRes.data.accessToken;
  const apiAdmin = createApi(adminToken);

  const criarPagRes = await apiAdmin.post('/licenca/pagamento/criar', {
    planoId: plano.id,
    periodo: 'MENSAL',
    metodo: 'TRANSFERENCIA',
    referencia: `TEST-${TS}`,
  });
  if (criarPagRes.status !== 201 || !criarPagRes.data?.id) {
    console.error('   ✖ Falha ao criar pagamento:', criarPagRes.data?.message || criarPagRes.data);
    process.exit(1);
  }
  pagamentoId = criarPagRes.data.id;
  console.log(`   ✓ Pagamento PENDING criado: ${pagamentoId}\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. COMERCIAL → Confirma pagamento
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('6. COMERCIAL → Confirma pagamento (POST .../confirmar)');
  const confirmRes = await apiComercial.post(`/licenca/pagamento/${pagamentoId}/confirmar`, {
    observacoes: 'Pagamento confirmado - teste fluxo comercial',
  });
  if (confirmRes.status !== 200) {
    console.error('   ✖ Falha ao confirmar pagamento:', confirmRes.data?.message || confirmRes.data);
    process.exit(1);
  }
  const novaDataFim = confirmRes.data?.novaDataFim;
  console.log('   ✓ Pagamento confirmado');
  if (novaDataFim) console.log(`   ✓ Licença renovada até: ${novaDataFim}\n`);
  else console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. Sistema → Email ASSINATURA_ATIVADA enviado
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('7. SISTEMA → Verificar email ASSINATURA_ATIVADA enviado');
  const emailEnviado = await prisma.emailEnviado.findFirst({
    where: {
      tipo: 'ASSINATURA_ATIVADA',
      destinatarioEmail: ADMIN_EMAIL,
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!emailEnviado) {
    console.error('   ✖ Email ASSINATURA_ATIVADA não encontrado em emails_enviados');
    process.exit(1);
  }
  console.log(`   ✓ Email registrado para: ${emailEnviado.destinatarioEmail}`);
  console.log(`   ✓ Status: ${emailEnviado.status}`);
  if (emailEnviado.erro) {
    console.log(`   ⚠ Envio: ${emailEnviado.erro.includes('testing emails') ? 'Resend em modo teste - em produção com domínio verificado funcionará' : emailEnviado.erro}`);
  }
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // 7b. COMERCIAL → Listar instituições e verificar restrições
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('7b. COMERCIAL → Listar instituições (GET /instituicoes)');
  const instRes = await apiComercial.get('/instituicoes');
  if (instRes.status !== 200) {
    console.error('   ✖ COMERCIAL listar instituições falhou:', instRes.status, instRes.data);
    process.exit(1);
  }
  const instList = Array.isArray(instRes.data) ? instRes.data : instRes.data?.data || [];
  const found = instList.some((i: any) => i.id === instituicaoId);
  if (!found) {
    console.error('   ✖ Nova instituição não aparece na lista do COMERCIAL');
    process.exit(1);
  }
  console.log(`   ✓ COMERCIAL listou ${instList.length} instituição(ões)\n`);

  console.log('7c. COMERCIAL → Deve ser bloqueado em /stats/super-admin');
  const statsRes = await apiComercial.get('/stats/super-admin');
  if (statsRes.status !== 403) {
    console.error('   ✖ COMERCIAL deveria ser bloqueado em /stats/super-admin. Status:', statsRes.status);
    process.exit(1);
  }
  console.log('   ✓ COMERCIAL corretamente bloqueado em /stats/super-admin\n');

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. Instituição → Acessa via login
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('8. INSTITUIÇÃO → Acessa e utiliza a plataforma');
  const meRes = await apiAdmin.get('/auth/me');
  if (meRes.status !== 200 || (!meRes.data?.id && !meRes.data?.userId)) {
    console.error('   ✖ /auth/me falhou - instituição não consegue acessar');
    console.error('     Status:', meRes.status, 'Data:', JSON.stringify(meRes.data));
    process.exit(1);
  }
  const assinatura = await prisma.assinatura.findUnique({
    where: { instituicaoId },
    include: { plano: true },
  });
  if (!assinatura || assinatura.status !== 'ativa') {
    console.error('   ✖ Assinatura não está ativa');
    process.exit(1);
  }
  console.log('   ✓ Instituição autenticada');
  console.log(`   ✓ Assinatura ativa: ${assinatura.plano?.nome || 'N/A'}`);
  console.log(`   ✓ URL de acesso: https://${SUBDOMINIO}.dsicola.com/auth\n`);

  // ═══════════════════════════════════════════════════════════════════════════
  // Limpeza (opcional - remova para manter dados)
  // ═══════════════════════════════════════════════════════════════════════════
  const CLEANUP = process.env.TEST_CLEANUP !== 'false';
  if (CLEANUP) {
    console.log('9. Limpeza (TEST_CLEANUP=true)');
    try {
      await prisma.emailEnviado.deleteMany({ where: { destinatarioEmail: ADMIN_EMAIL } });
      await prisma.pagamentoLicenca.deleteMany({ where: { instituicaoId } });
      await prisma.assinatura.deleteMany({ where: { instituicaoId } });
      await prisma.user.deleteMany({ where: { instituicaoId } });
      await prisma.instituicao.delete({ where: { id: instituicaoId } });
      await prisma.leadComercial.delete({ where: { id: leadId } });
      await prisma.user.deleteMany({ where: { email: COMERCIAL_EMAIL } });
      console.log('   ✓ Dados de teste removidos\n');
    } catch (e: any) {
      console.log('   ⚠ Limpeza parcial:', e.message);
    }
  }

  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('  ✓ FLUXO COMERCIAL COMPLETO - TODOS OS PASSOS OK');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
}

main()
  .catch((e: any) => {
    console.error('\n✖ Erro no teste:', e?.message || e);
    if (e?.response?.data) console.error('  Response:', e.response.data);
    if (e?.stack) console.error(e.stack);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
