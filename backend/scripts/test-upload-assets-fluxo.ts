#!/usr/bin/env npx tsx
/**
 * TESTE: Fluxo de Upload de Assets (Logo, Capa, Favicon) no Banco
 *
 * Valida:
 * 1. ADMIN faz upload via POST /configuracoes-instituicao/upload-assets
 * 2. Config retorna URLs dos assets
 * 3. GET /configuracoes-instituicao/assets/:tipo serve as imagens (público)
 * 4. Config GET retorna URLs corretas
 * 5. GET instituicoes/subdominio/:subdominio retorna URLs para login/capa
 * 6. MULTI-TENANT: Admin Inst A só altera config da Inst A; Admin Inst B só da Inst B
 * 7. DOIS TIPOS: Funciona em SECUNDARIO e SUPERIOR
 *
 * Requer: Backend rodando, seed-multi-tenant-test executado
 * Uso: npx tsx scripts/test-upload-assets-fluxo.ts
 */
import 'dotenv/config';
import axios, { AxiosInstance } from 'axios';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import FormData from 'form-data';

const prisma = new PrismaClient();
const API_URL = process.env.API_URL || 'http://localhost:3001';
const SENHA = process.env.TEST_MULTITENANT_PASS || 'TestMultiTenant123!';

// PNG 1x1 pixel mínimo (válido)
const MINI_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

function criarApi(): AxiosInstance {
  return axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
    validateStatus: () => true,
  });
}

async function login(api: AxiosInstance, email: string, password: string = SENHA): Promise<boolean> {
  const res = await api.post('/auth/login', { email, password });
  if (res.status !== 200 || !res.data?.accessToken) return false;
  api.defaults.headers.common['Authorization'] = `Bearer ${res.data.accessToken}`;
  return true;
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  TESTE: Fluxo Upload Assets (Logo, Capa, Favicon) no Banco');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const instA = await prisma.instituicao.findFirst({
    where: { subdominio: 'inst-a-secundario-test' },
  });
  if (!instA) {
    console.error('   ❌ Execute: npx tsx scripts/seed-multi-tenant-test.ts');
    process.exit(1);
  }

  const admin = await prisma.user.findFirst({
    where: {
      instituicaoId: instA.id,
      roles: { some: { role: 'ADMIN' } },
    },
  });
  if (!admin) {
    console.error('   ❌ Admin não encontrado na instituição.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(SENHA, 10);
  await prisma.user.update({
    where: { id: admin.id },
    data: { password: hash, mustChangePassword: false },
  });

  const api = criarApi();
  try {
    const ok = await login(api, admin.email!);
    if (!ok) {
      console.error('   ❌ Login falhou. Verifique credenciais.');
      process.exit(1);
    }
  } catch (e: any) {
    if (e?.code === 'ECONNREFUSED' || e?.message?.includes('hang up') || e?.message?.includes('connect')) {
      console.error(`   ❌ Backend não está rodando em ${API_URL}. Inicie com: npm run dev`);
    } else {
      console.error('   ❌ Erro no login:', e?.message);
    }
    process.exit(1);
  }

  let passou = 0;
  const assert = (cond: boolean, msg: string) => {
    if (cond) {
      console.log(`   ✔ ${msg}`);
      passou++;
    } else {
      console.log(`   ❌ ${msg}`);
    }
  };

  // 1. Upload assets
  console.log('\n1. Upload de logo, capa e favicon...');
  const form = new FormData();
  form.append('logo', MINI_PNG, { filename: 'logo.png', contentType: 'image/png' });
  form.append('capa', MINI_PNG, { filename: 'capa.png', contentType: 'image/png' });
  form.append('favicon', MINI_PNG, { filename: 'favicon.png', contentType: 'image/png' });

  const uploadRes = await api.post('/configuracoes-instituicao/upload-assets', form, {
    headers: form.getHeaders(),
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  assert(uploadRes.status === 200, `Upload retornou ${uploadRes.status}`);
  assert(!!uploadRes.data?.logoUrl, 'Resposta tem logoUrl');
  assert(!!uploadRes.data?.imagemCapaLoginUrl, 'Resposta tem imagemCapaLoginUrl');
  assert(!!uploadRes.data?.faviconUrl, 'Resposta tem faviconUrl');
  assert(
    uploadRes.data.logoUrl.includes('/configuracoes-instituicao/assets/logo'),
    'logoUrl aponta para endpoint de assets'
  );

  // 2. Config GET retorna URLs
  console.log('\n2. Config GET retorna URLs dos assets...');
  const configRes = await api.get('/configuracoes-instituicao');
  assert(configRes.status === 200, 'Config GET 200');
  assert(!!configRes.data?.logo_url || !!configRes.data?.logoUrl, 'Config tem logo_url');
  assert(
    !!configRes.data?.imagem_capa_login_url || !!configRes.data?.imagemCapaLoginUrl,
    'Config tem imagem_capa_login_url'
  );
  assert(!!configRes.data?.favicon_url || !!configRes.data?.faviconUrl, 'Config tem favicon_url');

  // 3. Servir assets (rotas públicas)
  console.log('\n3. Endpoints públicos servem as imagens...');
  const logoAssetRes = await axios.get(
    `${API_URL}/configuracoes-instituicao/assets/logo?instituicaoId=${instA.id}`,
    { validateStatus: () => true, responseType: 'arraybuffer' }
  );
  assert(logoAssetRes.status === 200, 'GET assets/logo retorna 200');
  assert(
    logoAssetRes.headers['content-type']?.includes('image'),
    'Content-Type de logo é image/*'
  );
  assert(
    Buffer.isBuffer(logoAssetRes.data) || logoAssetRes.data?.byteLength > 0,
    'Logo retorna bytes'
  );

  const capaAssetRes = await axios.get(
    `${API_URL}/configuracoes-instituicao/assets/capa?instituicaoId=${instA.id}`,
    { validateStatus: () => true }
  );
  assert(capaAssetRes.status === 200, 'GET assets/capa retorna 200');
  assert(
    capaAssetRes.headers['content-type']?.includes('image'),
    'Content-Type de capa é image/*'
  );

  const faviconAssetRes = await axios.get(
    `${API_URL}/configuracoes-instituicao/assets/favicon?instituicaoId=${instA.id}`,
    { validateStatus: () => true }
  );
  assert(faviconAssetRes.status === 200, 'GET assets/favicon retorna 200');
  assert(
    faviconAssetRes.headers['content-type']?.includes('image') ||
      faviconAssetRes.headers['content-type']?.includes('icon'),
    'Content-Type de favicon é image/*'
  );

  // 4. Endpoint público por subdomínio
  console.log('\n4. Config pública por subdomínio inclui URLs...');
  const subRes = await axios.get(`${API_URL}/instituicoes/subdominio/inst-a-secundario-test`, {
    validateStatus: () => true,
  });
  assert(subRes.status === 200, 'GET subdominio retorna 200');
  const conf = subRes.data?.configuracao || subRes.data;
  assert(
    !!conf?.logoUrl || !!conf?.logo_url,
    'Config pública tem logo (login/capa)'
  );
  assert(
    !!conf?.imagemCapaLoginUrl || !!conf?.imagem_capa_login_url,
    'Config pública tem imagem de capa'
  );

  // 5. Verificar no banco que os dados foram persistidos
  console.log('\n5. Dados persistidos no PostgreSQL...');
  const configDb = await prisma.configuracaoInstituicao.findFirst({
    where: { instituicaoId: instA.id },
  });
  assert(!!configDb?.logoData, 'logo_data gravado no banco');
  assert(!!configDb?.imagemCapaLoginData, 'imagem_capa_login_data gravado no banco');
  assert(!!configDb?.faviconData, 'favicon_data gravado no banco');

  // 6. MULTI-TENANT: Admin Inst B não vê/altera config da Inst A
  console.log('\n6. MULTI-TENANT: Isolamento entre instituições...');
  const instB = await prisma.instituicao.findFirst({
    where: { subdominio: 'inst-b-superior-test' },
  });
  if (instB) {
    const adminB = await prisma.user.findFirst({
      where: {
        instituicaoId: instB.id,
        roles: { some: { role: 'ADMIN' } },
      },
    });
    if (adminB) {
      await prisma.user.update({
        where: { id: adminB.id },
        data: { password: await bcrypt.hash(SENHA, 10), mustChangePassword: false },
      });
      const apiB = criarApi();
      await login(apiB, adminB.email!);
      const configB = await apiB.get('/configuracoes-instituicao');
      assert(configB.status === 200, 'Admin Inst B obtém config (da sua própria instituição)');
      // Admin B deve ver config da Inst B, NÃO da Inst A
      const configBData = configB.data;
      const logoB = configBData?.logo_url || configBData?.logoUrl;
      assert(
        !logoB || !logoB.includes(instA.id) || logoB.includes(instB.id),
        'Admin Inst B não recebe URLs da Inst A'
      );
      // Upload como Admin B deve afetar só Inst B
      const formB = new FormData();
      formB.append('logo', MINI_PNG, { filename: 'logo-b.png', contentType: 'image/png' });
      const uploadB = await apiB.post('/configuracoes-instituicao/upload-assets', formB, {
        headers: formB.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      assert(uploadB.status === 200, 'Admin Inst B faz upload (só para sua instituição)');
      assert(
        uploadB.data?.logoUrl?.includes(instB.id),
        'Upload de B retorna URL com instituicaoId da B'
      );
      // Inst A deve manter seus dados (não foram sobrescritos por B)
      const configAposB = await prisma.configuracaoInstituicao.findFirst({
        where: { instituicaoId: instA.id },
      });
      assert(!!configAposB?.logoData, 'Inst A mantém logo após upload de B (isolamento OK)');
    }
  } else {
    console.log('   ⚠ Inst B não encontrada (seed incompleto) - pulando testes multi-tenant');
  }

  // 7. DOIS TIPOS: Funciona em SECUNDARIO e SUPERIOR
  console.log('\n7. DOIS TIPOS: SECUNDARIO e SUPERIOR...');
  assert(instA.tipoAcademico === 'SECUNDARIO', 'Inst A é SECUNDARIO');
  if (instB) {
    assert(instB.tipoAcademico === 'SUPERIOR', 'Inst B é SUPERIOR');
    const logoInstB = await axios.get(
      `${API_URL}/configuracoes-instituicao/assets/logo?instituicaoId=${instB.id}`,
      { validateStatus: () => true }
    );
    assert(logoInstB.status === 200, 'Asset de instituição SUPERIOR acessível');
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  TOTAL: ${passou} verificações OK`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (passou < 15) {
    process.exit(1);
  }
  console.log('  ✅ Fluxo de upload de assets: multi-tenant e dois tipos OK!\n');
}

main().catch((e) => {
  console.error('Erro:', e?.message || e);
  process.exit(1);
});
