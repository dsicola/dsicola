#!/usr/bin/env npx tsx
/**
 * TESTE: Videoaulas postadas pelo super-admin devem carregar para instituições
 *
 * Fluxo:
 * 1. Cria instituição de teste + admin (se não existir)
 * 2. Login como SUPER_ADMIN → cria videoaula
 * 3. Login como ADMIN da instituição → GET /video-aulas
 * 4. Verifica que a videoaula aparece na lista
 *
 * Requer: Backend rodando (API_URL)
 * Uso: npx tsx scripts/test-videoaulas-instituicao.ts
 */
import 'dotenv/config';
import axios, { AxiosInstance } from 'axios';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = process.env.API_URL || 'http://localhost:3001';
const SUPER_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'superadmin@dsicola.com';
const SUPER_PASS = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';
const SENHA_TESTE = 'TestVideoAula123!';

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  TESTE: Videoaulas - Instituição deve carregar vídeos');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL}\n`);

  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
    validateStatus: () => true,
  });

  // ─── 1. Criar instituição + admin de teste ─────────────────────────────────
  console.log('1. Preparar instituição e admin de teste...');
  const inst = await prisma.instituicao.findFirst({
    where: { subdominio: 'inst-videoaula-test' },
  });
  let instituicaoId: string;
  let adminEmail: string;

  if (!inst) {
    const nova = await prisma.instituicao.create({
      data: {
        nome: 'Inst. Teste Videoaulas',
        subdominio: 'inst-videoaula-test',
        tipoInstituicao: 'ENSINO_MEDIO',
        tipoAcademico: 'SECUNDARIO',
        status: 'ativa',
      },
    });
    instituicaoId = nova.id;
    console.log('   ✔ Instituição criada:', nova.nome);

    // Assinatura ativa (obrigatório para validateLicense)
    let plano = await prisma.plano.findFirst({ where: { ativo: true } });
    if (!plano) {
      plano = await prisma.plano.create({
        data: {
          nome: 'Plano Teste Videoaulas',
          descricao: 'Para teste de videoaulas',
          valorMensal: 0,
          limiteAlunos: 100,
          limiteProfessores: 20,
          limiteCursos: 10,
          ativo: true,
        },
      });
    }
    const dataFim = new Date();
    dataFim.setFullYear(dataFim.getFullYear() + 1);
    await prisma.assinatura.upsert({
      where: { instituicaoId },
      create: {
        instituicaoId,
        planoId: plano.id,
        status: 'ativa',
        tipo: 'PAGA',
        dataFim,
        dataProximoPagamento: dataFim,
        valorAtual: 0,
      },
      update: { status: 'ativa', dataFim },
    });
    console.log('   ✔ Assinatura ativa criada para a instituição');

    const hash = await bcrypt.hash(SENHA_TESTE, 10);
    const user = await prisma.user.create({
      data: {
        email: 'admin.videoaula@teste.dsicola.com',
        password: hash,
        nomeCompleto: 'Admin Videoaula Teste',
        instituicaoId,
        mustChangePassword: false,
      },
    });
    await prisma.userRole_.create({
      data: { userId: user.id, role: 'ADMIN', instituicaoId },
    });
    adminEmail = user.email;
    console.log('   ✔ Admin criado:', adminEmail);
  } else {
    instituicaoId = inst.id;
    // Garantir assinatura ativa (validateLicense)
    let assin = await prisma.assinatura.findUnique({ where: { instituicaoId } });
    if (!assin || assin.status !== 'ativa') {
      let plano = await prisma.plano.findFirst({ where: { ativo: true } });
      if (!plano) {
        plano = await prisma.plano.create({
          data: {
            nome: 'Plano Teste',
            descricao: 'Teste',
            valorMensal: 0,
            limiteAlunos: 100,
            limiteProfessores: 20,
            limiteCursos: 10,
            ativo: true,
          },
        });
      }
      const dataFim = new Date();
      dataFim.setFullYear(dataFim.getFullYear() + 1);
      if (assin) {
        await prisma.assinatura.update({
          where: { id: assin.id },
          data: { status: 'ativa', dataFim },
        });
      } else {
        await prisma.assinatura.create({
          data: {
            instituicaoId,
            planoId: plano.id,
            status: 'ativa',
            tipo: 'PAGA',
            dataFim,
            dataProximoPagamento: dataFim,
            valorAtual: 0,
          },
        });
      }
      console.log('   ✔ Assinatura ativa garantida');
    }
    const admin = await prisma.user.findFirst({
      where: { instituicaoId, roles: { some: { role: 'ADMIN' } } },
      select: { email: true },
    });
    if (!admin) {
      console.error('   ❌ Instituição existe mas sem admin. Execute seed ou apague a instituição.');
      process.exit(1);
    }
    adminEmail = admin.email;
    await prisma.user.updateMany({
      where: { email: adminEmail },
      data: { password: await bcrypt.hash(SENHA_TESTE, 10), mustChangePassword: false },
    });
    console.log('   ✔ Instituição e admin já existem:', adminEmail);
  }

  // ─── 2. Login SUPER_ADMIN e criar videoaula ─────────────────────────────────
  console.log('\n2. Login como SUPER_ADMIN...');
  const loginSuper = await api.post('/auth/login', { email: SUPER_EMAIL, password: SUPER_PASS });
  if (loginSuper.status !== 200 || !loginSuper.data?.accessToken) {
    console.error('   ❌ Login SUPER_ADMIN falhou:', loginSuper.data?.message || loginSuper.status);
    process.exit(1);
  }
  console.log('   ✔ Login OK');

  const tokenSuper = loginSuper.data.accessToken;
  api.defaults.headers.common['Authorization'] = `Bearer ${tokenSuper}`;

  const videoPayload = {
    titulo: 'Vídeo Teste Instituição',
    descricao: 'Criado pelo teste automatizado',
    urlVideo: 'https://iframe.mediadelivery.net/embed/297435/ce7a71b9-c84c-4ecb-9e2c-ec08b61d3260',
    tipoVideo: 'BUNNY',
    modulo: 'GERAL',
    perfilAlvo: 'TODOS',
    tipoInstituicao: null,
    ordem: 0,
    ativo: true,
  };

  const createRes = await api.post('/video-aulas', videoPayload);
  if (createRes.status !== 200 && createRes.status !== 201) {
    console.error('   ❌ Criar videoaula falhou:', createRes.data?.message || createRes.status);
    process.exit(1);
  }
  const videoId = createRes.data?.id;
  console.log('   ✔ Videoaula criada:', videoId);

  // ─── 3. Login como ADMIN da instituição ────────────────────────────────────
  console.log('\n3. Login como ADMIN da instituição...');
  const loginAdmin = await api.post('/auth/login', { email: adminEmail, password: SENHA_TESTE });
  if (loginAdmin.status !== 200 || !loginAdmin.data?.accessToken) {
    console.error('   ❌ Login ADMIN falhou:', loginAdmin.data?.message || loginAdmin.status);
    process.exit(1);
  }
  console.log('   ✔ Login OK -', loginAdmin.data.user?.nomeCompleto);

  api.defaults.headers.common['Authorization'] = `Bearer ${loginAdmin.data.accessToken}`;

  // ─── 4. GET /video-aulas ───────────────────────────────────────────────────
  console.log('\n4. GET /video-aulas (como instituição)...');
  const listRes = await api.get('/video-aulas');
  if (listRes.status !== 200) {
    console.error('   ❌ GET /video-aulas falhou:', listRes.status, listRes.data?.message);
    process.exit(1);
  }

  const lista = Array.isArray(listRes.data) ? listRes.data : [];
  const encontrado = lista.find((v: any) => v.id === videoId || v.titulo === videoPayload.titulo);

  if (encontrado) {
    console.log('   ✔ Videoaula encontrada na lista da instituição:', encontrado.titulo);
    console.log('\n✅ TESTE PASSOU: Instituição carrega videoaulas postadas pelo super-admin.\n');
    process.exit(0);
  } else {
    console.error('   ❌ Videoaula NÃO aparece na lista. Total retornado:', lista.length);
    if (lista.length > 0) {
      console.error('   Primeiros títulos:', lista.slice(0, 3).map((v: any) => v.titulo));
    }
    console.error('\n❌ TESTE FALHOU: Instituição não está a carregar as videoaulas.\n');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Erro:', e.message);
  process.exit(1);
}).finally(() => {
  prisma.$disconnect();
});
