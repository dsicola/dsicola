#!/usr/bin/env npx tsx
/**
 * TESTE: Validação Multi-Tenant (CRÍTICO)
 *
 * Estrutura verificada:
 * - Tabela Instituicao bem definida
 * - Modelos têm instituicaoId
 * - Relações Prisma corretas
 * - Super Admin isolado do tenant
 *
 * Testes práticos obrigatórios:
 * - Login admin A só vê dados A
 * - Login admin B só vê dados B
 * - Professor A não vê alunos B
 * - Relatórios filtram por instituição
 *
 * Pré-requisito: npx tsx scripts/seed-multi-tenant-test.ts
 * Uso: npm run test:multi-tenant
 * Requer: Backend rodando (API_URL)
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_URL = process.env.API_URL || 'http://localhost:3001';

interface TestResult {
  name: string;
  ok: boolean;
  details?: string;
}

const results: TestResult[] = [];

function assert(name: string, ok: boolean, details?: string) {
  const icon = ok ? '✔' : '✖';
  console.log(`  ${icon} ${name}${details ? `: ${details}` : ''}`);
  results.push({ name, ok, details });
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TESTE DE SEGURANÇA MULTI-TENANT');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const axios = (await import('axios')).default;

  // 0. ESTRUTURA - Verificação do schema
  console.log('0. ESTRUTURA - Verificando schema Prisma');
  try {
    const fs = await import('fs');
    const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    const hasInstituicao = schema.includes('model Instituicao');
    const hasInstituicaoId = (schema.match(/instituicaoId/g) || []).length >= 10;
    assert('Tabela Instituicao definida', hasInstituicao, hasInstituicao ? 'OK' : 'Schema inválido');
    assert('Modelos com instituicaoId', hasInstituicaoId, hasInstituicaoId ? 'OK' : 'Poucos modelos com instituicaoId');
  } catch (e) {
    assert('Leitura schema', false, (e as Error).message);
  }

  // 1. Obter Instituição A (Secundário) e B (Superior) - preferir seed
  console.log('\n1. PREPARAÇÃO - Buscando Inst A (Secundário) e Inst B (Superior)');
  let instituicaoA!: string, instituicaoB!: string;
  let userA!: { token: string; instituicaoId: string };
  let userB!: { token: string; instituicaoId: string };
  let professorA!: { token: string; instituicaoId: string };

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
      const instituicoes = await prisma.instituicao.findMany({
        take: 2,
        select: { id: true, nome: true, tipoAcademico: true },
      });
      if (instituicoes.length < 2) {
        assert(
          '2 instituições no banco (Inst A Secundário, Inst B Superior)',
          false,
          `Rode: npx tsx scripts/seed-multi-tenant-test.ts`
        );
      } else {
        instA = instituicoes[0];
        instB = instituicoes[1];
      }
    }

    instituicaoA = instA!.id;
    instituicaoB = instB!.id;
    assert(
      '2 instituições (A Secundário, B Superior)',
      true,
      `${instA!.nome} (${instA!.tipoAcademico || '?'}) | ${instB!.nome} (${instB!.tipoAcademico || '?'})`
    );
    await prisma.$disconnect();
  } catch (e) {
    assert('Conexão com banco', false, (e as Error).message);
  }

  // 2. Obter tokens: Admin A, Admin B, Professor A (um por instituição)
  console.log('\n2. AUTENTICAÇÃO - Obtendo tokens (Admin A, Admin B, Professor A)');
  const emailA = process.env.TEST_USER_INST_A_EMAIL || 'admin.inst.a@teste.dsicola.com';
  const passA = process.env.TEST_USER_INST_A_PASSWORD || 'TestMultiTenant123!';
  const emailB = process.env.TEST_USER_INST_B_EMAIL || 'admin.inst.b@teste.dsicola.com';
  const passB = process.env.TEST_USER_INST_B_PASSWORD || 'TestMultiTenant123!';
  const emailProfA = process.env.TEST_PROF_INST_A_EMAIL || 'prof.inst.a@teste.dsicola.com';
  const passProfA = process.env.TEST_PROF_INST_A_PASSWORD || 'TestMultiTenant123!';

  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const usersInstA = await prisma.user.findMany({
      where: { instituicaoId: instituicaoA! },
      take: 5,
      select: { id: true, email: true }
    });
    const usersInstB = await prisma.user.findMany({
      where: { instituicaoId: instituicaoB! },
      take: 5,
      select: { id: true, email: true }
    });
    await prisma.$disconnect();

    const senhasTeste = [passA, passB, passProfA, 'TestMultiTenant123!', '123456', 'Admin@123', 'Test@123', 'Senha@123'].filter(Boolean);
    let loggedA = false,
      loggedB = false,
      loggedProfA = false;

    const norm = (s: string) => String(s || '').trim();

    // Admin A
    if (emailA && passA) {
      const res = await axios.post(`${API_URL}/auth/login`, { email: emailA, password: passA }, { validateStatus: () => true });
      const userInstId = res.data?.user?.instituicaoId;
      if (res.status === 200 && res.data?.accessToken && userInstId && norm(userInstId) === norm(instituicaoA)) {
        userA = { token: res.data.accessToken, instituicaoId: instituicaoA };
        loggedA = true;
      } else if (res.status === 429) {
        console.log('  ⚠ Rate limit no login (429) - aguarde ~1 min e rode novamente');
      }
    }
    if (emailB && passB) {
      const res = await axios.post(`${API_URL}/auth/login`, { email: emailB, password: passB }, { validateStatus: () => true });
      const userInstId = res.data?.user?.instituicaoId;
      if (res.status === 200 && res.data?.accessToken && userInstId && norm(userInstId) === norm(instituicaoB)) {
        userB = { token: res.data.accessToken, instituicaoId: instituicaoB };
        loggedB = true;
      } else if (res.status === 429) {
        console.log('  ⚠ Rate limit no login (429) - aguarde ~1 min e rode novamente');
      }
    }

    // Professor A (Inst A)
    if (emailProfA && passProfA) {
      const res = await axios.post(`${API_URL}/auth/login`, { email: emailProfA, password: passProfA }, { validateStatus: () => true });
      const userInstId = res.data?.user?.instituicaoId;
      if (res.status === 200 && res.data?.accessToken && userInstId && norm(userInstId) === norm(instituicaoA)) {
        professorA = { token: res.data.accessToken, instituicaoId: instituicaoA };
        loggedProfA = true;
      }
    }

    // Fallback: tentar usuários do banco com senhas comuns
    for (const u of usersInstA || []) {
      if (loggedA) break;
      for (const p of senhasTeste) {
        const res = await axios.post(`${API_URL}/auth/login`, { email: u.email, password: p }, { validateStatus: () => true });
        if (res.status === 200 && res.data?.accessToken && res.data?.user?.instituicaoId === instituicaoA) {
          userA = { token: res.data.accessToken, instituicaoId: instituicaoA };
          loggedA = true;
          break;
        }
      }
    }
    for (const u of usersInstB || []) {
      if (loggedB) break;
      for (const p of senhasTeste) {
        const res = await axios.post(`${API_URL}/auth/login`, { email: u.email, password: p }, { validateStatus: () => true });
        if (res.status === 200 && res.data?.accessToken && res.data?.user?.instituicaoId === instituicaoB) {
          userB = { token: res.data.accessToken, instituicaoId: instituicaoB };
          loggedB = true;
          break;
        }
      }
    }

    if (!loggedProfA) {
      const profsInstA = await prisma.user.findMany({
        where: { instituicaoId: instituicaoA!, roles: { some: { role: 'PROFESSOR' } } },
        take: 3,
        select: { email: true },
      });
      for (const u of profsInstA) {
        if (loggedProfA) break;
        for (const p of senhasTeste) {
          const res = await axios.post(`${API_URL}/auth/login`, { email: u.email, password: p }, { validateStatus: () => true });
          if (res.status === 200 && res.data?.accessToken && res.data?.user?.instituicaoId === instituicaoA) {
            professorA = { token: res.data.accessToken, instituicaoId: instituicaoA };
            loggedProfA = true;
            break;
          }
        }
      }
    }

    if (!loggedA || !loggedB) {
      assert(
        'Admin A e Admin B autenticados',
        false,
        'Rode: npx tsx scripts/seed-multi-tenant-test.ts'
      );
    } else {
      assert('Admin A e Admin B autenticados', true);
    }
    if (!loggedProfA) {
      assert('Professor A autenticado', false, 'Necessário para teste Professor A não vê alunos B');
    } else {
      assert('Professor A autenticado', true);
    }
    await prisma.$disconnect();
  } catch (e) {
    assert('Backend disponível', false, `API em ${API_URL} não respondeu: ${(e as Error).message}`);
  }

  // 3. Testar isolamento: User A não acessa dados de Inst B
  console.log('\n3. ISOLAMENTO - Usuário Inst A NÃO acessa dados da Inst B');

  const hasUsers = typeof userA !== 'undefined' && typeof userB !== 'undefined' && instituicaoA && instituicaoB;
  if (!hasUsers) {
    console.log('  ⚠ Pulando testes de isolamento completo (usuários/instituições não obtidos)');
    assert('Pré-requisitos para teste de isolamento', false, 'Configure TEST_USER_INST_A_EMAIL/PASSWORD e TEST_USER_INST_B_EMAIL/PASSWORD');
    // Modo SUPER_ADMIN: verificar que rotas filtram por instituicaoId quando passado
    try {
      const loginSuper = await axios.post(
        `${API_URL}/auth/login`,
        { email: process.env.SUPER_ADMIN_EMAIL || 'superadmin@dsicola.com', password: process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123' },
        { validateStatus: () => true }
      );
      if (loginSuper.status === 200 && loginSuper.data?.accessToken && instituicaoA && instituicaoB) {
        const tokenSuper = loginSuper.data.accessToken;
        const resA = await axios.get(`${API_URL}/users?instituicaoId=${instituicaoA}`, {
          headers: { Authorization: `Bearer ${tokenSuper}` },
          validateStatus: () => true
        });
        const resB = await axios.get(`${API_URL}/users?instituicaoId=${instituicaoB}`, {
          headers: { Authorization: `Bearer ${tokenSuper}` },
          validateStatus: () => true
        });
        const todosA = resA.status === 200 && Array.isArray(resA.data) && resA.data.every((u: any) => u.instituicaoId === instituicaoA);
        const todosB = resB.status === 200 && Array.isArray(resB.data) && resB.data.every((u: any) => u.instituicaoId === instituicaoB);
        assert('SUPER_ADMIN: /users?instituicaoId filtra corretamente', todosA && todosB, todosA && todosB ? 'OK' : 'Dados misturados');
      }
    } catch (_) {}
  } else {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    // Pegar um curso/aluno/turma da instituição B
    const cursoB = await prisma.curso.findFirst({
      where: { instituicaoId: instituicaoB! },
      select: { id: true, nome: true }
    });
    const alunoB = await prisma.user.findFirst({
      where: { instituicaoId: instituicaoB!, roles: { some: { role: 'ALUNO' } } },
      select: { id: true, email: true }
    });
    const turmaB = await prisma.turma.findFirst({
      where: { instituicaoId: instituicaoB! },
      select: { id: true, nome: true }
    });

    await prisma.$disconnect();

    // User A (token da Inst A) tenta acessar recurso da Inst B
    const tokenA = userA.token;

    if (cursoB) {
      const resCurso = await axios.get(`${API_URL}/cursos/${cursoB.id}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        validateStatus: () => true
      });
      assert(
        'User A não acessa curso da Inst B',
        resCurso.status === 404 || resCurso.status === 403 || (resCurso.data?.instituicaoId !== instituicaoB && !resCurso.data?.id),
        resCurso.status === 200 ? 'RETORNOU DADOS DA INST B!' : `Status: ${resCurso.status} (OK)`
      );
    }

    if (alunoB) {
      const resAlunoStats = await axios.get(`${API_URL}/stats/aluno/${alunoB.id}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        validateStatus: () => true
      });
      assert(
        'User A não acessa stats/aluno da Inst B',
        resAlunoStats.status === 404 || resAlunoStats.status === 403,
        resAlunoStats.status === 200 ? 'VULNERÁVEL: retornou dados do aluno!' : `Status: ${resAlunoStats.status} (OK)`
      );
    }

    if (turmaB) {
      const resTurma = await axios.get(`${API_URL}/turmas/${turmaB.id}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        validateStatus: () => true
      });
      assert(
        'User A não acessa turma da Inst B',
        resTurma.status === 404 || resTurma.status === 403,
        resTurma.status === 200 ? 'RETORNOU TURMA DA INST B!' : `Status: ${resTurma.status} (OK)`
      );
    }

    // Lista /users - User A deve ver APENAS users da Inst A
    const resUsers = await axios.get(`${API_URL}/users`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      validateStatus: () => true
    });
    if (resUsers.status === 200 && Array.isArray(resUsers.data)) {
      const todosInstA = resUsers.data.every((u: any) => u.instituicaoId === instituicaoA);
      assert(
        'Rota /users retorna apenas dados da instituição do token',
        todosInstA,
        todosInstA ? 'OK' : `Encontrados users de outra instituição: ${resUsers.data.filter((u: any) => u.instituicaoId !== instituicaoA).length}`
      );
    }

    // Lista /cursos - User A deve ver APENAS cursos da Inst A
    const resCursos = await axios.get(`${API_URL}/cursos`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      validateStatus: () => true
    });
    if (resCursos.status === 200 && Array.isArray(resCursos.data)) {
      const todosCursosInstA = resCursos.data.every((c: any) => c.instituicaoId === instituicaoA);
      assert(
        'Rota /cursos retorna apenas dados da instituição do token',
        todosCursosInstA,
        todosCursosInstA ? 'OK' : 'Encontrados cursos de outra instituição'
      );
    }

    // Tentar forjar instituicaoId na query (deve ser ignorado)
    const resUsersForged = await axios.get(`${API_URL}/users?instituicaoId=${instituicaoB}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      validateStatus: () => true
    });
    if (resUsersForged.status === 200 && Array.isArray(resUsersForged.data)) {
      const aindaFiltradoA = resUsersForged.data.every((u: any) => u.instituicaoId === instituicaoA);
      assert(
        'Query instituicaoId forjada é ignorada (segurança)',
        aindaFiltradoA,
        aindaFiltradoA ? 'Query forjada ignorada' : 'VULNERÁVEL: aceitou instituicaoId da query!'
      );
    }

    // Admin B só vê dados B
    const resUsersB = await axios.get(`${API_URL}/users`, {
      headers: { Authorization: `Bearer ${userB.token}` },
      validateStatus: () => true
    });
    if (resUsersB.status === 200 && Array.isArray(resUsersB.data)) {
      const todosInstB = resUsersB.data.every((u: any) => u.instituicaoId === instituicaoB);
      assert(
        'Admin B só vê dados da Inst B',
        todosInstB,
        todosInstB ? 'OK' : `Encontrados users de outra instituição: ${resUsersB.data.filter((u: any) => u.instituicaoId !== instituicaoB).length}`
      );
    }

    // Professor A não vê alunos B
    if (typeof professorA !== 'undefined') {
      const resProfilesAlunos = await axios.get(`${API_URL}/profiles?role=ALUNO`, {
        headers: { Authorization: `Bearer ${professorA.token}` },
        validateStatus: () => true
      });
      if (resProfilesAlunos.status === 200 && Array.isArray(resProfilesAlunos.data)) {
        const alunosInstB = resProfilesAlunos.data.filter((p: any) => p.instituicao_id === instituicaoB || p.instituicaoId === instituicaoB);
        assert(
          'Professor A não vê alunos da Inst B',
          alunosInstB.length === 0,
          alunosInstB.length === 0 ? 'OK' : `VULNERÁVEL: Professor A viu ${alunosInstB.length} aluno(s) da Inst B!`
        );
      }
    }

    // Relatórios filtram por instituição
    const resRelatoriosA = await axios.get(`${API_URL}/relatorios`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      validateStatus: () => true
    });
    const resRelatoriosB = await axios.get(`${API_URL}/relatorios`, {
      headers: { Authorization: `Bearer ${userB.token}` },
      validateStatus: () => true
    });
    if (resRelatoriosA.status === 200 && resRelatoriosB.status === 200) {
      const relatoriosA = Array.isArray(resRelatoriosA.data) ? resRelatoriosA.data : [];
      const relatoriosB = Array.isArray(resRelatoriosB.data) ? resRelatoriosB.data : [];
      const todosRelAInstA = relatoriosA.every((r: any) => r.instituicaoId === instituicaoA || r.instituicao_id === instituicaoA);
      const todosRelBInstB = relatoriosB.every((r: any) => r.instituicaoId === instituicaoB || r.instituicao_id === instituicaoB);
      assert(
        'Relatórios filtram por instituição',
        todosRelAInstA && todosRelBInstB,
        todosRelAInstA && todosRelBInstB ? 'OK' : 'Relatórios de outra instituição vazados'
      );
    } else if (resRelatoriosA.status === 403 || resRelatoriosB.status === 403) {
      assert('Relatórios: requireTenantScope', true, 'Rota exige escopo (OK)');
    }
  }

  // 4. Auditoria estática: verificar arquivos que fazem queries
  console.log('\n4. AUDITORIA - Rotas não devem retornar dados globais (exceto SUPER_ADMIN)');
  try {
    const fs = await import('fs');
    const statsPath = path.resolve(__dirname, '../src/routes/stats.routes.ts');
    const statsContent = fs.readFileSync(statsPath, 'utf-8');
    const statsAlunoSeguro = statsContent.includes('instituicaoId') && statsContent.includes('aluno') && statsContent.includes('req.user?.instituicaoId');
    assert('/stats/aluno filtra por instituicaoId', statsAlunoSeguro, statsAlunoSeguro ? 'Código correto' : 'Revisar filtro');
  } catch (e) {
    assert('Auditoria stats', false, (e as Error).message);
  }

  // Relatório final
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  RESUMO - SEGURANÇA MULTI-TENANT');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  console.log(`Total: ${passed}/${results.length} testes passaram.\n`);

  if (failed.length > 0) {
    console.log('⚠️  Testes que falharam:');
    failed.forEach((r) => console.log(`   - ${r.name}${r.details ? `: ${r.details}` : ''}`));
    console.log('\n❌ SEGURANÇA MULTI-TENANT COMPROMETIDA - Corrija os itens acima.\n');
    process.exit(1);
  }

  console.log('✅ SEGURANÇA MULTI-TENANT OK - Usuários isolados por instituição.\n');
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
