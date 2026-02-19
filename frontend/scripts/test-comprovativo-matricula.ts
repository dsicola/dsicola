/**
 * Script para testar a geração do comprovativo de matrícula (A4 e térmico).
 * Nota: jsPDF requer browser; em Node pode falhar. Use script:test-recibo-matricula-fluxo para validar a lógica.
 * Executar: npm run script:test-comprovativo
 */
import { gerarMatriculaReciboA4PDF, gerarMatriculaReciboTermicoPDF, MatriculaReciboData } from '../src/utils/pdfGenerator';

const dadosTeste: MatriculaReciboData = {
  instituicao: {
    nome: 'Instituto Superior do Kuito',
    nif: '123456789',
    logoUrl: null,
    email: 'contato@iskuito.edu.ao',
    telefone: '+244 123 456 789',
    endereco: 'Kuito, Angola',
  },
  aluno: {
    nome: 'Cassessa Delfina',
    numeroId: '2026-0458',
    bi: null,
    email: 'cassessa@email.com',
  },
  matricula: {
    curso: 'Engenharia de Informática',
    turma: 'Turma AM',
    turno: 'Manhã',
    disciplina: 'Fisiologia',
    disciplinas: ['Fisiologia', 'Inglês'],
    ano: 2026,
    semestre: '1',
    dataMatricula: new Date().toISOString(),
    reciboNumero: 'MAT20260212-TEST',
    anoFrequencia: '1º Ano',
    classeFrequencia: null,
    tipoAcademico: 'SUPERIOR',
  },
  pagamento: {
    taxaMatricula: 45000,
    mensalidade: 5000,
    totalPago: 50000,
    formaPagamento: 'Transferência',
  },
  operador: 'Daniel Pinto Antonio',
};

async function testarComprovativo() {
  console.log('🔍 Testando geração do comprovativo de matrícula...\n');

  try {
    // Teste A4 (jsPDF requer browser – em Node pode falhar)
    console.log('1. Gerando comprovativo A4...');
    let blobA4: Blob;
    try {
      blobA4 = await gerarMatriculaReciboA4PDF(dadosTeste);
    } catch (e) {
      if ((e as Error).message?.includes('constructor') || (e as Error).message?.includes('jsPDF')) {
        console.log('   ⚠️  jsPDF requer browser. Execute o teste no browser ou use script:test-recibo-matricula-fluxo para validar a lógica.');
        return;
      }
      throw e;
    }
    if (!blobA4 || blobA4.size === 0) {
      throw new Error('Blob A4 vazio ou inválido');
    }
    console.log(`   ✅ A4 gerado com sucesso (${blobA4.size} bytes)\n`);

    // Teste Térmico
    console.log('2. Gerando comprovativo térmico...');
    const blobTermico = await gerarMatriculaReciboTermicoPDF(dadosTeste);
    if (!blobTermico || blobTermico.size === 0) {
      throw new Error('Blob térmico vazio ou inválido');
    }
    console.log(`   ✅ Térmico gerado com sucesso (${blobTermico.size} bytes)\n`);

    // Teste com dados mínimos (fallbacks)
    console.log('3. Testando com dados mínimos (fallbacks)...');
    const dadosMinimos: MatriculaReciboData = {
      instituicao: { nome: 'Instituição' },
      aluno: { nome: 'Aluno Teste' },
      matricula: {
        curso: 'Curso',
        turma: 'Turma',
        disciplina: '',
        ano: 2026,
        semestre: '',
        dataMatricula: new Date().toISOString(),
        reciboNumero: 'MAT-TEST-MIN',
      },
    };
    const blobMinA4 = await gerarMatriculaReciboA4PDF(dadosMinimos);
    const blobMinTermico = await gerarMatriculaReciboTermicoPDF(dadosMinimos);
    console.log(`   ✅ A4 mínimo: ${blobMinA4.size} bytes`);
    console.log(`   ✅ Térmico mínimo: ${blobMinTermico.size} bytes\n`);

    // Teste Ensino Secundário
    console.log('4. Testando formato Ensino Secundário...');
    const dadosSecundario: MatriculaReciboData = {
      ...dadosTeste,
      aluno: { ...dadosTeste.aluno, nome: 'João Manuel', numeroId: '20260012' },
      matricula: {
        ...dadosTeste.matricula,
        tipoAcademico: 'SECUNDARIO',
        anoFrequencia: null,
        classeFrequencia: '10ª Classe',
        curso: 'Ciências Físicas e Biológicas',
        turma: '10-A',
      },
      pagamento: { taxaMatricula: 5000, mensalidade: 12000, totalPago: 17000, formaPagamento: 'Multicaixa' },
      encarregado: 'Maria José',
    };
    const blobSecA4 = await gerarMatriculaReciboA4PDF(dadosSecundario);
    const blobSecTermico = await gerarMatriculaReciboTermicoPDF(dadosSecundario);
    console.log(`   ✅ A4 secundário: ${blobSecA4.size} bytes`);
    console.log(`   ✅ Térmico secundário: ${blobSecTermico.size} bytes\n`);

    console.log('✅ Todos os testes passaram! O comprovativo está a funcionar corretamente.');
  } catch (erro) {
    console.error('\n❌ Erro ao gerar comprovativo:', erro);
    process.exit(1);
  }
}

testarComprovativo();
