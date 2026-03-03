# Como Atribuir Professores a Turmas e Disciplinas

## 📋 Visão Geral

No sistema DSICOLA, os professores **NÃO são atribuídos diretamente a turmas**. A atribuição é feita através de **Planos de Ensino**, que vinculam:
- **Professor** (via `professorId` = `professores.id` - tabela professores, NUNCA users.id)
- **Disciplina** (via `disciplinaId`)
- **Turma** (via `turmaId` - opcional)
- **Ano Letivo** (via `anoLetivoId` - obrigatório)

## 🔄 Fluxo de Atribuição

### 1. Criar Plano de Ensino

O Plano de Ensino é criado pelo **ADMIN** através da interface de administração:

**Caminho:** Dashboard Admin → Aba "Atribuição de Disciplinas"

**Componente:** `AtribuicaoDisciplinasTab.tsx`

**O que acontece:**
1. Admin seleciona:
   - Professor
   - Disciplina
   - Curso/Classe (opcional)
   - Ano Letivo
   - Turma (opcional - pode ser atribuído depois)
   - Semestre (para Ensino Superior)

2. Sistema cria um **Plano de Ensino** com:
   - `professorId` = ID do professor (professores.id da tabela professores)
   - `disciplinaId` = ID da disciplina
   - `turmaId` = ID da turma (pode ser `null` inicialmente)
   - `anoLetivoId` = ID do ano letivo
   - `estado` = `RASCUNHO` (inicialmente)
   - `bloqueado` = `false`

### 2. Aprovar Plano de Ensino

Para o professor poder executar ações acadêmicas, o Plano de Ensino precisa estar:
- **Estado:** `APROVADO`
- **Bloqueado:** `false`

**Regra:** Apenas ADMIN e SUPER_ADMIN podem aprovar planos de ensino.

### 3. Buscar Turmas do Professor

Quando o professor acessa o dashboard, o sistema:

1. Extrai `professorId` e `instituicaoId` do **JWT** (token de autenticação)
2. Busca **Planos de Ensino** vinculados ao professor:
   ```sql
   SELECT * FROM plano_ensino 
   WHERE professorId = :professorId 
     AND instituicaoId = :instituicaoId
     AND anoLetivoId = :anoLetivoId (ou ano letivo ATIVO)
   ```
3. Separa em duas categorias:
   - **Turmas:** Planos com `turmaId` preenchido
   - **Disciplinas sem Turma:** Planos com `turmaId = null`

## ❌ Por que aparece "Nenhuma Atribuição"?

A mensagem "Nenhuma Atribuição" aparece quando:
- `turmas.length === 0` **E** `disciplinasSemTurma.length === 0`

### Possíveis Causas:

#### 1. **Não há Planos de Ensino criados**
- O professor não tem nenhum Plano de Ensino vinculado
- **Solução:** Admin deve criar um Plano de Ensino através da aba "Atribuição de Disciplinas"

#### 2. **Planos de Ensino não estão no ano letivo ativo**
- Os planos existem, mas estão vinculados a um ano letivo diferente do ativo
- **Solução:** Verificar se há um ano letivo ATIVO e se os planos estão vinculados a ele

#### 3. **professorId do JWT não corresponde aos planos**
- O `professorId` extraído do JWT não corresponde aos `professorId` dos planos no banco
- **Solução:** Verificar se o usuário está logado com a conta correta e se os planos foram criados com o `professorId` correto

#### 4. **instituicaoId não corresponde**
- O `instituicaoId` do JWT não corresponde ao `instituicaoId` dos planos
- **Solução:** Verificar se o professor pertence à instituição correta

#### 5. **Professor não tem registro na tabela `professores`**
- O professor DEVE ter registro na tabela `professores` - planos usam professores.id
- **Solução:** O sistema cria automaticamente em: createUser (role PROFESSOR), updateUserRole (role PROFESSOR), POST /user-roles (role PROFESSOR). Safety net: ao acessar o painel, se não existir, é criado automaticamente.

## 🔍 Como Diagnosticar

### 1. Verificar Logs do Backend

Quando o professor acessa o dashboard, o backend registra logs detalhados:

```
[getTurmasByProfessor] Request: { professorId, instituicaoId, anoLetivoId, ... }
[buscarTurmasProfessorComPlanos] Total de planos encontrados para professorId: X
[buscarTurmasProfessorComPlanos] Planos com instituicaoId: X
[buscarTurmasProfessorComPlanos] Planos sem instituicaoId: X
```

**O que procurar:**
- Se `Total de planos encontrados = 0`: Não há planos criados
- Se `Planos com instituicaoId = 0`: Planos existem mas em outra instituição
- Se `Planos com anoLetivoId = 0`: Planos existem mas em outro ano letivo

### 2. Verificar no Banco de Dados

```sql
-- Verificar se há planos de ensino para o professor
SELECT COUNT(*) 
FROM plano_ensino 
WHERE professorId = :professorId;

-- Verificar planos por instituição
SELECT COUNT(*) 
FROM plano_ensino 
WHERE professorId = :professorId 
  AND instituicaoId = :instituicaoId;

-- Verificar planos por ano letivo
SELECT COUNT(*) 
FROM plano_ensino 
WHERE professorId = :professorId 
  AND anoLetivoId = :anoLetivoId;

-- Verificar se professor tem registro na tabela Professor
SELECT * 
FROM professores 
WHERE userId = :professorId 
  AND instituicaoId = :instituicaoId;
```

### 3. Verificar no Frontend

No console do navegador, procurar por:

```
[ProfessorDashboard] Buscando turmas via /turmas/professor
[ProfessorDashboard] user?.id: <id-do-usuario>
[ProfessorDashboard] ✅ Dados retornados pelo backend: { turmas: X, disciplinasSemTurma: Y }
```

## ✅ Solução Passo a Passo

### Passo 1: Verificar se há Ano Letivo Ativo

1. Acesse como ADMIN
2. Vá em "Anos Letivos"
3. Verifique se há um ano letivo com status `ATIVO`
4. Se não houver, crie e ative um ano letivo

### Passo 2: Criar Plano de Ensino

1. Acesse como ADMIN
2. Vá em "Professores" → Aba "Atribuição de Disciplinas"
3. Clique em "Atribuir Disciplina a Professor"
4. Preencha:
   - **Professor:** Selecione o professor
   - **Disciplina:** Selecione a disciplina
   - **Ano Letivo:** Selecione o ano letivo ATIVO
   - **Curso/Classe:** Selecione se aplicável
   - **Turma:** Selecione a turma (ou deixe vazio para atribuir depois)
   - **Semestre:** Se Ensino Superior
5. Clique em "Criar"

### Passo 3: Aprovar Plano de Ensino

1. Acesse como ADMIN
2. Vá em "Planos de Ensino"
3. Encontre o plano criado
4. Altere o estado para `APROVADO`
5. Certifique-se de que `bloqueado = false`

### Passo 4: Verificar Atribuição

1. Faça logout e login como o professor
2. Acesse o dashboard do professor
3. Verifique se as turmas/disciplinas aparecem

## 📝 Notas Importantes

1. **professorId (REGRA institucional):**
   - Nos Planos de Ensino, `professorId` é SEMPRE `professores.id` (tabela professores)
   - NUNCA usar `users.id` - o frontend deve usar GET /professores para obter a lista
   - O professor vê seus planos via req.professor.id (resolvido do JWT pelo middleware)

2. **Turma Opcional:**
   - Um Plano de Ensino pode existir sem `turmaId`
   - Neste caso, aparece como "Disciplina sem Turma" no dashboard
   - O professor não pode executar ações acadêmicas até a turma ser vinculada

3. **Ano Letivo:**
   - O sistema busca automaticamente o ano letivo ATIVO se não fornecido
   - Se não houver ano letivo ativo, busca em todos os anos letivos

4. **Estados do Plano:**
   - `RASCUNHO`: Plano criado mas não aprovado
   - `EM_REVISAO`: Plano em revisão
   - `APROVADO`: Plano aprovado (permite ações acadêmicas se não bloqueado)
   - `ENCERRADO`: Plano encerrado (apenas visualização)

## 🔗 Arquivos Relacionados

- **Backend:**
  - `backend/src/controllers/turma.controller.ts` - Endpoint `/turmas/professor`
  - `backend/src/services/validacaoAcademica.service.ts` - Função `buscarTurmasProfessorComPlanos`
  - `backend/src/controllers/professorDisciplina.controller.ts` - Criação de atribuições
  - `backend/src/controllers/planoEnsino.controller.ts` - Gerenciamento de planos

- **Frontend:**
  - `frontend/src/pages/professor/ProfessorDashboard.tsx` - Dashboard do professor
  - `frontend/src/components/admin/AtribuicaoDisciplinasTab.tsx` - Interface de atribuição
  - `frontend/src/services/api.ts` - API `turmasApi.getTurmasProfessor`

## 🐛 Troubleshooting

### Problema: "Nenhuma Atribuição" mesmo com planos criados

**Verificar:**
1. Logs do backend para ver quantos planos foram encontrados
2. Se `professorId` do JWT corresponde ao `professorId` dos planos
3. Se `instituicaoId` do JWT corresponde ao `instituicaoId` dos planos
4. Se há ano letivo ATIVO e se os planos estão vinculados a ele

### Problema: Planos aparecem mas ações estão bloqueadas

**Verificar:**
1. Se o estado do plano é `APROVADO`
2. Se `bloqueado = false`
3. Se há `turmaId` vinculado (necessário para ações acadêmicas)

### Problema: Professor não aparece na lista de professores

**Verificar:**
1. Se o usuário tem role `PROFESSOR`
2. Se há registro na tabela `professores` (não obrigatório, mas recomendado)
3. Se o usuário pertence à instituição correta

