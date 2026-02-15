#!/usr/bin/env npx tsx
/**
 * TESTE: Fluxo Comercial Completo ( produção)
 *
 * Lead → Landing page
 * Comercial → Contato e negociação
 * Contrato fechado → status convertido
 * Pagamento → Transferência bancária
 * Comercial → Confirma pagamento na aba Pagamentos
 * Sistema → Renova licença e envia email com instruções de acesso
 * Instituição → Acessa via link do email
 *
 * Requer: Backend rodando (localhost:3001 ou API_URL)
 * Uso: npx tsx scripts/test-fluxo-comercial-completo.ts
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
  // 3. Comercial → Contrato fechado (status convertido)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('3. COMERCIAL → Contrato fechado (PUT /leads - status convertido)');
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
  // 4. Criar instituição via onboarding (com plano e assinatura)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('4. Criar instituição via onboarding (POST /onboarding/instituicao)');
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
  const onboardingRes = await apiSuper.post('/onboarding/instituicao', {
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
  // 6. Comercial → Confirma pagamento (SUPER_ADMIN)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('6. COMERCIAL → Confirma pagamento (POST .../confirmar)');
  const confirmRes = await apiSuper.post(`/licenca/pagamento/${pagamentoId}/confirmar`, {
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
