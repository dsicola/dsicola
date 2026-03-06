# Guia de Utilização — Módulo de Contabilidade

Este guia descreve passo a passo como trabalhar com o módulo de Contabilidade do DSICOLA.

---

## Acesso ao módulo

1. Aceda ao **Dashboard** como utilizador com perfil **ADMIN**, **FINANCEIRO** ou **SUPER_ADMIN**
2. No menu lateral, clique em **Contabilidade**
3. A página abre na aba **Plano de Contas**

---

## 1. Configurar o Plano de Contas

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

### 1.3 Configuração de contas por instituição

1. Vá à aba **Configuração**
2. Defina os códigos de conta para:
   - **Caixa** (ex: 11)
   - **Banco** (ex: 12)
   - **Receita Mensalidades** (ex: 41)
   - **Receita Taxas** (ex: 42)
   - **Despesas Pessoal** (ex: 51)
   - **Resultados Transitados** (ex: 32)
3. Guarde as alterações

---

## 2. Lançamentos Contábeis

### 2.1 Criar um lançamento

1. Vá à aba **Lançamentos**
2. Defina o período (De / Até) para filtrar os lançamentos
3. Clique em **Novo lançamento**
4. Preencha:
   - **Data** — data do movimento
   - **Descrição** — ex: "Pagamento mensalidade João"
   - **Linhas** — mínimo 2 linhas, com:
     - Conta (selecione)
     - Débito ou Crédito (um dos dois por linha)
5. Verifique: **Total Débito = Total Crédito**
6. Clique em **Criar**

**⚠️ Atenção:** Não é possível criar lançamentos em exercícios já fechados.

### 2.2 Editar ou excluir lançamento

1. Na lista de lançamentos, clique no ícone **Editar** (lápis) ou **Excluir**
2. **Bloqueado:** Lançamentos em períodos fechados não podem ser alterados nem excluídos

### 2.3 Fechar lançamento individual

1. Clique no ícone **Fechar** (cadeado) em lançamentos abertos
2. Um lançamento fechado não pode ser editado nem excluído

**Nota:** Os pagamentos de mensalidades geram lançamentos automáticos (Débito Caixa, Crédito Receita).

---

## 3. Relatórios

### 3.1 Balancete

1. Vá à aba **Balancete**
2. Defina o período (De / Até)
3. Visualize o relatório com débitos, créditos e saldos por conta
4. Use **Imprimir** para exportar em PDF

### 3.2 Livro Razão

1. Vá à aba **Razão**
2. Selecione a **Conta**
3. Defina o período (De / Até)
4. Visualize os movimentos com saldo inicial, débitos, créditos e saldo corrente
5. Use **Imprimir** para exportar

### 3.3 Balanço Patrimonial

1. Vá à aba **Balanço**
2. Defina os limites do período (De / Até)
3. Visualize Ativo, Passivo e Patrimônio Líquido
4. Use **Imprimir** para exportar

### 3.4 DRE (Demonstração de Resultados)

1. Vá à aba **DRE**
2. Defina o período (De / Até)
3. Visualize Receitas, Despesas e Resultado do Período
4. Use **Imprimir** para exportar

---

## 4. Fecho de Exercício

### 4.1 Quando fechar

Feche o exercício no fim de cada ano civil (ex: 31/12/2025).

### 4.2 Como fechar

1. Vá à aba **Fecho**
2. Selecione o **Ano** a fechar (ex: 2025)
3. Clique em **Fechar exercício**
4. Confirme a ação

**O que acontece:**
- O sistema cria o lançamento de encerramento (Receitas e Despesas → PL)
- O período fica bloqueado até 31/12 desse ano
- Não é possível criar, editar ou excluir lançamentos em datas anteriores

### 4.3 Verificar exercícios fechados

Na aba **Fecho**, a tabela **Exercícios fechados** lista os anos já fechados e a data do fecho.

---

## 5. Exportação para Contabilistas

1. Vá à aba **Exportação**
2. Defina o período (De / Até) para os relatórios

### 5.1 Exportar em Excel

- **Plano de Contas** — exporta todas as contas
- **Lançamentos** — exporta lançamentos do período
- **Balancete** — exporta balancete do período
- **Balanço** — exporta por folhas (Ativo, Passivo, PL)
- **DRE** — exporta Receitas e Despesas
- **Razão** — selecione a conta e exporte

### 5.2 Exportar SAFT-AO (XML)

1. Defina o **Ano** e **Mês** (ou ano inteiro)
2. Clique em **Exportar SAFT-AO (XML)**
3. O ficheiro é gerado em conformidade com a legislação angolana

---

## 6. Centros de Custo (opcional)

1. Vá à aba **Centros de Custo**
2. Crie centros (ex: Administração, Académico, Manutenção)
3. Ao criar lançamentos, pode associar linhas a centros de custo

---

## Fluxo de trabalho recomendado

1. **Início do ano:** Configurar plano de contas e configuração de contas
2. **Durante o ano:** Registar lançamentos (manuais ou automáticos via pagamentos)
3. **Periodicamente:** Consultar Balancete, Razão, Balanço e DRE
4. **Fim do ano:** Fechar o exercício (após 31/12)
5. **Para contabilistas:** Exportar em Excel ou SAFT-AO conforme necessário

---

## Permissões

| Perfil | Acesso |
|-------|--------|
| ADMIN | Contabilidade completo da sua instituição |
| FINANCEIRO | Contabilidade completo da sua instituição |
| SUPER_ADMIN | Contabilidade de qualquer instituição (com seleção de instituição) |

---

## Suporte técnico

Em caso de dúvidas, consulte a documentação em `docs/CONTABILIDADE_ROADMAP.md` ou contacte o suporte técnico.
