# Avaliação Profissional do Módulo Contabilidade DSICOLA

> **Documentação geral:** [Guia para Todos](CONTABILIDADE_README.md) | [Guia de Utilização](CONTABILIDADE_GUIA_UTILIZACAO.md)

**Perspectiva:** Contabilista sénior / ERP avançado  
**Data:** Março 2026

---

## ✅ Pontos Fortes (o que já está bem)

1. **Estrutura base sólida** – Plano de contas, lançamentos, balancete, balanço, DRE, razão, fecho de exercício
2. **Integração contábil** – Motor automático com regras configuráveis (evento → débito/crédito)
3. **Multi-tenant** – Isolamento por instituição
4. **Origem Automático/Manual** – Rastreabilidade de lançamentos
5. **Fecho de exercício** – Bloqueio de períodos fechados
6. **Exportação** – Excel, SAFT, PDF

---

## 🔴 Lacunas Críticas (nível ERP avançado)

### 1. Moeda e Formatação
- **Problema:** Moeda hardcoded "Kz" em todo o módulo
- **Solução:** Usar `moedaPadrao` da instituição (AOA, USD, EUR, etc.) e `Intl.NumberFormat` com `style: 'currency'`
- **Impacto:** Instituições internacionais ou multi-moeda

### 2. Integração Contábil – Seleção de Contas
- **Problema:** Input manual de código (ex: "41") – propenso a erro, sem validação
- **Solução:** Combobox com busca no plano de contas (código + descrição), validação em tempo real
- **Referência:** Primavera, SAP, Odoo

### 3. Configuração – Vinculação ao Plano
- **Problema:** Códigos digitados à mão, sem verificar existência
- **Solução:** Select com contas do plano (filtradas por tipo: ATIVO para Caixa/Banco, RECEITA para receitas, etc.)

### 4. Balancete – Estrutura Profissional
- **Problema:** Lista plana; falta saldo inicial, saldo final e agrupamento por natureza
- **Solução:** 
  - Saldo inicial + movimentos + saldo final
  - Agrupamento: Ativo, Passivo, PL, Receitas, Despesas
  - Subtotais por grupo
  - Export PDF com cabeçalho institucional

### 5. Livro Diário – PDF Profissional
- **Problema:** PDF básico, sem logótipo, numeração de páginas, rodapé
- **Solução:** Cabeçalho com nome da instituição, período, data de emissão; rodapé com "Página X de Y"

### 6. Dashboard – Indicadores Avançados
- **Problema:** Só valores absolutos; falta contexto
- **Solução:**
  - Variação vs mês anterior (%)
  - Liquidez (Caixa+Bancos vs Passivo Corrente) – se aplicável
  - Margem operacional (Resultado/Receitas %)
  - Atalhos de período (Este mês, Mês anterior, Trimestre, Ano)

### 7. Auditoria e Rastreabilidade
- **Problema:** Não há `createdBy`/`updatedBy` em lançamentos
- **Solução:** Campos opcionais `criadoPor`, `alteradoPor` (userId) para auditoria

### 8. Número de Documento / Referência Externa
- **Problema:** Só número interno (2026-001); falta referência a documento externo (recibo, fatura)
- **Solução:** Campo `documentoExterno` ou `referencia` em LancamentoContabil (ex: "REC-12345", "FAT-2026-001")

### 9. Centro de Custo nos Lançamentos
- **Problema:** Centro de custo existe no modelo mas não é usado de forma consistente no formulário
- **Solução:** Campo centro de custo em cada linha do lançamento; relatórios por centro de custo

### 10. Paginação e Performance
- **Problema:** Diário e listagens carregam tudo de uma vez
- **Solução:** Paginação server-side (ex: 50 linhas por página) para períodos longos

---

## 🟡 Melhorias Recomendadas (nível acima de ERP)

1. **Plano de contas** – Máscara de validação (ex: 1.1.01), conta analítica vs sintética
2. **Conciliação bancária** – Módulo para conciliar extrato vs lançamentos
3. **Previsão de fluxo de caixa** – Baseado em receitas/despesas recorrentes
4. **Relatórios gerenciais** – DRE comparativo (ano atual vs anterior), evolução mensal
5. **Assinatura digital** – Relatórios oficiais com assinatura do responsável
6. **Integração fiscal** – GIA, declarações (conforme legislação angolana)

---

## Priorização Sugerida

| Prioridade | Item | Esforço | Impacto | Estado |
|------------|------|---------|---------|--------|
| P0 | Moeda dinâmica | Baixo | Alto | ✅ Implementado |
| P0 | Integração: Select de contas | Médio | Alto | ✅ Implementado |
| P1 | Configuração: Select de contas | Baixo | Médio | ✅ Implementado |
| P1 | Diário PDF profissional | Baixo | Alto | ✅ Implementado |
| P1 | Dashboard: variação % e atalhos | Médio | Médio | ✅ Implementado |
| P2 | Balancete agrupado | Médio | Alto | Pendente |
| P2 | Referência externa em lançamentos | Baixo | Médio | Pendente |
| P3 | Auditoria (createdBy) | Médio | Médio | Pendente |
| P3 | Paginação | Médio | Baixo (performance) | Pendente |

---

## Implementado (Março 2026)

- **useFormatarMoeda** – Hook que usa moeda da instituição (AOA, USD, etc.)
- **ContaSelect** – Combobox com busca para seleção de contas do plano
- **Integração Contábil** – Contas selecionadas via ContaSelect (sem input manual)
- **Configuração** – Contas selecionadas via ContaSelect, filtradas por tipo
- **Diário** – PDF com cabeçalho institucional, rodapé "Página X de Y", atalhos de período
- **Dashboard** – Variação % vs mês anterior, moeda dinâmica
