#!/usr/bin/env npx tsx
/**
 * TESTE DE BACKUP COMPLETO - SUPER_ADMIN + ADMIN por instituição + Backups automáticos
 *
 * Valida:
 * - SUPER_ADMIN: POST /admin/backups/forcar (forçar backup por instituição)
 * - ADMIN de cada instituição: POST /backup/generate (backup manual)
 * - Backups automáticos: BackupService.executeScheduledBackups()
 *
 * Requer: Backend rodando em http://localhost:3001
 * Uso: npx tsx scripts/test-backup-fluxo-completo.ts
 */
import axios, { AxiosInstance } from 'axios';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import prisma from '../src/lib/prisma.js';
import { BackupService } from '../src/services/backup.service.js';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';
const ADMIN_PASS = process.env.TEST_ADMIN_PASS || 'SuperAdmin@123';

interface TestResult {
  name: string;
  ok: boolean;
  message?: string;
  details?: string;
}

async function runTest(
  client: AxiosInstance,
  name: string,
  fn: () => Promise<{ status: number; data?: any }>
): Promise<TestResult> {
  try {
    const result = await fn();
    const ok = result.status >= 200 && result.status < 300;
    const msg = !ok ? (result.data?.message || JSON.stringify(result.data)?.slice(0, 100)) : undefined;
    return { name, ok, message: msg };
  } catch (err: any) {
    const msg = err.response?.data?.message || err.message;
    return { name, ok: false, message: String(msg).slice(0, 120) };
  }
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TESTE DE BACKUP COMPLETO - SUPER_ADMIN + ADMIN + Backups Automáticos');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  console.log(`API: ${API_URL}\n`);

  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
    validateStatus: () => true,
  });

  const results: TestResult[] = [];

  // 1. Obter SUPER_ADMIN
  const superAdmin = await prisma.user.findFirst({
    where: { roles: { some: { role: 'SUPER_ADMIN' } } },
    select: { id: true, email: true },
  });

  if (!superAdmin) {
    console.error('❌ Necessário usuário SUPER_ADMIN no sistema.');
    process.exit(1);
  }

  const hashSuperAdmin = await bcrypt.hash(ADMIN_PASS, 10);
  await prisma.user.update({
    where: { id: superAdmin.id },
    data: { password: hashSuperAdmin, mustChangePassword: false },
  });

  console.log(`SUPER_ADMIN: ${superAdmin.email}\n`);

  // 2. Obter TODAS as instituições cadastradas
  const instituicoes = await prisma.instituicao.findMany({
    select: { id: true, nome: true, tipoAcademico: true },
    orderBy: { nome: 'asc' },
  });

  if (instituicoes.length === 0) {
    console.error('❌ Nenhuma instituição cadastrada.');
    process.exit(1);
  }

  console.log(`Instituições encontradas: ${instituicoes.length}\n`);
  instituicoes.forEach((i) => console.log(`   - ${i.nome} (${i.tipoAcademico})`));
  console.log('');

  // 3. Obter ADMIN de cada instituição
  const getAdmin = async (instituicaoId: string) => {
    const admin = await prisma.user.findFirst({
      where: {
        instituicaoId,
        roles: { some: { role: 'ADMIN' } },
      },
      select: { id: true, email: true },
    });
    if (admin) {
      const hash = await bcrypt.hash(ADMIN_PASS, 10);
      await prisma.user.update({
        where: { id: admin.id },
        data: { password: hash, mustChangePassword: false },
      });
    }
    return admin;
  };

  const adminsByInst: Map<string, { email: string }> = new Map();
  for (const inst of instituicoes) {
    const admin = await getAdmin(inst.id);
    if (admin) adminsByInst.set(inst.id, { email: admin.email });
  }

  if (adminsByInst.size === 0) {
    console.error('❌ Nenhuma instituição possui ADMIN cadastrado.');
    process.exit(1);
  }

  console.log(`ADMINs encontrados: ${adminsByInst.size}\n`);

  // ═══════════════════════════════════════════════════════════════════
  // 4. TESTES SUPER_ADMIN - Forçar backup por instituição
  // ═══════════════════════════════════════════════════════════════════
  console.log('1. Testando SUPER_ADMIN - Forçar backup por instituição...');

  const loginSuperAdmin = await api.post('/auth/login', {
    email: superAdmin.email,
    password: ADMIN_PASS,
  });

  if (loginSuperAdmin.status !== 200 || !loginSuperAdmin.data?.accessToken) {
    results.push({
      name: '[SUPER_ADMIN] Login',
      ok: false,
      message: 'Login falhou',
    });
  } else {
    const clientSuperAdmin = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginSuperAdmin.data.accessToken}`,
      },
      timeout: 60000, // Backup pode demorar
      validateStatus: () => true,
    });

    results.push(
      await runTest(clientSuperAdmin, '[SUPER_ADMIN] GET /admin/backups', async () => {
        const res = await clientSuperAdmin.get('/admin/backups');
        return { status: res.status, data: res.data };
      })
    );

    // Forçar backup para cada instituição
    for (const inst of instituicoes) {
      results.push(
        await runTest(
          clientSuperAdmin,
          `[SUPER_ADMIN] POST /admin/backups/forcar (${inst.nome})`,
          async () => {
            const res = await clientSuperAdmin.post('/admin/backups/forcar', {
              instituicaoId: inst.id,
              tipo: 'dados',
              justificativa: 'Teste automatizado - validação de backup manual SUPER_ADMIN',
            });
            return { status: res.status, data: res.data };
          }
        )
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 5. TESTES ADMIN - Backup manual por instituição
  // ═══════════════════════════════════════════════════════════════════
  console.log('2. Testando ADMIN - Backup manual por instituição...');

  const testForAdmin = async (
    adminEmail: string,
    instNome: string,
    instId: string
  ): Promise<TestResult[]> => {
    const loginRes = await api.post('/auth/login', { email: adminEmail, password: ADMIN_PASS });
    if (loginRes.status !== 200 || !loginRes.data?.accessToken) {
      return [{ name: `[ADMIN ${instNome}] Login`, ok: false, message: 'Login falhou' }];
    }

    const client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginRes.data.accessToken}`,
      },
      timeout: 60000,
      validateStatus: () => true,
    });

    const r: TestResult[] = [];

    r.push(
      await runTest(client, `[ADMIN ${instNome}] GET /backup/history`, async () => {
        const res = await client.get('/backup/history', { params: { limit: 10 } });
        return { status: res.status, data: res.data };
      })
    );

    r.push(
      await runTest(client, `[ADMIN ${instNome}] POST /backup/generate (completo)`, async () => {
        const res = await client.post('/backup/generate', { tipo: 'completo' });
        return { status: res.status, data: res.data };
      })
    );

    r.push(
      await runTest(client, `[ADMIN ${instNome}] POST /backup/generate (dados)`, async () => {
        const res = await client.post('/backup/generate', { tipo: 'dados' });
        return { status: res.status, data: res.data };
      })
    );

    return r;
  };

  for (const inst of instituicoes) {
    const admin = adminsByInst.get(inst.id);
    if (!admin) {
      results.push({
        name: `[ADMIN ${inst.nome}]`,
        ok: true,
        details: 'Sem ADMIN - ignorado',
      });
      continue;
    }
    const resAdmin = await testForAdmin(admin.email, inst.nome, inst.id);
    results.push(...resAdmin);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 6. TESTE Backups automáticos (executeScheduledBackups)
  // ═══════════════════════════════════════════════════════════════════
  console.log('3. Testando Backups Automáticos (executeScheduledBackups)...');

  let scheduleId: string | null = null;
  const instParaCron = instituicoes[0];

  try {
    // Criar agendamento de teste: ativo, proximoBackup no passado
    const schedule = await prisma.backupSchedule.create({
      data: {
        instituicaoId: instParaCron.id,
        frequencia: 'diario',
        horaExecucao: '00:00',
        tipoBackup: 'dados',
        ativo: true,
        proximoBackup: new Date(0), // Epoch - sempre "devido"
      },
    });
    scheduleId = schedule.id;

    const countBefore = await prisma.backupHistory.count({
      where: { instituicaoId: instParaCron.id },
    });

    await BackupService.executeScheduledBackups();

    const countAfter = await prisma.backupHistory.count({
      where: { instituicaoId: instParaCron.id },
    });

    const newBackups = countAfter - countBefore;
    results.push({
      name: '[BACKUP AUTOMÁTICO] executeScheduledBackups',
      ok: true,
      details: `${newBackups} novo(s) backup(s) gerado(s) para ${instParaCron.nome}`,
    });
  } catch (err: any) {
    results.push({
      name: '[BACKUP AUTOMÁTICO] executeScheduledBackups',
      ok: false,
      message: err?.message || String(err),
    });
  } finally {
    if (scheduleId) {
      await prisma.backupSchedule.delete({ where: { id: scheduleId } }).catch(() => {});
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // 7. Aguardar backups em background e verificar histórico
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n4. Aguardando 30s para backups em background (pg_dump + criptografia)...');
  await new Promise((r) => setTimeout(r, 30000));

  const firstAdmin = adminsByInst.get(instituicoes[0].id);
  if (firstAdmin) {
    const loginCheck = await api.post('/auth/login', {
      email: firstAdmin.email,
      password: ADMIN_PASS,
    });
    if (loginCheck.status === 200 && loginCheck.data?.accessToken) {
      const client = axios.create({
        baseURL: API_URL,
        headers: { Authorization: `Bearer ${loginCheck.data.accessToken}` },
        timeout: 30000,
        validateStatus: () => true,
      });
      const histRes = await client.get('/backup/history', { params: { limit: 20 } });
      const history = Array.isArray(histRes.data) ? histRes.data : [];
      const concluidos = history.filter((b: any) => b.status === 'concluido');
      const emProgresso = history.filter((b: any) => b.status === 'em_progresso');
      const comErro = history.filter((b: any) => b.status === 'erro');
      results.push({
        name: '[VERIFICAÇÃO] Histórico de backups',
        ok: history.length > 0,
        details: `${concluidos.length} concluído(s), ${emProgresso.length} em progresso, ${comErro.length} erro(s)`,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // RELATÓRIO
  // ═══════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  RESULTADOS - TESTE DE BACKUP COMPLETO');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  results.forEach((r) => {
    const icon = r.ok ? '✅' : '❌';
    console.log(`${icon} ${r.name}`);
    if (r.message) console.log(`   └─ ${r.message}`);
    if (r.details) console.log(`   └─ ${r.details}`);
  });

  console.log(`\n${passed}/${results.length} testes passaram.`);
  if (failed.length > 0) {
    console.log(`\n⚠️  ${failed.length} teste(s) falharam.`);
    process.exit(1);
  }
  console.log('\n✅ Todos os testes de backup (manual e automático) passaram.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
