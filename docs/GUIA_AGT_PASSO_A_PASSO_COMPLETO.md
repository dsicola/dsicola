# Guia Completo — Cumprir as Exigências AGT (Decreto 312/18)

**Ref. AGT:** 0000481/01180000/AGT/2026  
**Destinatário:** produtos.dfe.dcrr.agt@minfin.gov.ao  
**Prazo:** 15 dias úteis após notificação

Este guia explica, passo a passo, como gerar no DSICOLA todos os documentos exigidos pela AGT para validação de software de faturação.

---

## Mapa rápido: Onde fazer cada ponto

| Ponto | Documento | Onde na aplicação | Separador/Ação |
|-------|-----------|-------------------|----------------|
| 1 | Factura com NIF | **Relatórios Financeiros** | Marcar Pago (mensalidade) |
| 2 | Factura anulada | **Relatórios Financeiros** | Estornar (mensalidade paga) |
| 3 | Pró-forma | **Documentos Fiscais** | Tab **Pró-forma** |
| 4 | Fatura baseada em PF | **Documentos Fiscais** | Tab **Fatura de PF** |
| 5 | Nota de crédito | **Documentos Fiscais** | Tab **Nota Crédito** |
| 6 | FT IVA + Isento | **Documentos Fiscais** | Tab Pró-forma → 2 linhas: Linha 1 IVA 14%, Linha 2 Cód. Isenção M02 |
| 7 | Doc. com desconto | **Script** (formulário não suporta) | `npx tsx scripts/seed-documentos-teste-agt.ts` |
| 8 | Moeda estrangeira | **Documentos Fiscais** | Tab Pró-forma ou Guia Remessa → Moeda USD/EUR |
| 9 | Cliente sem NIF (<50) | **Documentos Fiscais** | Tab Pró-forma → Cliente sem BI + valor < 50 |
| 10 | Outro cliente sem NIF | **Documentos Fiscais** | Repetir com outro aluno sem BI |
| 11 | 2 guias remessa | **Documentos Fiscais** | Tab **Guia Remessa** (emitir 2×) |
| 12 | Orçamento/Pró-forma | **Documentos Fiscais** | Tab **Pró-forma** |
| 13 | Factura genérica | Não aplicável | — |
| 14 | Auto-facturação | Não aplicável | — |
| 15 | Factura global | Não aplicável | — |
| — | Exportar SAF-T | **Exportar SAFT** | Escolher período → Gerar XML |

---

## Índice

1. [O que a AGT exige (resumo)](#1-o-que-a-agt-exige)
2. [Pré-requisitos obrigatórios](#2-pré-requisitos-obrigatórios)
3. [Ponto 1 — Factura para cliente com NIF](#3-ponto-1--factura-para-cliente-com-nif)
4. [Ponto 2 — Factura anulada + PDF após anulação](#4-ponto-2--factura-anulada--pdf-após-anulação)
5. [Ponto 3 — Pró-forma (documento preliminar)](#5-ponto-3--pró-forma)
6. [Ponto 4 — Factura com base na pró-forma (OrderReferences)](#6-ponto-4--factura-com-base-na-pró-forma)
7. [Ponto 5 — Nota de crédito baseada na factura](#7-ponto-5--nota-de-crédito)
8. [Ponto 6 — Factura com 2 linhas (IVA + isento)](#8-ponto-6--factura-com-2-linhas-iva--isento)
9. [Ponto 7 — Documento com desconto (100×0,55 + 8,8% + SettlementAmount)](#9-ponto-7--documento-com-desconto)
10. [Ponto 8 — Documento em moeda estrangeira](#10-ponto-8--documento-em-moeda-estrangeira)
11. [Pontos 9 e 10 — Documentos cliente sem NIF (< 50 AOA)](#11-pontos-9-e-10--documentos-cliente-sem-nif)
12. [Ponto 11 — Duas guias de remessa](#12-ponto-11--duas-guias-de-remessa)
13. [Ponto 12 — Orçamento ou pró-forma adicional](#13-ponto-12--orçamento-ou-pró-forma)
14. [Pontos 13 e 14 — Não aplicável](#14-pontos-13-e-14--não-aplicável)
15. [Ponto 15 — Mapeamento de exemplos](#15-ponto-15--mapeamento-de-exemplos)
16. [Exportar SAF-T (ficheiro XML)](#16-exportar-saf-t)
17. [Requisitos dos PDFs](#17-requisitos-dos-pdfs)
18. [Montar o pacote para envio à AGT](#18-montar-o-pacote-para-envio)

---

## 1. O que a AGT exige

A AGT solicitou os seguintes documentos **em formato PDF**, emitidos **em dois meses diferentes**, com:

- Período Contabilístico (Period) preenchido
- 4 caracteres do Hash do documento + hífen + mensagem:  
  `[XXXX]-Processado por programa válido n31.1/AGT20`
- Documentos devidamente assinados

**Lista completa dos pontos:**

| Ponto | Documento exigido |
|-------|-------------------|
| 1 | Factura para cliente com NIF |
| 2 | Factura anulada + PDF após anulação (visível "ANULADO") |
| 3 | Pró-forma (documento preliminar) |
| 4 | Factura com base no documento do ponto 3 (OrderReferences) |
| 5 | Nota de crédito baseada na factura do ponto 4 |
| 6 | Factura com 2 linhas: 1ª IVA 14% ou 5%, 2ª isenta (TaxExemptionReason) |
| 7 | Documento: linha 1 = 100×0,55 com desconto linha 8,8%; linha 2; desconto global (SettlementAmount) |
| 8 | Documento em moeda estrangeira (USD/EUR) |
| 9 | Documento cliente sem NIF, total < 50 AOA (registado até 10h) |
| 10 | Documento para outro cliente sem NIF |
| 11 | Duas guias de remessa |
| 12 | Orçamento ou pró-forma |
| 13 | Factura genérica (se aplicável) |
| 14 | Auto-facturação (se aplicável) |
| 15 | Factura global (se aplicável) |

**Nota:** Pontos 13, 14 e 15 — Se o DSICOLA não gera estes tipos, indique "Não aplicável".

---

## 2. Pré-requisitos obrigatórios

### 2.1. Configurar dados fiscais da instituição

1. Faça login como **Administrador** da instituição
2. Menu lateral → **Configurações**
3. Preencha a secção **Dados Fiscais**:
   - **NIF:** Número real da instituição (ex.: `123456789`) — **não use** `000000000` nem `999999999`
   - **Nome fiscal**
   - **Endereço fiscal completo**
   - **Email** e **telefone** fiscais

### 2.2. Limite cliente sem NIF

1. **Configurações** → **Financeiro** (ou Dados Fiscais)
2. Defina **Permitir cliente sem NIF até valor:** `50` (AOA)

### 2.3. Alunos necessários

Precisa de:

| Tipo | Quantidade | Para que serve |
|------|------------|----------------|
| Aluno com NIF/BI | 2 ou mais | Pontos 1, 2, 3–8, 11, 12 |
| Aluno sem NIF/BI | 2 | Pontos 9 e 10 |

**Como criar aluno sem NIF:**

1. Menu lateral → **Gestão de Alunos** → **Admitir Estudante**
2. Preencha os dados normais, mas **deixe em branco** o campo **Número de identificação** (BI/NIF)
3. Guarde o aluno

### 2.4. Mensalidades para Pontos 1 e 2

Se ainda não existirem mensalidades:

1. Menu lateral → **Relatórios Financeiros** (`/admin-dashboard/gestao-financeira`)
2. Se houver botão **Gerar mensalidades** ou similar, use-o para criar mensalidades para pelo menos 2 alunos com BI

---

## 3. Ponto 1 — Factura para cliente com NIF

**O que a AGT quer:** Uma factura emitida para um cliente que providenciou o seu NIF.

### Passos na aplicação

1. **Aceder à página:**
   - Menu lateral → **Relatórios Financeiros**
   - Ou URL: `/admin-dashboard/gestao-financeira`

2. **Localizar a mensalidade:**
   - Na tabela, procure uma mensalidade com:
     - **Estado:** Pendente
     - **Aluno:** com BI/NIF preenchido (verifique na coluna do aluno)

3. **Registar o pagamento:**
   - Clique no botão **Marcar Pago** (ou ícone de pagamento) da linha
   - No diálogo:
     - **Data de pagamento:** escolha uma data (ex.: 15/01/2026)
     - **Forma de pagamento:** ex. Transferência Bancária
     - **Valor:** confirme o valor da mensalidade
   - Clique em **Confirmar Pagamento**

4. **Obter o PDF:**
   - Após o pagamento, o sistema gera Recibo (RC) e Fatura (FT)
   - Clique em **Imprimir recibo** ou **Ver recibo**
   - Guarde o PDF com nome ex.: `ponto1_recibo_ft_nif.pdf`

**Verificação:** O PDF deve ter no rodapé:  
`[4 chars do Hash]-Processado por programa válido n31.1/AGT20`

**Documento DSICOLA:** Recibo RC-XXXX + Fatura FT-XXXX (emitidos automaticamente)

---

## 4. Ponto 2 — Factura anulada + PDF após anulação

**O que a AGT quer:** Uma factura anulada e o respetivo PDF onde conste, de forma visível, que o documento está anulado.

### Passos na aplicação

1. **Aceder à mesma página:**  
   Menu lateral → **Relatórios Financeiros**

2. **Localizar uma mensalidade paga:**
   - Na tabela, procure uma mensalidade com **Estado:** Pago

3. **Estornar o pagamento:**
   - Clique no botão **Estornar** dessa linha
   - No diálogo, preencha o motivo (ex.: "Anulação para teste AGT")
   - Confirme o estorno

4. **Obter o PDF após anulação:**
   - Após o estorno, o documento fica **ESTORNADO**
   - Clique em **Imprimir recibo** ou **Ver recibo**
   - O PDF deve mostrar claramente o selo ou banner **"ANULADO"** (geralmente em vermelho)
   - Guarde o PDF: `ponto2_fatura_anulada.pdf`

**Verificação:**

- Na base de dados o documento deve estar com estado `ESTORNADO`
- No SAF-T exportado deve constar o documento anulado
- O PDF deve ter o texto fiscal no rodapé e o selo "ANULADO" visível

---

## 5. Ponto 3 — Pró-forma

**O que a AGT quer:** Um documento preliminar (pró-forma) para conferência de transmissão de bens ou prestação de serviços.

### Passos na aplicação

1. **Aceder:**  
   Menu lateral → **Documentos Fiscais**  
   URL: `/admin-dashboard/documentos-fiscais`

2. **Selecionar o separador:**  
   Clique na tab **Pró-forma**

3. **Preencher o formulário:**
   - **Cliente:** escolha um estudante **com NIF/BI**
   - **Moeda:** AOA
   - **Linhas:** adicione pelo menos uma linha:
     - Descrição: `Serviço educacional`
     - Quantidade: `1`
     - Preço unitário: `100000`
     - (O valor total calcula automaticamente)

4. **Emitir:**
   - Clique em **Emitir Pró-forma**
   - Anote o número (ex.: `PF-2026-0001`) — vai precisar para o Ponto 4

5. **Obter o PDF** (se houver botão de impressão na lista):  
   Guarde como `ponto3_proforma.pdf`

---

## 6. Ponto 4 — Factura com base na pró-forma

**O que a AGT quer:** Uma factura gerada a partir da pró-forma do ponto 3, que deve gerar o elemento **OrderReferences** no SAF-T.

### Passos na aplicação

1. **Aceder:**  
   Menu lateral → **Documentos Fiscais**

2. **Selecionar o separador:**  
   Tab **Fatura de PF**

3. **Gerar a fatura:**
   - No dropdown **Pró-forma**, seleccione a PF criada no Ponto 3 (ex.: PF-2026-0001)
   - Clique em **Gerar Fatura**
   - O sistema cria uma Fatura (FT) referenciando a pró-forma

4. **Anote o número da fatura** (ex.: FT-2026-0006) — vai precisar para o Ponto 5

---

## 7. Ponto 5 — Nota de crédito

**O que a AGT quer:** Uma nota de crédito baseada na factura do ponto 4 (ou, se não cumpriu o ponto anterior, baseada noutro documento).

### Passos na aplicação

1. **Aceder:**  
   Menu lateral → **Documentos Fiscais**

2. **Selecionar o separador:**  
   Tab **Nota Crédito**

3. **Preencher:**
   - **Fatura de referência:** seleccione a fatura do Ponto 4
   - **Valor do crédito:** ex. `10000`
   - **Motivo:** ex. `Ajuste de valor`
   - **Moeda:** AOA

4. **Emitir:**
   - Clique em **Emitir Nota de Crédito**
   - Anote o número (ex.: NC-2026-0001)

---

## 8. Ponto 6 — Factura com 2 linhas (IVA + isento)

**O que a AGT quer:** Factura com 2 linhas:
- **Linha 1:** produto/serviço com IVA 14% ou 5%
- **Linha 2:** produto/serviço isento com um dos códigos AGT (M00, M02, M04, M11–M20, M30–M38)

### Via interface (Documentos Fiscais)

1. Menu lateral → **Documentos Fiscais** → Tab **Pró-forma**
2. **Cliente:** estudante com NIF
3. **Linha 1:** Descrição «Material com IVA», Qtd 1, Preço 10000, **IVA %** = **14** (ou 5), Cód. Isenção = —
4. Clique em **Adicionar linha**
5. **Linha 2:** Descrição «Propina isenta», Qtd 1, Preço 50000, **IVA %** = **0**, **Cód. Isenção** = **M02** (ou M04, M11, etc.)
6. Clique em **Emitir Pró-forma**
7. Para obter Fatura (FT) em vez de Pró-forma: Tab **Fatura de PF** → seleccione a PF criada → **Gerar Fatura**

**Nota:** Os campos **IVA %** e **Cód. Isenção** estão em cada linha. Use IVA 14% ou 5% na linha tributada; use IVA 0% + código de isenção (M00, M02, M04, etc.) na linha isenta.

### Alternativa via script

```bash
cd backend
npx tsx scripts/seed-documentos-teste-agt.ts
```

---

## 9. Ponto 7 — Documento com desconto

**O que a AGT quer:**
- **Linha 1:** quantidade 100, preço unitário 0,55, desconto na linha de 8,8%
- **Linha 2:** outra linha
- **Desconto global** no documento (elemento SettlementAmount no SAF-T)

O formulário actual **não tem** desconto global no cabeçalho nem todos os campos por linha. Use o **script**.

### Via script

```bash
cd backend
npx tsx scripts/seed-documentos-teste-agt.ts
```

O script gera um documento FT com:
- Linha 1: 100 × 0,55, desconto 8,8% na linha
- Linha 2: outra linha
- Desconto global (valorDesconto) no cabeçalho

---

## 10. Ponto 8 — Documento em moeda estrangeira

**O que a AGT quer:** Um documento emitido em USD ou EUR.

### Passos na aplicação

1. **Aceder:**  
   Menu lateral → **Documentos Fiscais** → Tab **Pró-forma**

2. **Preencher:**
   - **Cliente:** estudante com NIF
   - **Moeda:** seleccione **USD** ou **EUR**
   - **Linha:** ex. Descrição `Taxa em moeda estrangeira`, Qtd `1`, Preço `100`

3. **Emitir:**  
   Clique em **Emitir Pró-forma**

**Alternativa:** Tab **Guia Remessa**, mesma lógica (Cliente + Moeda USD/EUR + Linha).

---

## 11. Pontos 9 e 10 — Documentos cliente sem NIF

**O que a AGT quer:**
- **Ponto 9:** Documento para cliente identificado sem NIF, com **total < 50 AOA**, registado até às 10h (SystemEntryDate)
- **Ponto 10:** Documento para **outro** cliente sem NIF

### Pré-requisito

Em **Configurações** → **Financeiro**: **Permitir cliente sem NIF até valor** = `50` AOA.

### Passos na aplicação

**Ponto 9:**

1. Menu lateral → **Documentos Fiscais** → Tab **Pró-forma**
2. **Cliente:** escolha um aluno **sem NIF/BI** (sem número de identificação)
3. **Moeda:** AOA
4. **Linha:** valor total < 50 AOA  
   - Ex.: Descrição `Taxa mínima`, Qtd `1`, Preço unitário `35` (total 35 AOA)
5. Clique em **Emitir Pró-forma**
6. **Opcional (AGT):** Se a AGT exigir SystemEntryDate até 10h, emita este documento de manhã cedo.

**Ponto 10:**

1. Repita os passos para **outro** aluno sem NIF
2. Ex.: Descrição `Serviço consumidor final`, Qtd `1`, Preço `40`

---

## 12. Ponto 11 — Duas guias de remessa

**O que a AGT quer:** Duas guias de remessa.

### Passos na aplicação

**Guia 1:**

1. Menu lateral → **Documentos Fiscais** → Tab **Guia Remessa**
2. **Cliente:** estudante com NIF
3. **Moeda:** AOA
4. **Linha:** ex. Descrição `Material escolar - Lote 1`, Qtd `1`, Preço `5000`
5. Clique em **Emitir Guia de Remessa**
6. Anote o número (ex.: GR-2026-0001)

**Guia 2:**

1. Na mesma tab, adicione nova emissão
2. **Linha:** ex. Descrição `Material escolar - Lote 2`, Qtd `1`, Preço `3000`
3. Clique em **Emitir Guia de Remessa**
4. Anote o número (ex.: GR-2026-0002)

---

## 13. Ponto 12 — Orçamento ou pró-forma

**O que a AGT quer:** Um orçamento ou factura pró-forma adicional.

### Passos na aplicação

1. Menu lateral → **Documentos Fiscais** → Tab **Pró-forma**
2. **Cliente:** estudante com NIF
3. **Moeda:** AOA
4. **Linhas:** ex.  
   - Descrição `Orçamento ano letivo`, Qtd `12`, Preço `15000` (total 180 000)
5. Clique em **Emitir Pró-forma**
6. Anote o número (ex.: PF-2026-0002)

---

## 14. Pontos 13, 14 e 15 — Especiais

**Ponto 13:** Factura genérica (se aplicável) e auto-facturação  
**Ponto 14:** Factura global  
**Ponto 15:** Um exemplo de **outro tipo de documento** emitido pela aplicação e ainda não fornecido nos pontos anteriores  

O DSICOLA **não gera** factura genérica, auto-facturação nem factura global. Na resposta à AGT:

- **Ponto 13:** "Não aplicável"
- **Ponto 14:** "Não aplicável"
- **Ponto 15:** Use o **Recibo (RC)** — é um tipo diferente de documento emitido pelo sistema (ex.: RC-2026-0001 do Ponto 1). Se já tiver fornecido RC no Ponto 1, indique: "Recibo RC-XXXX — tipo de documento distinto de FT, PF, GR, NC"

---

## 15. Ponto 15 — Mapeamento de exemplos

A AGT exige que, para cada ponto, indique o documento de exemplo enviado. Use uma tabela como a seguinte:

| Ponto | Documento DSICOLA | Ficheiro PDF |
|-------|-------------------|--------------|
| 1 | Recibo RCB-2026-0001 / Fatura FT-2026-0001 | ponto1_recibo.pdf |
| 2 | Fatura FT-2026-0002 anulada | ponto2_anulada.pdf |
| 3 | Pró-forma PF-2026-0001 | ponto3_proforma.pdf |
| 4 | Fatura FT-2026-0006 (baseada em PF-2026-0001) | ponto4_ft_pf.pdf |
| 5 | Nota de crédito NC-2026-0001 | ponto5_nc.pdf |
| 6 | Fatura FT-2026-0007 (2 linhas: IVA + isento) | ponto6_iva_isento.pdf |
| 7 | Fatura FT-2026-0008 (100×0,55 + SettlementAmount) | ponto7_desconto.pdf |
| 8 | Pró-forma PF-2026-0003 (USD) | ponto8_moeda_estrangeira.pdf |
| 9 | Pró-forma PF-2026-0004 (cliente sem NIF, 35 AOA) | ponto9_sem_nif_1.pdf |
| 10 | Pró-forma PF-2026-0005 (outro cliente sem NIF) | ponto10_sem_nif_2.pdf |
| 11 | Guias GR-2026-0001 e GR-2026-0002 | ponto11_gr1.pdf, ponto11_gr2.pdf |
| 12 | Pró-forma PF-2026-0002 (orçamento) | ponto12_orcamento.pdf |
| 13 | Não aplicável | — |
| 14 | Não aplicável | — |
| 15 | Não aplicável | — |

---

## 16. Exportar SAF-T

**O que a AGT quer:** Um único ficheiro XML SAF-T, conforme Decreto 312/18, integrando todos os documentos exemplo, com HashControl preenchido.

### Passos na aplicação

1. **Aceder:**  
   Menu lateral → **Exportar SAFT**  
   URL: `/admin-dashboard/exportar-saft` (ou `/super-admin/exportar-saft` se for SUPER_ADMIN)

2. **Seleccionar instituição** (se SUPER_ADMIN)

3. **Período:**
   - **Ano:** ex. 2026
   - **Mês:** escolha um mês que inclua os documentos, ou "Ano inteiro" para incluir todos

4. **Gerar:**
   - Clique em **Gerar** / **Exportar**
   - Guarde o ficheiro XML (ex.: `SAFT-DSICOLA-2026.xml`)

**Importante:** Os documentos devem estar emitidos em **dois meses diferentes**. Ex.: parte em Janeiro e parte em Fevereiro. Depois exporte o SAF-T para um período que cubra os dois meses.

---

## 17. Requisitos dos PDFs

Todos os PDFs enviados devem:

1. **Rodapé obrigatório:**  
   `[4 primeiros caracteres do HashControl]-Processado por programa válido n31.1/AGT20`  
   Exemplo: `F3A7-Processado por programa válido n31.1/AGT20`

2. **Campos 4.1.4.5 / 4.2.3.5 / 4.3.4.5** (consoante o tipo) — Período Contabilístico (Period) preenchido

3. **Assinatura** quando aplicável

4. **Documento anulado (Ponto 2):** selo "ANULADO" bem visível no PDF

---

## 18. Montar o pacote para envio

### O que enviar

1. **Carta de apresentação** (formal, com dados da instituição/empresa)
2. **Tabela de mapeamento** (Ponto 15) — indicando, para cada ponto 1–15, o documento enviado ou "Não aplicável"
3. **PDFs** — um ficheiro por documento, em dois meses diferentes
4. **1 ficheiro XML SAF-T** — contendo todos os documentos do período

### Destinatário

- **Email:** produtos.dfe.dcrr.agt@minfin.gov.ao  
- **Assunto:** Validação software DSICOLA — Ref. 0000481/01180000/AGT/2026

### Checklist final antes do envio

- [ ] NIF real (não 000000000 nem 999999999)
- [ ] Email e telefone fiscais preenchidos
- [ ] Documentos em dois meses diferentes
- [ ] Todos os PDFs com texto fiscal no rodapé
- [ ] PDF da factura anulada com "ANULADO" visível
- [ ] SAF-T XML contém todos os documentos
- [ ] HashControl preenchido em todos os documentos
- [ ] Tabela de mapeamento completa
- [ ] Carta de apresentação assinada

---

## Ordem sugerida de execução

1. Configurar dados fiscais e limite cliente sem NIF
2. Garantir alunos: 2+ com BI, 2 sem BI
3. Gerar mensalidades (se necessário)
4. **Ponto 1:** Pagar mensalidade (factura com NIF)
5. **Ponto 2:** Estornar outra mensalidade (factura anulada)
6. **Pontos 3 → 4 → 5:** Pró-forma → Fatura de PF → Nota de crédito
7. **Pontos 8, 9, 10, 11, 12:** Na interface (Documentos Fiscais)
8. **Pontos 6 e 7:** Executar `npx tsx scripts/seed-documentos-teste-agt.ts`
9. **Exportar SAF-T**
10. Montar PDFs e tabela de mapeamento
11. Enviar à AGT dentro do prazo

---

## Referências

- **Decreto Presidencial 312/18** — Regime de submissão eletrónica (Angola)
- **Ofício AGT** — Ref. 0000481/01180000/AGT/2026
- `docs/PASSO_A_PASSO_AGT_NA_REAL.md` — Guia resumido
- `docs/PASSO_A_PASSO_PRODUCAO_AGT.md` — Guia de produção
