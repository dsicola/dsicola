/**
 * ========================================
 * VALIDAÇÃO DE MENU/SIDEBAR RBAC - DSICOLA FRONTEND
 * ========================================
 * 
 * Script para validar que o menu/sidebar está configurado
 * corretamente para cada perfil de usuário.
 * 
 * Validações:
 * 1. Cada perfil vê apenas menus permitidos
 * 2. Menus não permitidos não aparecem
 * 3. Roles estão corretamente definidos
 * 
 * Uso:
 *   npm run script:validate-menu-rbac
 *   ou
 *   tsx scripts/validate-menu-rbac.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface MenuItem {
  label: string;
  path?: string;
  roles?: string[];
  subItems?: MenuItem[];
}

interface ValidationResult {
  role: string;
  allowedMenus: string[];
  forbiddenMenus: string[];
  issues: string[];
  passed: boolean;
}

// Definição de menus permitidos por perfil
const ALLOWED_MENUS_BY_ROLE: Record<string, string[]> = {
  SUPER_ADMIN: [
    'Dashboard',
    'Instituições',
    'Assinaturas',
    'Planos e Preços',
    'Configurações Globais',
    'Logs Globais',
    'Backups Globais',
  ],
  ADMIN: [
    'Dashboard',
    'Gestão Acadêmica',
    'Cursos',
    'Disciplinas',
    'Turmas',
    'Ano Letivo',
    'Plano de Ensino',
    'Aulas',
    'Presenças',
    'Avaliações',
    'Notas',
    'Matrículas',
    'Alunos',
    'Relatórios',
  ],
  PROFESSOR: [
    'Dashboard',
    'Plano de Ensino', // apenas leitura própria
    'Aulas', // criar próprias
    'Presenças', // marcar próprias
    'Notas', // lançar próprias
  ],
  ALUNO: [
    'Dashboard',
    'Notas', // apenas visualizar próprias
    'Frequência', // apenas visualizar própria
    'Boletim', // apenas próprio
    'Histórico', // apenas próprio
  ],
  SECRETARIA: [
    'Dashboard',
    'Matrículas',
    'Transferências',
    'Documentos',
    'Relatórios Administrativos',
  ],
  DIRECAO: [
    'Dashboard',
    'Gestão Acadêmica',
    'Calendário Acadêmico',
    'Notas',
    'Matrículas',
    'Alunos',
  ],
  COORDENADOR: [
    'Dashboard',
    'Gestão Acadêmica',
    'Calendário Acadêmico',
    'Notas',
    'Matrículas',
    'Alunos',
  ],
  AUDITOR: [
    'Dashboard',
    'Auditoria',
  ],
};

// Menus que NÃO devem aparecer para cada perfil
const FORBIDDEN_MENUS_BY_ROLE: Record<string, string[]> = {
  SUPER_ADMIN: [
    'Gestão Acadêmica',
    'Cursos',
    'Disciplinas',
    'Turmas',
    'Plano de Ensino',
    'Aulas',
    'Presenças',
    'Notas',
    'Matrículas',
  ],
  PROFESSOR: [
    'Gestão Acadêmica',
    'Cursos',
    'Disciplinas',
    'Turmas',
    'Ano Letivo',
    'Matrículas',
    'Configuração de Ensinos',
  ],
  ALUNO: [
    'Gestão Acadêmica',
    'Cursos',
    'Disciplinas',
    'Turmas',
    'Ano Letivo',
    'Plano de Ensino',
    'Aulas',
    'Presenças',
    'Matrículas',
    'Configuração de Ensinos',
  ],
};

/**
 * Ler arquivo de configuração do sidebar
 */
function readSidebarConfig(): string {
  const configPath = path.join(__dirname, '..', 'src', 'components', 'layout', 'sidebar.config.ts');
  try {
    return fs.readFileSync(configPath, 'utf-8');
  } catch (error) {
    console.error(`Erro ao ler sidebar.config.ts:`, error);
    return '';
  }
}

/**
 * Extrair menus da configuração
 */
function extractMenusFromConfig(configContent: string): MenuItem[] {
  const menus: MenuItem[] = [];
  
  // Procurar por objetos com label e roles
  // Este é um parser simples - pode precisar ajustes baseado na estrutura real
  const menuRegex = /label:\s*['"]([^'"]+)['"]/g;
  const rolesRegex = /roles:\s*\[([^\]]+)\]/g;
  
  let match;
  while ((match = menuRegex.exec(configContent)) !== null) {
    const label = match[1];
    // Procurar roles próximos a este label (dentro de 500 caracteres)
    const context = configContent.substring(Math.max(0, match.index - 200), match.index + 500);
    const rolesMatch = context.match(/roles:\s*\[([^\]]+)\]/);
    const roles = rolesMatch 
      ? rolesMatch[1].split(',').map(r => r.trim().replace(/['"]/g, ''))
      : [];
    
    menus.push({ label, roles });
  }
  
  return menus;
}

/**
 * Validar menu para um perfil específico
 */
function validateMenuForRole(role: string, menus: MenuItem[]): ValidationResult {
  const allowed = ALLOWED_MENUS_BY_ROLE[role] || [];
  const forbidden = FORBIDDEN_MENUS_BY_ROLE[role] || [];
  const issues: string[] = [];
  const allowedMenus: string[] = [];
  const forbiddenMenus: string[] = [];

  // Verificar menus que aparecem mas não deveriam
  for (const menu of menus) {
    if (menu.roles && menu.roles.includes(role)) {
      // Menu aparece para este role
      if (forbidden.some(f => menu.label.includes(f) || f.includes(menu.label))) {
        forbiddenMenus.push(menu.label);
        issues.push(`❌ Menu "${menu.label}" NÃO deve aparecer para ${role}`);
      } else {
        allowedMenus.push(menu.label);
      }
    }
  }

  // Verificar menus que deveriam aparecer mas não aparecem
  for (const expected of allowed) {
    const found = menus.some(m => 
      m.roles?.includes(role) && 
      (m.label.includes(expected) || expected.includes(m.label))
    );
    if (!found) {
      issues.push(`⚠️  Menu "${expected}" deveria aparecer para ${role} mas não foi encontrado`);
    }
  }

  return {
    role,
    allowedMenus,
    forbiddenMenus,
    issues,
    passed: forbiddenMenus.length === 0,
  };
}

/**
 * Gerar relatório
 */
function generateReport(results: ValidationResult[]): void {
  console.log('\n' + '='.repeat(80));
  console.log('📋 RELATÓRIO DE VALIDAÇÃO DE MENU/SIDEBAR RBAC - DSICOLA FRONTEND');
  console.log('='.repeat(80) + '\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);

  console.log(`📊 Resumo:`);
  console.log(`   ✅ Perfis válidos: ${passed}`);
  console.log(`   ❌ Perfis com problemas: ${failed}`);
  console.log(`   📝 Total de issues: ${totalIssues}\n`);

  if (failed === 0) {
    console.log('✅ Todos os perfis passaram na validação de menu!\n');
    return;
  }

  console.log('\n' + '-'.repeat(80));
  console.log('📋 DETALHES POR PERFIL');
  console.log('-'.repeat(80) + '\n');

  for (const result of results) {
    console.log(`\n👤 ${result.role}`);
    console.log(`   Status: ${result.passed ? '✅ OK' : '❌ FALHOU'}`);
    
    if (result.allowedMenus.length > 0) {
      console.log(`   ✅ Menus permitidos encontrados: ${result.allowedMenus.join(', ')}`);
    }
    
    if (result.forbiddenMenus.length > 0) {
      console.log(`   ❌ Menus proibidos encontrados: ${result.forbiddenMenus.join(', ')}`);
    }

    if (result.issues.length > 0) {
      console.log(`   📝 Issues:`);
      for (const issue of result.issues) {
        console.log(`      ${issue}`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📚 PRÓXIMOS PASSOS');
  console.log('='.repeat(80));
  console.log('1. Revisar menus que aparecem indevidamente');
  console.log('2. Revisar menus que estão faltando');
  console.log('3. Ajustar sidebar.config.ts conforme necessário');
  console.log('4. Executar novamente: npm run script:validate-menu-rbac\n');
}

/**
 * Função principal
 */
function main() {
  console.log('🔍 Iniciando validação de menu/sidebar RBAC...\n');

  // Ler configuração do sidebar
  console.log('📁 Lendo sidebar.config.ts...');
  const configContent = readSidebarConfig();
  
  if (!configContent) {
    console.error('❌ Não foi possível ler sidebar.config.ts');
    process.exit(1);
  }

  // Extrair menus
  console.log('📋 Extraindo menus da configuração...');
  const menus = extractMenusFromConfig(configContent);
  
  if (menus.length === 0) {
    console.warn('⚠️  Nenhum menu encontrado na configuração. Verifique o formato do arquivo.');
  }

  // Validar para cada perfil
  const roles = Object.keys(ALLOWED_MENUS_BY_ROLE);
  const results: ValidationResult[] = [];

  for (const role of roles) {
    const result = validateMenuForRole(role, menus);
    results.push(result);
  }

  // Gerar relatório
  generateReport(results);

  // Exit code baseado em problemas
  const hasErrors = results.some(r => !r.passed);
  process.exit(hasErrors ? 1 : 0);
}

// Executar
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

