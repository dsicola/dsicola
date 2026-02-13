#!/usr/bin/env ts-node
/**
 * Script de Auditoria de Rotas
 * Mapeia todas as rotas do backend e verifica:
 * - Middleware authenticate
 * - RBAC (authorize)
 * - Multi-tenant (addInstitutionFilter/requireTenantScope)
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface RouteInfo {
  file: string;
  method: string;
  path: string;
  hasAuthenticate: boolean;
  hasAuthorize: boolean;
  authorizeRoles?: string[];
  hasMultiTenant: boolean;
  middlewares: string[];
  controller?: string;
}

const routesDir = path.join(__dirname, '../src/routes');
const controllersDir = path.join(__dirname, '../src/controllers');

async function findRouteFiles(): Promise<string[]> {
  const files = await glob('**/*.routes.ts', { cwd: routesDir });
  return files.map(f => path.join(routesDir, f));
}

function extractRoutes(filePath: string): RouteInfo[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const routes: RouteInfo[] = [];
  const fileName = path.basename(filePath);

  // Verificar se usa router.use(authenticate) globalmente
  const hasGlobalAuthenticate = /router\.use\s*\(\s*authenticate\s*\)/.test(content);
  const hasGlobalAuthorize = /router\.use\s*\(\s*authorize/.test(content);

  // Extrair rotas individuais
  const routeRegex = /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]\s*,/g;
  let match;

  while ((match = routeRegex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const routePath = match[2];
    
    // Extrair middlewares da linha
    const lineStart = content.lastIndexOf('\n', match.index);
    const lineEnd = content.indexOf('\n', match.index + match[0].length);
    const line = content.substring(lineStart, lineEnd);

    const hasAuthenticate = hasGlobalAuthenticate || /authenticate/.test(line);
    const hasAuthorize = hasGlobalAuthorize || /authorize\s*\(/.test(line);
    
    // Extrair roles do authorize
    let authorizeRoles: string[] | undefined;
    if (hasAuthorize) {
      const authorizeMatch = line.match(/authorize\s*\(\s*\[?([^\]]+)\]?/);
      if (authorizeMatch) {
        authorizeRoles = authorizeMatch[1]
          .split(',')
          .map(r => r.trim().replace(/['"]/g, ''))
          .filter(r => r);
      }
    }

    // Extrair controller
    const controllerMatch = line.match(/(\w+Controller)\.(\w+)/);
    const controller = controllerMatch ? `${controllerMatch[1]}.${controllerMatch[2]}` : undefined;

    // Verificar middlewares
    const middlewares: string[] = [];
    if (hasAuthenticate) middlewares.push('authenticate');
    if (hasAuthorize) middlewares.push('authorize');
    if (/validateLicense/.test(line)) middlewares.push('validateLicense');
    if (/requireConfiguracaoEnsino/.test(line)) middlewares.push('requireConfiguracaoEnsino');
    if (/requireInstitution/.test(line)) middlewares.push('requireInstitution');
    if (/bloquearAnoLetivoEncerrado/.test(line)) middlewares.push('bloquearAnoLetivoEncerrado');
    if (/validarProfessorAtivo/.test(line)) middlewares.push('validarProfessorAtivo');

    routes.push({
      file: fileName,
      method,
      path: routePath,
      hasAuthenticate,
      hasAuthorize,
      authorizeRoles,
      hasMultiTenant: false, // Será verificado no controller
      middlewares,
      controller
    });
  }

  return routes;
}

async function checkControllerMultiTenant(controllerName: string): Promise<boolean> {
  if (!controllerName) return false;
  
  const [controllerFile, method] = controllerName.split('.');
  const controllerPath = path.join(controllersDir, `${controllerFile}.controller.ts`);
  
  if (!fs.existsSync(controllerPath)) return false;

  const content = fs.readFileSync(controllerPath, 'utf-8');
  
  // Buscar o método específico
  const methodRegex = new RegExp(`export\\s+const\\s+${method}\\s*=\\s*async[\\s\\S]*?\\{[\\s\\S]*?\\}`, 'm');
  const methodMatch = content.match(methodRegex);
  
  if (!methodMatch) return false;
  
  const methodContent = methodMatch[0];
  
  // Verificar se usa addInstitutionFilter ou requireTenantScope
  return /addInstitutionFilter|requireTenantScope/.test(methodContent);
}

async function main() {
  console.log('🔍 Iniciando auditoria de rotas...\n');

  const routeFiles = await findRouteFiles();
  console.log(`📁 Encontrados ${routeFiles.length} arquivos de rotas\n`);

  const allRoutes: RouteInfo[] = [];
  const issues: Array<{ file: string; route: string; issue: string; severity: 'P0' | 'P1' | 'P2' }> = [];

  for (const file of routeFiles) {
    const routes = extractRoutes(file);
    
    for (const route of routes) {
      // Verificar multi-tenant no controller
      if (route.controller) {
        route.hasMultiTenant = await checkControllerMultiTenant(route.controller);
      }

      // Verificar problemas
      if (!route.hasAuthenticate && !route.path.includes('/auth/') && !route.path.includes('/subdominio/')) {
        issues.push({
          file: route.file,
          route: `${route.method} ${route.path}`,
          issue: 'Rota sem middleware authenticate',
          severity: 'P0'
        });
      }

      if (route.hasMultiTenant === false && route.controller && !route.path.includes('/auth/')) {
        issues.push({
          file: route.file,
          route: `${route.method} ${route.path}`,
          issue: 'Controller pode não estar usando multi-tenant (addInstitutionFilter/requireTenantScope)',
          severity: 'P1'
        });
      }

      allRoutes.push(route);
    }
  }

  // Gerar relatório
  console.log('📊 RELATÓRIO DE AUDITORIA DE ROTAS\n');
  console.log(`Total de rotas mapeadas: ${allRoutes.length}\n`);

  // Agrupar por arquivo
  const routesByFile = new Map<string, RouteInfo[]>();
  for (const route of allRoutes) {
    if (!routesByFile.has(route.file)) {
      routesByFile.set(route.file, []);
    }
    routesByFile.get(route.file)!.push(route);
  }

  console.log('📋 ROTAS POR ARQUIVO:\n');
  for (const [file, routes] of Array.from(routesByFile.entries()).sort()) {
    console.log(`\n${file} (${routes.length} rotas):`);
    for (const route of routes) {
      const auth = route.hasAuthenticate ? '✅' : '❌';
      const rbac = route.hasAuthorize ? `✅ [${route.authorizeRoles?.join(', ') || 'N/A'}]` : '⚠️';
      const mt = route.hasMultiTenant ? '✅' : '⚠️';
      console.log(`  ${route.method.padEnd(6)} ${route.path.padEnd(40)} Auth: ${auth} RBAC: ${rbac} MT: ${mt}`);
    }
  }

  // Problemas encontrados
  console.log('\n\n🚨 PROBLEMAS ENCONTRADOS:\n');
  
  const p0Issues = issues.filter(i => i.severity === 'P0');
  const p1Issues = issues.filter(i => i.severity === 'P1');
  const p2Issues = issues.filter(i => i.severity === 'P2');

  if (p0Issues.length > 0) {
    console.log(`\n❌ P0 - CRÍTICO (${p0Issues.length}):`);
    for (const issue of p0Issues) {
      console.log(`  - ${issue.file}: ${issue.route} - ${issue.issue}`);
    }
  }

  if (p1Issues.length > 0) {
    console.log(`\n⚠️  P1 - IMPORTANTE (${p1Issues.length}):`);
    for (const issue of p1Issues) {
      console.log(`  - ${issue.file}: ${issue.route} - ${issue.issue}`);
    }
  }

  if (p2Issues.length > 0) {
    console.log(`\n📝 P2 - MELHORIA (${p2Issues.length}):`);
    for (const issue of p2Issues) {
      console.log(`  - ${issue.file}: ${issue.route} - ${issue.issue}`);
    }
  }

  if (issues.length === 0) {
    console.log('✅ Nenhum problema encontrado!');
  }

  // Estatísticas
  console.log('\n\n📈 ESTATÍSTICAS:\n');
  const withAuth = allRoutes.filter(r => r.hasAuthenticate).length;
  const withRBAC = allRoutes.filter(r => r.hasAuthorize).length;
  const withMT = allRoutes.filter(r => r.hasMultiTenant).length;
  
  console.log(`Rotas com authenticate: ${withAuth}/${allRoutes.length} (${Math.round(withAuth/allRoutes.length*100)}%)`);
  console.log(`Rotas com RBAC: ${withRBAC}/${allRoutes.length} (${Math.round(withRBAC/allRoutes.length*100)}%)`);
  console.log(`Rotas com multi-tenant: ${withMT}/${allRoutes.length} (${Math.round(withMT/allRoutes.length*100)}%)`);

  // Salvar relatório em arquivo
  const reportPath = path.join(__dirname, '../../AUDITORIA_ROTAS_COMPLETA.md');
  const report = `# Auditoria Completa de Rotas - DSICOLA
**Data**: ${new Date().toISOString()}
**Total de Rotas**: ${allRoutes.length}

## Problemas Encontrados

### P0 - Crítico (${p0Issues.length})
${p0Issues.map(i => `- **${i.file}**: \`${i.route}\` - ${i.issue}`).join('\n')}

### P1 - Importante (${p1Issues.length})
${p1Issues.map(i => `- **${i.file}**: \`${i.route}\` - ${i.issue}`).join('\n')}

### P2 - Melhoria (${p2Issues.length})
${p2Issues.map(i => `- **${i.file}**: \`${i.route}\` - ${i.issue}`).join('\n')}

## Estatísticas

- Rotas com authenticate: ${withAuth}/${allRoutes.length} (${Math.round(withAuth/allRoutes.length*100)}%)
- Rotas com RBAC: ${withRBAC}/${allRoutes.length} (${Math.round(withRBAC/allRoutes.length*100)}%)
- Rotas com multi-tenant: ${withMT}/${allRoutes.length} (${Math.round(withMT/allRoutes.length*100)}%)

## Detalhes por Arquivo

${Array.from(routesByFile.entries()).map(([file, routes]) => `
### ${file} (${routes.length} rotas)

| Método | Path | Auth | RBAC | Multi-Tenant |
|--------|------|------|------|--------------|
${routes.map(r => `| ${r.method} | ${r.path} | ${r.hasAuthenticate ? '✅' : '❌'} | ${r.hasAuthorize ? `✅ [${r.authorizeRoles?.join(', ') || 'N/A'}]` : '⚠️'} | ${r.hasMultiTenant ? '✅' : '⚠️'} |`).join('\n')}
`).join('\n')}
`;

  fs.writeFileSync(reportPath, report);
  console.log(`\n📄 Relatório salvo em: ${reportPath}`);
}

main().catch(console.error);

