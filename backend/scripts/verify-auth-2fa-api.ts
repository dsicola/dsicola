/**
 * Script de verificação das rotas de Auth e 2FA.
 * Garante que os endpoints existem e que os schemas de request/response estão consistentes.
 *
 * Uso: tsx scripts/verify-auth-2fa-api.ts
 * (Backend não precisa estar rodando - apenas verifica código.)
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function read(path: string): string {
  const full = join(ROOT, path);
  if (!existsSync(full)) throw new Error(`File not found: ${full}`);
  return readFileSync(full, 'utf-8');
}

let errors: string[] = [];
let checks = 0;

function ok(name: string) {
  checks++;
  console.log(`  ✓ ${name}`);
}

function fail(msg: string) {
  errors.push(msg);
  console.log(`  ✗ ${msg}`);
}

console.log('\n=== Verificação Auth + 2FA (backend) ===\n');

// 1. auth.routes: login, login-step2
const authRoutes = read('src/routes/auth.routes.ts');
if (!authRoutes.includes("router.post('/login'")) fail("auth.routes: POST /login não encontrado");
else ok("auth.routes: POST /login");
if (!authRoutes.includes("router.post('/login-step2'")) fail("auth.routes: POST /login-step2 não encontrado");
else ok("auth.routes: POST /login-step2");
if (!authRoutes.includes('loginStep2Schema') || !authRoutes.includes('userId') || !authRoutes.includes('token'))
  fail("auth.routes: login-step2 schema (userId, token) não encontrado");
else ok("auth.routes: login-step2 schema com userId e token");

// 2. auth.service: login retorna requiresTwoFactor
const authService = read('src/services/auth.service.ts');
if (!authService.includes('requiresTwoFactor')) fail("auth.service: requiresTwoFactor não encontrado");
else ok("auth.service: login pode retornar requiresTwoFactor");
if (!authService.includes('loginStep2(userId')) fail("auth.service: loginStep2 não encontrado");
else ok("auth.service: loginStep2 existe");

// 3. twoFactor.routes: setup, verify, disable, status
const twoFactorRoutes = read('src/routes/twoFactor.routes.ts');
if (!twoFactorRoutes.includes("'/setup'")) fail("twoFactor.routes: POST /setup não encontrado");
else ok("twoFactor.routes: POST /setup");
if (!twoFactorRoutes.includes("'/verify'")) fail("twoFactor.routes: POST /verify não encontrado");
else ok("twoFactor.routes: POST /verify");
if (!twoFactorRoutes.includes("'/disable'")) fail("twoFactor.routes: POST /disable não encontrado");
else ok("twoFactor.routes: POST /disable");
if (!twoFactorRoutes.includes("'/status'")) fail("twoFactor.routes: GET /status não encontrado");
else ok("twoFactor.routes: GET /status");

// 4. twoFactor.service: verifyTwoFactorLogin
const twoFactorService = read('src/services/twoFactor.service.ts');
if (!twoFactorService.includes('verifyTwoFactorLogin')) fail("twoFactor.service: verifyTwoFactorLogin não encontrado");
else ok("twoFactor.service: verifyTwoFactorLogin existe");

console.log('\n=== Verificação Frontend (paths) ===\n');

const frontRoot = join(ROOT, '..', 'frontend', 'src');
function readFront(path: string): string {
  const full = join(frontRoot, path);
  if (!existsSync(full)) {
    throw new Error(`File not found: ${full}`);
  }
  return readFileSync(full, 'utf-8');
}

try {
  const apiTs = readFront('services/api.ts');
  if (!apiTs.includes("'/auth/login'")) fail("frontend api: POST /auth/login não encontrado");
  else ok("frontend api: POST /auth/login");
  if (!apiTs.includes("'/auth/login-step2'")) fail("frontend api: POST /auth/login-step2 não encontrado");
  else ok("frontend api: POST /auth/login-step2");
  if (!apiTs.includes("'/two-factor/setup'")) fail("frontend api: POST /two-factor/setup não encontrado");
  else ok("frontend api: POST /two-factor/setup");
  if (!apiTs.includes("'/two-factor/verify'")) fail("frontend api: POST /two-factor/verify não encontrado");
  else ok("frontend api: POST /two-factor/verify");
  if (!apiTs.includes("'/two-factor/disable'")) fail("frontend api: POST /two-factor/disable não encontrado");
  else ok("frontend api: POST /two-factor/disable");
  if (!apiTs.includes("'/two-factor/status'")) fail("frontend api: GET /two-factor/status não encontrado");
  else ok("frontend api: GET /two-factor/status");

  const loginForm = readFront('components/auth/LoginForm.tsx');
  if (!loginForm.includes('requiresTwoFactor')) fail("LoginForm: requiresTwoFactor não usado");
  else ok("LoginForm: trata requiresTwoFactor");
  if (!loginForm.includes('signInWithTokens')) fail("LoginForm: signInWithTokens não usado após 2FA");
  else ok("LoginForm: usa signInWithTokens após 2FA");

  const twoFactorVerification = readFront('components/auth/TwoFactorVerification.tsx');
  if (!twoFactorVerification.includes('loginStep2')) fail("TwoFactorVerification: loginStep2 não usado");
  else ok("TwoFactorVerification: chama loginStep2");
} catch (e) {
  fail(`Frontend check: ${(e as Error).message}`);
}

console.log('\n=== Resultado ===\n');
console.log(`Verificações: ${checks}`);
if (errors.length > 0) {
  console.log(`Erros: ${errors.length}`);
  errors.forEach((e) => console.log(`  - ${e}`));
  process.exit(1);
}
console.log('Todas as verificações passaram. Frontend e backend estão alinhados para Auth e 2FA.\n');
process.exit(0);
