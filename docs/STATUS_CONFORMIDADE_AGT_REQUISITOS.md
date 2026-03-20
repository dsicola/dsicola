# Status de Conformidade — Requisitos AGT (Ref. 0000481/01180000/AGT/2026)

> Verificação de **todos** os requisitos exigidos no ofício da AGT (Software agt.pdf) vs implementação no DSICOLA.

---

## Requisitos gerais (PDFs)

| Requisito AGT | Implementado | Notas |
|---------------|:------------:|-------|
| PDFs em **dois meses diferentes** | ✅ | Processo manual — emitir em Jan e Fev |
| **4 caracteres Hash + texto** no rodapé | ✅ | `[XXXX]-Processado por programa válido n31.1/AGT20` |
| **Período (Period)** nos campos 4.1.4.5 / 4.2.3.5 / 4.3.4.5 | ✅ | Data no PDF; Period no SAF-T XML |
| **Assinatura** do documento | ⚠️ | Hash no rodapé; assinatura RSA digital — confirmar com AGT se exigido |

---

## Documentos a fornecer (pontos 1–14)

| Ponto | Exigência AGT | Implementado | Como gerar |
|-------|---------------|:------------:|------------|
| **1** | Factura para cliente com NIF | ✅ | Documentos Fiscais ou pagar mensalidade → Recibo/FT |
| **2** | Factura anulada + PDF visível "anulado" | ✅ | Estornar mensalidade → PDF com selo "ANULADO" |
| **3** | Pró-forma (conferência bens/serviços) | ✅ | Documentos Fiscais → Tab Pró-forma |
| **4** | Factura baseada no doc. ponto 3 (OrderReferences) | ✅ | Documentos Fiscais → Tab Fatura de PF |
| **5** | Nota de crédito baseada na factura ponto 4 | ✅ | Documentos Fiscais → Tab Nota Crédito |
| **6** | Factura 2 linhas: 1ª IVA 14% ou 5%; 2ª isenta (M00–M38) | ✅ | Documentos Fiscais → Pró-forma com 2 linhas (IVA + Cód. Isenção) |
| **7** | Doc. 2 linhas: qtd 100, preço 0.55, desconto linha 8.8% + SettlementAmount | ✅ | **Script** `npx tsx scripts/seed-documentos-certificacao-agt.ts` — a UI não suporta 8.8% nem este cenário exato |
| **8** | Documento em moeda estrangeira | ✅ | Documentos Fiscais → Moeda USD ou EUR |
| **9** | Cliente sem NIF, total < 50 AOA, SystemEntryDate até 10h | ✅ | permitirClienteSemNifAteValor (50); emitir de manhã cedo (manual) |
| **10** | Outro documento cliente sem NIF | ✅ | Igual ao ponto 9, com outro aluno |
| **11** | Duas guias de remessa | ✅ | Documentos Fiscais → Tab Guia Remessa (emitir 2×) |
| **12** | Orçamento ou pró-forma | ✅ | Documentos Fiscais → Tab Pró-forma |
| **13** | Factura genérica | ❌ | **Não aplicável** — indicar na resposta |
| **14** | Auto-facturação | ❌ | **Não aplicável** — indicar na resposta |
| **15** | Factura global | ❌ | **Não aplicável** — indicar na resposta |
| **16** | Outros tipos de documento | ✅ | Recibo (RC), FT, NC, PF, GR |

---

## SAF-T XML

| Requisito | Implementado | Notas |
|-----------|:------------:|-------|
| Um único ficheiro XML SAF-T | ✅ | Exportar SAFT |
| Integrar todos os documentos exemplo | ✅ | Escolher período que os inclua |
| HashControl (4.1.4.4, 4.2.3.4, 4.3.4.4) preenchido | ✅ | hashControl em cada documento |
| Estrutura Decreto 312/18 | ✅ | Schema SAF-T AO 1.01_01 |
| **UnitPrice** sem imposto, 4 casas decimais | ⚠️ | Verificar precisão no saft.service |

---

## Códigos de isenção (M00–M38)

Todos os códigos exigidos estão disponíveis no formulário e no SAF-T:

| Códigos | Implementado |
|---------|:------------:|
| M00, M02, M04, M11–M20, M30–M38 | ✅ |
| TaxExemptionReason no SAF-T | ✅ |
| Código visível no PDF | ✅ |

---

## Resposta e mapeamento (pontos 15–17)

| Requisito | Implementado |
|-----------|:------------:|
| **15.** Indicar documento de exemplo por ponto | ✅ | Tabela na carta |
| **16.** "Não aplicável" para docs não produzidos | ✅ | Pontos 13, 14, 15 |
| **17.** Ficheiro SAF-T com todos os documentos | ✅ | Exportar SAFT |

---

## Resumo executivo

| Categoria | Status |
|-----------|--------|
| PDFs (texto fiscal, anulado) | ✅ |
| Pontos 1–12 (documentos) | ✅ |
| Pontos 13–15 (não aplicável) | ✅ |
| SAF-T XML | ✅ |
| Ponto 7 (script obrigatório) | ✅ Via script |
| UnitPrice 4 decimais | ⚠️ A verificar |
| Assinatura digital | ⚠️ A confirmar com AGT |

---

## Conclusão

**Sim, praticamente tudo o que a AGT exige está implementado no DSICOLA.**  

Exceções:
- **Ponto 7** — Tem de ser gerado pelo script `seed-documentos-certificacao-agt.ts` (a interface não permite o cenário exato).
- **Pontos 13, 14, 15** — Factura genérica, auto-facturação e factura global não existem no DSICOLA; deve indicar "Não aplicável" na carta.
- **SystemEntryDate até 10h** (ponto 9) — Operacional: emitir o documento antes das 10h.
- **Assinatura digital** — Confirmar com a AGT se o hash no rodapé é suficiente.

Para gerar o conjunto completo de documentos, execute o script AGT (inclui o ponto 7) e complemente com os restantes na interface.
