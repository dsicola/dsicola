# Guia de Utilização — Módulo de Contabilidade

> **Novo no módulo?** Leia primeiro o [Guia para Todos](CONTABILIDADE_README.md) para entender os conceitos básicos.

Este guia descreve passo a passo como configurar e usar cada parte do módulo de Contabilidade.

---

## Índice

1. [Acesso ao módulo](#acesso-ao-módulo)
2. [Plano de Contas](#1-plano-de-contas)
3. [Configuração](#2-configuração)
4. [Integração Contábil (Regras)](#3-integração-contábil-regras)
5. [Lançamentos](#4-lançamentos)
6. [Relatórios](#5-relatórios)
7. [Fecho de Exercício](#6-fecho-de-exercício)
8. [Exportação](#7-exportação)
9. [Centros de Custo](#8-centros-de-custo)

---

## Acesso ao módulo

1. Aceda ao **Dashboard** como utilizador com perfil **ADMIN**, **FINANCEIRO** ou **SUPER_ADMIN**
2. No menu lateral, clique em **Contabilidade**
3. A página abre na aba **Dashboard**

> **Disponibilidade:** O módulo Contabilidade está disponível para **ambos os tipos de instituição** — Ensino Superior e Ensino Secundário.

---

## 1. Plano de Contas

### 1.1 Criar plano padrão (primeira vez)

1. Vá à aba **Plano de Contas**
2. No campo **Tipo de plano**, escolha:
   - **Auto** — usa o tipo da instituição (Secundário ou Superior)
   - **Secundário** — plano com 12 contas (ensino médio)
   - **Superior** — plano com 22 contas (universidade)
   - **Mínimo** — plano básico (3 contas)
3. Clique em **Criar plano padrão**
4. O sistema cria as contas automaticamente

### 1.2 Adicionar ou editar contas manualmente

1. Clique em **Nova conta** para criar
2. Preencha: **Código**, **Descrição**, **Tipo** (Ativo, Passivo, Patrimônio Líquido, Receita, Despesa)
3. Opcionalmente, selecione uma **Conta pai** para hierarquia
4. Clique em **Criar** ou **Salvar**

---

## 2. Configuração

Define quais contas do plano são usadas para cada tipo de movimento.

1. Vá à aba **Configuração**
2. Para cada campo, selecione a conta no respetivo **dropdown** (busca por código ou descrição):
   - **Caixa** (ex: 11)
   - **Banco** (ex: 12)
   - **Receita Mensalidades** (ex: 41)
   - **Receita Taxas** (ex: 42)
   - **Despesas Pessoal** (ex: 51)
   - **Resultados Transitados** (ex: 32)
3. Guarde as alterações

---

## 3. Integração Contábil (Regras)

Esta aba define **como os eventos do sistema** (pagamentos, estornos, etc.) geram lançamentos contábeis automáticos.

### 3.1 O que são as regras?

Cada evento (ex: «Pagamento de propina») tem uma regra que indica:
- **Conta a débito** — onde entra o dinheiro (ex: Caixa/Banco)
- **Conta a crédito** — onde sai ou é registada a receita (ex: Receita Mensalidades)

### 3.2 Eventos disponíveis

| Evento | Descrição |
|--------|-----------|
| Pagamento de propina/mensalidade | Quando o aluno paga a propina no POS ou Gestão Financeira |
| Estorno de propina | Quando o pagamento é estornado |
| Pagamento de taxa de matrícula | Quando o aluno paga a taxa de matrícula (primeiro pagamento) |
| Estorno de taxa de matrícula | Quando o pagamento com taxa é estornado |
| Pagamento de salários | Quando a folha de pagamento é paga |
| Estorno de folha | Quando o pagamento da folha é estornado |
| Pagamento a fornecedor | Quando pagamento a fornecedor é registado |
| Compra de material | Quando compra de material é registada |

### 3.3 Configurar uma regra

1. Vá à aba **Integração Contábil**
2. Para cada evento, selecione:
   - **Conta a débito** — use o dropdown para selecionar do plano
   - **Conta a crédito** — idem
3. Guarde as alterações

**Nota:** Se não configurar uma regra, o sistema usa os valores padrão da Configuração (Caixa, Banco, Receitas, etc.).

### 3.4 Taxa de matrícula no POS

Quando o aluno paga a **primeira mensalidade** após a matrícula e a turma/curso tem taxa de matrícula configurada:

1. No POS, ao clicar em **Pagar** aparece a opção «Incluir taxa de matrícula»
2. Se marcar, o valor total inclui taxa + propina
3. O sistema cria **dois lançamentos**:
   - Um para a taxa (Receita Taxas)
   - Outro para a propina (Receita Mensalidades)
4. O estorno reverte ambos automaticamente

---

## 4. Lançamentos

### 4.1 Criar um lançamento manual

1. Vá à aba **Lançamentos**
2. Defina o período (De / Até) para filtrar os lançamentos
3. Clique em **Novo lançamento**
4. Preencha:
   - **Data** — data do movimento
   - **Descrição** — ex: "Pagamento mensalidade João"
   - **Linhas** — mínimo 2 linhas, com:
     - Conta (selecione no dropdown)
     - Débito ou Crédito (um dos dois por linha)
5. Verifique: **Total Débito = Total Crédito**
6. Clique em **Criar**

**⚠️ Atenção:** Não é possível criar lançamentos em exercícios já fechados.

### 4.2 Editar ou excluir lançamento

1. Na lista de lançamentos, clique no ícone **Editar** (lápis) ou **Excluir**
2. **Bloqueado:** Lançamentos em períodos fechados não podem ser alterados nem excluídos

### 4.3 Fechar lançamento individual

1. Clique no ícone **Fechar** (cadeado) em lançamentos abertos
2. Um lançamento fechado não pode ser editado nem excluído

### 4.4 Badge Automático / Manual

Cada lançamento mostra um badge:
- **Automático** — gerado pelo sistema (ex: pagamento no POS)
- **Manual** — criado pelo utilizador

### 4.5 Livro Diário

1. Vá à aba **Diário**
2. Defina o período (De / Até) para filtrar
3. Use os atalhos: Este mês, Mês anterior, Trimestre, Ano
4. Visualize todos os lançamentos com data, descrição e linhas
5. Use **Exportar PDF** para imprimir (com cabeçalho, rodapé e numeração de páginas)

---

## 5. Relatórios

### 5.1 Dashboard

1. Vá à aba **Dashboard**
2. Visualize:
   - Saldo Caixa e Bancos
   - Receitas e Despesas do mês
   - Resultado do mês
   - Variação % vs mês anterior
   - Gráfico dos últimos 12 meses

### 5.2 Balancete

1. Vá à aba **Balancete**
2. Defina o período (De / Até)
3. Visualize o relatório com débitos, créditos e saldos por conta
4. Use **Imprimir** para exportar em PDF

### 5.3 Livro Razão

1. Vá à aba **Razão**
2. Selecione a **Conta**
3. Defina o período (De / Até)
4. Visualize os movimentos com saldo inicial, débitos, créditos e saldo corrente
5. Use **Imprimir** para exportar

### 5.4 Balanço Patrimonial

1. Vá à aba **Balanço**
2. Defina os limites do período (De / Até)
3. Visualize Ativo, Passivo e Patrimônio Líquido
4. Use **Imprimir** para exportar

### 5.5 DRE (Demonstração de Resultados)

1. Vá à aba **DRE**
2. Defina o período (De / Até)
3. Visualize Receitas, Despesas e Resultado do Período
4. Use **Imprimir** para exportar

---

## 6. Fecho de Exercício

### 6.1 Quando fechar

Feche o exercício no fim de cada ano civil (ex: 31/12/2025).

### 6.2 Como fechar

1. Vá à aba **Fecho**
2. Selecione o **Ano** a fechar (ex: 2025)
3. Clique em **Fechar exercício**
4. Confirme a ação

**O que acontece:**
- O sistema cria o lançamento de encerramento (Receitas e Despesas → PL)
- O período fica bloqueado até 31/12 desse ano
- Não é possível criar, editar ou excluir lançamentos em datas anteriores

### 6.3 Verificar exercícios fechados

Na aba **Fecho**, a tabela **Exercícios fechados** lista os anos já fechados e a data do fecho.

---

## 7. Exportação

1. Vá à aba **Exportação**
2. Defina o período (De / Até) para os relatórios

### 7.1 Exportar em Excel

- **Plano de Contas** — exporta todas as contas
- **Lançamentos** — exporta lançamentos do período
- **Balancete** — exporta balancete do período
- **Balanço** — exporta por folhas (Ativo, Passivo, PL)
- **DRE** — exporta Receitas e Despesas
- **Razão** — selecione a conta e exporte

### 7.2 Exportar SAFT-AO (XML)

1. Defina o **Ano** e **Mês** (ou ano inteiro)
2. Clique em **Exportar SAFT-AO (XML)**
3. O ficheiro é gerado em conformidade com a legislação angolana

---

## 8. Centros de Custo

1. Vá à aba **Centros de Custo**
2. Crie centros (ex: Administração, Académico, Manutenção)
3. Ao criar lançamentos, pode associar linhas a centros de custo

---

## Fluxo de trabalho recomendado

1. **Início do ano:** Configurar Plano de Contas e Configuração
2. **Configurar:** Integração Contábil (mapear eventos às contas)
3. **Durante o ano:** Registar lançamentos (manuais ou automáticos via pagamentos)
4. **Periodicamente:** Consultar Dashboard, Balancete, Balanço e DRE
5. **Fim do ano:** Fechar o exercício (após 31/12)
6. **Para contabilistas:** Exportar em Excel ou SAFT-AO conforme necessário

---

## Permissões

| Perfil | Acesso |
|--------|--------|
| ADMIN | Contabilidade completo da sua instituição |
| FINANCEIRO | Contabilidade completo da sua instituição |
| SUPER_ADMIN | Contabilidade de qualquer instituição (com seleção de instituição) |

---

## Suporte

- [Guia para Todos](CONTABILIDADE_README.md) — conceitos básicos
- [Roadmap](CONTABILIDADE_ROADMAP.md) — evolução técnica
- [Avaliação Profissional](CONTABILIDADE_AVALIACAO_PROFISSIONAL.md) — análise de contabilista sénior
