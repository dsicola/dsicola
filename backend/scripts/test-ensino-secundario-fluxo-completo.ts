#!/usr/bin/env npx tsx
/**
 * TESTE FLUXO COMPLETO - Ensino Secundário (Admin cadastrando professor + plano de ensino)
 *
 * Garante:
 * 1. Fluxo completo funciona no ensino secundário (classe, classeOuAno, sem curso/semestre)
 * 2. Isolamento total: ensino superior NÃO é afetado (contagem antes/depois idêntica)
 *
 * Requer: Backend rodando em http://localhost:3001
 * Uso: npx tsx scripts/test-ensino-secundario-fluxo-completo.ts
 *      INSTITUICAO_ID=xxx npx tsx scripts/test-ensino-secundario-fluxo-completo.ts
 */
import axios, { AxiosInstance } from 'axios';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import prisma from '../src/lib/prisma.js';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const SUPER_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'superadmin@dsicola.com';
const SUPER_ADMIN_PASS = process.env.TEST_ADMIN_PASS || 'SuperAdmin@123';
const INSTITUICAO_ID = process.env.INSTITUICAO_ID;

const TEST_PROF_EMAIL = `prof.secundario.test.${Date.now()}@teste.dsicola.com`;
const TEST_PROF_PASS = 'Professor@123';

interface ContagemSuperior {
  planos: number;
  professores: number;
  users: number;
  anosLetivos: number;
}

async function contarDadosSuperior(): Promise<ContagemSuperior> {
  const instSuperior = await prisma.instituicao.findFirst({
    where: { tipoAcademico: 'SUPERIOR' },
    select: { id: true },
  });
  if (!instSuperior) return { planos: 0, professores: 0, users: 0, anosLetivos: 0 };

  const [planos, professores, users, anosLetivos] = await Promise.all([
    prisma.planoEnsino.count({ where: { instituicaoId: instSuperior.id } }),
    prisma.professor.count({ where: { instituicaoId: instSuperior.id } }),
    prisma.user.count({ where: { instituicaoId: instSuperior.id } }),
    prisma.anoLetivo.count({ where: { instituicaoId: instSuperior.id } }),
  ]);
  return { planos, professores, users, anosLetivos };
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TESTE FLUXO COMPLETO - ENSINO SECUNDÁRIO (Admin + Professor + Plano Ensino)');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL}\n`);

  // ─── 0. ISOLAMENTO: Contar dados do ensino SUPERIOR antes ────────────────────────────────
  console.log('0. ISOLAMENTO: Contando dados do Ensino Superior (antes)...');
  const contagemAntes = await contarDadosSuperior();
  console.log(`   Planos: ${contagemAntes.planos} | Professores: ${contagemAntes.professores} | Users: ${contagemAntes.users} | Anos: ${contagemAntes.anosLetivos}\n`);

  // ─── 1. Encontrar instituição SECUNDÁRIA ────────────────────────────────────────────────
  let instituicaoSecundaria: { id: string; nome: string; tipoAcademico: string | null };
  if (INSTITUICAO_ID) {
    const inst = await prisma.instituicao.findUnique({
      where: { id: INSTITUICAO_ID },
      select: { id: true, nome: true, tipoAcademico: true },
    });
    if (!inst) {
      console.error('❌ Instituição não encontrada:', INSTITUICAO_ID);
      process.exit(1);
    }
    instituicaoSecundaria = inst;
  } else {
    const inst = await prisma.instituicao.findFirst({
      where: {
        OR: [{ tipoAcademico: 'SECUNDARIO' }, { tipoInstituicao: 'ENSINO_MEDIO' }],
      },
      select: { id: true, nome: true, tipoAcademico: true },
    });
    if (!inst) {
      console.error('❌ Nenhuma instituição secundária encontrada. Crie uma instituição do ensino secundário.');
      process.exit(1);
    }
    instituicaoSecundaria = inst;
  }
  const instId = instituicaoSecundaria.id;
  console.log(`1. Instituição Secundária: ${instituicaoSecundaria.nome} (${instId})`);
  console.log(`   tipoAcademico: ${instituicaoSecundaria.tipoAcademico ?? 'a definir'}\n`);

  if (instituicaoSecundaria.tipoAcademico !== 'SECUNDARIO') {
    console.log('   ⚠️  tipoAcademico não é SECUNDARIO. Atualizando instituição...');
    await prisma.instituicao.update({
      where: { id: instId },
      data: { tipoAcademico: 'SECUNDARIO' },
    });
    console.log('   ✅ tipoAcademico definido como SECUNDARIO\n');
  }

  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 20000,
    validateStatus: () => true,
  });

  // ─── 2. Login SUPER_ADMIN ───────────────────────────────────────────────────────────────
  console.log('2. Login SUPER_ADMIN...');
  const loginSuper = await api.post('/auth/login', {
    email: SUPER_ADMIN_EMAIL,
    password: SUPER_ADMIN_PASS,
  });
  if (loginSuper.status !== 200 || !loginSuper.data?.accessToken) {
    console.error('❌ Login falhou:', loginSuper.data?.message);
    process.exit(1);
  }
  api.defaults.headers.common['Authorization'] = `Bearer ${loginSuper.data.accessToken}`;
  console.log('   ✅ Login OK\n');

  // ─── 3. Obter ou criar ADMIN da instituição secundária ─────────────────────────────────
  console.log('3. Obter ADMIN da instituição secundária...');
  let adminUser = await prisma.user.findFirst({
    where: {
      instituicaoId: instId,
      roles: { some: { role: 'ADMIN' } },
    },
    select: { id: true, email: true, nomeCompleto: true },
  });

  if (!adminUser) {
    console.log('   Criando usuário ADMIN para instituição secundária...');
    const createAdminRes = await api.post('/users', {
      email: `admin.secundario.${Date.now()}@teste.dsicola.com`,
      password: 'Admin@123',
      nomeCompleto: 'Admin Ensino Secundário Teste',
      role: 'ADMIN',
      instituicaoId: instId,
    });
    if (createAdminRes.status >= 400) {
      console.error('   ❌ Erro ao criar ADMIN:', createAdminRes.data?.message);
      process.exit(1);
    }
    adminUser = createAdminRes.data;
    console.log('   ✅ ADMIN criado:', adminUser.email);
  } else {
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { password: await bcrypt.hash(SUPER_ADMIN_PASS, 10), mustChangePassword: false },
    });
    console.log('   ✅ ADMIN existente:', adminUser.email);
  }
  console.log('');

  // ─── 4. Login como ADMIN (para obter JWT com tipoAcademico=SECUNDARIO) ───────────────────
  console.log('4. Login como ADMIN da instituição secundária...');
  const loginAdmin = await api.post('/auth/login', {
    email: adminUser.email,
    password: SUPER_ADMIN_PASS,
  });
  if (loginAdmin.status !== 200 || !loginAdmin.data?.accessToken) {
    console.error('❌ Login ADMIN falhou');
    process.exit(1);
  }
  const adminToken = loginAdmin.data.accessToken;
  const adminApi = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    timeout: 20000,
    validateStatus: () => true,
  });
  const tipoAcad = loginAdmin.data.user?.tipoAcademico;
  console.log(`   ✅ Login OK | JWT tipoAcademico: ${tipoAcad}\n`);

  if (tipoAcad !== 'SECUNDARIO') {
    console.error('   ❌ JWT deve ter tipoAcademico=SECUNDARIO. Verifique a instituição.');
    process.exit(1);
  }

  // ─── 5. Criar Professor ─────────────────────────────────────────────────────────────────
  console.log('5. Cadastrar Professor...');
  const createProfRes = await adminApi.post('/users', {
    email: TEST_PROF_EMAIL,
    password: TEST_PROF_PASS,
    nomeCompleto: 'Professor Teste Ensino Secundário',
    role: 'PROFESSOR',
  });
  if (createProfRes.status >= 400) {
    console.error('   ❌ Erro ao criar professor:', createProfRes.data?.message);
    process.exit(1);
  }
  const novoUser = createProfRes.data;
  console.log('   ✅ Professor (user) criado:', novoUser.email);

  let professorId: string | null = null;
  const profExistente = await prisma.professor.findFirst({
    where: { userId: novoUser.id, instituicaoId: instId },
  });
  if (profExistente) {
    professorId = profExistente.id;
    console.log('   ✅ Entidade Professor já existe:', professorId);
  } else {
    const createProfEntityRes = await adminApi.post(`/users/${novoUser.id}/professor`);
    if (createProfEntityRes.status >= 400) {
      console.error('   ❌ Erro ao criar entidade Professor:', createProfEntityRes.data?.message);
      process.exit(1);
    }
    professorId = createProfEntityRes.data?.id;
    console.log('   ✅ Entidade Professor criada:', professorId);
  }
  console.log('');

  // ─── 6. Garantir ano letivo ATIVO ───────────────────────────────────────────────────────
  console.log('6. Garantir ano letivo ATIVO...');
  let anoLetivo = await prisma.anoLetivo.findFirst({
    where: { instituicaoId: instId, status: 'ATIVO' },
    select: { id: true, ano: true },
  });
  if (!anoLetivo) {
    const anoAtual = new Date().getFullYear();
    anoLetivo = await prisma.anoLetivo.findFirst({
      where: { instituicaoId: instId },
      select: { id: true, ano: true },
    });
    if (anoLetivo) {
      await prisma.anoLetivo.update({
        where: { id: anoLetivo.id },
        data: { status: 'ATIVO', ativadoEm: new Date(), ativadoPor: adminUser.id },
      });
      console.log('   ✅ Ano letivo ativado:', anoLetivo.ano);
    } else {
      const novo = await prisma.anoLetivo.create({
        data: {
          instituicaoId: instId,
          ano: anoAtual,
          dataInicio: new Date(anoAtual, 0, 1),
          dataFim: new Date(anoAtual, 11, 31),
          status: 'ATIVO',
          ativadoEm: new Date(),
          ativadoPor: adminUser.id,
        },
      });
      anoLetivo = { id: novo.id, ano: novo.ano };
      console.log('   ✅ Ano letivo criado e ativado:', anoLetivo.ano);
    }
  } else {
    console.log('   ✅ Ano letivo ativo existente:', anoLetivo.ano);
  }
  console.log('');

  // ─── 7. Garantir Classe e Disciplina ────────────────────────────────────────────────────
  console.log('7. Garantir Classe e Disciplina (secundário)...');
  let classe = await prisma.classe.findFirst({
    where: { instituicaoId: instId },
    select: { id: true, nome: true },
  });
  if (!classe) {
    classe = await prisma.classe.create({
      data: {
        instituicaoId: instId,
        nome: '10ª Classe',
        codigo: '10C',
      },
      select: { id: true, nome: true },
    });
    console.log('   ✅ Classe criada:', classe.nome);
  } else {
    console.log('   ✅ Classe existente:', classe.nome);
  }

  let disciplina = await prisma.disciplina.findFirst({
    where: { instituicaoId: instId },
    select: { id: true, nome: true },
  });
  if (!disciplina) {
    disciplina = await prisma.disciplina.create({
      data: {
        instituicaoId: instId,
        nome: 'Matemática',
        codigo: 'MAT',
        cargaHoraria: 120,
      },
      select: { id: true, nome: true },
    });
    console.log('   ✅ Disciplina criada:', disciplina.nome);
  } else {
    console.log('   ✅ Disciplina existente:', disciplina.nome);
  }
  console.log('');

  // ─── 8. Criar Plano de Ensino (SECUNDARIO: classeId + classeOuAno) ───────────────────────
  console.log('8. Criar Plano de Ensino (classe + classeOuAno, SEM curso/semestre)...');
  const planoPayload = {
    professorId,
    anoLetivoId: anoLetivo.id,
    disciplinaId: disciplina.id,
    classeId: classe.id,
    classeOuAno: '10ª Classe',
    metodologia: 'Aulas expositivas e exercícios',
    objetivos: 'Dominar conceitos fundamentais',
    conteudoProgramatico: 'Conteúdo programático de teste',
    criteriosAvaliacao: 'Provas e trabalhos',
  };
  const createPlanoRes = await adminApi.post('/plano-ensino', planoPayload);
  if (createPlanoRes.status >= 400) {
    console.error('   ❌ Erro ao criar plano de ensino:', createPlanoRes.data?.message);
    console.error('   Payload:', JSON.stringify(planoPayload, null, 2));
    process.exit(1);
  }
  const plano = createPlanoRes.data;
  console.log('   ✅ Plano de Ensino criado:', plano.id);
  console.log('   - classeId:', plano.classeId);
  console.log('   - classeOuAno:', plano.classeOuAno);
  console.log('   - semestre:', plano.semestre, '(deve ser null no secundário)');
  console.log('   - cursoId:', plano.cursoId, '(deve ser null no secundário)\n');

  // ─── 9. Verificar plano no banco ────────────────────────────────────────────────────────
  console.log('9. Verificar plano de ensino no banco...');
  const planoDb = await prisma.planoEnsino.findFirst({
    where: { id: plano.id, instituicaoId: instId },
    select: { id: true, classeId: true, classeOuAno: true, cursoId: true, semestre: true },
  });
  if (!planoDb) {
    console.error('   ❌ Plano não encontrado no banco');
    process.exit(1);
  }
  if (planoDb.classeId !== classe.id || !planoDb.classeOuAno) {
    console.error('   ❌ Plano sem classe/classeOuAno (regras secundário)');
    process.exit(1);
  }
  if (planoDb.cursoId != null || planoDb.semestre != null) {
    console.error('   ❌ Plano secundário não deve ter cursoId ou semestre');
    process.exit(1);
  }
  console.log('   ✅ Plano válido (classe + classeOuAno, sem curso/semestre)\n');

  // ─── 10. ISOLAMENTO: Verificar que ensino SUPERIOR não foi afetado ──────────────────────
  console.log('10. ISOLAMENTO: Verificando que Ensino Superior não foi afetado...');
  const contagemDepois = await contarDadosSuperior();
  const mudou =
    contagemDepois.planos !== contagemAntes.planos ||
    contagemDepois.professores !== contagemAntes.professores ||
    contagemDepois.users !== contagemAntes.users ||
    contagemDepois.anosLetivos !== contagemAntes.anosLetivos;

  console.log(`   Antes:  planos=${contagemAntes.planos} professores=${contagemAntes.professores} users=${contagemAntes.users} anos=${contagemAntes.anosLetivos}`);
  console.log(`   Depois: planos=${contagemDepois.planos} professores=${contagemDepois.professores} users=${contagemDepois.users} anos=${contagemDepois.anosLetivos}`);

  if (mudou) {
    console.error('\n   ❌ ISOLAMENTO QUEBRADO: Dados do Ensino Superior foram alterados!');
    process.exit(1);
  }
  console.log('   ✅ Isolamento total: Ensino Superior inalterado\n');

  await prisma.$disconnect();

  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('  ✅ TESTE PASSOU: Fluxo completo Ensino Secundário + isolamento garantido');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
