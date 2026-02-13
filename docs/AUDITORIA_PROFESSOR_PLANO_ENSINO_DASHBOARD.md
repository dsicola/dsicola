# Auditoria: PROFESSOR ↔ PLANO DE ENSINO ↔ DASHBOARD

**Data:** 2025-02-11  
**Sistema:** DSICOLA (ERP educacional multi-tenant, padrão SIGA/SIGAE)

---

## PASSO 1 — SCHEMA E RELAÇÕES (CONFIRMADO)

### Model Professor (tabela `professores`)
- `id` (UUID, PK)
- `userId` (FK para `users.id`, unique)
- `instituicaoId` (FK para `instituicoes.id`)

### Model PlanoEnsino (tabela `plano_ensino`)
- `professorId` (FK para `Professor.id` — **professores.id**, NÃO users.id)
- Relação: `professor Professor @relation(fields: [professorId], references: [id])`

### Conclusão
- **Schema correto:** `PlanoEnsino.professorId` referencia `Professor.id` (professores.id)
- **Problema:** Tabela `professores` vazia; planos existentes podem ter `professor_id = users.id` (legacy)

---

## PASSO 1 — MAPEAMENTO DE BUGS (userId vs professorId)

### Arquivos e linhas com mismatch ou pontos críticos

| Arquivo | Linha | Descrição |
|---------|-------|-----------|
| `validacaoAcademica.service.ts` | 995-1031 | **FALLBACK:** `buscarTurmasEDisciplinasProfessorComPlanoAtivo` aceita `userIdForFallback` para planos com `professor_id = users.id` (legacy). Útil até migração corrigir dados. |
| `turma.controller.ts` | 963-970 | `getTurmasByProfessor` passa `req.professor.userId` como fallback — correto para cobrir legacy. |
| `planoEnsino.controller.ts` | 89-185 | `createOrGetPlanoEnsino` valida `professorId` via `validateProfessorId` — exige `professores.id`. **Não há mismatch** no controller. |
| `professorResolver.ts` | 116-147 | **SAFETY NET:** `resolveProfessor` cria professor automaticamente se user tem role PROFESSOR e não existe em professores. Pode mascarar problema de backfill. |
| `professorVinculo.controller.ts` | 19-53 | `listarProfessores` busca da tabela `professores` — retorna vazio se tabela vazia. |

### Fluxo de erro atual
1. **3 users com role PROFESSOR** → tabela `professores` vazia
2. **GET /professores** → retorna `[]` (admin não consegue selecionar professor para criar plano)
3. **GET /turmas/professor** → `resolveProfessor` falha → "Professor não cadastrado"
4. **Criar plano** → Se frontend enviar `users.id` por engano → FK `plano_ensino_professor_id_fkey` falha
5. **Planos existentes** com `professor_id = users.id` → fallback em `buscarTurmasEDisciplinasProfessorComPlanoAtivo` permite retornar dados, mas dados estão inconsistentes

---

## PASSO 2 — REGRA ÚNICA (Padrão SIGA/SIGAE)

| Entidade | Propósito |
|----------|-----------|
| `users` | Identidade e autenticação |
| `professores` | Perfil acadêmico institucional |
| `plano_ensino.professor_id` | **SEMPRE** `professores.id` |
| JWT | `userId`, `instituicaoId`, `tipoAcademico`, (opcional) `professorId` resolvido via middleware |

---

## IMPLEMENTAÇÃO CONCLUÍDA (2025-02-11)

### Executado

1. **Migration backfill** — `prisma/migrations/20260211000000_backfill_professores_plano_ensino/migration.sql`
   - Popula `professores` para users com role PROFESSOR
   - Corrige `plano_ensino.professor_id` de users.id para professores.id
   - Logs: `RAISE NOTICE` com quantidades criadas/corrigidas

2. **resolveProfessor** — `middlewares/resolveProfessor.middleware.ts`
   - Anexa `req.user.professorId` além de `req.professor`
   - `return next()` em todos os caminhos (evita "next is not a function")

3. **ProfessorDashboard** — `frontend/.../ProfessorDashboard.tsx`
   - Erro 400: mensagem "Professor não cadastrado" + CTA "Solicitar cadastro"
   - Erros 401/403: mensagem de autenticação
   - Propaga 400 para exibir CTA (não mais swallow)

4. **Plano select** — Já usa `professorsApi.getAll()` (professores.id)

5. **Testes** — `src/__tests__/professor-plano-dashboard.test.ts`
   - Validação de regras (validateProfessorId, resolveProfessorId)
   - Verificação da migration SQL

### Como aplicar

```bash
# 1. Rodar migration
cd backend && npx prisma migrate deploy

# 2. Verificar pós-migração
npx tsx scripts/verificar-backfill-professores.ts

# 3. Instalar vitest e rodar testes (opcional)
npm install -D vitest
npx vitest run src/__tests__/professor-plano-dashboard.test.ts
```
