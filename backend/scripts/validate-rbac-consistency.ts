/**
 * ========================================
 * VALIDAÇÃO DE CONSISTÊNCIA RBAC - DSICOLA
 * ========================================
 * 
 * Script para validar que o sistema RBAC está implementado
 * corretamente em todas as rotas e controllers.
 * 
 * Validações:
 * 1. Rotas usam middlewares RBAC apropriados
 * 2. Controllers usam addInstitutionFilter em queries
 * 3. CREATE/UPDATE rejeitam instituicaoId do body
 * 4. Multi-tenant respeitado
 * 
 * Uso:
 *   npm run script:validate-rbac
 *   ou
 *   tsx scripts/validate-rbac-consistency.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ValidationResult {
  file: string;
  type: 'route' | 'controller';
  issues: ValidationIssue[];
  passed: boolean;
}

interface ValidationIssue {
  line?: number;
  severity: 'error' | 'warning';
  message: string;
  suggestion?: string;
}

const results: ValidationResult[] = [];

// Rotas que devem usar requireConfiguracaoEnsino
const ROUTES_REQUIRE_CONFIG_ENSINO = [
  'curso',
  'disciplina',
  'classe',
  'turma',
  'ano-letivo',
  'plano-ensino',
  'distribuicao-aulas',
];

// Rotas que PROFESSOR pode acessar (operações limitadas)
const ROUTES_PROFESSOR_CAN_ACCESS = [
  'aula',
  'presenca',
  'nota',
  'plano-ensino', // apenas leitura própria
];

// Entidades que devem ter multi-tenant
const ENTITIES_REQUIRE_MULTI_TENANT = [
  'curso',
  'disciplina',
  'classe',
  'turma',
  'anoLetivo',
  'planoEnsino',
  'aula',
  'presenca',
  'nota',
  'matricula',
  'aluno',
];

// Entidades que NÃO precisam addInstitutionFilter (globais ou por usuário)
const ENTITIES_NO_MULTI_TENANT = [
  'videoAula', // Globais (SUPER_ADMIN)
  'videoAulaProgresso', // Por usuário (userId)
  'reaberturaAnoLetivo', // Usa requireTenantScope direto na query
];

/**
 * Ler arquivo e retornar linhas
 */
function readFileLines(filePath: string): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split('\n');
  } catch (error) {
    console.error(`Erro ao ler arquivo ${filePath}:`, error);
    return [];
  }
}

/**
 * Validar arquivo de rota
 */
function validateRouteFile(filePath: string): ValidationResult {
  const fileName = path.basename(filePath);
  const routeName = fileName.replace('.routes.ts', '').replace('.routes.js', '');
  const lines = readFileLines(filePath);
  const issues: ValidationIssue[] = [];

  const content = lines.join('\n');

  // Verificar se usa authenticate (exceto rotas de integração biométrica)
  if (!content.includes('authenticate') && !content.includes('autenticação alternativa') && !content.includes('token do dispositivo')) {
    // Verificar se há comentário explicando exceção
    if (!content.includes('INTERNOS') && !content.includes('não requerem autenticação JWT')) {
      issues.push({
        severity: 'error',
        message: 'Rota não usa middleware authenticate',
        suggestion: 'Adicionar: router.use(authenticate); (ou documentar exceção se intencional)',
      });
    }
  }

  // Verificar se rota acadêmica usa requireConfiguracaoEnsino
  if (ROUTES_REQUIRE_CONFIG_ENSINO.includes(routeName)) {
    if (!content.includes('requireConfiguracaoEnsino')) {
      issues.push({
        severity: 'error',
        message: `Rota ${routeName} deve usar requireConfiguracaoEnsino para bloquear PROFESSOR/ALUNO/SUPER_ADMIN`,
        suggestion: 'Adicionar: router.use(requireConfiguracaoEnsino);',
      });
    }
  }

  // Verificar se rota usa requireInstitution (multi-tenant)
  if (ROUTES_REQUIRE_CONFIG_ENSINO.includes(routeName) || ROUTES_PROFESSOR_CAN_ACCESS.includes(routeName)) {
    if (!content.includes('requireInstitution')) {
      issues.push({
        severity: 'warning',
        message: `Rota ${routeName} deve usar requireInstitution para garantir multi-tenant`,
        suggestion: 'Adicionar: router.use(requireInstitution);',
      });
    }
  }

  // Verificar se CREATE/UPDATE usa authorize
  const hasPostRoute = content.includes('router.post(');
  const hasPutRoute = content.includes('router.put(');
  const hasDeleteRoute = content.includes('router.delete(');

  if ((hasPostRoute || hasPutRoute || hasDeleteRoute) && !content.includes("authorize('")) {
    // Algumas rotas podem não precisar authorize se usam authorizeModule
    if (!content.includes('authorizeModule')) {
      issues.push({
        severity: 'warning',
        message: 'Rotas POST/PUT/DELETE devem usar authorize() ou authorizeModule()',
        suggestion: 'Adicionar: router.post("/", authorize("ADMIN"), controller.create);',
      });
    }
  }

  return {
    file: fileName,
    type: 'route',
    issues,
    passed: issues.filter(i => i.severity === 'error').length === 0,
  };
}

/**
 * Validar arquivo de controller
 */
function validateControllerFile(filePath: string): ValidationResult {
  const fileName = path.basename(filePath);
  const controllerName = fileName.replace('.controller.ts', '').replace('.controller.js', '');
  const lines = readFileLines(filePath);
  const issues: ValidationIssue[] = [];

  const content = lines.join('\n');

  // Verificar se usa addInstitutionFilter em queries (findMany, findFirst, findUnique)
  const hasQueries = content.includes('findMany') || content.includes('findFirst') || content.includes('findUnique');
  if (hasQueries && !content.includes('addInstitutionFilter')) {
    // Verificar se é uma entidade que requer multi-tenant
    const entityName = controllerName.toLowerCase();
    const requiresMultiTenant = ENTITIES_REQUIRE_MULTI_TENANT.some(e => 
      entityName.includes(e.toLowerCase())
    );
    const isNoMultiTenant = ENTITIES_NO_MULTI_TENANT.some(e =>
      entityName.includes(e.toLowerCase())
    );

    if (requiresMultiTenant && !isNoMultiTenant) {
      // Verificar se usa requireTenantScope direto na query (alternativa aceitável)
      if (!content.includes('requireTenantScope') || !content.includes('instituicaoId:')) {
        issues.push({
          severity: 'error',
          message: `Controller ${controllerName} usa queries mas não aplica addInstitutionFilter (risco multi-tenant)`,
          suggestion: 'Adicionar: const filter = addInstitutionFilter(req); e usar em queries (ou usar requireTenantScope direto na query)',
        });
      }
    }
  }

  // Verificar se CREATE rejeita instituicaoId do body
  if (content.includes('router.post') || content.includes('create') || (content.includes('prisma.') && content.includes('.create('))) {
    // Verificar se há função create ou export const create
    const hasCreateFunction = content.includes('export const create') || content.includes('const create');
    
    if (hasCreateFunction) {
      // Verificar se há validação explícita que rejeita instituicaoId do body
      const hasValidation = content.includes('req.body.instituicaoId') && 
                           (content.includes('AppError') || content.includes('permitido') || content.includes('não é permitido') || content.includes('Não é permitido'));
      
      // Verificar se usa requireTenantScope ou req.user.instituicaoId
      const usesTenantScope = content.includes('requireTenantScope') || 
                             (content.includes('req.user') && content.includes('instituicaoId'));
      
      // Se não tem validação explícita e não usa tenantScope, alertar
      if (!hasValidation && usesTenantScope) {
        // Verificar se realmente pode ter problema procurando por criação que usa body.instituicaoId
        const createMatches = content.match(/\.create\([\s\S]{0,2000}data:\s*\{[\s\S]{0,1000}\}/g);
        if (createMatches) {
          for (const match of createMatches) {
            if (match.includes('instituicaoId') && match.includes('req.body')) {
              // Não encontrou validação que rejeita
              issues.push({
                severity: 'error',
                message: `CREATE em ${controllerName} pode aceitar instituicaoId do body (risco multi-tenant)`,
                suggestion: 'Rejeitar instituicaoId do body e usar req.user.instituicaoId do token',
              });
              break; // Só alertar uma vez
            }
          }
        }
      }
    }
  }

  // Verificar se UPDATE verifica tenant antes de atualizar
  if (content.includes('.update(') || content.includes('.updateMany(')) {
    // Verificar se há verificação de tenant antes do update
    const updateMatches = content.match(/\.update\([\s\S]{0,2000}/g);
    if (updateMatches) {
      for (const match of updateMatches) {
        // Buscar contexto antes do update
        const matchIndex = content.indexOf(match);
        const contextBefore = content.substring(Math.max(0, matchIndex - 1000), matchIndex);
        
        // Verificar se há verificação de existência/tenant antes
        const hasFindBefore = contextBefore.includes('findFirst') || contextBefore.includes('findUnique');
        const hasFilterCheck = contextBefore.includes('addInstitutionFilter') || contextBefore.includes('instituicaoId');
        
        if (!hasFindBefore || !hasFilterCheck) {
          issues.push({
            severity: 'warning',
            message: `UPDATE em ${controllerName} pode não verificar tenant antes de atualizar`,
            suggestion: 'Verificar que recurso pertence à instituição antes de atualizar',
          });
        }
      }
    }
  }

  return {
    file: fileName,
    type: 'controller',
    issues,
    passed: issues.filter(i => i.severity === 'error').length === 0,
  };
}

/**
 * Buscar todos os arquivos de rota
 */
function findRouteFiles(): string[] {
  const routesDir = path.join(__dirname, '..', 'src', 'routes');
  const files = fs.readdirSync(routesDir);
  return files
    .filter(f => f.endsWith('.routes.ts') || f.endsWith('.routes.js'))
    .map(f => path.join(routesDir, f))
    .filter(f => f !== path.join(routesDir, 'index.ts')); // Excluir index
}

/**
 * Buscar todos os arquivos de controller
 */
function findControllerFiles(): string[] {
  const controllersDir = path.join(__dirname, '..', 'src', 'controllers');
  const files = fs.readdirSync(controllersDir);
  return files
    .filter(f => f.endsWith('.controller.ts') || f.endsWith('.controller.js'))
    .map(f => path.join(controllersDir, f));
}

/**
 * Gerar relatório
 */
function generateReport(results: ValidationResult[]): void {
  console.log('\n' + '='.repeat(80));
  console.log('📋 RELATÓRIO DE VALIDAÇÃO RBAC - DSICOLA');
  console.log('='.repeat(80) + '\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
  const errors = results.reduce((sum, r) => sum + r.issues.filter(i => i.severity === 'error').length, 0);
  const warnings = results.reduce((sum, r) => sum + r.issues.filter(i => i.severity === 'warning').length, 0);

  console.log(`📊 Resumo:`);
  console.log(`   ✅ Arquivos válidos: ${passed}`);
  console.log(`   ❌ Arquivos com problemas: ${failed}`);
  console.log(`   🚨 Erros: ${errors}`);
  console.log(`   ⚠️  Avisos: ${warnings}`);
  console.log(`   📝 Total de issues: ${totalIssues}\n`);

  if (failed === 0) {
    console.log('✅ Todos os arquivos passaram na validação!\n');
    return;
  }

  console.log('\n' + '-'.repeat(80));
  console.log('📋 DETALHES DOS PROBLEMAS');
  console.log('-'.repeat(80) + '\n');

  for (const result of results) {
    if (result.issues.length === 0) continue;

    console.log(`\n📁 ${result.file} (${result.type})`);
    console.log(`   Status: ${result.passed ? '✅ OK' : '❌ FALHOU'}`);

    for (const issue of result.issues) {
      const icon = issue.severity === 'error' ? '🚨' : '⚠️';
      console.log(`   ${icon} ${issue.message}`);
      if (issue.suggestion) {
        console.log(`      💡 Sugestão: ${issue.suggestion}`);
      }
      if (issue.line) {
        console.log(`      📍 Linha: ${issue.line}`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📚 PRÓXIMOS PASSOS');
  console.log('='.repeat(80));
  console.log('1. Revisar erros críticos (🚨)');
  console.log('2. Revisar avisos (⚠️)');
  console.log('3. Corrigir problemas identificados');
  console.log('4. Executar novamente: npm run script:validate-rbac\n');
}

/**
 * Função principal
 */
function main() {
  console.log('🔍 Iniciando validação de consistência RBAC...\n');

  // Validar rotas
  console.log('📁 Validando rotas...');
  const routeFiles = findRouteFiles();
  for (const file of routeFiles) {
    const result = validateRouteFile(file);
    results.push(result);
  }

  // Validar controllers
  console.log('📁 Validando controllers...');
  const controllerFiles = findControllerFiles();
  for (const file of controllerFiles) {
    const result = validateControllerFile(file);
    results.push(result);
  }

  // Gerar relatório
  generateReport(results);

  // Exit code baseado em erros
  const hasErrors = results.some(r => r.issues.some(i => i.severity === 'error'));
  process.exit(hasErrors ? 1 : 0);
}

// Executar
main();

