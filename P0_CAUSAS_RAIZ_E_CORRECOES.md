# P0: Professor não vê atribuições/planos no dashboard

## Causas Raiz (arquivo:linha)

### 1. Fonte do select de professor: /professores vs /users

| Local | Arquivo | Linha | Status |
|-------|---------|-------|--------|
| PlanoEnsino, DistribuicaoAulasTab, AtribuicaoDisciplinasTab | frontend | vários | ✅ Usam `professorsApi` (GET /professores) |
| ProfessoresTab | frontend/src/components/admin/ProfessoresTab.tsx | 79-83 | ✅ Usa `professorsApi.getAll()` para lista |
| Biblioteca | frontend/src/pages/admin/Biblioteca.tsx | 176 | ⚠️ Usa `professoresApi` (GET /users) - **mantido** pois EmprestimoBiblioteca.usuarioId = users.id |

**Regra:** Selects de Plano de Ensino devem usar `professorsApi` (GET /professores, value=professores.id). Biblioteca usa users.id para empréstimos.

### 2. POST /plano-ensino (ADMIN)

| Verificação | Arquivo | Linha | Status |
|-------------|---------|-------|--------|
| Exige professorId | backend/src/controllers/planoEnsino.controller.ts | 177-181 | ✅ |
| Valida professor pertence ao tenant | backend/src/controllers/planoEnsino.controller.ts | 165-171 | ✅ validateProfessorId |
| Não usa resolveProfessor | backend/src/routes/planoEnsino.routes.ts | 27 | ✅ POST sem middleware |

### 3. Rotas do professor: resolveProfessor e queries

| Rota | Arquivo | Linha | Status |
|------|---------|-------|--------|
| GET /turmas/professor | backend/src/routes/turma.routes.ts | 21 | ✅ resolveProfessor |
| getTurmasByProfessor | backend/src/controllers/turma.controller.ts | 858-863 | ✅ req.professor.id, instituicaoId |
| buscarTurmasEDisciplinasProfessorComPlanoAtivo | backend/src/services/validacaoAcademica.service.ts | 614-683 | ✅ professorId, instituicaoId |
| GET /plano-ensino | backend/src/routes/planoEnsino.routes.ts | 37 | ✅ resolveProfessorOptional |
| getPlanoEnsino para professor | backend/src/controllers/planoEnsino.controller.ts | 1176-1184 | ✅ req.professor.id |
| GET /professor-disciplinas/me | backend/src/controllers/professorDisciplina.controller.ts | 218 | ✅ req.professor.id |

### 4. Visibilidade de planos por estado

| Local | Arquivo | Linha | Status |
|-------|---------|-------|--------|
| buscarTurmasEDisciplinasProfessorComPlanoAtivo | backend/src/services/validacaoAcademica.service.ts | 664-667 | ✅ NÃO filtra por estado |
| getPlanoEnsino | backend/src/controllers/planoEnsino.controller.ts | 1322-1334 | ✅ Professor vê todos os estados |

### 5. Professor sem registro na tabela professores

| Local | Arquivo | Linha | Status |
|-------|---------|-------|--------|
| createUser role PROFESSOR | backend/src/controllers/user.controller.ts | 447-454 | ✅ Cria professor automaticamente |
| updateRole para PROFESSOR | backend/src/controllers/user.controller.ts | 815-824 | ✅ Cria professor se não existir |
| resolveProfessor falha | backend/src/utils/professorResolver.ts | 89-132 | Professor não encontrado → 400 |

**Causa:** Professores criados antes do fix não têm registro em `professores`. Solução: POST /users/:id/professor.

### 6. 400/404/500 e retornos vazios

| Local | Arquivo | Linha | Status |
|-------|---------|-------|--------|
| getTurmasByProfessor | backend/src/controllers/turma.controller.ts | 1050-1110 | ✅ Sempre retorna 200 com arrays vazios |
| getPlanoEnsino professor sem req.professor | backend/src/controllers/planoEnsino.controller.ts | 1179-1182 | ✅ Retorna [] |
| addInstitutionFilter vazio | backend/src/middlewares/auth.ts | 386-393 | instituicaoId null → filtro { instituicaoId: null } |

### 7. Regras instituicaoId e tipoAcademico

| Regra | Status |
|-------|--------|
| instituicaoId só do JWT | ✅ addInstitutionFilter, requireTenantScope |
| tipoAcademico só do JWT | ✅ req.user.tipoAcademico |
| Nenhuma query sem instituicaoId | ✅ filter em todas as queries |

## Correções aplicadas (mínimas P0)

### 1. professorDisciplina.getByProfessor (OPÇÃO B estrita)

**Arquivo:** backend/src/controllers/professorDisciplina.controller.ts

**Antes:** Aceitava professorId como professors.id OU users.id (fallback).

**Depois:** Valida com validateProfessorId; aceita APENAS professors.id; retorna 404 se inválido.

### 2. Sistema já estava conforme

Demais itens já estavam corretos:

- Fonte de professor para selects de Plano de Ensino: professorsApi (GET /professores)
- POST /plano-ensino: professorId obrigatório, validateProfessorId, sem resolveProfessor
- Rotas professor: resolveProfessor, req.professor.id, instituicaoId do JWT
- Estado não oculta planos (buscarTurmasEDisciplinasProfessorComPlanoAtivo)
- createUser/updateRole criam professor automaticamente para role PROFESSOR
- getTurmasByProfessor nunca retorna 400/404/500 (sempre 200 com arrays)

## Ação para legados

Professores criados antes do fix P0 (sem registro em `professores`) devem ter o registro criado via:
- POST /users/:id/professor (id = users.id)
- Ou recriar o usuário com role PROFESSOR
