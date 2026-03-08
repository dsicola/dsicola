# Módulo de Contabilidade — Guia para Todos

**Este documento explica o módulo de Contabilidade de forma simples.**  
Se não tem formação em contabilidade, comece aqui.

---

## O que é este módulo?

O módulo de Contabilidade regista **todos os movimentos de dinheiro** da instituição de ensino: receitas (propinas, taxas de matrícula), despesas (salários, fornecedores) e o que fica em caixa ou no banco.

**Em resumo:**  
Quando um aluno paga a propina ou quando a escola paga um salário, o sistema regista automaticamente esses movimentos na contabilidade. Assim, a gestão e o contabilista têm sempre a informação organizada e atualizada.

---

## Para quem serve?

| Perfil | O que faz |
|--------|-----------|
| **Admin / Financeiro** | Configura o plano de contas, consulta relatórios, exporta dados para o contabilista |
| **Contabilista** | Recebe os dados exportados (Excel, SAFT-AO) e usa os relatórios para fechar o exercício |
| **Gestão** | Consulta o Dashboard e os relatórios para tomar decisões |

---

## Conceitos em 1 minuto

### Plano de contas
É a **lista de contas** onde o dinheiro é registado. Exemplos:
- **Conta 11 (Caixa)** — dinheiro em numerário
- **Conta 12 (Banco)** — dinheiro em conta bancária
- **Conta 41 (Receita Mensalidades)** — propinas recebidas
- **Conta 42 (Receita Taxas)** — taxas de matrícula recebidas
- **Conta 51 (Despesas Pessoal)** — salários pagos

### Lançamento contábil
É um **registro de um movimento** de dinheiro. Cada lançamento tem sempre **duas partes** (débito e crédito):
- **Débito** — aumenta o que a instituição tem (ex: caixa entra dinheiro)
- **Crédito** — diminui ou aumenta o que a instituição deve (ex: receita recebida)

**Regra:** O total de débitos deve ser igual ao total de créditos em cada lançamento.

### Automático vs Manual
- **Automático** — o sistema cria o lançamento quando acontece algo (ex: pagamento de propina no POS)
- **Manual** — o utilizador cria o lançamento à mão (ex: ajuste, despesa pontual)

---

## O que acontece quando...?

### Aluno paga a propina no POS
1. O utilizador regista o pagamento no POS
2. O sistema cria **automaticamente** um lançamento:
   - **Débito** — Caixa ou Banco (conforme o método de pagamento)
   - **Crédito** — Receita Mensalidades
3. O lançamento aparece no Diário e no Balancete

### Aluno paga a propina + taxa de matrícula (primeiro pagamento)
1. No POS, quando a mensalidade tem taxa de matrícula, aparece a opção «Incluir taxa de matrícula»
2. Se selecionar, o sistema cria **dois lançamentos**:
   - Um para a taxa de matrícula (Débito Caixa/Banco, Crédito Receita Taxas)
   - Outro para a propina (Débito Caixa/Banco, Crédito Receita Mensalidades)
3. O estorno reverte também os dois lançamentos

### Escola paga salários
1. O utilizador marca a folha como paga no módulo de RH
2. O sistema cria **automaticamente** um lançamento:
   - **Débito** — Despesas Pessoal
   - **Crédito** — Caixa ou Banco

### Utilizador cria um lançamento manual
1. Vai à aba **Lançamentos**
2. Clica em **Novo lançamento**
3. Preenche data, descrição e as linhas (conta, débito ou crédito)
4. O total de débitos deve ser igual ao total de créditos

---

## Mapa das abas (o que está em cada uma)

1. **Dashboard** — Visão geral: saldos, receitas, despesas e gráfico dos últimos 12 meses  
2. **Plano de Contas** — Lista de contas (CRUD)
3. **Configuração** — Definição de quais contas usar para Caixa, Banco, Receitas, etc.
4. **Integração Contábil** — Regras que ligam eventos (ex: pagamento propina) às contas de débito/crédito
5. **Centros de Custo** — Agrupamento opcional (ex: Administração, Académico)
6. **Lançamentos** — Lista e criação de lançamentos manuais
7. **Diário** — Livro diário de todos os lançamentos (com exportação PDF)
8. **Balancete** — Relatório por período com débitos, créditos e saldos
9. **Razão** — Movimentos por conta, com saldo inicial e saldo corrente
10. **Balanço** — Ativo, Passivo e Património Líquido
11. **DRE** — Demonstração de Resultados (Receitas, Despesas, Resultado)
12. **Fecho** — Fechar exercício no fim do ano
13. **Exportação** — Exportar em Excel ou SAFT-AO para o contabilista

---

## Fluxo de trabalho recomendado

```
Início do ano
    → Configurar Plano de Contas e Configuração
    → Configurar Integração Contábil (mapear eventos às contas)

Durante o ano
    → Pagamentos automáticos (POS, folha) geram lançamentos
    → Lançamentos manuais para ajustes
    → Consultar Dashboard, Balancete, Balanço, DRE

Fim do ano
    → Fechar exercício (após 31/12)
    → Exportar para o contabilista (Excel, SAFT-AO)
```

---

## Documentos relacionados

| Documento | Descrição |
|-----------|-----------|
| [Guia de Utilização](CONTABILIDADE_GUIA_UTILIZACAO.md) | Passo a passo para configurar e usar cada aba |
| [Roadmap](CONTABILIDADE_ROADMAP.md) | Evolução técnica e funcionalidades planeadas |
| [Avaliação Profissional](CONTABILIDADE_AVALIACAO_PROFISSIONAL.md) | Análise de contabilista sénior e melhorias implementadas |

---

## Permissões

| Perfil | Acesso |
|--------|--------|
| ADMIN | Contabilidade completa da sua instituição |
| FINANCEIRO | Contabilidade completa da sua instituição |
| SUPER_ADMIN | Contabilidade de qualquer instituição (com seleção de instituição) |
