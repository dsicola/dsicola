# Passo a passo: Exigências AGT em Produção Real

Guia completo para configurar o DSICOLA em produção e cumprir todas as exigências da notificação AGT (Ref. 0000481/01180000/AGT/2026) para certificação de software de faturação.

---

## Pré-requisitos

- [ ] Acesso de administrador ao DSICOLA em produção
- [ ] Dados fiscais da instituição (NIF, endereço, certificado AGT quando obtido)
- [ ] Base de dados com dados reais ou de demonstração validados

---

## FASE 1 — Configuração institucional

### Passo 1.1: Configurar dados fiscais

1. Faça login como **Administrador** da instituição
2. Aceda a **Configurações** → **Dados Fiscais** (ou equivalente)
3. Preencha **obrigatoriamente**:

   | Campo | Exemplo | Obrigatório |
   |-------|---------|-------------|
   | NIF | 123456789 (9+ dígitos) | Sim |
   | Nome fiscal | Escola XYZ Lda | Sim |
   | Endereço fiscal | Rua Exemplo, 123, Luanda | Sim |
   | Código postal | 0000 | Sim |
   | Cidade / Província | Luanda | Sim |
   | País | Angola | Sim |
   | Email fiscal | fiscal@escola.ao | Sim |
   | Telefone fiscal | +244 923 456 789 | Sim |
   | Nº certificado AGT | AGT-2026-XXXXX (quando recebido) | Sim (0 até obter) |

4. Guarde as alterações

> ⚠️ **Importante:** NIF `000000000` ou `999999999` é rejeitado pela AGT. Use o NIF real da instituição.

---

### Passo 1.2: Configurar moeda e limite cliente sem NIF

1. Em **Configurações** → **Financeiro** (ou Dados Fiscais)
2. Defina:
   - **Moeda padrão:** AOA
   - **Permitir cliente sem NIF até valor:** 50 (AOA) — conforme exigência AGT ponto 9

---

### Passo 1.3: Garantir que todos os alunos têm BI/NIF

A AGT exige que documentos para clientes com valor ≥ 50 AOA tenham identificação fiscal.

1. Aceda a **Estudantes** / **Alunos**
2. Para cada aluno que emite recibos/faturas:
   - Preencha **Número de identificação** (BI) ou NIF
   - Ex.: `BI98655345` ou NIF no formato correto

> **Exceção AGT:** Documentos com total < 50 AOA podem ter cliente sem NIF (CustomerTaxID 9999999900 no SAF-T).

---

## FASE 2 — Criar os documentos exigidos pela AGT

Emita os documentos em **dois meses diferentes** (ex.: Janeiro e Fevereiro do ano em curso ou anterior).

---

### Passo 2.1: Ponto 1 — Factura para cliente com NIF

1. Crie/use uma **mensalidade** para um aluno com BI preenchido
2. Registar o **pagamento** dessa mensalidade
3. O sistema gera automaticamente **Recibo (RC)** e **DocumentoFinanceiro (FT)**
4. Guarde o PDF do recibo — deve conter o texto fiscal no rodapé

**Verificação:** O recibo tem `[XXXX]-Processado por programa válido n31.1/AGT20` no rodapé?

---

### Passo 2.2: Ponto 2 — Factura anulada + PDF após anulação

1. Escolha uma **factura** ou **recibo** já emitido (com hash e hashControl)
2. Execute o **estorno** desse pagamento/recibo
3. O documento passa a estado **ESTORNADO**
4. Gere o **PDF do recibo** após anulação
5. O PDF deve mostrar o selo **"ANULADO"** (banner vermelho) de forma visível

**Verificação:** O PDF pós-anulação mostra claramente "ANULADO"?

---

### Passo 2.3: Ponto 3 — Pró-forma (documento preliminar)

1. Aceda à funcionalidade de **Pró-forma** / **Orçamento**
2. Crie uma pró-forma para um cliente com NIF
3. Exemplo: 1 linha — "Serviço educacional", valor 100 000 AOA
4. Guarde o número do documento (ex.: PF-2026-0001)

**Se o sistema não tiver UI:** Use a API ou script:
```bash
# Exemplo via script (ajustar IDs)
npx tsx scripts/seed-documentos-teste-agt.ts [instituicaoId]
```

---

### Passo 2.4: Ponto 4 — Factura com base na pró-forma (OrderReferences)

1. Com a pró-forma do ponto 3 criada
2. Emita uma **Factura (FT)** baseada nessa pró-forma
3. No SAF-T, a factura deve conter `<OrderReferences><OriginatingON>PF-2026-0001</OriginatingON></OrderReferences>`

**Verificação:** Exporte o SAF-T e confirme que existe `OrderReferences` referenciando a pró-forma.

---

### Passo 2.5: Ponto 5 — Nota de crédito baseada na factura do ponto 4

1. Com a factura do ponto 4
2. Crie uma **Nota de Crédito (NC)** referenciando essa factura
3. Valor da NC: por exemplo 10 000 AOA (ajuste)
4. No SAF-T deve constar `<References><Reference>FT-2026-XXXX</Reference></References>`

**Verificação:** O SAF-T contém `References` com o número da factura.

---

### Passo 2.6: Ponto 6 — Factura com 2 linhas (IVA + Isento)

Crie uma factura com:
- **Linha 1:** Produto/serviço com IVA 14% ou 5%
- **Linha 2:** Produto/serviço isento com código AGT (M00, M02, M04, M11–M20, M30–M38)

Exemplo de códigos de isenção AGT:
- M00 — Regime Transitório  
- M02 — Transmissão de bens/serviço não sujeita  
- M04 — IVA - Regime de não sujeição  
- M11 — Isento Art. 12º b) do CIVA  

**Verificação:** O SAF-T tem `<TaxExemptionReason>` e `<TaxExemptionCode>` na linha isenta.

---

### Passo 2.7: Ponto 7 — Documento com desconto (SettlementAmount)

Crie um documento com:
- **Linha 1:** Quantidade 100, preço unitário 0,55 AOA, desconto na linha 8,8%
- **Linha 2:** Outra linha qualquer
- **Desconto global** no documento (cabeçalho)

**Verificação:** O SAF-T contém `<SettlementAmount>` nas linhas e/ou no DocumentTotals.

---

### Passo 2.8: Ponto 8 — Documento em moeda estrangeira

1. Crie uma factura ou pró-forma
2. Defina a **moeda** como USD ou EUR (não AOA)
3. Exemplo: valor 100 USD

**Verificação:** O documento tem `moeda` diferente de AOA e o SAF-T reflete isso quando aplicável.

---

### Passo 2.9: Pontos 9 e 10 — Documentos para cliente sem NIF (< 50 AOA)

1. Garanta que **Permitir cliente sem NIF até valor** está em 50 (AOA)
2. Crie um **aluno/cliente** sem NIF (BI vazio)
3. Emita um documento com **valor total < 50 AOA** (ex.: 35 AOA)
4. **Ponto 9 (opcional):** SystemEntryDate até às 10h — registe o documento de manhã cedo se necessário
5. Crie um **segundo documento** para outro cliente sem NIF (ponto 10)

**Verificação:** O SAF-T inclui estes clientes com `CustomerTaxID` 9999999900.

---

### Passo 2.10: Ponto 11 — Duas guias de remessa

1. Crie **duas guias de remessa (GR)** para envio de bens ou descrição de serviços
2. Exemplo: "Material escolar - Lote 1" e "Material escolar - Lote 2"

**Verificação:** Existem 2 documentos tipo GR no período.

---

### Passo 2.11: Ponto 12 — Orçamento ou pró-forma adicional

1. Crie outro **orçamento** ou **pró-forma**
2. Exemplo: "Orçamento ano letivo", 12 meses × 15 000 AOA

---

### Pontos 13 e 14 — Não aplicável

Se o DSICOLA não gera factura genérica nem auto-facturação nem factura global, indique na resposta à AGT:

- **Ponto 13:** "Não aplicável"
- **Ponto 14:** "Não aplicável"

---

## FASE 3 — Verificar PDFs (texto fiscal obrigatório)

Cada PDF (recibo, fatura, pró-forma, etc.) deve ter no rodapé:

```
[4 primeiros caracteres do HashControl]-Processado por programa válido n31.1/AGT20
```

Exemplo: `F3A7-Processado por programa válido n31.1/AGT20`

### Checklist PDFs

- [ ] Recibo (RC) com texto fiscal
- [ ] Fatura (FT) com texto fiscal
- [ ] Documento anulado com selo "ANULADO" visível
- [ ] Pró-forma (se emitir PDF) com texto fiscal
- [ ] Nota de crédito (se emitir PDF) com texto fiscal

---

## FASE 4 — Exportar SAF-T e validar

### Passo 4.1: Exportar SAF-T XML

1. Aceda à funcionalidade de **Exportação SAF-T** / **Ficheiro fiscal**
2. Selecione o **período** que inclui todos os documentos (ex.: Jan–Fev 2026)
3. Gere o ficheiro XML
4. Guarde o ficheiro (ex.: `SAFT-DSICOLA-2026-M01-M02.xml`)

### Passo 4.2: Validações no XML

Confirme que o XML contém:

- [ ] `xmlns="urn:OECD:StandardAuditFile-Tax:AO_1.01_01"`
- [ ] `<TaxRegistrationNumber>` com NIF
- [ ] `<SoftwareCertificateNumber>`
- [ ] `<Hash>` e `<HashControl>` em cada Invoice
- [ ] `<OrderReferences>` na factura baseada em pró-forma
- [ ] `<References>` na nota de crédito
- [ ] `<TaxExemptionReason>` e `<TaxExemptionCode>` nas linhas isentas
- [ ] `<SettlementAmount>` onde há descontos
- [ ] `<CurrencyCode>AOA</CurrencyCode>`
- [ ] Clientes sem NIF com `CustomerTaxID` 9999999900

### Passo 4.3: Teste automático (opcional)

```bash
cd backend
SKIP_SAFT_GAP_VALIDATION=1 npx tsx scripts/test-agt-exigencias-completo.ts
```

---

## FASE 5 — Montar o pacote para envio à AGT

### Documentos a enviar

1. **Carta de apresentação** (formal, com dados da instituição/empresa)
2. **Mapeamento ponto a ponto** — tabela indicando, para cada ponto 1–15:
   - Documento enviado (ex.: "Ponto 1: Recibo RCB-2026-0001, PDF anexo")
   - Ou "Não aplicável" se não produzido
3. **PDFs dos documentos** — um ficheiro por documento, em dois meses diferentes
4. **Ficheiro XML SAF-T** — um único ficheiro com todos os documentos do período

### Exemplo de mapeamento (resposta à AGT)

| Ponto | Documento enviado |
|-------|-------------------|
| 1 | Recibo RCB-2026-0001 (PDF: recibo_001.pdf) |
| 2 | Factura FT-2026-0005 anulada (PDF: ft_anulada.pdf) |
| 3 | Pró-forma PF-2026-0001 (PDF: proforma_001.pdf) |
| 4 | Factura FT-2026-0006 baseada em PF-2026-0001 |
| 5 | Nota de crédito NC-2026-0001 referenciando FT-2026-0006 |
| 6 | Factura FT-2026-0007 (2 linhas: IVA 14% + isento M02) |
| 7 | Factura FT-2026-0008 (100×0,55, 8,8% linha, SettlementAmount) |
| 8 | Factura FT-2026-0009 em USD |
| 9 | Factura FT-2026-0010 (cliente sem NIF, 35 AOA) |
| 10 | Factura FT-2026-0011 (outro cliente sem NIF) |
| 11 | Guias GR-2026-0001 e GR-2026-0002 |
| 12 | Pró-forma PF-2026-0002 (orçamento) |
| 13 | Não aplicável |
| 14 | Não aplicável |
| 15 | Recibo, Fatura, Nota de crédito, Pró-forma, Guia de remessa |

### Envio

- **Para:** produtos.dfe.dcrr.agt@minfin.gov.ao  
- **Assunto:** Validação software DSICOLA — Ref. 0000481/01180000/AGT/2026  
- **Corpo:** Carta de apresentação + tabela de mapeamento  
- **Anexos:** Todos os PDFs + 1 ficheiro XML SAF-T  

---

## FASE 6 — Checklist final antes do envio

- [ ] NIF real configurado (não 000000000 nem 999999999)
- [ ] Email e telefone fiscais preenchidos
- [ ] Documentos emitidos em dois meses diferentes
- [ ] Todos os PDFs com texto fiscal no rodapé
- [ ] Documento anulado com "ANULADO" visível no PDF
- [ ] SAF-T XML contém todos os documentos
- [ ] HashControl preenchido em todos os documentos
- [ ] Mapeamento ponto a ponto completo
- [ ] Carta de apresentação assinada

---

## Referências

- **Decreto Presidencial 312/18** — Regime de submissão eletrónica
- **Decreto Executivo 317/20** — Estrutura SAF-T AO
- ** docs/NOTIFICACAO_AGT_VALIDACAO_SOFTWARE.md** — Requisitos detalhados
- ** docs/CARTA_APRESENTACAO_DSICOLA.md** — Modelo de carta

---

**Prazo:** 15 dias úteis a partir da notificação. O não envio implica indeferimento automático (art. 6º Decreto 312/18).
