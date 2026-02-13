# PASSO 1 — Auditoria: Schema e Relações (userId vs professorId)

**Data:** 2025-02-11  
**Sistema:** DSICOLA (ERP educacional multi-tenant, padrão SIGA/SIGAE)

---

## 1. SCHEMA CONFIRMADO

### Model Professor (tabela `professores`)
- `id` (UUID, PK) — **professores.id**
- `userId` (FK para `users.id`, unique)
- `instituicaoId` (FK para `instituicoes.id`)
- `@@unique([userId, instituicaoId])` — um professor por user+instituição

### Model PlanoEnsino (tabela `plano_ensino`)
- `professorId` (FK para `Professor.id`) — **SEMPRE professores.id**
- Relação: `professor Professor @relation(fields: [professorId], references: [id])`

### Conclusão
- **Schema correto:** `PlanoEnsino.professorId` referencia `Professor.id` (professores.id)
- **Problema:** Tabela `professores` vazia; planos legados podem ter `professor_id = users.id`

---

## 2. MAPEAMENTO DE BUGS (userId vs professorId)

### Arquivos e linhas com mismatch ou pontos críticos

| Arquivo | Linhas | Descrição |
|---------|--------|-----------|
| `validacaoAcademica.service.ts` | 995-1031 | **FALLBACK:** `buscarTurmasEDisciplinasProfessorComPlanoAtivo` aceita `userIdForFallback` para planos com `professor_id = users.id` (legacy). Útil até migração corrigir dados. |
| `turma.controller.ts` | 963-970 | `getTurmasByProfessor` passa `req.professor.userId` como fallback — correto para cobrir legacy. |
| `planoEnsino.controller.ts` | 89-185 | `createOrGetPlanoEnsino` valida `professorId` via `validateProfessorId` — exige `professores.id`. **Não há mismatch** no controller. |
| `professorResolver.ts` | 116-147 | **SAFETY NET:** `resolveProfessor` cria professor automaticamente se user tem role PROFESSOR e não existe em professores. Pode mascarar problema de backfill. |
| `professorVinculo.controller.ts` | 19-53 | `listarProfessores` busca da tabela `professores` — retorna vazio se tabela vazia. |
| `planoEnsino.controller.ts` | 134-172 | Valida `professorIdBody` com `validateProfessorId` — exige `professores.id`. Mensagem: "O frontend deve usar o campo 'id' retornado pelo endpoint GET /professores." |

### Fluxo de erro atual
1. **3 users com role PROFESSOR** → tabela `professores` vazia
2. **GET /professores** → retorna `[]` (admin não consegue selecionar professor para criar plano)
3. **GET /turmas/professor** → `resolveProfessor` falha → "Professor não cadastrado"
4. **Criar plano** → Se frontend enviar `users.id` por engano → FK `plano_ensino_professor_id_fkey` falha
5. **Planos existentes** com `professor_id = users.id` → fallback em `buscarTurmasEDisciplinasProfessorComPlanoAtivo` permite retornar dados, mas dados estão inconsistentes

---

## 3. ROTAS RELACIONADAS

| Rota | Controller | Usa professorId |
|------|------------|------------------|
| GET /turmas/professor | turma.controller.getTurmasByProfessor | req.professor.id (professores.id) ✅ |
| GET /professor-disciplinas/me | professorDisciplina.controller.getMyDisciplinas | req.professor.id ✅ |
| POST /plano-ensino | planoEnsino.controller.createOrGetPlanoEnsino | professorIdBody validado ✅ |
| GET /professores | professorVinculo.controller.listarProfessores | N/A (lista professores) |

---

## 4. REGRA ÚNICA (Padrão SIGA/SIGAE)

| Entidade | Propósito |
|----------|-----------|
| `users` | Identidade e autenticação |
| `professores` | Perfil acadêmico institucional |
| `plano_ensino.professor_id` | **SEMPRE** `professores.id` |
| JWT | `userId`, `instituicaoId`, `tipoAcademico`, (opcional) `professorId` resolvido via middleware |
