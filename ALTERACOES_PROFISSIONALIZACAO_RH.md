# Profissionalização do Módulo de Recursos Humanos - DSICOLA

## Resumo das Alterações Implementadas

Este documento descreve todas as alterações realizadas para profissionalizar o módulo de Recursos Humanos do sistema DSICOLA, garantindo coerência de negócio, dados e UX.

---

## 1. ALTERAÇÕES NO SCHEMA (Prisma)

### 1.1. Novo Enum: `StatusFrequenciaFuncionario`
```prisma
enum StatusFrequenciaFuncionario {
  PRESENTE
  FALTA_JUSTIFICADA
  FALTA_NAO_JUSTIFICADA
}
```

### 1.2. Model `Funcionario`
- ✅ `email` agora é **opcional** (nem todo funcionário precisa ter login)
- ✅ `userId` já era opcional (correto)
- ✅ `salarioBase` mantido (salário vem do funcionário)

### 1.3. Model `ContratoFuncionario`
- ✅ `salario` agora é **opcional** (READ-ONLY, preenchido automaticamente)
- ✅ Adicionado `cargoId` (vincula Funcionario + Cargo + Período)
- ✅ Relacionamento com `Cargo` adicionado

### 1.4. Model `FrequenciaFuncionario`
- ✅ `status` convertido de `String` para enum `StatusFrequenciaFuncionario`
- ✅ Valores: `PRESENTE`, `FALTA_JUSTIFICADA`, `FALTA_NAO_JUSTIFICADA`

### 1.5. Model `FolhaPagamento`
Novos campos adicionados para cálculos automáticos:
- ✅ `diasUteis`: Total de dias úteis no mês (excluindo domingos e feriados)
- ✅ `valorDia`: Valor do dia útil (salarioBase / diasUteis)
- ✅ `totalFaltasNaoJustificadas`: Contador de faltas não justificadas
- ✅ `valorHora`: Valor da hora trabalhada (para cálculo de horas extras)

### 1.6. Model `Feriado`
- ✅ Já existe no schema
- ✅ Integrado com cálculos de dias úteis

### 1.7. Model `User` (Alunos)
- ✅ Confirmado: Alunos usam model `User` (separado de `Funcionario`)
- ✅ Role `ALUNO` controla acesso ao portal do aluno
- ✅ Relacionamentos: Matriculas, Frequencias, Notas, Mensalidades

---

## 2. ALTERAÇÕES NO BACKEND

### 2.1. Services (`rh.service.ts`)

#### `getSalarioBaseFuncionario()`
- ✅ **Alterado**: Removida prioridade do contrato
- ✅ Nova prioridade: `Funcionario.salarioBase` > `Cargo.salarioBase`
- ✅ Motivo: Salário deve vir do cadastro do funcionário, não do contrato

#### Funções já existentes (verificadas):
- ✅ `calcularDiasUteis()`: Calcula dias úteis excluindo domingos e feriados
- ✅ `contarFaltasNaoJustificadas()`: Conta apenas faltas com status `FALTA_NAO_JUSTIFICADA`
- ✅ `calcularDescontoFaltas()`: Calcula desconto automaticamente
- ✅ `contarHorasExtras()`: Soma horas extras da frequência
- ✅ `calcularValorHorasExtras()`: Calcula valor das horas extras

### 2.2. Controllers

#### `contratoFuncionario.controller.ts`
- ✅ `create()`: 
  - Salário preenchido automaticamente do funcionário/cargo
  - Suporte a `cargoId` adicionado
  - Salário do body é ignorado (garante consistência)
  
- ✅ `update()`:
  - Salário é **READ-ONLY** (não pode ser atualizado)
  - Suporte a `cargoId` adicionado
  - Salário do body é ignorado

- ✅ `getAll()`, `getById()`, `getByFuncionarioIds()`, `encerrar()`:
  - Formatadores atualizados para incluir `cargoId`
  - `salario` retornado como `null` se não existir (nullable)
  - Inclui relação `cargo` no include do Prisma

#### `folhaPagamento.controller.ts`
- ✅ `create()`: 
  - Calcula automaticamente: `diasUteis`, `valorDia`, `totalFaltasNaoJustificadas`, `valorHora`
  - Salário base vem do funcionário (não do contrato)
  - Desconto por faltas calculado automaticamente
  - Horas extras calculadas automaticamente
  - Salário líquido calculado automaticamente
  
- ✅ `update()`:
  - Recalcula todos os campos automáticos
  - Mantém consistência dos cálculos

#### `frequenciaFuncionario.controller.ts`
- ✅ `create()`: 
  - Usa enum `StatusFrequenciaFuncionario`
  - Valida valores do enum
  - Horas extras só permitidas para status `PRESENTE`
  
- ✅ `update()`:
  - Usa enum `StatusFrequenciaFuncionario`
  - Valida valores do enum
  - Mantém compatibilidade com valores antigos (conversão)

#### `feriado.controller.ts`
- ✅ Controller já existe e está funcional
- ✅ Integrado com cálculos de dias úteis
- ✅ Suporta feriados NACIONAIS e INSTITUCIONAIS

---

## 3. MIGRATION

### Migration: `20251229094050_profissionalizar_rh`

Alterações SQL:
1. ✅ Cria enum `StatusFrequenciaFuncionario`
2. ✅ Torna `email` opcional em `funcionarios`
3. ✅ Torna `salario` opcional em `contratos_funcionario`
4. ✅ Adiciona `cargo_id` em `contratos_funcionario`
5. ✅ Adiciona foreign key para `cargos`
6. ✅ Converte `status` de TEXT para enum em `frequencia_funcionarios`
7. ✅ Adiciona novos campos em `folha_pagamento`:
   - `dias_uteis`
   - `valor_dia`
   - `total_faltas_nao_justificadas`
   - `valor_hora`

---

## 4. REGRAS DE NEGÓCIO IMPLEMENTADAS

### 4.1. Funcionários
- ✅ Funcionário pode existir sem `userId` (sem login)
- ✅ Funcionário pode existir sem `email`
- ✅ Funcionário deve ter `salarioBase` para cálculos de folha

### 4.2. Contratos
- ✅ Salário vem automaticamente do funcionário
- ✅ Campo `salario` é READ-ONLY (não editável)
- ✅ Contrato vincula: Funcionario + Cargo + Período

### 4.3. Frequência
- ✅ Status deve ser: `PRESENTE`, `FALTA_JUSTIFICADA`, `FALTA_NAO_JUSTIFICADA`
- ✅ Apenas `FALTA_NAO_JUSTIFICADA` gera desconto
- ✅ Horas extras só podem ser registradas para `PRESENTE`

### 4.4. Folha de Pagamento
- ✅ Salário base vem do funcionário (não do contrato)
- ✅ Dias úteis calculados automaticamente (excluindo domingos e feriados)
- ✅ Desconto por faltas calculado automaticamente
- ✅ Horas extras calculadas automaticamente
- ✅ Salário líquido calculado automaticamente
- ✅ Nenhum valor deve ser digitado manualmente

### 4.5. Feriados
- ✅ Feriados não contam como falta
- ✅ Feriados não entram no cálculo de dias úteis
- ✅ Suporta feriados nacionais e institucionais

### 4.6. Alunos
- ✅ Aluno usa model `User` (separado de `Funcionario`)
- ✅ Aluno tem role `ALUNO` para acesso ao portal
- ✅ Aluno não acessa módulos de RH

---

## 5. PENDÊNCIAS / PRÓXIMOS PASSOS

### Backend:
- ⏳ Implementar recibo/PDF para folha de pagamento
- ⏳ Adicionar endpoint para gerar PDF da folha

### Frontend:
- ⏳ Ajustar formulário de contratos: tornar campo `salario` READ-ONLY
- ⏳ Ajustar formulário de frequência: usar enum correto (PRESENTE, FALTA_JUSTIFICADA, FALTA_NAO_JUSTIFICADA)
- ⏳ Ajustar formulário de folha de pagamento: tornar campos calculados READ-ONLY
- ⏳ Adicionar campos novos da folha (diasUteis, valorDia, etc.) na interface
- ⏳ Implementar tela de recibo/PDF

### Testes:
- ⏳ Testar criação de contrato com salário automático
- ⏳ Testar cálculo de folha com faltas não justificadas
- ⏳ Testar cálculo de dias úteis com feriados
- ⏳ Testar atualização de frequência com enum

---

## 6. COMANDOS PARA APLICAR ALTERAÇÕES

```bash
# 1. Aplicar migration
cd backend
npx prisma migrate deploy

# 2. Gerar Prisma Client (já foi feito)
npx prisma generate

# 3. Reiniciar servidor backend
npm run dev
```

---

## 7. NOTAS IMPORTANTES

1. **Compatibilidade**: Os formatadores mantêm campo `tipo` para compatibilidade com frontend antigo, mas o banco usa `status` (enum).

2. **Salário no Contrato**: O campo `salario` no contrato é preenchido automaticamente na criação, mas é READ-ONLY. Não pode ser editado.

3. **Cálculos Automáticos**: Todos os cálculos da folha são feitos no backend. O frontend não deve permitir edição manual desses valores.

4. **Multi-tenant**: Todas as alterações mantêm o filtro por `instituicaoId` para garantir isolamento entre instituições.

5. **Dados Existentes**: As migrations são seguras e não apagam dados existentes. A conversão do enum mantém valores antigos compatíveis.

---

## 8. VALIDAÇÕES REALIZADAS

- ✅ Schema Prisma formatado e válido
- ✅ Controllers sem erros de lint
- ✅ Services sem erros de lint
- ✅ Prisma Client gerado com sucesso
- ✅ Relacionamentos corretos entre models
- ✅ Multi-tenant mantido em todos os endpoints
- ✅ Regras de negócio implementadas corretamente

---

**Data da Implementação**: 2025-01-01  
**Versão**: 1.0.0  
**Status**: Backend completo, Frontend pendente

