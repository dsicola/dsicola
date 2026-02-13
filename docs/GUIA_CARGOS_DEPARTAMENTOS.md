# Guia: Como Utilizar Cargos e Departamentos no DSICOLA

## Visão Geral

A estrutura organizacional do DSICOLA funciona em três níveis hierárquicos:

```
📁 DEPARTAMENTO
  └── 💼 CARGO
      └── 👤 FUNCIONÁRIO
```

## Problema Resolvido

**Antes**: Funcionários com cargo mas sem departamento não apareciam na estrutura organizacional.

**Agora**: Todos os funcionários aparecem, mesmo sem departamento. Uma seção especial "Funcionários sem Departamento" foi criada para exibir esses casos.

---

## Como Cadastrar

### 1. Criar Departamento

**Localização**: Recursos Humanos → Departamentos

**Campos obrigatórios**:
- Nome do Departamento (ex: "Departamento Acadêmico", "Secretaria")
- Descrição (opcional)

**Passos**:
1. Acesse **Recursos Humanos** → **Departamentos**
2. Clique em **"Criar Departamento"**
3. Preencha o nome e descrição
4. Salve

**Importante**: Departamentos podem ser desativados sem excluir funcionários vinculados.

---

### 2. Criar Cargo

**Localização**: Recursos Humanos → Cargos

**Campos obrigatórios**:
- Nome do Cargo (ex: "Professor", "Assistente Administrativo")
- Tipo: `ACADEMICO` ou `ADMINISTRATIVO`
- Salário Base (opcional)

**Tipos de Cargo**:
- **ACADEMICO**: Para professores e cargos acadêmicos
- **ADMINISTRATIVO**: Para secretaria, coordenação, etc.

**Passos**:
1. Acesse **Recursos Humanos** → **Cargos**
2. Clique em **"Criar Cargo"**
3. Preencha nome, tipo e salário base
4. Salve

**Importante**: 
- Cargos podem ser desativados sem excluir funcionários vinculados
- Não é possível excluir cargo com funcionários vinculados

---

### 3. Vincular Funcionário a Cargo e Departamento

**Localização**: Recursos Humanos → Funcionários

**Ao criar ou editar funcionário**:

1. **Selecionar Cargo** (obrigatório para aparecer na estrutura):
   - Escolha o cargo do funcionário
   - O cargo deve estar ativo

2. **Selecionar Departamento** (opcional, mas recomendado):
   - Escolha o departamento do funcionário
   - Se não selecionar, o funcionário aparecerá em "Funcionários sem Departamento"

**Passos**:
1. Acesse **Recursos Humanos** → **Funcionários**
2. Crie novo funcionário ou edite existente
3. No formulário, selecione:
   - **Cargo**: Escolha o cargo (ex: "Professor", "Assistente Administrativo")
   - **Departamento**: Escolha o departamento (opcional)
4. Salve

---

## Visualizar Estrutura Organizacional

**Localização**: Recursos Humanos → Estrutura Organizacional

A estrutura mostra:

### Por Departamento
- Lista de departamentos
- Cargos dentro de cada departamento
- Funcionários em cada cargo
- Total de funcionários por departamento

### Funcionários sem Departamento
- Seção especial para funcionários sem departamento vinculado
- Mostra todos os cargos (mesmo sem funcionários)
- Funcionários agrupados por cargo

### Cargos Disponíveis
- Cargos ativos sem funcionários vinculados
- Útil para ver quais cargos estão disponíveis para contratação

---

## Resolução do Problema Reportado

### Problema Original
> "Tem dois funcionários nos cargos 'Assistente Administrativo' e 'Professor' mas não aparecem nos cargos nem na opção de total de funcionários"

### Causa
Os funcionários tinham cargo vinculado, mas **não tinham departamento**. A lógica antiga só mostrava funcionários vinculados a departamentos.

### Solução Implementada
1. ✅ Criada seção "Funcionários sem Departamento" que sempre aparece se houver funcionários sem departamento
2. ✅ Todos os cargos aparecem nesta seção, mesmo sem funcionários
3. ✅ Funcionários sem departamento são agrupados por cargo
4. ✅ Total de funcionários agora conta TODOS os funcionários ativos (não apenas os com departamento)

### Como Verificar
1. Acesse **Recursos Humanos** → **Estrutura Organizacional**
2. Procure pela seção **"Funcionários sem Departamento"**
3. Os cargos "Assistente Administrativo" e "Professor" devem aparecer com seus funcionários
4. O total de funcionários deve incluir todos os funcionários ativos

---

## Boas Práticas

### 1. Sempre Vincular Cargo
- ✅ **SEMPRE** vincule um cargo ao funcionário
- Sem cargo, o funcionário não aparece na estrutura organizacional

### 2. Vincular Departamento (Recomendado)
- ✅ **RECOMENDADO**: Vincule um departamento ao funcionário
- Funcionários sem departamento aparecem em seção separada
- Facilita organização e relatórios

### 3. Manter Cargos Ativos
- ✅ Mantenha cargos ativos mesmo sem funcionários
- Útil para planejamento de contratações
- Aparecem em "Cargos Disponíveis"

### 4. Organização Hierárquica
```
Departamento Acadêmico
  └── Professor (2 funcionários)
  └── Coordenador (1 funcionário)

Secretaria
  └── Assistente Administrativo (3 funcionários)
  └── Secretário (1 funcionário)

Funcionários sem Departamento
  └── Professor (1 funcionário) ← Precisa vincular a departamento
  └── Assistente Administrativo (1 funcionário) ← Precisa vincular a departamento
```

---

## Estatísticas e Relatórios

### Total de Funcionários
- Agora conta **TODOS** os funcionários ativos
- Inclui funcionários com e sem departamento

### Total de Cargos
- Conta todos os cargos ativos
- Inclui cargos com e sem funcionários

### Inconsistências
O sistema identifica:
- ⚠️ **Cargos sem departamento**: Cargos com funcionários mas nenhum funcionário tem departamento
- ⚠️ **Funcionários sem cargo**: Funcionários ativos sem cargo vinculado

---

## Exemplos de Uso

### Exemplo 1: Professor Novo
1. Criar cargo "Professor de Matemática" (tipo: ACADEMICO)
2. Vincular ao departamento "Departamento Acadêmico"
3. Criar funcionário e vincular ao cargo e departamento
4. ✅ Aparece na estrutura: Departamento Acadêmico → Professor de Matemática

### Exemplo 2: Funcionário sem Departamento
1. Criar cargo "Assistente Administrativo" (tipo: ADMINISTRATIVO)
2. Criar funcionário e vincular apenas ao cargo (sem departamento)
3. ✅ Aparece na estrutura: Funcionários sem Departamento → Assistente Administrativo

### Exemplo 3: Corrigir Funcionário sem Departamento
1. Acesse **Recursos Humanos** → **Funcionários**
2. Edite o funcionário
3. Selecione um departamento
4. Salve
5. ✅ Funcionário agora aparece no departamento correto

---

## Troubleshooting

### Funcionário não aparece na estrutura
**Verificar**:
1. ✅ Funcionário está com status "ATIVO"?
2. ✅ Funcionário tem cargo vinculado?
3. ✅ Cargo está ativo?

**Solução**: Edite o funcionário e vincule um cargo ativo.

### Cargo não aparece
**Verificar**:
1. ✅ Cargo está ativo?
2. ✅ Cargo pertence à mesma instituição?

**Solução**: Ative o cargo ou verifique a instituição.

### Total de funcionários incorreto
**Verificar**:
1. ✅ Todos os funcionários estão com status "ATIVO"?
2. ✅ Funcionários têm cargo vinculado?

**Solução**: O total agora conta todos os funcionários ativos, independente de ter departamento.

---

## Conclusão

O sistema agora garante que:
- ✅ Todos os funcionários aparecem na estrutura
- ✅ Todos os cargos aparecem na estrutura
- ✅ Funcionários sem departamento têm seção própria
- ✅ Total de funcionários é preciso
- ✅ Estrutura organizacional completa e clara

**Última atualização**: 2024
**Versão**: 1.1.0

