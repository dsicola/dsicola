# Checklist Final - Módulo de Notas (SIGA/SIGAE)

**Objetivo:** Garantir que o sistema não quebre após as alterações de multi-tenant, isolamento de professores e constraints.

## Verificação CAUSA RAIZ (bugs comuns)

| Causa | Status | Verificação |
|-------|--------|-------------|
| Unique errado | ✔ | Índice parcial `(estudante_id, disciplina_id, turma_id, professor_id, componente)` |
| Upsert sem professorId | ✔ | Create path define `professorId`; update não altera (mesmo registro) |
| Falta where professorId | ✔ | getAlunosNotasByTurma, getNotas, pauta getNotas, getNotaById, getHistoricoNota |
| Listagem sem filtro | ✔ | pauta.controller getNotas: filtro professorId + exames só dos planos do professor |

---

## 1. ✔ Multi-tenant isolado

| Verificação | Status | Local |
|-------------|--------|-------|
| `rejectBodyInstituicaoId(req)` em todos os endpoints de criação/atualização | ✔ | `nota.controller.ts` |
| `assertTenantInstituicao(req, entityInstituicaoId)` antes de operações | ✔ | createNota, updateNota, corrigirNota, createNotasEmLote, createNotasAvaliacaoEmLote |
| Queries filtradas por `instituicaoId` (JWT ou filtro) | ✔ | getNotaById, getHistoricoNota, listagem |
| `instituicaoId` na Nota preenchido ao criar | ✔ | createNota, createNotasEmLote, createNotasAvaliacaoEmLote |

---

## 2. ✔ Professor isolado

| Verificação | Status | Local |
|-------------|--------|-------|
| `getAlunosNotasByTurma` filtra por `professorId` quando isProfessor | ✔ | `nota.controller.ts` L1923-1928 |
| Filtro: `OR: [{ professorId }, { professorId: null }]` (AND com OR existente) | ✔ | Mantém exameId/avaliacao, adiciona professorId |
| `validarVinculoProfessorDisciplinaTurma` antes de lançar nota | ✔ | createNota, createNotasEmLote, createNotasAvaliacaoEmLote |
| Professor não vê notas de outro professor na mesma turma | ✔ | Filtro por planoEnsinoId + professorId |

---

## 3. ✔ Unique constraint correta

| Verificação | Status | Local |
|-------------|--------|-------|
| Índice único parcial: `(estudante_id, disciplina_id, turma_id, professor_id, componente)` | ✔ | `20260228150000_nota_unique_estudante_disciplina_turma_professor` |
| WHERE: todos os campos NOT NULL no índice | ✔ | migration.sql |
| Evita conflito entre professores na mesma turma | ✔ | Chave inclui professorId |

---

## 4. ✔ Upsert usando chave composta

| Verificação | Status | Local |
|-------------|--------|-------|
| `createNotasAvaliacaoEmLote`: findUnique por `alunoId_avaliacaoId` → update ou create | ✔ | `nota.controller.ts` L2218-2272 |
| `createNotasEmLote` (batch/exame): findUnique por `alunoId_exameId` → update ou create | ✔ | `nota.controller.ts` L1667-1684 |
| Chave composta respeita unique (alunoId, avaliacaoId) e (alunoId, exameId) | ✔ | Schema @@unique |

---

## 5. ✔ Cálculo usando professorId

| Verificação | Status | Local |
|-------------|--------|-------|
| `DadosCalculoNota` inclui `professorId` | ✔ | `calculoNota.service.ts` |
| `buscarNotasAluno` filtra por `professorId` quando fornecido | ✔ | L74: `...(dados.professorId && { professorId: dados.professorId })` |
| Chamadores passam `professorId`: nota.controller, historicoAcademico, relatoriosOficiais | ✔ | Média usa apenas notas do professor correto |

---

## 6. ✔ Sem remoção de campos existentes

| Verificação | Status | Local |
|-------------|--------|-------|
| `alunoId` mantido (obrigatório) | ✔ | Schema Nota |
| `estudanteId` adicionado como alias (opcional) | ✔ | Backfill em migration |
| `planoEnsinoId`, `exameId`, `avaliacaoId` mantidos | ✔ | Schema |
| Campos novos: `disciplinaId`, `turmaId`, `professorId`, `componente` (opcionais) | ✔ | Migration backfill |

---

## 7. ✔ Migration segura

| Verificação | Status | Local |
|-------------|--------|-------|
| Backfill `estudante_id` = `aluno_id` onde null | ✔ | 20260228150000 |
| Backfill `ano_letivo_id`, `instituicao_id` via plano_ensino | ✔ | 20260228150000 |
| Índice único parcial (não remove dados) | ✔ | CREATE UNIQUE INDEX ... WHERE |
| Migration pauta status: PROVISORIA→SUBMETIDA, DEFINITIVA→FECHADA | ✔ | 20260229110000 |

---

## 8. ✔ Testes passando

| Teste | Comando | Status |
|-------|---------|--------|
| Fluxo completo notas | `npm run test:fluxo-notas-completo` | ✔ |
| Isolamento professores | `npm run test:isolamento-professores` | ✔ |
| Vitest unitários | `npm run test` | ✔ |

**Nota:** Os testes usam o mesmo seed (inst A/B). Se `test:isolamento-professores` falhar após `test:fluxo-notas-completo`, pode ser por dados residuais. Executar isoladamente ou com DB limpo.

---

## Resumo

| Item | Status |
|------|--------|
| Multi-tenant isolado | ✔ |
| Professor isolado | ✔ |
| Unique constraint correta | ✔ |
| Upsert usando chave composta | ✔ |
| Cálculo usando professorId | ✔ |
| Sem remoção de campos existentes | ✔ |
| Migration segura | ✔ |
| Testes passando | ✔ |
