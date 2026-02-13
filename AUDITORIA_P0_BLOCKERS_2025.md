# Auditoria P0 Blockers - DSICOLA
**Data:** 2025-02-10  
**Escopo:** Erros que impedem login/uso, criação/visualização de dados essenciais, multi-tenant, dashboards

---

## RESUMO EXECUTIVO

| Status | Descrição |
|--------|-----------|
| **Corrigido** | 1 P0 crítico identificado e corrigido |
| **Verificado** | Auth/JWT, Professor↔PlanoEnsino, Rotas, Multi-tenant |

---

## P0 IDENTIFICADO E CORRIGIDO

### P0-1: Atribuição de Disciplinas envia `users.id` em vez de `professores.id` — **CORRIGIDO**

| Campo | Valor |
|-------|-------|
| **Arquivo** | `frontend/src/components/admin/AtribuicaoDisciplinasTab.tsx`, `frontend/src/hooks/useSmartSearch.ts` |
| **Rota afetada** | POST `/plano-ensino` |
| **Causa raiz** | O componente usava `userRolesApi` + `profilesApi` e `professoresApi` (GET `/users?role=PROFESSOR`), que retornam `users.id`. O backend exige `professores.id` |
| **Sintoma** | 404 ao criar atribuição de disciplina via Dashboard Admin → Atribuição de Disciplinas |
| **Correção** | Trocar para `professorsApi` (GET `/professores`) que retorna `professores.id` |

**Arquivos alterados:**
- `frontend/src/hooks/useSmartSearch.ts`: `professoresApi` → `professorsApi` no `useProfessorSearch`
- `frontend/src/components/admin/AtribuicaoDisciplinasTab.tsx`: query de professores usando `professorsApi.getAll()` em vez de `userRolesApi` + `profilesApi`

---

## P0 VERIFICADOS (SEM AÇÃO NECESSÁRIA)

### Auth/JWT/req.user
- **instituicaoId e tipoAcademico:** vêm do JWT (injetados no login e refresh) — OK
- **auth.service.ts:** `generateAccessToken` inclui `instituicaoId` e `tipoAcademico` — OK
- **auth.ts:** `req.user` montado com `userId`, `email`, `instituicaoId`, `roles`, `tipoAcademico` — OK

### Professor ↔ PlanoEnsino ↔ Dashboard
- **PlanoEnsino.professorId:** FK para `professores.id` no schema — OK
- **planoEnsino.controller.ts:** usa `req.professor.id` ou valida `professorId` do body como `professores.id` — OK
- **professorResolver.ts:** `validateProfessorId` checa `professores.id` — OK
- **resolveProfessor:** aplicado em rotas de PROFESSOR; ADMIN continua sem `req.professor` quando não tem registro — OK

### Rotas / Middlewares
- **resolveProfessor:** usado em rotas que exigem professor (avaliacao, nota, presenca, turma/professor, etc.) — OK
- **resolveProfessorOptional:** em GET `/plano-ensino` para professor ver seus planos — OK
- **POST /plano-ensino:** sem `resolveProfessor`; ADMIN usa `professorId` do body (professores.id) — OK

### Multi-tenant
- **addInstitutionFilter / requireTenantScope:** usados nos controllers — OK
- **JWT:** `instituicaoId` sempre do token, nunca de `req.query`/`body` — OK

---

## REGRAS VALIDADAS

1. **instituicaoId e tipoAcademico** — sempre do JWT
2. **PlanoEnsino.professorId** — sempre `professores.id`
3. **Queries** — filtradas por `instituicaoId` via `addInstitutionFilter` ou `requireTenantScope`
4. **resolveProfessor** — apenas em rotas de professor
5. **Admin** — não precisa estar em `professores` para criar plano para outro professor

---

## RECOMENDAÇÕES ADICIONAIS

1. **ViewProfessorDialog / ProfessoresTab:** `ProfessoresTab` usa `professoresApi` (users). Se o dialog for usado para turmas/disciplinas acadêmicas, passar `professorsApi` ou garantir que o `professor.id` seja `professores.id`.
2. **NotasTab:** Quando `isProfessor` chama `turmasApi.getAll`, a API usa `/turmas/professor` e ignora `professorId` (usa JWT) — OK.
3. **Documentação:** Manter `COMO_ATRIBUIR_PROFESSORES.md` alinhado com `professores.id` (não `users.id`).
