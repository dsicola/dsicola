# Verificação: Contabilidade — Multitenant e Tipos de Instituição

**Data:** Março 2026  
**Objetivo:** Garantir alinhamento com regras multitenant e suporte a SECUNDARIO/SUPERIOR

---

## 1. Multitenant — Conformidade

### Backend

| Componente | Filtro instituicaoId | Fonte | Status |
|------------|----------------------|-------|--------|
| ContabilidadeController | `requireTenantScope(req)` | JWT ou `?instituicaoId` (SUPER_ADMIN) | ✅ |
| ContabilidadeService | Todos os métodos recebem `instituicaoId` | Parâmetro do controller | ✅ |
| ConciliacaoBancariaService | Todos os métodos filtram por `instituicaoId` | Parâmetro do controller | ✅ |
| MotorLancamentosService | Recebe `instituicaoId` em `executar()` | Chamador (pagamentos, folha, etc.) | ✅ |

### Modelos com instituicaoId

- `PlanoConta`, `LancamentoContabil`, `RegraContabil`, `ConfiguracaoContabilidade`
- `CentroCusto`, `FechoExercicio`
- `ContaBancaria`, `MovimentoExtratoBancario` (novos)

### Isolamento cross-tenant

- Admin da Instituição A **não** vê dados da Instituição B (testado em `contabilidade-multitenant.test.ts`)
- SUPER_ADMIN **obrigado** a passar `?instituicaoId=xxx` para aceder contabilidade (403 sem escopo)

---

## 2. SECUNDARIO vs SUPERIOR — Plano de Contas

### seedPlanoPadrao

| tipoAcademico | Plano | Contas | Uso |
|---------------|-------|--------|-----|
| `SECUNDARIO` | PLANO_SECUNDARIO | 12 contas | Ensino médio, estrutura simplificada |
| `SUPERIOR` | PLANO_SUPERIOR | 18 contas | Universidade, mais completo |
| `ESCOLA` | PLANO_ESCOLA | 19 contas | Escolas (qualquer nível) |
| `null` | PLANO_MINIMO | 3 contas | Integração mínima (mensalidades) |

### Diferenças principais

**SECUNDARIO (12 contas):**
- 11 Caixa, 12 Bancos
- 21 Fornecedores
- 31 Capital Social
- 41 Receita Mensalidades, 42 Receita Taxas
- 51 Despesas Pessoal, 52 Despesas Operacionais

**SUPERIOR (18 contas):**
- 11 Caixa, 12 Depósitos à Ordem, 13 Outros Depósitos, 14 Clientes
- 21 Fornecedores, 22 Estado/Entes Públicos, 23 Passivos Financiamento
- 31 Capital e Reservas, 32 Resultados Transitados
- 41 Propinas, 42 Taxas/Emolumentos, 43 Prestação Serviços, 44 Subsídios/Donativos
- 51 Remunerações, 52 Aquisição Bens/Serviços, 53 Imobilizado, 54 Outras Despesas

### Funcionalidades comuns

- Lançamentos, Balancete, Balanço, DRE, Razão, Diário
- Fecho de exercício, Regras contábeis, Configuração
- Conciliação bancária, Referências externas, Auditoria (criadoPor/alteradoPor)

**Não há** diferenciação de UI por tipo — ambas as instituições usam as mesmas funcionalidades.

---

## 3. Frontend — Escopo SUPER_ADMIN

### Comportamento esperado

- **ADMIN/FINANCEIRO:** `instituicaoId` vem do JWT; API não precisa de parâmetro.
- **SUPER_ADMIN:** Deve passar `instituicaoId` em `params` quando tiver instituição selecionada.

### Contabilidade API

Os métodos `contabilidadeApi` aceitam `instituicaoId` em `params` (ex.: `listPlanoContas`, `listLancamentos`). Os componentes devem passar `instituicaoId` quando `isSuperAdmin && instituicaoId` para garantir escopo correto.

---

## 4. Checklist de Validação

- [x] Todos os endpoints de contabilidade usam `requireTenantScope`
- [x] Conciliação bancária filtra por `instituicaoId` em todas as operações
- [x] Plano de contas padrão diferenciado (SECUNDARIO vs SUPERIOR)
- [x] Testes multitenant cobrem isolamento e SUPER_ADMIN com `?instituicaoId`
- [x] Novos modelos (ContaBancaria, MovimentoExtratoBancario) têm `instituicaoId`
- [x] Frontend: LancamentosTab e ConciliacaoBancariaTab passam `instituicaoId` quando SUPER_ADMIN

---

## 5. Recomendações

1. **Moeda:** Usar `moedaPadrao` da instituição (já suportado em `useFormatarMoeda`).
2. **Conciliação:** Conta contábil deve ser do plano da instituição (validação já existe).
3. **Testes:** Executar `npx vitest run src/__tests__/contabilidade-multitenant.test.ts` após alterações.
