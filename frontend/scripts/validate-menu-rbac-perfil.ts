/**
 * ========================================
 * VALIDAÇÃO DE MENU/SIDEBAR POR PERFIL - DSICOLA
 * ========================================
 * 
 * Valida que cada perfil vê apenas os menus permitidos
 * Garante que nenhum item indevido é renderizado
 * 
 * Validações:
 * 1. Menu/Sidebar por perfil
 * 2. Rotas protegidas no frontend
 * 3. Componentes condicionais por role
 * 
 * Uso:
 *   npm run script:validate-menu-rbac-perfil
 *   ou
 *   tsx scripts/validate-menu-rbac-perfil.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========================================
// DEFINIÇÕES DE PERFIS
// ========================================

type UserRole = 'SUPER_ADMIN' | 'COMERCIAL' | 'ADMIN' | 'DIRECAO' | 'COORDENADOR' | 'PROFESSOR' | 'ALUNO' | 'SECRETARIA' | 'AUDITOR' | 'POS' | 'RESPONSAVEL' | 'RH' | 'FINANCEIRO';

interface MenuPermissoes {
  role: UserRole;
  menusPermitidos: string[];
  menusBloqueados: string[];
  rotasPermitidas: string[];
  rotasBloqueadas: string[];
}

const PERFIS_MENU: Record<UserRole, MenuPermissoes> = {
  SUPER_ADMIN: {
    role: 'SUPER_ADMIN',
    menusPermitidos: [
      'Dashboard',
      'Instituições',
      'Assinaturas',
      'Planos e Preços',
      'E-mails',
      'Logs Globais',
      'Financeiro',
    ],
    menusBloqueados: [
      'Configuração de Ensinos',
      'Plano de Ensino',
      'Aulas',
      'Presenças',
      'Notas',
      'Alunos',
      'Matrículas',
    ],
    rotasPermitidas: [
      '/super-admin',
      '/instituicoes',
      '/assinaturas',
      '/planos-precos',
      '/emails',
      '/logs-globais',
    ],
    rotasBloqueadas: [
      '/configuracao-ensinos',
      '/plano-ensino',
      '/aulas',
      '/presencas',
      '/notas',
      '/alunos',
      '/matriculas',
    ],
  },
  ADMIN: {
    role: 'ADMIN',
    menusPermitidos: [
      'Dashboard',
      'Configuração de Ensinos',
      'Calendário Acadêmico',
      'Plano de Ensino',
      'Distribuição de Aulas',
      'Aulas',
      'Presenças',
      'Notas',
      'Alunos',
      'Matrículas',
      'Documentos Acadêmicos',
      'Financeiro',
    ],
    menusBloqueados: [
      'Instituições',
      'Assinaturas',
      'Planos e Preços',
      'Logs Globais',
    ],
    rotasPermitidas: [
      '/admin-dashboard',
      '/configuracao-ensinos',
      '/calendario-academico',
      '/plano-ensino',
      '/distribuicao-aulas',
      '/aulas',
      '/presencas',
      '/notas',
      '/alunos',
      '/matriculas',
      '/documentos-academicos',
      '/financeiro',
    ],
    rotasBloqueadas: [
      '/super-admin',
      '/instituicoes',
      '/assinaturas',
      '/planos-precos',
      '/logs-globais',
    ],
  },
  PROFESSOR: {
    role: 'PROFESSOR',
    menusPermitidos: [
      'Dashboard',
      'Aulas',
      'Presenças',
      'Notas',
      'Plano de Ensino', // Apenas leitura própria
    ],
    menusBloqueados: [
      'Configuração de Ensinos',
      'Calendário Acadêmico',
      'Distribuição de Aulas',
      'Alunos',
      'Matrículas',
      'Encerramento Acadêmico',
    ],
    rotasPermitidas: [
      '/painel-professor',
      '/aulas',
      '/presencas',
      '/notas',
      '/plano-ensino', // Apenas leitura própria
    ],
    rotasBloqueadas: [
      '/configuracao-ensinos',
      '/calendario-academico',
      '/distribuicao-aulas',
      '/alunos',
      '/matriculas',
      '/encerramento-academico',
    ],
  },
  ALUNO: {
    role: 'ALUNO',
    menusPermitidos: [
      'Dashboard',
      'Notas',
      'Frequência',
      'Boletim',
      'Histórico',
      'Documentos',
      'Biblioteca',
    ],
    menusBloqueados: [
      'Configuração de Ensinos',
      'Plano de Ensino',
      'Aulas',
      'Presenças',
      'Alunos',
      'Matrículas',
      'Calendário Acadêmico',
    ],
    rotasPermitidas: [
      '/painel-aluno',
      '/notas',
      '/frequencia',
      '/boletim',
      '/historico',
      '/documentos',
      '/biblioteca',
    ],
    rotasBloqueadas: [
      '/configuracao-ensinos',
      '/plano-ensino',
      '/aulas',
      '/presencas',
      '/alunos',
      '/matriculas',
      '/calendario-academico',
    ],
  },
  SECRETARIA: {
    role: 'SECRETARIA',
    menusPermitidos: [
      'Dashboard',
      'Alunos',
      'Matrículas',
      'Documentos',
      'Relatórios',
      'Presenças', // Ver e ajustar
      'Notas', // Ver e ajustar
      'Calendário Acadêmico', // Ajustar datas
    ],
    menusBloqueados: [
      'Plano de Ensino',
      'Aulas',
      'Encerramento Acadêmico',
    ],
    rotasPermitidas: [
      '/secretaria-dashboard',
      '/alunos',
      '/matriculas',
      '/documentos',
      '/relatorios',
      '/presencas',
      '/notas',
      '/calendario-academico',
    ],
    rotasBloqueadas: [
      '/plano-ensino',
      '/aulas',
      '/encerramento-academico',
    ],
  },
  DIRECAO: {
    role: 'DIRECAO',
    menusPermitidos: [
      'Dashboard',
      'Configuração de Ensinos',
      'Calendário Acadêmico',
      'Plano de Ensino',
      'Distribuição de Aulas',
      'Aulas',
      'Presenças',
      'Notas',
      'Alunos',
      'Matrículas',
      'Documentos Acadêmicos',
      'Encerramento Acadêmico',
    ],
    menusBloqueados: [
      'Instituições',
      'Assinaturas',
      'Planos e Preços',
      'Logs Globais',
    ],
    rotasPermitidas: [
      '/admin-dashboard',
      '/configuracao-ensinos',
      '/calendario-academico',
      '/plano-ensino',
      '/distribuicao-aulas',
      '/aulas',
      '/presencas',
      '/notas',
      '/alunos',
      '/matriculas',
      '/documentos-academicos',
      '/encerramento-academico',
    ],
    rotasBloqueadas: [
      '/super-admin',
      '/instituicoes',
      '/assinaturas',
      '/planos-precos',
      '/logs-globais',
    ],
  },
  COORDENADOR: {
    role: 'COORDENADOR',
    menusPermitidos: [
      'Dashboard',
      'Configuração de Ensinos',
      'Calendário Acadêmico',
      'Plano de Ensino',
      'Distribuição de Aulas',
      'Aulas',
      'Presenças',
      'Notas',
      'Alunos',
      'Matrículas',
      'Documentos Acadêmicos',
    ],
    menusBloqueados: [
      'Encerramento Acadêmico',
      'Instituições',
      'Assinaturas',
    ],
    rotasPermitidas: [
      '/admin-dashboard',
      '/configuracao-ensinos',
      '/calendario-academico',
      '/plano-ensino',
      '/distribuicao-aulas',
      '/aulas',
      '/presencas',
      '/notas',
      '/alunos',
      '/matriculas',
      '/documentos-academicos',
    ],
    rotasBloqueadas: [
      '/encerramento-academico',
      '/super-admin',
      '/instituicoes',
      '/assinaturas',
    ],
  },
  AUDITOR: {
    role: 'AUDITOR',
    menusPermitidos: [
      'Dashboard',
      'Configuração de Ensinos',
      'Calendário Acadêmico',
      'Plano de Ensino',
      'Presenças',
      'Notas',
      'Alunos',
      'Matrículas',
    ],
    menusBloqueados: [
      'Aulas', // Não pode criar
      'Encerramento Acadêmico',
    ],
    rotasPermitidas: [
      '/admin-dashboard',
      '/configuracao-ensinos',
      '/calendario-academico',
      '/plano-ensino',
      '/presencas',
      '/notas',
      '/alunos',
      '/matriculas',
    ],
    rotasBloqueadas: [
      '/aulas',
      '/encerramento-academico',
    ],
  },
  RESPONSAVEL: {
    role: 'RESPONSAVEL',
    menusPermitidos: [
      'Dashboard',
      'Notas',
      'Frequência',
      'Boletim',
      'Histórico',
      'Documentos',
    ],
    menusBloqueados: [
      'Configuração de Ensinos',
      'Plano de Ensino',
      'Aulas',
      'Presenças',
      'Alunos',
      'Matrículas',
    ],
    rotasPermitidas: [
      '/painel-responsavel',
      '/notas',
      '/frequencia',
      '/boletim',
      '/historico',
      '/documentos',
    ],
    rotasBloqueadas: [
      '/configuracao-ensinos',
      '/plano-ensino',
      '/aulas',
      '/presencas',
      '/alunos',
      '/matriculas',
    ],
  },
  COMERCIAL: {
    role: 'COMERCIAL',
    menusPermitidos: ['Dashboard', 'Instituições', 'Assinaturas', 'Planos'],
    menusBloqueados: ['Gestão Acadêmica', 'Notas', 'Matrículas'],
    rotasPermitidas: ['/super-admin'],
    rotasBloqueadas: ['/admin-dashboard/gestao-academica', '/notas'],
  },
  POS: {
    role: 'POS',
    menusPermitidos: ['Dashboard', 'Ponto de Venda'],
    menusBloqueados: ['Gestão Acadêmica', 'Notas'],
    rotasPermitidas: ['/ponto-de-venda'],
    rotasBloqueadas: ['/admin-dashboard/gestao-academica'],
  },
  RH: {
    role: 'RH',
    menusPermitidos: ['Dashboard', 'Recursos Humanos'],
    menusBloqueados: ['Instituições', 'Assinaturas'],
    rotasPermitidas: ['/admin-dashboard/recursos-humanos'],
    rotasBloqueadas: ['/super-admin'],
  },
  FINANCEIRO: {
    role: 'FINANCEIRO',
    menusPermitidos: ['Dashboard', 'Pagamentos', 'Financeiro'],
    menusBloqueados: ['Gestão Acadêmica', 'Notas'],
    rotasPermitidas: ['/admin-dashboard/pagamentos'],
    rotasBloqueadas: ['/admin-dashboard/gestao-academica'],
  },
};

// ========================================
// INTERFACES DE VALIDAÇÃO
// ========================================

interface TestResult {
  perfil: UserRole;
  categoria: string;
  teste: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  mensagem: string;
  detalhes?: string;
}

interface ValidationReport {
  perfil: UserRole;
  totalTestes: number;
  passou: number;
  falhou: number;
  avisos: number;
  resultados: TestResult[];
}

// ========================================
// VALIDAÇÕES
// ========================================

/**
 * Validar sidebar config
 */
function validarSidebarConfig(perfil: UserRole): TestResult[] {
  const resultados: TestResult[] = [];
  const permissoes = PERFIS_MENU[perfil];

  const sidebarConfigPath = path.join(__dirname, '..', 'src', 'components', 'layout', 'sidebar.config.ts');
  
  if (!fs.existsSync(sidebarConfigPath)) {
    resultados.push({
      perfil,
      categoria: 'Sidebar',
      teste: 'Arquivo sidebar.config.ts existe',
      status: 'FAIL',
      mensagem: 'Arquivo sidebar.config.ts não encontrado',
    });
    return resultados;
  }

  const conteudo = fs.readFileSync(sidebarConfigPath, 'utf-8');

  // Verificar se função getSidebarItemsForRole existe
  if (!conteudo.includes('getSidebarItemsForRole')) {
    resultados.push({
      perfil,
      categoria: 'Sidebar',
      teste: 'Função getSidebarItemsForRole existe',
      status: 'FAIL',
      mensagem: 'Função getSidebarItemsForRole não encontrada',
      detalhes: 'Deve existir função para filtrar itens por role',
    });
  }

  // Verificar se menus bloqueados não aparecem para o perfil
  for (const menuBloqueado of permissoes.menusBloqueados) {
    // Verificar se menu bloqueado tem role do perfil
    const regex = new RegExp(`label:\\s*['"]${menuBloqueado}['"][\\s\\S]{0,500}roles:\\s*\\[[\\s\\S]{0,200}${perfil}`, 'i');
    if (regex.test(conteudo)) {
      resultados.push({
        perfil,
        categoria: 'Sidebar',
        teste: `${perfil} não vê menu ${menuBloqueado}`,
        status: 'FAIL',
        mensagem: `Menu ${menuBloqueado} está disponível para ${perfil} mas não deveria`,
        detalhes: `Remover ${perfil} do array roles do menu ${menuBloqueado}`,
      });
    }
  }

  // Verificar se menus permitidos aparecem para o perfil
  for (const menuPermitido of permissoes.menusPermitidos) {
    // Verificar se menu permitido tem role do perfil
    const regex = new RegExp(`label:\\s*['"]${menuPermitido}['"][\\s\\S]{0,500}roles:\\s*\\[[\\s\\S]{0,200}${perfil}`, 'i');
    if (!regex.test(conteudo)) {
      resultados.push({
        perfil,
        categoria: 'Sidebar',
        teste: `${perfil} vê menu ${menuPermitido}`,
        status: 'WARN',
        mensagem: `Menu ${menuPermitido} pode não estar disponível para ${perfil}`,
        detalhes: `Verificar se ${perfil} está no array roles do menu ${menuPermitido}`,
      });
    }
  }

  return resultados;
}

/**
 * Validar rotas protegidas no frontend
 */
function validarRotasProtegidas(perfil: UserRole): TestResult[] {
  const resultados: TestResult[] = [];
  const permissoes = PERFIS_MENU[perfil];

  // Buscar arquivo App.tsx ou rotas
  const appPath = path.join(__dirname, '..', 'src', 'App.tsx');
  const routesPath = path.join(__dirname, '..', 'src', 'routes');

  let conteudo = '';
  if (fs.existsSync(appPath)) {
    conteudo = fs.readFileSync(appPath, 'utf-8');
  } else if (fs.existsSync(routesPath)) {
    const arquivos = fs.readdirSync(routesPath);
    for (const arquivo of arquivos) {
      const arquivoPath = path.join(routesPath, arquivo);
      conteudo += fs.readFileSync(arquivoPath, 'utf-8');
    }
  }

  if (!conteudo) {
    resultados.push({
      perfil,
      categoria: 'Rotas',
      teste: 'Arquivo de rotas encontrado',
      status: 'WARN',
      mensagem: 'Não foi possível encontrar arquivo de rotas',
    });
    return resultados;
  }

  // Verificar se ProtectedRoute existe
  if (!conteudo.includes('ProtectedRoute')) {
    resultados.push({
      perfil,
      categoria: 'Rotas',
      teste: 'Componente ProtectedRoute existe',
      status: 'WARN',
      mensagem: 'Componente ProtectedRoute não encontrado',
      detalhes: 'Deve usar ProtectedRoute para proteger rotas',
    });
  }

  // Verificar se rotas bloqueadas estão protegidas
  for (const rotaBloqueada of permissoes.rotasBloqueadas) {
    // Verificar se rota bloqueada tem proteção
    const regex = new RegExp(`path=['"]${rotaBloqueada.replace('/', '\\/')}['"]`, 'i');
    if (regex.test(conteudo)) {
      // Verificar se tem allowedRoles que bloqueia o perfil
      const temProtecao = conteudo.includes('allowedRoles') && !conteudo.includes(`${perfil}`);
      if (!temProtecao) {
        resultados.push({
          perfil,
          categoria: 'Rotas',
          teste: `Rota ${rotaBloqueada} bloqueia ${perfil}`,
          status: 'WARN',
          mensagem: `Rota ${rotaBloqueada} pode não estar bloqueada para ${perfil}`,
          detalhes: `Verificar se ProtectedRoute bloqueia ${perfil} na rota ${rotaBloqueada}`,
        });
      }
    }
  }

  return resultados;
}

/**
 * Validar componentes condicionais
 */
function validarComponentesCondicionais(perfil: UserRole): TestResult[] {
  const resultados: TestResult[] = [];
  const permissoes = PERFIS_MENU[perfil];

  // Buscar componentes que usam roles
  const componentsDir = path.join(__dirname, '..', 'src', 'components');
  
  if (!fs.existsSync(componentsDir)) {
    return resultados;
  }

  function buscarArquivos(dir: string): string[] {
    const arquivos: string[] = [];
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        arquivos.push(...buscarArquivos(itemPath));
      } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
        arquivos.push(itemPath);
      }
    }
    
    return arquivos;
  }

  const arquivos = buscarArquivos(componentsDir);

  for (const arquivo of arquivos) {
    const conteudo = fs.readFileSync(arquivo, 'utf-8');
    const nomeArquivo = path.basename(arquivo);

    // Verificar se componente verifica role antes de renderizar
    if (conteudo.includes('role') || conteudo.includes('roles')) {
      // Verificar se usa verificação condicional
      const temVerificacao = conteudo.includes('includes(') || conteudo.includes('some(') || conteudo.includes('hasRole');
      
      if (temVerificacao) {
        // Verificar se menus bloqueados não são renderizados
        for (const menuBloqueado of permissoes.menusBloqueados) {
          if (conteudo.includes(menuBloqueado)) {
            // Verificar se há verificação que bloqueia
            const regex = new RegExp(`${menuBloqueado}[\\s\\S]{0,300}${perfil}`, 'i');
            if (regex.test(conteudo) && !conteudo.includes('!') && !conteudo.includes('!==')) {
              resultados.push({
                perfil,
                categoria: 'Componentes',
                teste: `Componente ${nomeArquivo} não renderiza ${menuBloqueado} para ${perfil}`,
                status: 'WARN',
                mensagem: `Componente ${nomeArquivo} pode renderizar ${menuBloqueado} para ${perfil}`,
                detalhes: `Verificar lógica condicional para ${menuBloqueado}`,
              });
            }
          }
        }
      }
    }
  }

  return resultados;
}

/**
 * Validar campos condicionais (ENSINO_SUPERIOR vs ENSINO_SECUNDARIO)
 */
function validarCamposCondicionaisFrontend(perfil: UserRole): TestResult[] {
  const resultados: TestResult[] = [];

  // Buscar componentes que lidam com tipoAcademico
  const componentsDir = path.join(__dirname, '..', 'src', 'components');
  
  if (!fs.existsSync(componentsDir)) {
    return resultados;
  }

  function buscarArquivos(dir: string): string[] {
    const arquivos: string[] = [];
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        arquivos.push(...buscarArquivos(itemPath));
      } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
        arquivos.push(itemPath);
      }
    }
    
    return arquivos;
  }

  const arquivos = buscarArquivos(componentsDir);

  for (const arquivo of arquivos) {
    const conteudo = fs.readFileSync(arquivo, 'utf-8');
    const nomeArquivo = path.basename(arquivo);

    // Verificar se há referência a Classe (ENSINO_SECUNDARIO)
    if (conteudo.includes('classe') || conteudo.includes('Classe')) {
      // Verificar se há validação de tipoAcademico
      if (!conteudo.includes('tipoAcademico') && !conteudo.includes('ENSINO_SECUNDARIO')) {
        resultados.push({
          perfil,
          categoria: 'Campos Condicionais',
          teste: `Componente ${nomeArquivo} oculta Classe para ENSINO_SUPERIOR`,
          status: 'WARN',
          mensagem: `Componente ${nomeArquivo} pode mostrar Classe para ENSINO_SUPERIOR`,
          detalhes: 'Deve verificar tipoAcademico antes de mostrar Classe',
        });
      }
    }

    // Verificar se há referência a Semestre (ENSINO_SUPERIOR)
    if (conteudo.includes('semestre') || conteudo.includes('Semestre')) {
      // Verificar se há validação de tipoAcademico
      if (!conteudo.includes('tipoAcademico') && !conteudo.includes('ENSINO_SUPERIOR')) {
        resultados.push({
          perfil,
          categoria: 'Campos Condicionais',
          teste: `Componente ${nomeArquivo} oculta Semestre para ENSINO_SECUNDARIO`,
          status: 'WARN',
          mensagem: `Componente ${nomeArquivo} pode mostrar Semestre para ENSINO_SECUNDARIO`,
          detalhes: 'Deve verificar tipoAcademico antes de mostrar Semestre',
        });
      }
    }
  }

  return resultados;
}

// ========================================
// GERAÇÃO DE RELATÓRIO
// ========================================

function gerarRelatorio(relatorios: ValidationReport[]): void {
  console.log('\n' + '='.repeat(80));
  console.log('📋 RELATÓRIO DE VALIDAÇÃO MENU/SIDEBAR POR PERFIL - DSICOLA');
  console.log('='.repeat(80) + '\n');

  let totalTestes = 0;
  let totalPassou = 0;
  let totalFalhou = 0;
  let totalAvisos = 0;

  for (const relatorio of relatorios) {
    totalTestes += relatorio.totalTestes;
    totalPassou += relatorio.passou;
    totalFalhou += relatorio.falhou;
    totalAvisos += relatorio.avisos;

    console.log(`\n👤 PERFIL: ${relatorio.perfil}`);
    console.log('-'.repeat(80));
    console.log(`   Total de testes: ${relatorio.totalTestes}`);
    console.log(`   ✅ Passou: ${relatorio.passou}`);
    console.log(`   ❌ Falhou: ${relatorio.falhou}`);
    console.log(`   ⚠️  Avisos: ${relatorio.avisos}`);

    // Mostrar apenas falhas e avisos
    const problemas = relatorio.resultados.filter(r => r.status !== 'PASS');
    if (problemas.length > 0) {
      console.log(`\n   📋 Problemas encontrados:`);
      for (const problema of problemas) {
        const icon = problema.status === 'FAIL' ? '🚨' : '⚠️';
        console.log(`   ${icon} [${problema.categoria}] ${problema.teste}`);
        console.log(`      ${problema.mensagem}`);
        if (problema.detalhes) {
          console.log(`      💡 ${problema.detalhes}`);
        }
      }
    } else {
      console.log(`\n   ✅ Nenhum problema encontrado!`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 RESUMO GERAL');
  console.log('='.repeat(80));
  console.log(`   Total de testes: ${totalTestes}`);
  console.log(`   ✅ Passou: ${totalPassou}`);
  console.log(`   ❌ Falhou: ${totalFalhou}`);
  console.log(`   ⚠️  Avisos: ${totalAvisos}`);
  console.log(`   📈 Taxa de sucesso: ${((totalPassou / totalTestes) * 100).toFixed(2)}%`);

  if (totalFalhou === 0 && totalAvisos === 0) {
    console.log('\n✅ Todos os perfis passaram na validação!\n');
  } else {
    console.log('\n⚠️  Alguns problemas foram encontrados. Revise os detalhes acima.\n');
  }
}

// ========================================
// FUNÇÃO PRINCIPAL
// ========================================

function main() {
  console.log('🔍 Iniciando validação de menu/sidebar por perfil...\n');

  const perfisParaValidar: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'PROFESSOR', 'ALUNO', 'SECRETARIA', 'DIRECAO', 'COORDENADOR', 'AUDITOR'];
  const relatorios: ValidationReport[] = [];

  for (const perfil of perfisParaValidar) {
    console.log(`📋 Validando perfil: ${perfil}...`);

    const resultados: TestResult[] = [];

    // 1. Validar sidebar config
    resultados.push(...validarSidebarConfig(perfil));

    // 2. Validar rotas protegidas
    resultados.push(...validarRotasProtegidas(perfil));

    // 3. Validar componentes condicionais
    resultados.push(...validarComponentesCondicionais(perfil));

    // 4. Validar campos condicionais
    resultados.push(...validarCamposCondicionaisFrontend(perfil));

    const relatorio: ValidationReport = {
      perfil,
      totalTestes: resultados.length,
      passou: resultados.filter(r => r.status === 'PASS').length,
      falhou: resultados.filter(r => r.status === 'FAIL').length,
      avisos: resultados.filter(r => r.status === 'WARN').length,
      resultados,
    };

    relatorios.push(relatorio);
  }

  // Gerar relatório
  gerarRelatorio(relatorios);

  // Exit code
  const temFalhas = relatorios.some(r => r.falhou > 0);
  process.exit(temFalhas ? 1 : 0);
}

// Executar
main();

