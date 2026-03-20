# Notificação AGT — Validação de Software (Ref. 0000481/01180000/AGT/2026)

> Documento baseado na notificação recebida em **12 de Março de 2026** da Direcção de Cobrança, Reembolso e Restituição (AGT).

---

## Requisitos gerais

| Item | Especificação |
|------|---------------|
| **Prazo** | 15 dias úteis |
| **Envio** | Email: **produtos.dfe.dcrr.agt@minfin.gov.ao** |
| **Formato** | PDFs em dois meses diferentes, conforme tipologia abaixo |

---

## Obrigatório em cada documento PDF

- **Período (Period)**: campos 4.1.4.5, 4.2.3.5 ou 4.3.4.5, conforme tipologia
- **Assinatura**: documento devidamente assinado
- **Texto fiscal no rodapé** (obrigatório):
  ```
  [4 caracteres do Hash]-Processado por programa válido n31.1/AGT20
  ```
  Exemplo: `F3A7-Processado por programa válido n31.1/AGT20`

---

## Documentos a fornecer (se aplicável)

| # | Documento | DSICOLA | Ação |
|---|-----------|---------|------|
| 1 | Factura para cliente com NIF | ✅ | Recibo/FT com aluno com BI |
| 2 | Factura anulada + PDF após anulação (visível "anulado") | ✅ | Fluxo: estorno → DocumentoFinanceiro ESTORNADO → PDF "ANULADO" |
| 3 | Pró-forma (conferência de transmissão de bens/serviços) | ✅ | criarProforma() - tipo PF |
| 4 | Factura com base no documento do ponto 3 (OrderReferences) | ✅ | criarFaturaBaseadaEmProforma() - SAF-T OrderReferences |
| 5 | Nota de crédito com base na factura do ponto 4 | ✅ | criarNotaCredito() - SAF-T References |
| 6 | Factura com 2 linhas: 1ª linha IVA 14% ou 5%; 2ª linha isenta (TaxExemptionReason) | ✅ | DocumentoLinha.taxaIVA, taxExemptionCode (M00-M13) |
| 7 | Documento com 2 linhas: qtd 100, preço 0.55, linha 8.8%; desconto global (SettlementAmount) | ✅ | valorDesconto doc/linha - SettlementAmount no SAF-T |
| 8 | Documento em moeda estrangeira | ✅ | DocumentoFinanceiro.moeda (USD, EUR) |
| 9 | Documento cliente sem NIF, Gross Total < 50 AOA, SystemEntryDate até 10h | ✅ | permitirClienteSemNifAteValor (default 50) |
| 10 | Outro documento cliente sem NIF | ✅ | Idem ponto 9 |
| 11 | Duas guias de remessas | ✅ | criarGuiaRemessa() - tipo GR |
| 12 | Orçamento ou pró-forma | ✅ | Proforma (PF) |
| 13 | Factura genérica e auto-facturação | ❌ | Não aplicável |
| 14 | Factura global | ❌ | Não aplicável |
| 15 | Outros tipos de documento | ✅ | Recibo, FT, RC, NC, PF, GR |

---

## SAF-T XML

- **Um ficheiro XML SAF-T** por aplicação
- Contém **todos** os documentos exemplo
- Campos **HashControl** (4.1.4.4, 4.2.3.4 ou 4.3.4.4) devidamente preenchidos
- **UnitPrice**: sem imposto, com decimais (ex: 4 casas)

---

## Comandos de teste

```bash
cd backend

# Teste completo AGT (seed + documentos + validação SAF-T)
npm run test:agt

# Ou passo a passo:
npm run seed:multi-tenant
npx tsx scripts/seed-documentos-certificacao-agt.ts
SKIP_SAFT_GAP_VALIDATION=1 npx tsx scripts/test-agt-exigencias-completo.ts

# Teste conformidade fluxo mensalidade/pagamento
MOCK_API=1 npm run test:saft:conformidade
```

## O que o DSICOLA precisa implementar

### 1. Texto fiscal no PDF (obrigatório)

- **Onde**: `frontend/src/utils/pdfGenerator.ts` (recibo, fatura)
- **O que**: Adicionar no rodapé de cada PDF:
  ```
  [4 primeiros do hashControl]-Processado por programa válido n31.1/AGT20
  ```
- **Fonte**: `hashControl` do `DocumentoFinanceiro` (FT/RC) — deve ser passado ao gerador de PDF

### 2. Mapeamento documento → resposta AGT

Para cada ponto do pedido, indicar:
- **Documento enviado**: ex. "Ponto 1: Recibo RCB-2026-0001 (PDF anexo)"
- **Não aplicável**: ex. "Ponto 3: Não aplicável"

### 3. Preparar amostra

1. Gerar PDFs com o texto fiscal (após implementar)
2. Emitir em **dois meses diferentes** (ex: Janeiro e Fevereiro 2026)
3. Gerar SAF-T XML com todos os documentos
4. Enviar por email para **produtos.dfe.dcrr.agt@minfin.gov.ao**

---

## Consequências

- **Não envio em 15 dias**: indeferimento automático (art. 6º Decreto 312/18)
- **Suspensão do prazo**: até conclusão dos testes de conformidade (art. 9º n.º 2)

---

## Contactos AGT

- **Email**: produtos.dfe.dcrr.agt@minfin.gov.ao | correspondencia.agt@minfin.gov.ao
- **Website**: www.agt.minfin.gov.ao
