# Correções P0 Aplicadas: Professor não vê atribuições/planos no dashboard

## Causas raiz identificadas (arquivo/linha)

### 1. ProfessoresTab usava `/users?role=PROFESSOR` (users.id) em vez de `/professores` (professores.id)
**Arquivo:** `frontend/src/components/admin/ProfessoresTab.tsx`  
**Linhas:** 78-88 (queryFn), 91-93 (deleteMutation), 166-168 (handlePrintComprovativo), 605-608 (delete button)

**Causa:** `professoresApi.getAll()` chama GET `/users?role=PROFESSOR` e retorna `users.id`. Ao abrir ViewProfessorDialog, `professor.id` (users.id) era passado para `turmasApi.getAll({ professorId })` e `professorDisciplinasApi.getByProfessor()`. O backend aceita ambos, mas a regra OPÇÃO B exige que selects acadêmicos usem `professores.id`.

### 2. Delete e getComprovativo precisam de users.id
**Arquivo:** `frontend/src/components/admin/ProfessoresTab.tsx`  
**Linhas:** 91-93, 166-168, 605-608

**Causa:** `professoresApi.delete(id)` e `professoresApi.getComprovativo(id)` chamam `/users/:id` e exigem `users.id`. Ao migrar para `professorsApi`, o `professor.id` passou a ser `professores.id`, então delete e getComprovativo precisam usar `professor.userId`.

---

## Correções aplicadas

### 1. ProfessoresTab: fonte GET /professores (value=professores.id)
- **Arquivo:** `frontend/src/components/admin/ProfessoresTab.tsx`
- **Alteração:** Substituído `professoresApi.getAll()` por `professorsApi.getAll()` (GET /professores)
- **Mapeamento:** Inclusão de `userId` no retorno para operações que usam users.id (delete, getComprovativo, handleEdit)

### 2. Delete e getComprovativo: uso de userId
- **Arquivo:** `frontend/src/components/admin/ProfessoresTab.tsx`
- **Alteração:** `deleteMutation.mutate(professor.userId)` e `professoresApi.getComprovativo(professor.userId)`
- **handleEdit:** `funcionarios.find(f => f.user_id === professor.userId)`

### 3. ViewProfessorDialog: professor.id = professores.id
- **Arquivo:** `frontend/src/components/admin/ViewProfessorDialog.tsx`
- **Status:** Sem alteração necessária. Passa a receber `professor` com `id` = `professores.id` vindo de ProfessoresTab.

---

## Verificações conformidade OPÇÃO B

| Item | Status |
|------|--------|
| Select de professor: GET /professores (value=professores.id) | ProfessoresTab, PlanoEnsinoTab, AtribuicaoDisciplinasTab, etc. usam `professorsApi` |
| POST /plano-ensino: professorId obrigatório, validateProfessorId, sem resolveProfessor | Já implementado (sem alteração) |
| Rotas professor: resolveProfessor, req.professor.id, instituicaoId do JWT | Já implementado (sem alteração) |
| Não filtrar planos por estado (visibilidade) | Já implementado em buscarTurmasEDisciplinasProfessorComPlanoAtivo (sem alteração) |

---

## Arquivos modificados

- `frontend/src/components/admin/ProfessoresTab.tsx` – migração para professorsApi, uso de userId em delete/getComprovativo/handleEdit
