#!/usr/bin/env npx tsx
/**
 * ========================================
 * TESTE BIOMETRIA E ROLES - DSICOLA
 * ========================================
 *
 * Valida:
 * 1. Roles: alinhamento backend (Prisma) ↔ frontend (types, rotas, menu)
 * 2. Biometria: service, controller, rotas, integração dispositivo
 *
 * Uso: npm run test:biometria-roles
 *      tsx scripts/test-biometria-roles.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_ROOT = path.join(__dirname, '..');
const FRONTEND_ROOT = path.join(BACKEND_ROOT, '..', 'frontend');

interface AssertResult {
  ok: boolean;
  message: string;
  details?: string;
}

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, details?: string): void {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}`);
    if (details) console.log(`     ${details}`);
  }
}

function assertContains(name: string, content: string, search: string | RegExp, details?: string): void {
  const found = typeof search === 'string' ? content.includes(search) : search.test(content);
  assert(name, found, details || (found ? undefined : `Não encontrado: ${String(search)}`));
}

// ==================== ROLES ====================
const BACKEND_ROLES = [
  'SUPER_ADMIN',
  'COMERCIAL',
  'ADMIN',
  'DIRECAO',
  'COORDENADOR',
  'PROFESSOR',
  'ALUNO',
  'SECRETARIA',
  'AUDITOR',
  'POS',
  'RESPONSAVEL',
  'RH',
  'FINANCEIRO',
];

function testRoles(): void {
  console.log('\n📋 1. ROLES - Backend ↔ Frontend\n');

  // Backend schema
  const schemaPath = path.join(BACKEND_ROOT, 'prisma', 'schema.prisma');
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  const enumMatch = schemaContent.match(/enum UserRole \{([\s\S]*?)\}/);
  assert('Schema tem enum UserRole', !!enumMatch);
  if (enumMatch) {
    for (const role of BACKEND_ROLES) {
      assertContains(`Schema inclui ${role}`, enumMatch[1], role);
    }
    assert('Schema NÃO inclui FUNCIONARIO', !enumMatch[1].includes('FUNCIONARIO'));
  }

  // Frontend types
  const authTypesPath = path.join(FRONTEND_ROOT, 'src', 'types', 'auth.ts');
  const authTypesContent = fs.readFileSync(authTypesPath, 'utf-8');
  for (const role of BACKEND_ROLES) {
    assertContains(`Frontend UserRole inclui ${role}`, authTypesContent, role);
  }
  assert('Frontend NÃO usa FUNCIONARIO em UserRole', !authTypesContent.includes("'FUNCIONARIO'"));

  // AuthContext rolePriority
  const authContextPath = path.join(FRONTEND_ROOT, 'src', 'contexts', 'AuthContext.tsx');
  const authContextContent = fs.readFileSync(authContextPath, 'utf-8');
  assertContains('AuthContext tem rolePriority/DIRECAO', authContextContent, 'DIRECAO');
  assertContains('AuthContext tem COORDENADOR', authContextContent, 'COORDENADOR');
  assertContains('AuthContext tem AUDITOR', authContextContent, 'AUDITOR');

  // Biometria routes
  const biometriaRoutesPath = path.join(BACKEND_ROOT, 'src', 'routes', 'biometria.routes.ts');
  const biometriaRoutesContent = fs.readFileSync(biometriaRoutesPath, 'utf-8');
  assertContains('Biometria registrar: ADMIN, RH', biometriaRoutesContent, /ADMIN.*RH|RH.*ADMIN/);
  assertContains('Biometria marcar-presenca: roles definidas', biometriaRoutesContent, 'authorize');
}

// ==================== BIOMETRIA ====================
function testBiometria(): void {
  console.log('\n🔐 2. BIOMETRIA - Service, Controller, Rotas\n');

  // BiometriaService: validação e documentação
  const biometriaServicePath = path.join(BACKEND_ROOT, 'src', 'services', 'biometria.service.ts');
  const biometriaServiceContent = fs.readFileSync(biometriaServicePath, 'utf-8');
  assertContains('BiometriaService tem validateTemplate', biometriaServiceContent, 'validateTemplate');
  assertContains('BiometriaService tem validateDedo', biometriaServiceContent, 'validateDedo');
  assertContains('BiometriaService usa timingSafeEqual', biometriaServiceContent, 'timingSafeEqual');
  assertContains('BiometriaService documenta arquitetura', biometriaServiceContent, 'ARQUITETURA');
  assertContains('BiometriaService documenta limitação SHA-256', biometriaServiceContent, 'SHA-256');

  // dispositivoBiometrico testConnection delega para ZKTeco
  const dispositivoControllerPath = path.join(BACKEND_ROOT, 'src', 'controllers', 'dispositivoBiometrico.controller.ts');
  const dispositivoControllerContent = fs.readFileSync(dispositivoControllerPath, 'utf-8');
  assertContains('testConnection delega ZKTeco quando tipo ZKTECO', dispositivoControllerContent, "dispositivo.tipo === 'ZKTECO'");
  assertContains('testConnection importa zkteco.controller', dispositivoControllerContent, 'zkteco.controller');
  assertContains('testConnection chama testarConexao para ZKTeco', dispositivoControllerContent, 'testarConexao');

  // Biometria controller: dedo normalizado
  const biometriaControllerPath = path.join(BACKEND_ROOT, 'src', 'controllers', 'biometria.controller.ts');
  const biometriaControllerContent = fs.readFileSync(biometriaControllerPath, 'utf-8');
  assertContains('biometria controller normaliza dedo (Math.floor/Number)', biometriaControllerContent, /Math\.floor|Number\(.*dedo/);

  // presencaBiometrica: SECRETARIA vê todas as presenças
  const presencaControllerPath = path.join(BACKEND_ROOT, 'src', 'controllers', 'presencaBiometrica.controller.ts');
  const presencaControllerContent = fs.readFileSync(presencaControllerPath, 'utf-8');
  assertContains('getPresencas: SECRETARIA em podeVerTodas', presencaControllerContent, "podeVerTodas");
  assertContains('getPresencas: SECRETARIA no array de roles', presencaControllerContent, "'SECRETARIA'");
}

// ==================== MAIN ====================
async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════');
  console.log('  TESTE BIOMETRIA E ROLES - DSICOLA');
  console.log('═══════════════════════════════════════════════════');

  try {
    testRoles();
    testBiometria();

    console.log('\n═══════════════════════════════════════════════════');
    console.log(`  Resultado: ${passed} passou, ${failed} falhou`);
    console.log('═══════════════════════════════════════════════════\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('\nErro ao executar testes:', err);
    process.exit(1);
  }
}

main();
