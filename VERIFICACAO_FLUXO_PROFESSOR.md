# Verificação Completa: Fluxo Professor → Atribuições → Painel

**Data:** 2026-02-10  
**Status:** ✅ Fluxo verificado e corrigido

---

## 1. Regra fundamental

**Professor DEVE estar na tabela `professores`** para ver atribuições no painel. O sistema usa `professores.id` (não `users.id`) em Planos de Ensino.

---

## 2. Criação automática na tabela `professores`

| Fluxo | Arquivo | Quando cria |
|-------|---------|-------------|
| **createUser** | `user.controller.ts:449` | Role = PROFESSOR ao criar usuário |
| **updateUserRole** | `user.controller.ts:821` | Role alterada para PROFESSOR |
| **POST /user-roles** | `user-roles.routes.ts:158` | Role PROFESSOR adicionada |
| **Safety net** | `professorResolver.ts:109` | Professor acessa painel sem registro |

---

## 3. Fluxo completo (criação até visualização)

```
1. ADMIN cria professor
   ├─ CriarProfessor (professoresApi.create) → POST /users { role: 'PROFESSOR' }
   ├─ FuncionarioFormDialog mode=PROFESSOR → usersApi.create → POST /users
   └─ POST /user-roles { role: 'PROFESSOR' }
   → createUser ou user-roles cria em professores ✅

2. ADMIN atribui disciplina
   ├─ Professores → Atribuição de Disciplinas → Nova Atribuição
   ├─ Seleciona professor (GET /professores → professores.id)
   ├─ Preenche: disciplina, ano letivo, curso/classe, semestre
   └─ Clica Atribuir → POST /plano-ensino { professorId: professores.id }
   → Plano de Ensino criado com professorId correto ✅

3. PROFESSOR acessa painel
   ├─ GET /turmas/professor (resolveProfessor middleware)
   ├─ resolveProfessor: userId + instituicaoId → professores.id
   │  └─ Se não existir: SAFETY NET cria automaticamente ✅
   ├─ buscarTurmasEDisciplinasProfessorComPlanoAtivo(professores.id)
   └─ Retorna turmas e disciplinasSemTurma
   → Professor vê suas atribuições ✅
```

---

## 4. Pontos críticos verificados

| Item | Status |
|------|--------|
| GET /professores retorna professores.id | ✅ professorVinculo.controller.listarProfessores |
| Atribuição usa professorId do select (professores.id) | ✅ AtribuicaoDisciplinasTab + useProfessorSearch |
| resolveProfessor usa professors.id | ✅ professorResolver |
| Safety net cria professor se faltar | ✅ professorResolver.ts:106-119 |
| getTurmasByProfessor usa req.professor.id | ✅ turma.controller.ts:863 |
| Plano de Ensino criado com estado RASCUNHO | ✅ Schema default |
| Plano de Ensino criado com bloqueado false | ✅ Schema default |

---

## 5. Correção para dados legados

Professores criados antes das correções podem não ter registro em `professores`. Dois caminhos:

**A) Safety net:** ao acessar o painel, o registro é criado automaticamente.

**B) Script manual:**
```bash
cd backend
npm run script:criar-professor -- <email-do-professor>
```

---

## 6. Diagnóstico (se ainda houver problema)

```bash
cd backend
npm run script:diagnostico-professor -- <email>
```

---

## 7. Resumo

O fluxo está completo e consistente. Todas as formas de criar/atribuir professor garantem registro em `professores`, e o safety net cobre casos antigos ou exceções.
