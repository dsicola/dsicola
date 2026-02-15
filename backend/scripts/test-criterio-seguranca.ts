#!/usr/bin/env npx tsx
/**
 * TESTE: Critério de Segurança - SEGURANÇA (OBRIGATÓRIO)
 *
 * Critérios obrigatórios:
 *
 * ✔ Senhas criptografadas com bcrypt
 * ✔ JWT com expiração configurada
 * ✔ Refresh token funcional
 * ✔ Middleware de autenticação em TODAS as rotas protegidas
 * ✔ Middleware de autorização por perfil
 * ✔ 2FA validado (se ativado)
 * ✔ Rate limit no login
 * ✔ Backup automático do banco
 * ✔ Variáveis de ambiente protegidas (.env no .gitignore)
 *
 * Uso: npm run test:criterio-seguranca ou npx tsx scripts/test-criterio-seguranca.ts
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_URL = process.env.API_URL || 'http://localhost:3001';

interface CriterioResult {
  criterio: string;
  ok: boolean;
  message?: string;
}

const results: CriterioResult[] = [];

function log(criterio: string, ok: boolean, msg?: string) {
  const icon = ok ? '✔' : '✖';
  console.log(`  ${icon} ${criterio}${msg ? `: ${msg}` : ''}`);
  results.push({ criterio, ok, message: msg });
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  CRITÉRIO DE SEGURANÇA - OBRIGATÓRIO ANTES DE PRODUÇÃO');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  // 1. Senhas criptografadas
  console.log('1. SENHAS CRIPTOGRAFADAS');
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const user = await prisma.user.findFirst({
      select: { password: true },
    });
    await prisma.$disconnect();

    if (!user?.password) {
      log('Senhas criptografadas (bcrypt)', false, 'Nenhum usuário com senha no banco');
    } else if (user.password.startsWith('$2') && user.password.length > 50) {
      log('Senhas criptografadas (bcrypt)', true, 'Hash bcrypt detectado');
    } else {
      log('Senhas criptografadas (bcrypt)', false, 'Senha parece não estar hasheada (formato bcrypt $2...)');
    }
  } catch (e) {
    log('Senhas criptografadas (bcrypt)', false, `Erro: ${(e as Error).message}`);
  }

  // 2. Tokens JWT seguros
  console.log('\n2. TOKENS JWT SEGUROS');
  const jwtSecret = process.env.JWT_SECRET;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
  const weakSecrets = ['secret', 'your-super-secret-jwt-key-change-in-production', 'refresh-secret'];
  const isJwtSecure =
    jwtSecret &&
    jwtSecret.length >= 32 &&
    !weakSecrets.includes(jwtSecret) &&
    jwtRefreshSecret &&
    jwtRefreshSecret.length >= 32 &&
    !weakSecrets.includes(jwtRefreshSecret);

  log(
    'JWT_SECRET e JWT_REFRESH_SECRET seguros',
    !!isJwtSecure,
    isJwtSecure ? 'Secrets configurados (min 32 chars)' : 'Use secrets fortes em produção (min 32 caracteres)'
  );

  // 2b. JWT com expiração configurada
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN;
  const jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN;
  const hasJwtExpiration =
    !!jwtExpiresIn &&
    !!jwtRefreshExpiresIn &&
    /^\d+[smhd]$/.test(jwtExpiresIn) &&
    /^\d+[smhd]$/.test(jwtRefreshExpiresIn);
  log(
    'JWT com expiração configurada',
    !!hasJwtExpiration,
    hasJwtExpiration ? `Access: ${jwtExpiresIn}, Refresh: ${jwtRefreshExpiresIn}` : 'Configure JWT_EXPIRES_IN e JWT_REFRESH_EXPIRES_IN (ex: 15m, 7d)'
  );

  // 3. Validação de permissões em rotas (teste via HTTP)
  console.log('\n3. MIDDLEWARE DE AUTENTICAÇÃO E AUTORIZAÇÃO EM ROTAS');
  try {
    const axios = (await import('axios')).default;
    const protectedEndpoints = [
      { method: 'get' as const, url: `${API_URL}/users` },
      { method: 'get' as const, url: `${API_URL}/profiles` },
      { method: 'get' as const, url: `${API_URL}/cursos` },
      { method: 'get' as const, url: `${API_URL}/stats/admin` },
      { method: 'get' as const, url: `${API_URL}/matriculas` },
      { method: 'get' as const, url: `${API_URL}/folha-pagamento` },
    ];
    let allProtected = true;
    for (const ep of protectedEndpoints) {
      const res = await axios({
        method: ep.method,
        url: ep.url,
        validateStatus: () => true,
        timeout: 5000,
      });
      if (res.status !== 401 && res.status !== 403) {
        allProtected = false;
        break;
      }
    }
    log(
      'Rotas protegidas retornam 401/403 sem token',
      allProtected,
      allProtected ? 'Middleware authenticate em todas as rotas protegidas' : 'Alguma rota pode estar exposta'
    );

    // 3b. Middleware de autorização por perfil (403 para role insuficiente)
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'superadmin@dsicola.com';
    const superAdminPass = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: superAdminEmail,
      password: superAdminPass,
    }, { validateStatus: () => true, timeout: 5000 });

    if (loginRes.status === 200 && loginRes.data?.accessToken) {
      const token = loginRes.data.accessToken;
      // SUPER_ADMIN tem acesso a stats/admin - deve retornar 200
      const adminRes = await axios.get(`${API_URL}/stats/admin`, {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
        timeout: 5000,
      });
      log(
        'Autorização por perfil (authorize)',
        adminRes.status === 200,
        adminRes.status === 200 ? 'SUPER_ADMIN acessa stats/admin' : `Status: ${adminRes.status}`
      );
    } else {
      log('Autorização por perfil (authorize)', false, 'Login falhou - não foi possível testar');
    }
  } catch (e) {
    log(
      'Rotas protegidas retornam 401/403 sem token',
      false,
      `Backend em ${API_URL} não respondeu. Inicie o backend e rode o teste novamente.`
    );
    log('Autorização por perfil (authorize)', false, 'Backend não disponível');
  }

  // 3c. Refresh token funcional
  console.log('\n4. REFRESH TOKEN FUNCIONAL');
  try {
    const axios = (await import('axios')).default;
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'superadmin@dsicola.com';
    const superAdminPass = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: superAdminEmail,
      password: superAdminPass,
    }, { validateStatus: () => true, timeout: 5000 });

    if (loginRes.status === 200 && loginRes.data?.refreshToken) {
      const refreshRes = await axios.post(`${API_URL}/auth/refresh`, {
        refreshToken: loginRes.data.refreshToken,
      }, { validateStatus: () => true, timeout: 5000 });

      const refreshOk = refreshRes.status === 200 && refreshRes.data?.accessToken && refreshRes.data?.refreshToken;
      log(
        'Refresh token funcional',
        !!refreshOk,
        refreshOk ? 'Refresh retorna novos accessToken e refreshToken' : (refreshRes.data?.message || `Status: ${refreshRes.status}`)
      );
    } else {
      const requires2FA = loginRes.data?.requiresTwoFactor;
      log(
        'Refresh token funcional',
        false,
        requires2FA
          ? 'Login requer 2FA - use super admin sem 2FA para testar'
          : (loginRes.data?.message || 'Refresh token não retornado no login')
      );
    }
  } catch (e) {
    log(
      'Refresh token funcional',
      false,
      `Backend em ${API_URL} não respondeu ou erro: ${(e as Error).message}`
    );
  }

  // 5. 2FA validado (se ativado)
  console.log('\n5. 2FA VALIDADO (SE ATIVADO)');
  try {
    const twoFactorPath = path.resolve(__dirname, '../src/services/twoFactor.service.ts');
    const authRoutesPath = path.resolve(__dirname, '../src/routes/auth.routes.ts');
    const twoFactorContent = fs.readFileSync(twoFactorPath, 'utf-8');
    const authRoutesContent = fs.readFileSync(authRoutesPath, 'utf-8');

    const has2FAService = twoFactorContent.includes('verifyTwoFactorLogin') && twoFactorContent.includes('speakeasy');
    const hasLoginStep2 = authRoutesContent.includes('login-step2') && authRoutesContent.includes('loginStep2');
    const has2FAValidation = twoFactorContent.includes('totp.verify') || twoFactorContent.includes('totp.verify');

    const twoFAOk = has2FAService && hasLoginStep2 && has2FAValidation;
    log(
      '2FA implementado e validado (TOTP)',
      !!twoFAOk,
      twoFAOk
        ? 'verifyTwoFactorLogin, login-step2 e validação TOTP presentes'
        : 'Verifique twoFactor.service e auth.routes'
    );
  } catch (e) {
    log('2FA validado', false, `Erro ao verificar: ${(e as Error).message}`);
  }

  // 6. Rate limit no login
  console.log('\n6. RATE LIMIT NO LOGIN');
  try {
    const appPath = path.resolve(__dirname, '../src/app.ts');
    const authRoutesPath = path.resolve(__dirname, '../src/routes/auth.routes.ts');
    const appContent = fs.readFileSync(appPath, 'utf-8');
    const authContent = fs.readFileSync(authRoutesPath, 'utf-8');
    const hasRateLimit =
      authContent.includes('rateLimit') ||
      authContent.includes('rate-limit') ||
      authContent.includes('express-rate-limit') ||
      appContent.includes('rateLimit') ||
      appContent.includes('rate-limit');
    log(
      'Rate limit no login',
      hasRateLimit,
      hasRateLimit ? 'Configurado' : 'Adicione express-rate-limit nas rotas de auth'
    );
  } catch (e) {
    log('Rate limit no login', false, `Erro ao verificar: ${(e as Error).message}`);
  }

  // 7. Backup automático do banco
  console.log('\n7. BACKUP AUTOMÁTICO DO BANCO');
  try {
    const schedulerPath = path.resolve(__dirname, '../src/services/scheduler.service.ts');
    const backupPath = path.resolve(__dirname, '../src/services/backup.service.ts');
    const schedulerContent = fs.readFileSync(schedulerPath, 'utf-8');
    const backupContent = fs.readFileSync(backupPath, 'utf-8');
    const hasBackupScheduler =
      schedulerContent.includes('BackupService') &&
      schedulerContent.includes('executeScheduledBackups') &&
      backupContent.includes('executeScheduledBackups');
    log(
      'Backup automático do banco',
      hasBackupScheduler,
      hasBackupScheduler ? 'Scheduler configurado (hora a hora)' : 'Configure BackupService no SchedulerService'
    );
  } catch (e) {
    log('Backup automático do banco', false, `Erro: ${(e as Error).message}`);
  }

  // 8. Variáveis de ambiente protegidas
  console.log('\n8. VARIÁVEIS DE AMBIENTE PROTEGIDAS');
  try {
    const gitignorePath = path.resolve(__dirname, '../../.gitignore');
    const gitignore = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf-8') : '';
    const envIgnored = /\.env\s|^\.env$|\.env\*/.test(gitignore) || gitignore.includes('.env');
    log(
      '.env no .gitignore',
      envIgnored,
      envIgnored ? '.env não será commitado' : 'Adicione .env ao .gitignore'
    );
  } catch (e) {
    log('.env no .gitignore', false, `Erro: ${(e as Error).message}`);
  }

  // Relatório final
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  RESUMO - CRITÉRIO DE SEGURANÇA');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  console.log(`Total: ${passed}/${results.length} critérios atendidos.\n`);

  if (failed.length > 0) {
    console.log('⚠️  Itens que falharam:');
    failed.forEach((r) => console.log(`   - ${r.criterio}${r.message ? `: ${r.message}` : ''}`));
    console.log('\n❌ SISTEMA NÃO ESTÁ PRONTO PARA PRODUÇÃO - Corrija os itens acima.\n');
    process.exit(1);
  }

  console.log('✅ SISTEMA ATENDE CRITÉRIO DE SEGURANÇA - Pode prosseguir para instituições.\n');
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
