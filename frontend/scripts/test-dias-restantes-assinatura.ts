/**
 * Teste unitário: Lógica de dias restantes na área Minha Assinatura
 *
 * Valida:
 * - Cálculo correto de differenceInDays com startOfDay
 * - Dias regressivos (hoje vs amanhã, hoje vs daqui 5 dias, etc.)
 * - Casos de assinatura expirada (dias negativos)
 *
 * Uso: npx tsx scripts/test-dias-restantes-assinatura.ts
 */
import { differenceInDays, startOfDay, addDays, subDays } from 'date-fns';

function getDaysRemaining(dataProximoPagamento: string | Date, now: Date): number | null {
  if (!dataProximoPagamento) return null;
  const today = startOfDay(now);
  const dueDate = startOfDay(new Date(dataProximoPagamento));
  return differenceInDays(dueDate, today);
}

function runTests() {
  let passed = 0;
  let failed = 0;

  const assert = (name: string, condition: boolean, detail?: string) => {
    if (condition) {
      console.log(`  ✅ ${name}`);
      passed++;
    } else {
      console.error(`  ❌ ${name}${detail ? `: ${detail}` : ''}`);
      failed++;
    }
  };

  const hoje = new Date();
  hoje.setHours(12, 30, 45, 0); // meio-dia para testar que startOfDay normaliza

  console.log('\n📋 Teste: Dias Restantes - Minha Assinatura\n');
  console.log('Data de referência (now):', hoje.toISOString());
  console.log('');

  // 1. Vencimento amanhã = 1 dia restante
  const amanha = addDays(hoje, 1);
  const diasAmanha = getDaysRemaining(amanha.toISOString(), hoje);
  assert('Vencimento amanhã retorna 1 dia restante', diasAmanha === 1, `obtido: ${diasAmanha}`);

  // 2. Vencimento hoje = 0 dias restante
  const hojeStr = startOfDay(hoje).toISOString();
  const diasHoje = getDaysRemaining(hojeStr, hoje);
  assert('Vencimento hoje retorna 0 dias restantes', diasHoje === 0, `obtido: ${diasHoje}`);

  // 3. Vencimento daqui 5 dias = 5 dias restantes
  const daqui5 = addDays(hoje, 5);
  const dias5 = getDaysRemaining(daqui5.toISOString(), hoje);
  assert('Vencimento em 5 dias retorna 5 dias restantes', dias5 === 5, `obtido: ${dias5}`);

  // 4. Vencimento ontem = -1 (expirado)
  const ontem = subDays(hoje, 1);
  const diasOntem = getDaysRemaining(ontem.toISOString(), hoje);
  assert('Vencimento ontem retorna -1 (expirado)', diasOntem === -1, `obtido: ${diasOntem}`);

  // 5. Vencimento há 10 dias = -10
  const ha10 = subDays(hoje, 10);
  const diasHa10 = getDaysRemaining(ha10.toISOString(), hoje);
  assert('Vencimento há 10 dias retorna -10', diasHa10 === -10, `obtido: ${diasHa10}`);

  // 6. Atualização dinâmica: "amanhã" visto à meia-noite vs ao meio-dia
  const meiaNoite = new Date(hoje);
  meiaNoite.setHours(0, 0, 0, 0);
  const amanhaMeiaNoite = addDays(meiaNoite, 1);
  amanhaMeiaNoite.setHours(23, 59, 59, 999);
  const diasDesdeMeiaNoite = getDaysRemaining(amanhaMeiaNoite.toISOString(), meiaNoite);
  assert('Vencimento amanhã às 23:59 = 1 dia (startOfDay)', diasDesdeMeiaNoite === 1, `obtido: ${diasDesdeMeiaNoite}`);

  // 7. null quando sem data
  const semData = getDaysRemaining('', hoje);
  assert('Sem data_proximo_pagamento retorna null', semData === null, `obtido: ${semData}`);

  console.log('');
  console.log('─'.repeat(50));
  console.log(`Resultado: ${passed} passou, ${failed} falhou`);
  console.log('─'.repeat(50));

  if (failed > 0) {
    process.exit(1);
  }
  console.log('\n✅ Todos os testes passaram. Lógica de dias restantes OK.\n');
}

runTests();
