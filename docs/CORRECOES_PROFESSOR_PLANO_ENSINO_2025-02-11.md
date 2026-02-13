# Correções: PROFESSOR ↔ PLANO DE ENSINO ↔ DASHBOARD

**Data:** 2025-02-11  
**Sistema:** DSICOLA (ERP educacional multi-tenant, padrão SIGA/SIGAE)

---

## RESUMO DAS MUDANÇAS

### PASSO 1 — Auditoria (Commit 1)
- **Arquivo:** `docs/AUDITORIA_PROFESSOR_PLANO_ENSINO_PASSO1.md`
- Mapeamento completo de arquivos e linhas com mismatch userId vs professorId
- Confirmação do schema: PlanoEnsino.professorId → Professor.id

### PASSO 3 — Migration e verificação (Commit 2)
- **Arquivo:** `backend/prisma/migrations/20260211000000_backfill_professores_plano_ensino/migration.sql`
  - **Correção multi-tenant:** JOIN na ETAPA 2 agora inclui `p.instituicao_id = pe.instituicao_id` para evitar vazamento entre instituições
- **Arquivo:** `backend/scripts/verificar-backfill-professores.ts`
  - Logs claros adicionados no resumo final

### PASSO 4 — resolveProfessor (Commit 3)
- **Arquivo:** `backend/src/middlewares/resolveProfessor.middleware.ts`
  - Verificação defensiva: `if (typeof next !== 'function')` evita erro "next is not a function"
  - Resposta 500 com mensagem clara se next for inválido
- **Arquivo:** `backend/src/utils/professorResolver.ts`
  - Mensagem alterada para "Professor não cadastrado na instituição"
  - Status alterado de 400 para 403 (autorização)

### PASSO 5 — GET /turmas/professor (Commit 4)
- Rota já configurada corretamente
- Usa req.professor.id (professores.id)
- Retorna 200 com arrays vazios em estados válidos
- Não filtra por estado do plano (RASCUNHO, EM_REVISAO, APROVADO, ENCERRADO)

### PASSO 6 — ProfessorDashboard.tsx (Commit 5)
- **Arquivo:** `frontend/src/pages/professor/ProfessorDashboard.tsx`
  - Tratamento de 403 além de 400 para "Professor não cadastrado"
  - Mensagem e CTA exibidos para ambos os códigos

### PASSO 7 — Plano de ensino professor select (Commit 6)
- **Arquivo:** `backend/src/controllers/planoEnsino.controller.ts`
  - Mensagem unificada: "Professor não cadastrado na instituição (professores). Use o campo 'id' retornado por GET /professores."
  - Status 400 para professor inválido
- Frontend já usa `professorsApi.getAll()` (GET /professores) → retorna professores.id

### PASSO 8 — Testes (Commit 7)
- **Arquivo:** `backend/src/__tests__/professor-plano-dashboard.test.ts`
  - Teste 4: Migration corrige plano_ensino.professor_id
  - Teste 5: Migration respeita multi-tenant (instituicao_id)
  - Teste 6: Schema PlanoEnsino.professorId referencia Professor.id

---

## COMO APLICAR

```bash
# 1. Rodar migration
cd backend && npx prisma migrate deploy

# 2. Verificar pós-migração
npx tsx scripts/verificar-backfill-professores.ts

# 3. Testes (se vitest/vite estiverem configurados)
npx vitest run src/__tests__/professor-plano-dashboard.test.ts
```

---

## REGRAS ABSOLUTAS MANTIDAS

- Nunca remover filtros multi-tenant
- NUNCA aceitar instituicaoId do frontend
- Em todas as queries: instituicaoId = req.user.instituicaoId, userId = req.user.userId
- Retornar 200 com arrays vazios quando for estado válido
- professorId = SEMPRE professores.id (NUNCA users.id)
