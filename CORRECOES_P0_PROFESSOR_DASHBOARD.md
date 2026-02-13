# Correções P0: Professor não vê atribuições/planos no dashboard

## Causas raiz identificadas

### 1. Professor sem registro na tabela `professores` (CRÍTICA)
**Arquivo:** `backend/src/controllers/user.controller.ts`  
**Linha:** ~434 (antes da linha 448)

**Causa:** Ao criar usuário com role PROFESSOR via POST /users, apenas o user e a role eram criados. O registro na tabela `professores` não era criado automaticamente. O middleware `resolveProfessor` falha se não encontrar professor, e `getTurmasByProfessor` depende de `req.professor.id`.

**Correção:** Criar registro em `professores` automaticamente na mesma transação quando `role === 'PROFESSOR'`.

### 2. `getByProfessor` e `getTurmas` aceitavam apenas `professores.id`
**Arquivos:**  
- `backend/src/controllers/professorDisciplina.controller.ts` (~290)  
- `backend/src/controllers/turma.controller.ts` (~34)

**Causa:** `ProfessoresTab` e `ViewProfessorDialog` usam `professoresApi` (GET /users?role=PROFESSOR) que retorna `users.id`. Ao chamar `getByProfessor(professor.id)` ou `getAll({ professorId })`, o backend esperava `professores.id` e retornava vazio.

**Correção:** Resolver `users.id` → `professores.id` quando o id não for encontrado como `professores.id`.

### 3. `turmasApi.getAll` com `professorId` usava endpoint errado
**Arquivo:** `frontend/src/services/api.ts` (~781)

**Causa:** Ao passar `professorId`, o frontend redirecionava para GET /turmas/professor, que retorna turmas do usuário atual (JWT), não do professor especificado. Admin via dados vazios ao visualizar um professor.

**Correção:** Usar GET /turmas com `professorId` no query (backend aceita `professores.id` ou `users.id`).

### 4. `NotasTab` enviava `user.id` como `professorId` para professor
**Arquivo:** `frontend/src/components/admin/NotasTab.tsx` (~296)

**Causa:** Professor usava `getAll({ professorId: user.id })` com `users.id`, que era rejeitado ou levava ao endpoint errado.

**Correção:** Professor usa `getTurmasProfessor()` (JWT resolve automaticamente).

---

## Verificações (conformidade OPÇÃO B)

| Item | Status |
|------|--------|
| Select de professor: GET /professores (value=professores.id) | ✅ AtribuicaoDisciplinasTab, PlanoEnsinoTab, etc. usam `professorsApi` |
| POST /plano-ensino: professorId obrigatório, validateProfessorId, sem resolveProfessor | ✅ |
| Rotas professor: resolveProfessor, req.professor.id, instituicaoId do JWT | ✅ GET /turmas/professor |
| Não filtrar planos por estado (visibilidade) | ✅ buscarTurmasEDisciplinasProfessorComPlanoAtivo não filtra por estado |

---

## Professores existentes (criados antes do fix)

Para professores já cadastrados sem registro em `professores`:

1. **API:** `professoresApi.createProfessor(userId)` — POST /users/:id/professor
2. **Uso:** Admin chama após identificar users com role PROFESSOR sem registro em `professores`.
