# Módulo de Contabilidade — Passo a Passo Completo

**Guia didático para utilizadores do DSICOLA**  
Este documento ensina a utilizar o módulo de Contabilidade do início ao fim, como se estivesse numa formação.

---

## Índice

1. [Introdução e acesso](#1-introdução-e-acesso)
2. [Configuração inicial (primeira vez)](#2-configuração-inicial-primeira-vez)
3. [Plano de Contas](#3-plano-de-contas)
4. [Configuração de contas](#4-configuração-de-contas)
5. [Integração Contábil (Regras automáticas)](#5-integração-contábil-regras-automáticas)
6. [Centros de Custo](#6-centros-de-custo)
7. [Lançamentos contábeis](#7-lançamentos-contábeis)
8. [Conciliação Bancária](#8-conciliação-bancária)
9. [Relatórios](#9-relatórios)
10. [Fecho de exercício](#10-fecho-de-exercício)
11. [Exportação](#11-exportação)
12. [Fluxo de trabalho recomendado](#12-fluxo-de-trabalho-recomendado)

---

## 1. Introdução e acesso

### 1.1 O que é o módulo de Contabilidade?

O módulo regista **todos os movimentos financeiros** da instituição: receitas (propinas, taxas), despesas (salários, fornecedores) e saldos em caixa e banco. Permite relatórios profissionais (Balancete, Balanço, DRE) e exportação para contabilistas.

### 1.2 Quem pode aceder?

| Perfil        | Acesso                                                                 |
|---------------|------------------------------------------------------------------------|
| **ADMIN**     | Contabilidade completa da sua instituição                             |
| **FINANCEIRO**| Contabilidade completa da sua instituição                             |
| **SUPER_ADMIN** | Contabilidade de qualquer instituição (deve selecionar a instituição) |

### 1.3 Como aceder?

1. Faça login no DSICOLA com um dos perfis acima.
2. No menu lateral (sidebar), clique em **Contabilidade**.
3. A página abre na aba **Dashboard**.

### 1.4 Estrutura das abas

O módulo está organizado em abas no topo da página:

| Aba                  | Função principal                                      |
|----------------------|-------------------------------------------------------|
| Dashboard            | Visão geral: saldos, receitas/despesas do mês        |
| Plano de Contas      | Lista de contas contábeis                             |
| Configuração         | Ligação de contas a eventos (Caixa, Banco, etc.)     |
| Integração Contábil  | Regras que criam lançamentos automáticos              |
| Centros de Custo     | Divisão por departamentos ou projetos                 |
| Lançamentos         | Criar, editar e consultar lançamentos                 |
| Conciliação Bancária | Importar extratos e conciliar com lançamentos         |
| Diário               | Livro diário (todos os movimentos)                    |
| Balancete            | Saldos por conta                                      |
| Razão                | Movimentos de uma conta específica                    |
| Balanço              | Ativo, Passivo e Patrimônio Líquido                   |
| DRE                  | Receitas, Despesas e Resultado                        |
| Fecho                | Fechar exercício anual                                |
| Exportação           | Excel, SAFT-AO (XML) para contabilistas               |

---

## 2. Configuração inicial (primeira vez)

**Objetivo:** Ter o plano de contas e a configuração prontos para começar a registar movimentos.

### Passo 2.1 — Criar o plano de contas padrão

1. Clique na aba **Plano de Contas**.
2. Se a lista estiver vazia, clique em **Criar plano padrão**.
3. Escolha o tipo:
   - **Auto** — usa o tipo da instituição (Secundário ou Superior).
   - **Secundário** — 12 contas (ensino médio).
   - **Superior** — 18 contas (universidade).
   - **Mínimo** — 3 contas (apenas integração básica).
4. Clique em **Criar plano padrão**.
5. O sistema cria as contas automaticamente.

**Resultado:** A lista passa a mostrar as contas (ex.: 11 Caixa, 12 Bancos, 41 Receita Mensalidades).

### Passo 2.2 — Configurar as contas principais

1. Clique na aba **Configuração**.
2. Para cada campo, selecione a conta correta no dropdown:
   - **Caixa** (ex.: 11)
   - **Banco** (ex.: 12)
   - **Receita Mensalidades** (ex.: 41)
   - **Receita Taxas** (ex.: 42)
   - **Despesas Pessoal** (ex.: 51)
   - **Fornecedores** (ex.: 21)
3. Clique em **Guardar**.

**Resultado:** O sistema sabe que conta usar para cada tipo de movimento.

---

## 3. Plano de Contas

### 3.1 O que são as contas?

Cada conta é um **contentor** para movimentos do mesmo tipo. Exemplos:

- **11 Caixa** — dinheiro em numerário
- **12 Bancos** — dinheiro em conta bancária
- **41 Receita Mensalidades** — propinas recebidas
- **51 Despesas Pessoal** — salários pagos

### 3.2 Adicionar uma nova conta

1. Na aba **Plano de Contas**, clique em **Nova conta**.
2. Preencha:
   - **Código** — ex.: 11.01
   - **Descrição** — ex.: Caixa Tesouraria
   - **Tipo** — Ativo, Passivo, Patrimônio Líquido, Receita ou Despesa
   - **Conta pai** (opcional) — para criar subcontas
3. Clique em **Criar**.

### 3.3 Editar ou desativar uma conta

1. Na lista, clique no ícone **Editar** (lápis) na conta.
2. Altere os campos e clique em **Salvar**.
3. Para desativar, marque **Inativo** e guarde.

**Nota:** Não é possível excluir contas que já têm lançamentos. Desative em vez de excluir.

---

## 4. Configuração de contas

### 4.1 Para que serve?

A Configuração indica **qual conta** do plano é usada para cada tipo de movimento:

- **Caixa** — quando o pagamento é em numerário
- **Banco** — quando o pagamento é por transferência ou cheque
- **Receita Mensalidades** — propinas
- **Receita Taxas** — taxas de matrícula
- **Despesas Pessoal** — salários
- **Fornecedores** — dívidas a fornecedores

### 4.2 Como alterar

1. Vá à aba **Configuração**.
2. Em cada campo, clique no dropdown e selecione a conta (ex.: 11 - Caixa).
3. Clique em **Guardar**.

---

## 5. Integração Contábil (Regras automáticas)

### 5.1 O que são as regras?

As regras definem **como os eventos do sistema** (pagamentos, estornos) geram lançamentos contábeis automaticamente.

**Exemplo:** Quando um aluno paga a propina no POS ou na Gestão Financeira, o sistema cria um lançamento com:
- **Débito** — Caixa ou Banco (conforme o método de pagamento)
- **Crédito** — Receita Mensalidades

### 5.2 Eventos disponíveis

| Evento                     | Quando ocorre                                      |
|----------------------------|----------------------------------------------------|
| Pagamento de propina       | Aluno paga propina no POS ou Gestão Financeira     |
| Estorno de propina         | Pagamento de propina é estornado                   |
| Pagamento de taxa matrícula| Aluno paga taxa de matrícula (primeiro pagamento)  |
| Estorno de taxa matrícula  | Pagamento com taxa é estornado                     |
| Pagamento de salários      | Folha de pagamento é paga no módulo RH             |
| Estorno de folha           | Pagamento da folha é estornado                     |
| Pagamento a fornecedor     | Pagamento a fornecedor é registado                  |
| Compra de material         | Compra de material é registada                      |

### 5.3 Configurar uma regra

1. Vá à aba **Integração Contábil**.
2. Para cada evento, selecione:
   - **Conta a débito** — use o dropdown para escolher do plano
   - **Conta a crédito** — idem
3. Clique em **Guardar** para cada regra alterada.

**Nota:** Se não configurar, o sistema usa os valores padrão da Configuração.

---

## 6. Centros de Custo

### 6.1 O que são?

Centros de custo permitem **dividir as despesas** por departamento ou projeto (ex.: Administração, Académico, Manutenção).

### 6.2 Criar um centro de custo

1. Vá à aba **Centros de Custo**.
2. Clique em **Novo centro de custo**.
3. Preencha **Código** (ex.: ADM) e **Descrição** (ex.: Administração).
4. Clique em **Criar**.

### 6.3 Usar em lançamentos

Ao criar um lançamento manual, pode associar cada linha a um centro de custo (se o formulário tiver esse campo). Os relatórios podem depois filtrar por centro de custo.

---

## 7. Lançamentos contábeis

### 7.1 Tipos de lançamento

| Tipo        | Origem                                      |
|-------------|---------------------------------------------|
| **Automático** | Gerado pelo sistema (pagamentos, folha, etc.) |
| **Manual**     | Criado pelo utilizador                      |

### 7.2 Criar um lançamento manual

1. Vá à aba **Lançamentos**.
2. Defina o período (De / Até) para filtrar a lista.
3. Clique em **Novo lançamento**.
4. Preencha:
   - **Data** — data do movimento
   - **Descrição** — ex.: "Pagamento mensalidade João Silva"
   - **Referência externa** (opcional) — ex.: FAT-2026-001, REC-123
   - **Tipo de referência** (opcional) — ex.: fatura, recibo, pagamento
5. Nas **Linhas**, adicione pelo menos 2 linhas:
   - **Conta** — selecione no dropdown
   - **Débito** ou **Crédito** — preencha um dos dois (não ambos)
6. Verifique: **Total Débito = Total Crédito**.
7. Clique em **Criar**.

**Exemplo:** Ajuste de caixa de 1.000 Kz

| Conta        | Débito | Crédito |
|--------------|--------|---------|
| 11 Caixa     | 1.000  | —       |
| 31 Capital   | —      | 1.000   |

### 7.3 Editar ou excluir lançamento

1. Na lista, clique no ícone **Editar** (lápis) ou **Excluir** (lixo).
2. **Restrições:**
   - Lançamentos **fechados** não podem ser alterados.
   - Lançamentos em **períodos fechados** (exercício fechado) não podem ser alterados.

### 7.4 Fechar um lançamento

1. Clique no ícone **Fechar** (cadeado) num lançamento aberto.
2. Um lançamento fechado não pode ser editado nem excluído.

### 7.5 Importar lançamentos (CSV)

1. Clique em **Importar CSV**.
2. Use o formato: `data;contaCodigo;descricao;debito;credito`
3. Linhas com mesma data e descrição formam um lançamento.
4. Clique em **Descarregar modelo** para obter um exemplo.
5. Cole o conteúdo e clique em **Importar**.

### 7.6 Referência externa e auditoria

- **Referência externa:** Permite ligar o lançamento a um documento (ex.: fatura, recibo). Útil para rastreabilidade e auditoria.
- **Auditoria:** A coluna "Auditoria" mostra quem criou o lançamento. O tooltip indica quem criou e quem alterou.

---

## 8. Conciliação Bancária

### 8.1 O que é?

A conciliação bancária permite **comparar o extrato da conta bancária** com os lançamentos contábeis, garantindo que os saldos estão corretos.

### 8.2 Configurar uma conta bancária

1. Vá à aba **Conciliação Bancária**.
2. Se não houver contas, clique em **Nova conta bancária**.
3. Preencha:
   - **Nome** — ex.: Banco BFA - Conta Principal
   - **IBAN ou Número da conta** (opcional)
   - **Banco** — ex.: BFA, BAI
   - **Conta contábil** — selecione a conta do plano (ex.: 12 Bancos)
4. Clique em **Criar**.

### 8.3 Importar extrato bancário

1. Selecione a conta bancária no dropdown.
2. Defina o período (De / Até).
3. Clique em **Importar extrato**.
4. Use o formato: `data;valor;descricao;referencia` (um movimento por linha)
   - **Valor:** positivo = entrada, negativo = saída
5. Cole o conteúdo e clique em **Importar**.

**Exemplo:**
```
2026-03-15;15000;Transferência recebida;TRF-123
2026-03-16;-5000;Pagamento fornecedor;CHQ-001
```

### 8.4 Conciliar um movimento

1. Na tabela de movimentos, localize um movimento **não conciliado**.
2. Clique no ícone **Conciliar** (link).
3. Selecione o **lançamento contábil** correspondente.
4. Clique em **Conciliar**.

**Nota:** O sistema valida se o valor do movimento corresponde ao valor do lançamento na conta bancária.

### 8.5 Desconciliar

1. Num movimento já conciliado, clique no ícone **Desconciliar** (desligar).
2. O movimento volta a ficar pendente.

### 8.6 Resumo de conciliação

No topo da aba, o resumo mostra:

- **Saldo extrato** — soma dos movimentos importados
- **Saldo contábil** — saldo da conta do plano de contas
- **Diferença** — deve ser zero quando está tudo conciliado
- **Status** — Conciliado ou Pendente

---

## 9. Relatórios

### 9.1 Dashboard

1. Vá à aba **Dashboard**.
2. Visualize:
   - Saldo Caixa e Bancos
   - Receitas e Despesas do mês
   - Resultado do mês
   - Gráfico dos últimos 12 meses

### 9.2 Livro Diário

1. Vá à aba **Diário**.
2. Defina o período (De / Até).
3. Use os atalhos: Este mês, Mês anterior, Trimestre, Ano.
4. Visualize todos os lançamentos com data, documento, descrição e linhas.
5. Use **Exportar PDF** para imprimir.

### 9.3 Balancete

1. Vá à aba **Balancete**.
2. Defina o período (De / Até).
3. Visualize débitos, créditos e saldos por conta.
4. Use **Imprimir** para exportar em PDF.

### 9.4 Livro Razão

1. Vá à aba **Razão**.
2. Selecione a **Conta**.
3. Defina o período (De / Até).
4. Visualize saldo inicial, movimentos e saldo corrente.
5. Use **Imprimir** para exportar.

### 9.5 Balanço Patrimonial

1. Vá à aba **Balanço**.
2. Defina o período (De / Até).
3. Visualize Ativo, Passivo e Patrimônio Líquido.
4. Use **Imprimir** para exportar.

### 9.6 DRE (Demonstração de Resultados)

1. Vá à aba **DRE**.
2. Defina o período (De / Até).
3. Visualize Receitas, Despesas e Resultado do Período.
4. Use **Imprimir** para exportar.

---

## 10. Fecho de exercício

### 10.1 Quando fechar

Feche o exercício no fim de cada ano civil (ex.: 31/12/2025).

### 10.2 Como fechar

1. Vá à aba **Fecho**.
2. Selecione o **Ano** a fechar (ex.: 2025).
3. Clique em **Fechar exercício**.
4. Confirme a ação.

**O que acontece:**
- O sistema cria o lançamento de encerramento (Receitas e Despesas → Patrimônio Líquido).
- O período fica bloqueado até 31/12 desse ano.
- Não é possível criar, editar ou excluir lançamentos em datas anteriores.

### 10.3 Verificar exercícios fechados

Na aba **Fecho**, a tabela **Exercícios fechados** lista os anos já fechados e a data do fecho.

---

## 11. Exportação

### 11.1 Exportar em Excel

1. Vá à aba **Exportação**.
2. Defina o período (De / Até).
3. Clique no botão correspondente:
   - **Plano de Contas**
   - **Lançamentos**
   - **Balancete**
   - **Balanço** (por folhas: Ativo, Passivo, PL)
   - **DRE**
   - **Razão** (selecione a conta antes)

### 11.2 Exportar SAFT-AO (XML)

1. Defina o **Ano** e **Mês** (ou ano inteiro).
2. Clique em **Exportar SAFT-AO (XML)**.
3. O ficheiro é gerado em conformidade com a legislação angolana para fisco e contabilistas.

---

## 12. Fluxo de trabalho recomendado

### Início do ano

1. Configurar **Plano de Contas** (se ainda não existir).
2. Configurar **Configuração** (mapear contas).
3. Configurar **Integração Contábil** (regras automáticas).

### Durante o ano

1. Registar lançamentos manuais quando necessário.
2. Deixar os pagamentos (POS, folha, fornecedores) gerarem lançamentos automáticos.
3. Periodicamente: **Conciliação Bancária** (importar extratos e conciliar).
4. Consultar **Dashboard**, **Balancete**, **Balanço** e **DRE**.

### Fim do ano

1. Verificar que todos os movimentos estão registados.
2. Fechar o exercício na aba **Fecho**.
3. Exportar em **Excel** ou **SAFT-AO** para o contabilista.

---

## Resumo rápido

| Ação                    | Onde fazer                    |
|-------------------------|-------------------------------|
| Criar plano de contas   | Plano de Contas → Criar plano padrão |
| Configurar contas      | Configuração                  |
| Regras automáticas     | Integração Contábil           |
| Criar lançamento       | Lançamentos → Novo lançamento |
| Importar extrato       | Conciliação Bancária → Importar extrato |
| Conciliar movimento    | Conciliação Bancária → ícone Conciliar |
| Ver relatórios         | Dashboard, Balancete, Balanço, DRE |
| Fechar ano             | Fecho → Fechar exercício      |
| Exportar Excel/SAFT    | Exportação                    |

---

## Documentos relacionados

- [Guia para Todos](CONTABILIDADE_README.md) — conceitos básicos
- [Guia de Utilização](CONTABILIDADE_GUIA_UTILIZACAO.md) — referência detalhada
- [Verificação Multitenant](CONTABILIDADE_VERIFICACAO_MULTITENANT_TIPO.md) — regras técnicas
