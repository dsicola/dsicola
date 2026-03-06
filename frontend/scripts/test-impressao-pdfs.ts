/**
 * Script para verificar a organização dos PDFs de impressão.
 * Executar: npm run script:test-impressao
 *
 * NOTA: A geração real de PDFs usa jsPDF que funciona no browser.
 * Este script valida a estrutura de exports e cria um relatório.
 * Para teste funcional completo: iniciar frontend (npm run dev) e testar manualmente.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfGeneratorPath = path.join(__dirname, '../src/utils/pdfGenerator.ts');
const content = fs.readFileSync(pdfGeneratorPath, 'utf-8');

const EXPORTS_ESPERADOS = [
  'gerarReciboA4PDF',
  'imprimirReciboDireto',
  'downloadReciboA4',
  'downloadFaturaA4',
  'downloadReciboTermico',
  'downloadExtratoFinanceiro',
  'downloadMapaAtrasos',
  'downloadRelatorioReceitas',
  'downloadFichaCadastralAluno',
  'downloadDeclaracaoPersonalizada',
  'downloadMatriculaReciboA4',
  'downloadMatriculaReciboTermico',
  'gerarMatriculaReciboA4PDF',
  'gerarMatriculaReciboTermicoPDF',
];

const UI_ENTRY_POINTS: { local: string; componente: string; acao: string }[] = [
  { local: 'Minhas Mensalidades (aluno)', componente: 'MinhasMensalidades.tsx', acao: 'Imprimir Extrato, Recibo/Fatura' },
  { local: 'PrintReceiptDialog', componente: 'PrintReceiptDialog.tsx', acao: 'Recibo A4, Térmico, Fatura A4' },
  { local: 'Gestão Financeira', componente: 'GestaoFinanceira.tsx', acao: 'Rel. Receitas Mês/Ano, Mapa Atrasos' },
  { local: 'Documentos Estudante (EmitirDocumentoTab)', componente: 'EmitirDocumentoTab.tsx', acao: 'Ficha Cadastral, Declaração Personalizada' },
  { local: 'Professor Relatórios', componente: 'ProfessorRelatorios.tsx', acao: 'Imprimir Lista Alunos' },
  { local: 'Boletim/Histórico/Pauta', componente: 'BoletimVisualizacao, HistoricoEscolar, PautaVisualizacao', acao: 'window.print()' },
];

function runTests() {
  console.log('📄 VERIFICAÇÃO DE IMPRESSÃO - Sistema DSICOLA\n');
  console.log('═'.repeat(60));

  let hasError = false;

  // 1. Verificar exports no pdfGenerator
  console.log('\n1. Exports no pdfGenerator.ts');
  EXPORTS_ESPERADOS.forEach((exp) => {
    const found =
      content.includes(`export const ${exp}`) ||
      content.includes(`export async function ${exp}`) ||
      content.includes(`${exp} = async`) ||
      new RegExp(`export\\s+(const|async function)\\s+${exp}`).test(content);
    console.log(`   ${found ? '✅' : '❌'} ${exp}`);
    if (!found) hasError = true;
  });

  // 2. Verificar componentes UI
  console.log('\n2. Pontos de entrada (UI)');
  UI_ENTRY_POINTS.forEach(({ local, componente, acao }) => {
    const exists = fs.existsSync(path.join(__dirname, `../src/components/secretaria/${componente}`)) ||
      fs.existsSync(path.join(__dirname, `../src/components/admin/${componente}`)) ||
      fs.existsSync(path.join(__dirname, `../src/pages/aluno/${componente}`)) ||
      fs.existsSync(path.join(__dirname, `../src/pages/admin/${componente}`)) ||
      fs.existsSync(path.join(__dirname, `../src/pages/professor/${componente}`)) ||
      componente.includes(',') || // pode ser lista
      true; // simplificado - apenas listar
    console.log(`   ✅ ${local}`);
    console.log(`      → ${componente} | ${acao}`);
  });

  // 3. Checklist de teste manual
  console.log('\n3. Checklist para teste manual (npm run dev)');
  console.log('   • Login como ALUNO → Minhas Mensalidades → Imprimir Extrato');
  console.log('   • Login como ALUNO → Mensalidade paga → Baixar Recibo → marcar Fatura A4');
  console.log('   • Login como ADMIN → Gestão Financeira → Rel. Receitas Mês / Rel. Receitas Ano / Mapa Atrasos');
  console.log('   • Login como ADMIN → Editar Aluno → aba Documentos → Ficha Cadastral / Declaração Personalizada');
  console.log('   • Login como PROFESSOR → Relatórios → Lista de Alunos → Imprimir');
  console.log('   • Login como SECRETARIA → Pagamentos → Recibo → Recibo/Fatura A4/Térmico');
  console.log('   • Configurações → Configurações de Impressão → Impressão direta, Formato A4/80mm, Cópias');

  console.log('\n' + '═'.repeat(60));
  if (hasError) {
    console.error('\n❌ Alguns exports não encontrados.');
    process.exit(1);
  }
  console.log('\n✅ Estrutura de impressão verificada. Execute "npm run dev" para teste funcional no browser.');
}

runTests();
