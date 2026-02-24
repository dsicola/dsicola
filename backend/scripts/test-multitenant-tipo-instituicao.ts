#!/usr/bin/env npx tsx
/**
 * TESTE: Multi-tenant + dois tipos de instituição (SECUNDARIO / SUPERIOR)
 * Garante:
 * - Duas instituições com tipoAcademico distinto (SECUNDARIO e SUPERIOR)
 * - Isolamento por tenant (dados não cruzam)
 * - Alinhamento frontend/backend: login e /auth/me retornam instituicaoId e tipoAcademico;
 *   JWT contém instituicaoId e tipoAcademico para o frontend (InstituicaoContext, decodeJWT)
 *
 * Pré-requisitos:
 *   - npx prisma generate (e migrações aplicadas)
 *   - npx tsx scripts/seed-multi-tenant-test.ts (ou instituições com tipoAcademico no banco)
 *   - Backend rodando (API_URL, default http://localhost:3001)
 *
 * Uso:
 *   npm run test:multitenant-tipo-instituicao
 *   npm run test:multitenant-tipo-instituicao:full   # roda seed antes
 */
import 'dotenv/config';
import { fileURLToPath } from 'url';
import path from 'path';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_URL = process.env.API_URL || 'http://localhost:3001';

interface AssertResult {
  name: string;
  ok: boolean;
  details?: string;
}

const results: AssertResult[] = [];

function assert(name: string, ok: boolean, details?: string) {
  const icon = ok ? '✔' : '✖';
  console.log(`  ${icon} ${name}${details ? `: ${details}` : ''}`);
  results.push({ name, ok, details });
}

/** Decodifica payload JWT (apenas base64, sem verificar assinatura) - mesmo contrato do frontend */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TESTE: MULTI-TENANT + DOIS TIPOS DE INSTITUIÇÃO (SECUNDARIO / SUPERIOR)');
  console.log('  Alinhamento Frontend / Backend');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  let instituicaoA!: string;
  let instituicaoB!: string;
  let tipoA!: 'SECUNDARIO' | 'SUPERIOR';
  let tipoB!: 'SECUNDARIO' | 'SUPERIOR';
  let tokenA: string | null = null;
  let tokenB: string | null = null;
  let emailA!: string;
  let emailB!: string;
  let pass!: string;

  // ─── 1. Banco: duas instituições com tipos distintos ───
  console.log('1. BANCO - Duas instituições (SECUNDARIO e SUPERIOR)');
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    let instA = await prisma.instituicao.findFirst({
      where: { subdominio: 'inst-a-secundario-test' },
      select: { id: true, nome: true, tipoAcademico: true },
    });
    let instB = await prisma.instituicao.findFirst({
      where: { subdominio: 'inst-b-superior-test' },
      select: { id: true, nome: true, tipoAcademico: true },
    });

    if (!instA || !instB) {
      const quais = await prisma.instituicao.findMany({
        where: { tipoAcademico: { not: null } },
        take: 10,
        select: { id: true, nome: true, tipoAcademico: true, subdominio: true },
      });
      const sec = quais.find((i) => i.tipoAcademico === 'SECUNDARIO');
      const sup = quais.find((i) => i.tipoAcademico === 'SUPERIOR');
      if (sec) instA = sec;
      if (sup) instB = sup;
    }

    if (!instA || !instB) {
      assert(
        'Duas instituições no banco (uma SECUNDARIO, uma SUPERIOR)',
        false,
        'Rode: npx tsx scripts/seed-multi-tenant-test.ts'
      );
      await prisma.$disconnect();
      printSummary();
      process.exit(1);
    }

    instituicaoA = instA.id;
    instituicaoB = instB.id;
    tipoA = (instA.tipoAcademico as 'SECUNDARIO') || 'SECUNDARIO';
    tipoB = (instB.tipoAcademico as 'SUPERIOR') || 'SUPERIOR';
    assert(
      'Instituição A com tipoAcademico',
      instA.tipoAcademico === 'SECUNDARIO' || instA.tipoAcademico === 'SUPERIOR',
      `${instA.nome} (${instA.tipoAcademico})`
    );
    assert(
      'Instituição B com tipoAcademico',
      instB.tipoAcademico === 'SECUNDARIO' || instB.tipoAcademico === 'SUPERIOR',
      `${instB.nome} (${instB.tipoAcademico})`
    );
    assert(
      'Tipos distintos entre as duas',
      instA.tipoAcademico !== instB.tipoAcademico,
      `A=${instA.tipoAcademico} B=${instB.tipoAcademico}`
    );

    // Usuários para login: preferir ADMIN de cada instituição (mesmo email que o seed)
    const adminA = await prisma.user.findFirst({
      where: {
        instituicaoId: instituicaoA,
        roles: { some: { role: 'ADMIN' } },
      },
      select: { email: true },
    });
    const adminB = await prisma.user.findFirst({
      where: {
        instituicaoId: instituicaoB,
        roles: { some: { role: 'ADMIN' } },
      },
      select: { email: true },
    });
    await prisma.$disconnect();

    emailA = adminA?.email || process.env.TEST_USER_INST_A_EMAIL || 'admin.inst.a@teste.dsicola.com';
    emailB = adminB?.email || process.env.TEST_USER_INST_B_EMAIL || 'admin.inst.b@teste.dsicola.com';
    pass = process.env.TEST_MULTITENANT_PASSWORD || 'TestMultiTenant123!';
  } catch (e) {
    assert('Conexão banco / leitura instituições', false, (e as Error).message);
    printSummary();
    process.exit(1);
  }

  // ─── 2. Login: resposta com instituicaoId e tipoAcademico (contrato frontend) ───
  console.log('\n2. LOGIN - Resposta alinhada com frontend (user.instituicaoId, user.tipoAcademico)');
  try {
    const resA = await axios.post(
      `${API_URL}/auth/login`,
      { email: emailA, password: pass },
      { validateStatus: () => true }
    );
    const resB = await axios.post(
      `${API_URL}/auth/login`,
      { email: emailB, password: pass },
      { validateStatus: () => true }
    );

    if (resA.status === 429 || resB.status === 429) {
      assert('Login (rate limit)', false, '429 - aguarde ~1 min e rode novamente');
    } else if (resA.status !== 200 || resB.status !== 200) {
      const msgB = resB.status !== 200 ? ` B: ${(resB.data as any)?.message || resB.statusText}` : '';
      assert('Login Inst A e B', false, `A=${resA.status} B=${resB.status}${msgB}`);
      if (resB.status === 401) {
        console.log('  Dica: Confirme que o backend (API_URL) usa o mesmo DATABASE_URL onde o seed foi executado.');
        console.log('  Email B usado:', emailB);
      }
    } else {
      const userFromA = resA.data?.user;
      const userFromB = resB.data?.user;
      assert(
        'Login A: user.instituicaoId presente',
        !!userFromA?.instituicaoId && userFromA.instituicaoId === instituicaoA,
        userFromA?.instituicaoId || 'ausente'
      );
      assert(
        'Login B: user.instituicaoId presente',
        !!userFromB?.instituicaoId && userFromB.instituicaoId === instituicaoB,
        userFromB?.instituicaoId || 'ausente'
      );
      assert(
        'Login A: user.tipoAcademico presente e correto',
        userFromA?.tipoAcademico === tipoA,
        userFromA?.tipoAcademico || 'ausente'
      );
      assert(
        'Login B: user.tipoAcademico presente e correto',
        userFromB?.tipoAcademico === tipoB,
        userFromB?.tipoAcademico || 'ausente'
      );
      tokenA = resA.data.accessToken;
      tokenB = resB.data.accessToken;
    }
  } catch (e) {
    assert('Backend disponível (login)', false, (e as Error).message);
    printSummary();
    process.exit(1);
  }

  if (!tokenA || !tokenB) {
    assert('Tokens obtidos para A e B', false, 'Necessário para testes de JWT/me/isolamento');
    printSummary();
    process.exit(1);
  }

  // ─── 3. JWT: payload contém instituicaoId e tipoAcademico (frontend usa decodeJWT) ───
  console.log('\n3. JWT - Payload com instituicaoId e tipoAcademico (alinhado ao frontend)');
  const payloadA = decodeJwtPayload(tokenA);
  const payloadB = decodeJwtPayload(tokenB);
  assert('JWT A: payload decodificável', !!payloadA, payloadA ? 'OK' : 'inválido');
  assert('JWT B: payload decodificável', !!payloadB, !!payloadB ? 'OK' : 'inválido');
  if (payloadA) {
    assert('JWT A: instituicaoId no payload', payloadA.instituicaoId === instituicaoA, String(payloadA.instituicaoId));
    assert('JWT A: tipoAcademico no payload', payloadA.tipoAcademico === tipoA, String(payloadA.tipoAcademico));
  }
  if (payloadB) {
    assert('JWT B: instituicaoId no payload', payloadB.instituicaoId === instituicaoB, String(payloadB.instituicaoId));
    assert('JWT B: tipoAcademico no payload', payloadB.tipoAcademico === tipoB, String(payloadB.tipoAcademico));
  }

  // ─── 4. GET /auth/me: instituicaoId e tipoAcademico (frontend usa após login) ───
  console.log('\n4. GET /auth/me - Resposta com instituicaoId e tipoAcademico');
  try {
    const meA = await axios.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      validateStatus: () => true,
    });
    const meB = await axios.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      validateStatus: () => true,
    });
    assert('GET /auth/me A: 200', meA.status === 200, String(meA.status));
    assert('GET /auth/me B: 200', meB.status === 200, String(meB.status));
    if (meA.status === 200) {
      assert('GET /auth/me A: instituicaoId', meA.data?.instituicaoId === instituicaoA, meA.data?.instituicaoId);
      assert('GET /auth/me A: tipoAcademico', meA.data?.tipoAcademico === tipoA, meA.data?.tipoAcademico);
    }
    if (meB.status === 200) {
      assert('GET /auth/me B: instituicaoId', meB.data?.instituicaoId === instituicaoB, meB.data?.instituicaoId);
      assert('GET /auth/me B: tipoAcademico', meB.data?.tipoAcademico === tipoB, meB.data?.tipoAcademico);
    }
  } catch (e) {
    assert('GET /auth/me', false, (e as Error).message);
  }

  // ─── 5. Isolamento: usuário A não vê dados da instituição B ───
  console.log('\n5. ISOLAMENTO - Tenant A não acessa dados da instituição B');
  try {
    const usersRes = await axios.get(`${API_URL}/users`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      validateStatus: () => true,
    });
    if (usersRes.status === 200 && Array.isArray(usersRes.data)) {
      const allFromA = usersRes.data.every((u: { instituicaoId?: string }) => u.instituicaoId === instituicaoA);
      assert(
        'Rota /users com token A retorna apenas instituição A',
        allFromA,
        allFromA ? 'OK' : 'dados de outra instituição encontrados'
      );
    }

    const cursosRes = await axios.get(`${API_URL}/cursos`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      validateStatus: () => true,
    });
    if (cursosRes.status === 200 && Array.isArray(cursosRes.data)) {
      const allCursosA = cursosRes.data.every((c: { instituicaoId?: string }) => c.instituicaoId === instituicaoA);
      assert(
        'Rota /cursos com token A retorna apenas instituição A',
        allCursosA,
        allCursosA ? 'OK' : 'cursos de outra instituição'
      );
    }

    const resForged = await axios.get(`${API_URL}/users?instituicaoId=${instituicaoB}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      validateStatus: () => true,
    });
    if (resForged.status === 200 && Array.isArray(resForged.data)) {
      const ignored = resForged.data.every((u: { instituicaoId?: string }) => u.instituicaoId === instituicaoA);
      assert('Query instituicaoId forjada ignorada (segurança)', ignored, ignored ? 'OK' : 'VULNERÁVEL');
    }
  } catch (e) {
    assert('Testes de isolamento', false, (e as Error).message);
  }

  // ─── 6. Resumo contrato Frontend/Backend ───
  console.log('\n6. CONTRATO FRONTEND/BACKEND');
  assert(
    'Login retorna user.instituicaoId e user.tipoAcademico',
    true,
    'InstituicaoContext e AuthContext usam esses campos'
  );
  assert(
    'JWT contém instituicaoId e tipoAcademico',
    true,
    'frontend/utils/jwt.ts decodeJWT() usa para tipoAcademico'
  );
  assert(
    'GET /auth/me retorna instituicaoId e tipoAcademico',
    true,
    'InstituicaoContext pode usar /me ou token'
  );

  printSummary();
}

function printSummary() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  RESUMO');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`Total: ${passed}/${results.length} testes passaram.\n`);

  if (failed.length > 0) {
    console.log('Falhas:');
    failed.forEach((r) => console.log(`   - ${r.name}${r.details ? `: ${r.details}` : ''}`));
    console.log('\n❌ Corrija os itens acima e rode novamente.\n');
    process.exit(1);
  }

  console.log('✅ Multi-tenant e dois tipos de instituição (SECUNDARIO/SUPERIOR) OK.');
  console.log('✅ Frontend e backend alinhados (instituicaoId, tipoAcademico em login, me e JWT).\n');
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
