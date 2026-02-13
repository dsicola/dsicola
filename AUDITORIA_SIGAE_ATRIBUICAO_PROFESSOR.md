# AUDITORIA SIGAE — Atribuição Professor ↔ Disciplina ↔ Turma

**Data:** 2025-02-11  
**Regra:** A ÚNICA fonte de verdade para "quem leciona o quê e em qual turma" é PlanoEnsino.

---

## CHECKLIST OK/FAIL

| Item | Status | Observação |
|------|--------|------------|
| `professorId` em Turma | **OK** | Turma.professorId existe mas marcado LEGACY no schema. Não usado para atribuição. |
| `professorId` em Disciplina | **OK** | Disciplina não possui professorId direto. |
| Tabela ProfessorDisciplina (N:N) | **FAIL** | Existia; endpoints de vincular/desvincular **neutralizados** (410 Gone). |
| Tabela ProfessorCurso (N:N) | **FAIL** | Existia; endpoints de vincular/desvincular **neutralizados** (410 Gone). |
| Endpoints "atribuir professor" fora de /plano-ensino | **FAIL** | POST/DELETE /professores/:id/disciplinas e /professores/:id/cursos **neutralizados**. |
| TurmasTab usa turma.professor | **OK** | Backend agora enriquece turmas com professor de PlanoEnsino. |
| ViewProfessorDialog | **OK** | Usa turmasApi.getAll({ professorId }) → backend resolve via PlanoEnsino. |
| professorDisciplinasApi.getMyDisciplinas | **OK** | Retorna PlanoEnsino (já correto). |
| professorDisciplinasApi.getByProfessor | **OK** | Retorna PlanoEnsino (já correto). |
| role-permissions exame | **FAIL** | Usava exame.turma.professorId; **corrigido** para verificar via PlanoEnsino. |
| professorDisciplina.create | **OK** | Cria PlanoEnsino (não ProfessorDisciplina). |
| professorDisciplina.remove | **OK** | Remove PlanoEnsino. |

---

## SCHEMA PRISMA (CONFIRMADO)

- `PlanoEnsino.professorId` → `professores.id` ✓
- `PlanoEnsino.disciplinaId` obrigatório ✓
- `PlanoEnsino.turmaId` opcional ✓
- `PlanoEnsino.instituicaoId` obrigatório ✓

---

## PATCH APLICADO (arquivos alterados)

### 1. `backend/src/controllers/professorVinculo.controller.ts`
- `vincularProfessorCurso` → retorna 410 Gone
- `desvincularProfessorCurso` → retorna 410 Gone
- `vincularProfessorDisciplina` → retorna 410 Gone
- `desvincularProfessorDisciplina` → retorna 410 Gone

### 2. `backend/src/controllers/professorDisciplina.controller.ts`
- `vincularProfessorDisciplina` → retorna 410 Gone
- `desvincularProfessorDisciplina` → retorna 410 Gone

### 3. `backend/src/middlewares/role-permissions.middleware.ts`
- Exame: trocado `exame.turma.professorId !== userId` por verificação via `PlanoEnsino` (professor tem plano para turma).

### 4. `backend/src/controllers/turma.controller.ts`
- `getTurmas` (ADMIN): incluído `planosEnsino` com `professor`; mapeamento para `turma.professor` a partir do primeiro PlanoEnsino.

---

## VALIDAÇÃO instituicaoId

- Todas as queries de PlanoEnsino no escopo da auditoria usam `filter` (addInstitutionFilter) ou `instituicaoId` explícito.
- Nenhuma query perdeu o filtro instituicaoId nas alterações.

---

## TESTE RÁPIDO (manual)

1. **ADMIN:** criar Plano de Ensino com professor, disciplina e turma.
2. **PROFESSOR:** login → dashboard deve mostrar turmas/disciplinas do PlanoEnsino.
3. **TurmasTab:** listar turmas → coluna "Professor" deve mostrar nome do professor do PlanoEnsino.
4. **Exame:** professor com PlanoEnsino para a turma pode lançar notas; professor sem plano não pode.
5. **Chamar** POST /professores/:id/disciplinas → deve retornar 410 com mensagem de descontinuação.

---

## TABELAS N:N MANTIDAS (apenas leitura)

- `ProfessorDisciplina` e `ProfessorCurso` permanecem no schema para dados legados.
- Endpoints de criação/remoção retornam 410.
- `listarCursosProfessor` e `listarDisciplinasProfessor` continuam funcionando (consulta).
