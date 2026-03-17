/**
 * Teste do fluxo servicosIncluir (checkboxes) - Taxa, Mensalidade, Bata, Passe
 *
 * Valida que:
 * - buildPagamentoFromEnt respeita servicosIncluir (checkboxes)
 * - Desmarcar um item zera o valor no total
 * - totalPago = soma apenas dos itens marcados
 *
 * Executar: npx tsx scripts/test-servicos-incluir-fluxo.ts
 */

interface ServicosIncluir {
  taxaMatricula: boolean;
  mensalidade: boolean;
  bata: boolean;
  passe: boolean;
}

interface Config {
  taxaMatriculaPadrao?: number | null;
  mensalidadePadrao?: number | null;
  valorPasse?: number | null;
}

function buildPagamentoFromEnt(
  ent: Record<string, unknown> | null | undefined,
  servicosIncluir: ServicosIncluir,
  config?: Config | null
) {
  if (!ent)
    return { taxaMatricula: 0, mensalidade: 0, bata: 0, passe: 0, totalPago: 0, formaPagamento: 'Transferência Bancária' };
  const taxaRaw = Number(ent.taxaMatricula ?? config?.taxaMatriculaPadrao ?? 0) || 0;
  const mensRaw = Number(ent.valorMensalidade ?? config?.mensalidadePadrao ?? 0) || 0;
  const bataRaw = ent.exigeBata ? Number(ent.valorBata ?? 0) || 0 : 0;
  const passeRaw = ent.exigePasse ? Number(ent.valorPasse ?? config?.valorPasse ?? 0) || 0 : 0;
  const taxa = servicosIncluir.taxaMatricula ? taxaRaw : 0;
  const mens = servicosIncluir.mensalidade ? mensRaw : 0;
  const bata = servicosIncluir.bata ? bataRaw : 0;
  const passe = servicosIncluir.passe ? passeRaw : 0;
  return {
    taxaMatricula: taxa,
    mensalidade: mens,
    bata,
    passe,
    totalPago: taxa + mens + bata + passe,
    formaPagamento: 'Transferência Bancária',
  };
}

async function runTests() {
  console.log('📋 TESTE DO FLUXO SERVIÇOS INCLUIR (checkboxes)\n');
  console.log('═'.repeat(60));

  const config = { taxaMatriculaPadrao: 45000, mensalidadePadrao: 5000, valorPasse: 2500 };
  const ent = {
    taxaMatricula: 50000,
    valorMensalidade: 6000,
    exigeBata: true,
    valorBata: 15000,
    exigePasse: true,
    valorPasse: 2500,
  };

  let passed = 0;
  let failed = 0;

  // 1. Todos marcados
  const allOn: ServicosIncluir = { taxaMatricula: true, mensalidade: true, bata: true, passe: true };
  const p1 = buildPagamentoFromEnt(ent, allOn, config);
  const esperado1 = 50000 + 6000 + 15000 + 2500;
  if (p1.totalPago === esperado1) {
    console.log('\n1. ✅ Todos marcados: total = 50000 + 6000 + 15000 + 2500 =', esperado1);
    passed++;
  } else {
    console.log('\n1. ❌ Esperado', esperado1, ', obtido', p1.totalPago);
    failed++;
  }

  // 2. Apenas taxa e mensalidade
  const semBataPasse: ServicosIncluir = { taxaMatricula: true, mensalidade: true, bata: false, passe: false };
  const p2 = buildPagamentoFromEnt(ent, semBataPasse, config);
  const esperado2 = 50000 + 6000;
  if (p2.totalPago === esperado2 && p2.bata === 0 && p2.passe === 0) {
    console.log('\n2. ✅ Sem bata/passe: total = 50000 + 6000 =', esperado2);
    passed++;
  } else {
    console.log('\n2. ❌ Esperado', esperado2, ', obtido', p2.totalPago, 'bata=', p2.bata, 'passe=', p2.passe);
    failed++;
  }

  // 3. Apenas bata
  const soBata: ServicosIncluir = { taxaMatricula: false, mensalidade: false, bata: true, passe: false };
  const p3 = buildPagamentoFromEnt(ent, soBata, config);
  if (p3.totalPago === 15000 && p3.bata === 15000 && p3.taxaMatricula === 0) {
    console.log('\n3. ✅ Apenas bata: total = 15000');
    passed++;
  } else {
    console.log('\n3. ❌ Esperado 15000, obtido', p3.totalPago);
    failed++;
  }

  // 4. Nenhum marcado
  const allOff: ServicosIncluir = { taxaMatricula: false, mensalidade: false, bata: false, passe: false };
  const p4 = buildPagamentoFromEnt(ent, allOff, config);
  if (p4.totalPago === 0) {
    console.log('\n4. ✅ Nenhum marcado: total = 0');
    passed++;
  } else {
    console.log('\n4. ❌ Esperado 0, obtido', p4.totalPago);
    failed++;
  }

  // 5. ent null
  const p5 = buildPagamentoFromEnt(null, allOn, config);
  if (p5.totalPago === 0) {
    console.log('\n5. ✅ ent null: total = 0');
    passed++;
  } else {
    console.log('\n5. ❌ Esperado 0, obtido', p5.totalPago);
    failed++;
  }

  // 6. Curso sem exigeBata/exigePasse
  const entSemBataPasse = { taxaMatricula: 40000, valorMensalidade: 5000, exigeBata: false, exigePasse: false };
  const p6 = buildPagamentoFromEnt(entSemBataPasse, allOn, config);
  if (p6.totalPago === 45000 && p6.bata === 0 && p6.passe === 0) {
    console.log('\n6. ✅ Curso sem bata/passe: total = 40000 + 5000 = 45000');
    passed++;
  } else {
    console.log('\n6. ❌ Esperado 45000, obtido', p6.totalPago);
    failed++;
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`\n📊 RESULTADO: ${passed} passou | ${failed} falhou\n`);

  if (failed > 0) process.exit(1);
  console.log('✅ Fluxo servicosIncluir validado.');
}

runTests();
