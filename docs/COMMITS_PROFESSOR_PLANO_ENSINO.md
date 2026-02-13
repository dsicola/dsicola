# Commits: Correção PROFESSOR ↔ PLANO DE ENSINO ↔ DASHBOARD

## Commit 1: Auditoria + logs
**Arquivos:**
- `docs/AUDITORIA_PROFESSOR_PLANO_ENSINO_PASSO1_COMPLETA.md` (novo)

**Mudanças:**
- Documento de auditoria com mapeamento completo de arquivos e linhas com mismatch userId vs professorId
- Confirmação do schema: PlanoEnsino.professorId → Professor.id
- Lista de rotas e controllers relacionados

---

## Commit 2: Migration backfill + verificação
**Arquivos:**
- `backend/prisma/migrations/20260211000000_backfill_professores_plano_ensino/migration.sql`
- `backend/scripts/verificar-backfill-professores.ts`

**Mudanças:**
- Migration: DISTINCT ON (u.id) no INSERT para evitar duplicatas quando user tem múltiplos user_roles
- NOT EXISTS simplificado para (user_id) devido a Professor.userId @unique
- Script de verificação: logs claros e avisos quando há planos inválidos ou users sem registro

**Erro eliminado:** FK `plano_ensino_professor_id_fkey` ao criar plano (tabela professores vazia)

---

## Commit 3: resolveProfessor corrigido
**Arquivos:**
- `backend/src/utils/professorResolver.ts`
- `backend/src/middlewares/resolveProfessor.middleware.ts`
- `backend/src/middlewares/rbac.middleware.ts`

**Mudanças:**
- professorResolver: mensagem unificada "Professor não cadastrado na instituição"
- resolveProfessor.middleware: mensagem de erro 500 mais clara
- requireInstitution: mensagem específica para professor "Professor não cadastrado na instituição"
- Assinatura (req, res, next) garantida; verificação `typeof next !== 'function'` evita "next is not a function"

**Erro eliminado:** "next is not a function", "Professor não encontrado" (mensagem genérica)

---

## Commit 4: Endpoint /turmas/professor
**Arquivos:** Nenhuma alteração necessária

**Status:** Endpoint já estava correto:
- Usa req.professor.id (professores.id)
- Retorna 200 com arrays vazios para estados válidos
- buscarTurmasEDisciplinasProfessorComPlanoAtivo não filtra por estado

---

## Commit 5: ProfessorDashboard.tsx ajustado
**Arquivos:**
- `frontend/src/pages/professor/ProfessorDashboard.tsx`

**Mudanças:**
- Comentários claros sobre não enviar IDs sensíveis
- Tratamento de 200 com arrays vazios como estado válido
- CTA "Verificar novamente" para erros 400/403
- Parsing robusto de turmas e disciplinasSemTurma

---

## Commit 6: Plano de ensino professor select
**Arquivos:** Nenhuma alteração necessária

**Status:** Frontend já usa professorsApi.getAll() → GET /professores
- Valor do select é prof.id (professores.id)
- Controller valida professorId com validateProfessorId antes de criar

---

## Commit 7: Testes P0
**Arquivos:**
- `backend/src/__tests__/professor-plano-dashboard.test.ts`

**Mudanças:**
- Teste 6b: Model Professor tem id, userId, instituicaoId
- Teste 7: resolveProfessorMiddleware tem assinatura (req, res, next)
- Teste 8: resolveProfessor retorna 500 quando next não é função
- Teste 9: validacaoAcademica não filtra por estado do plano

---

## Como aplicar

```bash
# 1. Rodar migration
cd backend && npx prisma migrate deploy

# 2. Verificar pós-migração
npx tsx scripts/verificar-backfill-professores.ts

# 3. Testes
npm test
```
