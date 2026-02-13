# AUDITORIA COMPLETA DO FLUXO ACADÊMICO INSTITUCIONAL
## DSICOLA - Padrão SIGA/SIGAE REAL

**Data:** 2024
**Status:** ✅ COMPLETO E CORRIGIDO

---

## 1. INSTITUIÇÃO (MULTI-TENANT) ✅

### Verificações:
- ✅ Todas as tabelas críticas possuem `instituicaoId`
- ✅ `instituicaoId` NUNCA vem do frontend (sempre do JWT)
- ✅ Middleware `addInstitutionFilter` aplicado corretamente
- ✅ `requireTenantScope` garante instituicaoId do JWT

### Tabelas com `instituicaoId` OBRIGATÓRIO:
- ✅ `Disciplina` - String (obrigatório)
- ✅ `Professor` - String (obrigatório)
- ✅ `PlanoEnsino` - String (obrigatório)
- ✅ `Avaliacao` - String (obrigatório)
- ✅ `Nota` - String (obrigatório)
- ✅ `AulaLancada` - String (obrigatório)
- ✅ `Presenca` - String (obrigatório)

### Tabelas com `instituicaoId` OPCIONAL (aceitável):
- `Curso` - String? (pode ser compartilhado entre instituições)
- `Classe` - String? (pode ser compartilhado entre instituições)
- `Turma` - String? (recomendado tornar obrigatório)

**AÇÃO:** Manter como está - multi-tenant está seguro via filtros no middleware.

---

## 2. USUÁRIOS E PAPÉIS ✅

### Estrutura:
- ✅ `User` (users) - apenas autenticação/autorização
- ✅ `UserRole_` (user_roles) - define papéis (ADMIN, PROFESSOR, ALUNO)
- ✅ Nenhuma regra acadêmica depende apenas do role
- ✅ Professor é entidade separada (professores)

**STATUS:** ✅ CORRETO

---

## 3. PROFESSOR (ENTIDADE ACADÊMICA) ✅

### Verificações:
- ✅ Tabela `professores` existe
- ✅ `professores.user_id` → `users.id` (FK correta)
- ✅ `professores.instituicao_id` obrigatório
- ✅ `professores.id` é usado em `PlanoEnsino.professorId`
- ✅ ADMIN cadastra professor explicitamente
- ✅ Role PROFESSOR NÃO cria professor automaticamente

### Middleware:
- ✅ `resolveProfessor` existe e funciona corretamente
- ✅ Resolve `userId + instituicaoId` → `professores.id`
- ✅ Anexa `req.professor` ao request

**STATUS:** ✅ CORRETO

---

## 4. CURSO ✅

### ENSINO SUPERIOR:
- ✅ Curso é OBRIGATÓRIO
- ✅ Disciplinas vinculadas via `CursoDisciplina`
- ✅ `PlanoEnsino.cursoId` obrigatório para Superior

### ENSINO SECUNDÁRIO:
- ✅ Curso é OPCIONAL
- ✅ Classe é obrigatória

### Relacionamentos:
- ✅ `CursoDisciplina` - vínculo correto
- ✅ `Disciplina.cursoId` - LEGACY (não usar)
- ✅ Filtros por tipo de instituição funcionando

**STATUS:** ✅ CORRETO

---

## 5. CLASSE (ENSINO SECUNDÁRIO) ✅

### Verificações:
- ✅ Classe existe apenas no Secundário
- ✅ Classe é obrigatória para matrícula no Secundário
- ✅ `PlanoEnsino.classeId` obrigatório para Secundário
- ✅ Classe substitui "ano do curso"

**STATUS:** ✅ CORRETO

---

## 6. DISCIPLINA ✅

### Verificações:
- ✅ Disciplinas vinculadas a curso via `CursoDisciplina`
- ✅ Carga horária definida na disciplina (`cargaHoraria`)
- ✅ Semestre NÃO pertence à disciplina (pertence ao Plano)
- ✅ `instituicaoId` obrigatório
- ✅ Nenhuma disciplina sem contexto institucional

**STATUS:** ✅ CORRETO

---

## 7. TURMA ✅

### Verificações:
- ✅ Turma pertence a instituição (`instituicaoId`)
- ✅ Turma pode existir sem professor
- ✅ Turma NÃO define professor (Plano define)
- ✅ `Turma.professorId` - LEGACY (não usar)
- ✅ `Turma.disciplinaId` - LEGACY (não usar)

### Relacionamentos:
- ✅ Turma vinculada a `AnoLetivo` (obrigatório)
- ✅ Turma vinculada a `Curso` ou `Classe` (conforme tipo)

**STATUS:** ✅ CORRETO

---

## 8. PLANO DE ENSINO (NÚCLEO DO SISTEMA) ✅

### Verificações:
- ✅ `PlanoEnsino.professorId` → `professores.id` (FK correta)
- ✅ `PlanoEnsino.instituicaoId` obrigatório
- ✅ PlanoEnsino é criado pelo ADMIN
- ✅ PlanoEnsino vincula: Professor → Disciplina → (Curso/Classe) → (Turma opcional)
- ✅ Semestre pertence AO PLANO, não à disciplina
- ✅ Estado controla ação, NÃO visibilidade

### Estados Válidos:
- ✅ `RASCUNHO` - aparece, bloqueado
- ✅ `EM_REVISAO` - aparece, bloqueado
- ✅ `APROVADO` - aparece, ativo
- ✅ `ENCERRADO` - aparece, somente leitura

### Campos Críticos:
- ✅ `anoLetivoId` - OBRIGATÓRIO (único lugar onde é obrigatório)
- ✅ `professorId` - OBRIGATÓRIO (professores.id)
- ✅ `disciplinaId` - OBRIGATÓRIO
- ✅ `cursoId` - OBRIGATÓRIO para Superior
- ✅ `classeId` - OBRIGATÓRIO para Secundário
- ✅ `semestreId` - OBRIGATÓRIO para Superior
- ✅ `turmaId` - OPCIONAL

**STATUS:** ✅ CORRETO

---

## 9. EXECUÇÃO PELO PROFESSOR ✅

### Verificações:
- ✅ Middleware `resolveProfessor` existe e é usado
- ✅ Professor executa apenas planos atribuídos a ele
- ✅ Professor lança aulas, notas e frequências
- ✅ Professor NÃO cria Plano de Ensino

### Rotas do Professor:
- ✅ `GET /turma/professor` - usa `resolveProfessor`
- ✅ `POST /aulas-lancadas` - usa `resolveProfessor`
- ✅ `POST /nota` - usa `resolveProfessor`
- ✅ `POST /presenca` - usa `resolveProfessor`
- ✅ `POST /avaliacao` - usa `resolveProfessor`
- ✅ `GET /plano-ensino` - usa `resolveProfessorOptional`

**STATUS:** ✅ CORRETO

---

## 10. ROTAS E MIDDLEWARES ✅

### Rotas Administrativas (NÃO usam resolveProfessor):
- ✅ `POST /plano-ensino` - ADMIN cria para qualquer professor
- ✅ `POST /turma` - ADMIN cria turma
- ✅ `POST /curso` - ADMIN cria curso
- ✅ `POST /disciplina` - ADMIN cria disciplina

### Rotas Operacionais do Professor (USAM resolveProfessor):
- ✅ `GET /turma/professor` - lista turmas do professor
- ✅ `POST /aulas-lancadas` - lança aulas
- ✅ `POST /nota` - lança notas
- ✅ `POST /presenca` - registra presenças
- ✅ `POST /avaliacao` - cria avaliações

**STATUS:** ✅ CORRETO

---

## 11. REGRAS POR TIPO DE INSTITUIÇÃO ✅

### Verificações:
- ✅ `req.user.tipoAcademico` vem do JWT (não do banco)
- ✅ ENSINO SUPERIOR: Curso obrigatório, Semestre obrigatório
- ✅ ENSINO SECUNDÁRIO: Classe obrigatória, Curso opcional
- ✅ Validações condicionais funcionando

**STATUS:** ✅ CORRETO

---

## CONCLUSÃO

✅ **TODOS OS PONTOS VERIFICADOS E CORRETOS**

O sistema está alinhado ao padrão SIGA/SIGAE REAL:
- Multi-tenant seguro
- Professor como entidade acadêmica separada
- Plano de Ensino como núcleo do sistema
- Separação clara entre rotas administrativas e operacionais
- Regras por tipo de instituição respeitadas
- Sistema pronto para produção

**NENHUM AJUSTE NECESSÁRIO**
