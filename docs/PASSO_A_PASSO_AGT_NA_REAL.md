# Passo a passo AGT — Onde clicar na aplicação real

Guia prático para gerar todos os documentos exigidos pela AGT usando o DSICOLA em produção ou ambiente de teste.

---

## Pré-requisitos rápidos

1. **Login:** Como ADMIN, SECRETARIA ou FINANCEIRO da instituição  
2. **Configuração fiscal:** NIF e dados fiscais preenchidos em **Configurações**  
3. **Alunos:** Pelo menos 2 alunos com BI/NIF e 1 aluno **sem** NIF (para pontos 9–10)  
4. **Permitir cliente sem NIF:** Em Configurações → Financeiro: valor até **50** AOA  

---

## Resumo por documento

| # | Documento | Onde | Página | Tab/Ação |
|---|-----------|------|--------|----------|
| 1 | Factura com NIF | Relatórios Financeiros | Gestão Financeira | Pagar mensalidade |
| 2 | Factura anulada | Relatórios Financeiros | Gestão Financeira | Estornar |
| 3 | Pró-forma | Documentos Fiscais | /documentos-fiscais | Tab **Pró-forma** |
| 4 | Fatura baseada em PF | Documentos Fiscais | /documentos-fiscais | Tab **Fatura de PF** |
| 5 | Nota de crédito | Documentos Fiscais | /documentos-fiscais | Tab **Nota Crédito** |
| 6 | FT IVA + Isento | Script (ou Documentos Fiscais*) | — | Ver nota abaixo |
| 7 | Doc. com desconto | Documentos Fiscais* | /documentos-fiscais | Tab Pró-forma (linhas) |
| 8 | Moeda estrangeira | Documentos Fiscais | /documentos-fiscais | Moeda **USD** ou **EUR** |
| 9–10 | Cliente sem NIF | Documentos Fiscais | /documentos-fiscais | Aluno sem BI, valor < 50 |
| 11 | 2 guias remessa | Documentos Fiscais | /documentos-fiscais | Tab **Guia Remessa** (2×) |
| 12 | Orçamento/PF | Documentos Fiscais | /documentos-fiscais | Tab **Pró-forma** |
| — | Exportar SAF-T | Exportar SAFT | /exportar-saft | Gerar XML |

\* Pontos 6 e 7: o formulário actual não tem IVA/código isenção nem desconto global no cabeçalho. Use o script `npm run test:agt` para gerar esses dois documentos exactos, ou aguarde implementação desses campos no formulário.

---

## 1. Factura com NIF (Ponto 1)

**Onde clicar:**

1. Menu lateral → **Relatórios Financeiros**  
   - *(Ou URL: `/admin-dashboard/gestao-financeira`)*
2. Na tabela de mensalidades, localize uma mensalidade **Pendente** de um aluno **com BI**
3. Clique em **Marcar Pago**
4. Escolha data e forma de pagamento → **Confirmar Pagamento**
5. O sistema emite recibo (RC) e fatura (FT) com NIF
6. Use **Imprimir/Ver recibo** para obter o PDF com texto fiscal

---

## 2. Factura anulada (Ponto 2)

**Onde clicar:**

1. Menu lateral → **Relatórios Financeiros**
2. Localize uma mensalidade **Paga**
3. Clique em **Estornar**
4. Confirme o estorno
5. O documento fica **ESTORNADO** e o PDF passa a mostrar o selo **ANULADO**
6. Imprima/baixe o PDF do recibo após anulação para anexar à AGT

---

## 3. Pró-forma (Ponto 3)

**Onde clicar:**

1. Menu lateral → **Documentos Fiscais**  
   - *(URL: `/admin-dashboard/documentos-fiscais`)*
2. Clique na tab **Pró-forma**
3. **Cliente:** escolha um estudante (com NIF)
4. **Moeda:** AOA
5. **Linhas:** adicione pelo menos uma linha:
   - Ex.: Descrição «Serviço educacional»
   - Qtd: 1
   - Preço unit.: 100000
6. Clique em **Emitir Pró-forma**
7. Anote o número (ex.: PF-2026-0001)

---

## 4. Fatura baseada na Pró-forma (Ponto 4)

**Onde clicar:**

1. Menu lateral → **Documentos Fiscais**
2. Clique na tab **Fatura de PF**
3. No dropdown **Pró-forma**, seleccione a PF emitida no passo 3
4. Clique em **Gerar Fatura**
5. O sistema cria FT com OrderReferences para a pró-forma

---

## 5. Nota de Crédito (Ponto 5)

**Onde clicar:**

1. Menu lateral → **Documentos Fiscais**
2. Clique na tab **Nota Crédito**
3. **Fatura de referência:** seleccione a fatura do ponto 4
4. **Valor do crédito:** ex. 10000
5. **Motivo:** ex. «Ajuste de valor»
6. Clique em **Emitir Nota de Crédito**

---

## 6. Factura IVA + Isento (Ponto 6) — via script

O formulário actual não permite escolher **Taxa IVA** nem **Código de isenção** por linha.  
Use o script para gerar automaticamente:

```bash
cd backend
npm run test:agt
```

O script cria uma FT com:
- Linha 1: IVA 14%
- Linha 2: Isento (código M02)

---

## 7. Documento com desconto (Ponto 7) — via formulário ou script

**Via formulário (parcial):**

1. **Documentos Fiscais** → tab **Pró-forma**
2. Adicione **2 linhas**:
   - Linha 1: Desc. «Produto 100×0.55», Qtd **100**, Preço **0.55**, Desconto **4.84** (8.8% de 55)
   - Linha 2: Desc. «Serviço», Qtd 1, Preço 10
3. Emita a pró-forma

*Nota:* O desconto global (SettlementAmount) no cabeçalho do documento não está disponível no formulário. Para conformidade exacta com o ponto 7 da AGT, use `npm run test:agt`.

---

## 8. Moeda estrangeira (Ponto 8)

**Onde clicar:**

1. Menu lateral → **Documentos Fiscais**
2. Tab **Pró-forma** ou **Guia Remessa**
3. **Cliente:** escolha um estudante
4. **Moeda:** seleccione **USD** ou **EUR**
5. Adicione uma linha (ex.: «Taxa em USD», 1 × 100)
6. Clique em **Emitir Pró-forma** ou **Emitir Guia de Remessa**

---

## 9–10. Cliente sem NIF (Pontos 9 e 10)

**Pré-requisito:** Aluno(s) **sem** BI/NIF e **Permitir cliente sem NIF até valor** = 50 AOA.

**Onde clicar:**

1. **Documentos Fiscais** → tab **Pró-forma** ou **Guia Remessa**
2. **Cliente:** escolha um aluno **sem** BI
3. **Moeda:** AOA
4. Linha com **valor total < 50** AOA (ex.: 1 × 35)
5. Clique em **Emitir Pró-forma** (ou GR)
6. Repita para outro aluno sem NIF (ponto 10)

---

## 11. Duas guias de remessa (Ponto 11)

**Onde clicar:**

1. Menu lateral → **Documentos Fiscais**
2. Tab **Guia Remessa**
3. **Cliente:** escolha um estudante
4. **Linha 1:** ex. «Material escolar - Lote 1», 1 × 5000
5. Clique em **Emitir Guia de Remessa**
6. Repita para **Guia 2:** «Material escolar - Lote 2», 1 × 3000

---

## 12. Orçamento/Pró-forma adicional (Ponto 12)

**Onde clicar:**

1. Menu lateral → **Documentos Fiscais**
2. Tab **Pró-forma**
3. Emita outra pró-forma (ex.: «Orçamento ano letivo», 12 × 15000)
4. Clique em **Emitir Pró-forma**

---

## Exportar SAF-T (final)

**Onde clicar:**

1. Menu lateral → **Exportar SAFT**  
   - *(URL: `/admin-dashboard/exportar-saft`)*
2. Defina **Ano** e **Mês** (ou período) que inclua todos os documentos
3. Clique em **Gerar** / **Exportar**
4. Baixe o ficheiro XML e guarde-o para enviar à AGT

---

## Ordem sugerida

1. Configurar dados fiscais (NIF, limite cliente sem NIF)  
2. Garantir alunos: 2+ com BI, 1–2 sem BI  
3. Gerar mensalidades (se ainda não existirem)  
4. **Ponto 1:** Pagar mensalidade (FT com NIF)  
5. **Ponto 2:** Estornar outra mensalidade (FT anulada)  
6. **Pontos 3, 4, 5:** Documentos Fiscais → Pró-forma → Fatura de PF → Nota Crédito  
7. **Pontos 8, 9, 10, 11, 12:** Documentos Fiscais (Pró-forma e Guia Remessa)  
8. **Pontos 6 e 7:** Executar `npm run test:agt` (script)  
9. Exportar SAF-T  

---

## Resumo de rotas

| Função | URL |
|--------|-----|
| Pagar / Estornar | `/admin-dashboard/gestao-financeira` |
| PF, GR, NC, FT de PF | `/admin-dashboard/documentos-fiscais` |
| Exportar SAF-T | `/admin-dashboard/exportar-saft` |

---

## Script para documentos 6 e 7

Se não quiser usar o formulário para os pontos 6 e 7, rode:

```bash
cd backend
npm run test:agt
```

O script gera o conjunto completo de documentos AGT na base de dados actual. Depois exporte o SAF-T pela interface.
