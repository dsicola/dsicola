# Roadmap Contabilidade DSICOLA

## Estado atual (MVP)

- ✅ Plano de contas (CRUD)
- ✅ Lançamentos contábeis (CRUD, fechar)
- ✅ Balancete por período
- ✅ **Livro Razão** (por conta, com saldo inicial e saldo corrente)
- ✅ Balanço patrimonial
- ✅ DRE (Demonstração de Resultados)
- ✅ **Fecho de exercício** e bloqueio de período
- ✅ Exportação para contabilistas (Excel: plano, lançamentos, balancete, balanço, DRE, razão; SAFT-AO)
- ✅ Integração pagamentos mensalidades → lançamentos automáticos
- ✅ Plano padrão por tipo: Secundário (12 contas), Superior (22 contas), Mínimo (2 contas)
- ✅ Multi-tenant e dois tipos de instituição (testado)

---

## Passo a passo para tornar a área mais robusta

### 1. **Configuração de contas por instituição** (prioridade média)
- Adicionar em `configuracoes_instituicao` ou `parametros_sistema`:
  - `contaCaixaCodigo` (default: "11")
  - `contaReceitaMensalidadesCodigo` (default: "41")
  - `contaBancoCodigo` (default: "12") — para pagamentos por transferência
- Permite cada instituição usar o seu próprio plano sem alterar código

### 2. **Integração com outros fluxos financeiros**
- **Folha de pagamento**: ao marcar como pago → Débito 51 (Pessoal), Crédito 11/12 (Caixa/Banco)
- **Pagamentos a fornecedores**: Débito 21 (Fornecedores), Crédito 11/12
- **Taxa de matrícula**: Crédito 42 (Receita Taxas)

### 3. **Relatórios contábeis**
- **Balanço** (Ativo = Passivo + PL) por data ✅
- **DRE** (Demonstração de Resultados) — Receitas - Despesas ✅
- **Razão** por conta (todos os lançamentos) ✅
- Exportação PDF/Excel ✅

### 4. **Hierarquia no plano de contas**
- Contas pai/filho (1 → 11, 11.1, 11.2)
- Agregação automática no balancete (contas pai = soma das filhas)
- Nível atual no schema já suporta `contaPaiId` e `nivel`

### 5. **Centro de custos** (opcional)
- Modelo `CentroCusto` (ex: "Administração", "Académico", "Manutenção")
- Campo `centroCustoId` em `LancamentoContabilLinha`
- Relatórios por centro de custo

### 6. **Conformidade fiscal**
- Integração com SAFT-AO (Angola) — mapear lançamentos para documento fiscal ✅
- Período de fechamento (bloquear edição de meses anteriores) ✅
- Numeração sequencial de documentos contábeis

### 7. **Auditoria e rastreabilidade**
- `pagamentoId` / `origemId` em `LancamentoContabil` (opcional) — ligar ao pagamento que originou
- Log de alterações em lançamentos (antes de fechar)

### 8. **Importação**
- Importar CSV de lançamentos (data, conta, descrição, débito, crédito)
- Validação de contas e saldo antes de criar

---

## Ordem sugerida de implementação

1. **Configuração de contas** (2) — flexibilidade sem alterar código
2. **Integração folha de pagamento** (2) — fluxo financeiro crítico
3. **Relatórios Balanço e DRE** (3) — valor imediato para gestão
4. **Hierarquia** (4) — melhorar plano de contas
5. **Centro de custos** (5) — se houver necessidade de gestão por área
