# Auditoria P0 Blockers - DSICOLA (Final)
**Data:** 2025-02-10  
**Escopo:** Erros que impedem login/uso, criação/visualização de dados essenciais, multi-tenant, dashboards

---

## RESUMO EXECUTIVO

| Status | Descrição |
|--------|-----------|
| **Corrigido** | 2 P0 identificados e corrigidos nesta auditoria |
| **Verificado OK** | Auth/JWT, Professor↔PlanoEnsino, Rotas, Multi-tenant |

---

## P0 CORRIGIDOS NESTA AUDITORIA

### P0-1: termoLegal.middleware - `x-instituicao-id` header antes do JWT — **CORRIGIDO**

| Campo | Valor |
|-------|-------|
| **Arquivo** | `backend/src/middlewares/termoLegal.middleware.ts` |
| **Linha** | 29 |
| **Causa raiz** | `req.headers['x-instituicao-id']` permitia injetar instituicaoId antes de query/JWT, violando regra "instituicaoId SEMPRE do JWT" |
| **Risco** | Vulnerabilidade multi-tenant - possível bypass de escopo |
| **Correção** | Removido `req.headers['x-instituicao-id']`; manter apenas `req.query.instituicaoId` (SUPER_ADMIN) ou `requireTenantScope` (JWT) |

### P0-2: governo.service - findUnique sem instituicaoId — **CORRIGIDO**

| Campo | Valor |
|-------|-------|
| **Arquivo** | `backend/src/services/governo/governo.service.ts` |
| **Função** | `enviarEventoGovernamental`, `reenviarEventoGovernamental` |
| **Causa raiz** | `prisma.eventoGovernamental.findUnique({ where: { id } })` sem filtro instituicaoId |
| **Risco** | Query poderia retornar/processar evento de outra instituição |
| **Correção** | Adicionado parâmetro `instituicaoId` em `enviarEventoGovernamental`; uso de `findFirst({ where: { id, instituicaoId } })`; `findUnique` em reenviar substituído por `findFirst` com filtro |

---

## P0 VERIFICADOS (SEM AÇÃO NECESSÁRIA)

### Auth/JWT/req.user
- **instituicaoId e tipoAcademico:** vêm do JWT (auth.service.ts injeta no login/refresh) — OK
- **auth.ts:** `req.user` montado com `userId`, `email`, `instituicaoId`, `roles`, `tipoAcademico` — OK
- **Rejeição token sem instituicaoId:** auth.ts linhas 91-102 — OK

### Professor ↔ PlanoEnsino ↔ Dashboard
- **PlanoEnsino.professorId:** FK para `professores.id` no schema — OK
- **planoEnsino.controller.ts:** usa `req.professor.id` ou valida `professorId` do body como `professores.id` — OK
- **professorResolver.ts:** `validateProfessorId` checa `professores.id` — OK
- **resolveProfessor:** aplicado em rotas de PROFESSOR; ADMIN continua sem `req.professor` quando não tem registro — OK
- **Dashboard Professor:** GET `/turmas/professor` usa `resolveProfessor` + `req.professor.id` → `buscarTurmasProfessorComPlanos` — OK

### Rotas / Middlewares
- **resolveProfessor:** usado em rotas que exigem professor (avaliacao, nota, presenca, turma/professor, relatorios/pauta, etc.) — OK
- **resolveProfessorOptional:** em GET `/plano-ensino` para professor ver seus planos — OK
- **POST /plano-ensino:** sem `resolveProfessor`; ADMIN usa `professorId` do body (professores.id) — OK
- **Admin não precisa ser professor:** middleware resolveProfessor retorna next() quando ADMIN sem registro — OK

### Multi-tenant
- **addInstitutionFilter / requireTenantScope:** usados nos controllers — OK
- **JWT:** `instituicaoId` sempre do token, nunca de req.query/body para não-SUPER_ADMIN — OK
- **matriculasDisciplinasV2.controller:** usa `requireTenantScope` e rejeita query — OK
- **pauta.controller:** getBoletim usa filter.instituicaoId em matriculas, notas, frequencias — OK

---

## REGRAS VALIDADAS

1. **instituicaoId e tipoAcademico** — sempre do JWT
2. **PlanoEnsino.professorId** — sempre `professores.id` (nunca users.id)
3. **Queries** — filtradas por `instituicaoId` via `addInstitutionFilter` ou `requireTenantScope`
4. **resolveProfessor** — apenas em rotas de professor (PROFESSOR role)
5. **Admin** — não precisa estar em `professores` para criar plano para outro professor

---

## ARQUIVOS ALTERADOS

1. `backend/src/middlewares/termoLegal.middleware.ts` — remoção de x-instituicao-id
2. `backend/src/services/governo/governo.service.ts` — filtro instituicaoId em enviarEventoGovernamental
