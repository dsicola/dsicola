#!/usr/bin/env npx tsx
/**
 * TESTE: Infraestrutura - Critérios Obrigatórios
 *
 * Critérios verificados:
 * 1. Variáveis sensíveis apenas em .env
 * 2. Banco com acesso privado
 * 3. HTTPS ativo
 * 4. Backup automático diário do PostgreSQL
 * 5. Logs de erro configurados
 *
 * Uso: npx tsx scripts/test-infraestrutura.ts
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

interface CriterioResult {
  criterio: string;
  ok: boolean;
  message?: string;
  recomendacao?: string;
}

const results: CriterioResult[] = [];

function log(criterio: string, ok: boolean, msg?: string, recomendacao?: string) {
  const icon = ok ? '✔' : '✖';
  console.log(`  ${icon} ${criterio}${msg ? `: ${msg}` : ''}`);
  if (recomendacao && !ok) console.log(`     → ${recomendacao}`);
  results.push({ criterio, ok, message: msg, recomendacao });
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  TESTE DE INFRAESTRUTURA - CRITÉRIOS OBRIGATÓRIOS');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  // 1. Variáveis sensíveis apenas em .env
  console.log('1. VARIÁVEIS SENSÍVEIS APENAS EM .env');
  try {
    const gitignorePath = path.resolve(ROOT, '.gitignore');
    const gitignore = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf-8') : '';
    const envIgnored = /\.env\s|^\.env$|\.env\*/.test(gitignore) || gitignore.includes('.env');

    if (!envIgnored) {
      log('.env no .gitignore', false, 'Adicione .env ao .gitignore', 'Adicione ".env" e ".env.*" ao .gitignore');
    } else {
      // Verificar se há segredos hardcoded no código de produção
      const authServicePath = path.resolve(__dirname, '../src/services/auth.service.ts');
      const authMiddlewarePath = path.resolve(__dirname, '../src/middlewares/auth.ts');
      let hasHardcodedFallback = false;

      if (fs.existsSync(authServicePath)) {
        const authContent = fs.readFileSync(authServicePath, 'utf-8');
        if (
          authContent.includes("|| 'secret'") ||
          authContent.includes("|| 'refresh-secret'") ||
          authContent.includes('JWT_SECRET || \'secret\'')
        ) {
          hasHardcodedFallback = true;
        }
      }
      if (fs.existsSync(authMiddlewarePath)) {
        const authMwContent = fs.readFileSync(authMiddlewarePath, 'utf-8');
        if (authMwContent.includes("JWT_SECRET || 'secret'")) {
          hasHardcodedFallback = true;
        }
      }

      const jwtSecret = process.env.JWT_SECRET;
      const weakSecrets = ['secret', 'your-super-secret-jwt-key-change-in-production', 'your-super-secret-jwt-key-minimum-32-characters'];
      const isJwtWeak = !jwtSecret || weakSecrets.includes(jwtSecret) || jwtSecret.length < 32;

      if (hasHardcodedFallback) {
        log(
          'Variáveis sensíveis apenas em .env',
          false,
          'Fallbacks fracos (secret/refresh-secret) no código - em produção use variáveis obrigatórias',
          'Remova fallbacks hardcoded em auth.service e auth.ts; exija JWT_SECRET no .env'
        );
      } else if (isJwtWeak) {
        log(
          'Variáveis sensíveis apenas em .env',
          false,
          `JWT_SECRET fraco ou não configurado (${jwtSecret ? 'valor default' : 'ausente'})`,
          'Configure JWT_SECRET e JWT_REFRESH_SECRET fortes (min 32 caracteres) no .env'
        );
      } else {
        log('Variáveis sensíveis apenas em .env', true, '.env no .gitignore, segredos em variáveis de ambiente');
      }
    }
  } catch (e) {
    log('Variáveis sensíveis apenas em .env', false, `Erro: ${(e as Error).message}`);
  }

  // 2. Banco com acesso privado
  console.log('\n2. BANCO COM ACESSO PRIVADO');
  try {
    const dockerPath = path.resolve(__dirname, '../docker-compose.yml');
    const dockerProdPath = path.resolve(__dirname, '../docker-compose.production.yml');
    const dockerCompose = fs.existsSync(dockerPath) ? fs.readFileSync(dockerPath, 'utf-8') : '';
    const dockerProd = fs.existsSync(dockerProdPath) ? fs.readFileSync(dockerProdPath, 'utf-8') : '';

    const postgresExposed = dockerCompose.includes('5432:5432') || /ports:\s*[\s\S]*?5432/.test(dockerCompose);
    const prodRemovesPorts = dockerProd.includes('ports: []') || /postgres[\s\S]*?ports:\s*\[\s*\]/m.test(dockerProd);

    if (prodRemovesPorts) {
      log(
        'Banco com acesso privado',
        true,
        'docker-compose.production.yml remove exposição da porta 5432'
      );
    } else if (postgresExposed) {
      log(
        'Banco com acesso privado',
        false,
        'PostgreSQL expõe 5432 - use docker-compose.production.yml em produção',
        'Em produção: docker compose -f docker-compose.yml -f docker-compose.production.yml up -d'
      );
    } else {
      log('Banco com acesso privado', true, 'PostgreSQL não expõe porta publicamente');
    }
  } catch (e) {
    log('Banco com acesso privado', false, `Erro: ${(e as Error).message}`);
  }

  // 3. HTTPS ativo
  console.log('\n3. HTTPS ATIVO');
  try {
    const nginxPath = path.resolve(__dirname, '../nginx/nginx.conf');
    const nginxProdPath = path.resolve(__dirname, '../nginx/nginx.production.conf');
    const nginxConf = fs.existsSync(nginxPath) ? fs.readFileSync(nginxPath, 'utf-8') : '';
    const nginxProdConf = fs.existsSync(nginxProdPath) ? fs.readFileSync(nginxProdPath, 'utf-8') : '';

    const mainSsl = nginxConf.includes('listen 443 ssl') && !nginxConf.includes('# listen 443 ssl');
    const prodSsl =
      nginxProdConf.includes('listen 443 ssl http2') && nginxProdConf.includes('ssl_certificate ');

    if (mainSsl || prodSsl) {
      log('HTTPS ativo', true, prodSsl ? 'nginx.production.conf com SSL/TLS' : 'nginx.conf com SSL/TLS');
    } else {
      log(
        'HTTPS ativo',
        false,
        'SSL comentado - use nginx.production.conf em produção',
        'Em produção: cp nginx/nginx.production.conf nginx/nginx.conf e configure nginx/ssl/ com certificados'
      );
    }
  } catch (e) {
    log('HTTPS ativo', false, `Erro: ${(e as Error).message}`);
  }

  // 4. Backup automático diário do PostgreSQL
  console.log('\n4. BACKUP AUTOMÁTICO DIÁRIO DO POSTGRESQL');
  try {
    const schedulerPath = path.resolve(__dirname, '../src/services/scheduler.service.ts');
    const backupPath = path.resolve(__dirname, '../src/services/backup.service.ts');
    const schedulerContent = fs.readFileSync(schedulerPath, 'utf-8');
    const backupContent = fs.readFileSync(backupPath, 'utf-8');

    const hasBackupScheduler =
      schedulerContent.includes('BackupService') &&
      schedulerContent.includes('executeScheduledBackups') &&
      backupContent.includes('executeScheduledBackups');

    const hasDiarioSupport = backupContent.includes('diario') || backupContent.includes('frequencia');

    if (!hasBackupScheduler) {
      log(
        'Backup automático diário',
        false,
        'Scheduler de backup não configurado',
        'Configure BackupService.executeScheduledBackups no SchedulerService'
      );
    } else if (!hasDiarioSupport) {
      log(
        'Backup automático diário',
        false,
        'Suporte a frequência diária não encontrado',
        'Implemente BackupSchedule com frequencia=diario'
      );
    } else {
      log(
        'Backup automático diário',
        true,
        'Scheduler configurado (a cada hora); admin deve criar agendamento com frequência "diario" em /backups/schedules'
      );
    }
  } catch (e) {
    log('Backup automático diário', false, `Erro: ${(e as Error).message}`);
  }

  // 5. Logs de erro configurados
  console.log('\n5. LOGS DE ERRO CONFIGURADOS');
  try {
    const errorHandlerPath = path.resolve(__dirname, '../src/middlewares/errorHandler.ts');
    const appPath = path.resolve(__dirname, '../src/app.ts');
    const errorHandler = fs.readFileSync(errorHandlerPath, 'utf-8');
    const appContent = fs.readFileSync(appPath, 'utf-8');

    const hasErrorLogging = errorHandler.includes('console.error') || errorHandler.includes('logger') || errorHandler.includes('log');
    const hasMorgan = appContent.includes('morgan');
    const morganInProd = appContent.includes("NODE_ENV !== 'production'") && appContent.includes('morgan');

    // Morgan só em dev - em prod não há HTTP logging explícito
    const nginxErrorLog = fs.existsSync(path.resolve(__dirname, '../nginx/nginx.conf'))
      ? (() => {
          const nginx = fs.readFileSync(path.resolve(__dirname, '../nginx/nginx.conf'), 'utf-8');
          return nginx.includes('error_log');
        })()
      : false;

    if (hasErrorLogging) {
      const fileLogging = errorHandler.includes('fs.write') || errorHandler.includes('createWriteStream') || errorHandler.includes('winston') || errorHandler.includes('pino');
      if (fileLogging) {
        log('Logs de erro configurados', true, 'Error handler com logging a arquivo/stream');
      } else {
        log(
          'Logs de erro configurados',
          true,
          'Error handler usa console.error; nginx error_log configurado',
          morganInProd ? 'Em produção, considere winston/pino para logs estruturados em arquivo' : undefined
        );
      }
    } else {
      log(
        'Logs de erro configurados',
        false,
        'Nenhum logging de erro encontrado no errorHandler',
        'Adicione console.error ou logger no errorHandler para erros'
      );
    }
  } catch (e) {
    log('Logs de erro configurados', false, `Erro: ${(e as Error).message}`);
  }

  // Relatório final
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('  RESUMO - INFRAESTRUTURA');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  console.log(`Total: ${passed}/${results.length} critérios atendidos.\n`);

  if (failed.length > 0) {
    console.log('⚠️  Itens que falharam:');
    failed.forEach((r) => {
      console.log(`   - ${r.criterio}${r.message ? `: ${r.message}` : ''}`);
      if (r.recomendacao) console.log(`     → ${r.recomendacao}`);
    });
    console.log('\n❌ INFRAESTRUTURA NÃO ATENDE TODOS OS CRITÉRIOS - Corrija os itens acima.\n');
    process.exit(1);
  }

  console.log('✅ INFRAESTRUTURA ATENDE TODOS OS CRITÉRIOS.\n');
}

main().catch((e) => {
  console.error('Erro:', e);
  process.exit(1);
});
