# Auditoria: Sincronização Plano de Ensino ↔ Professores ↔ Estudantes ↔ Multi-tenant ↔ Tipos de Instituição

**Data:** 2025-03-02  
**Sistema:** DSICOLA (ERP educacional, padrão SIGA/SIGAE)

---

## 1. Plano de Ensino ↔ Professores

### Schema
- `PlanoEnsino.professorId` → `Professor.id` (tabela `professores`)
- `Professor.instituicaoId` → `Instituicao.id`

### Fluxo
- **Criação:** Apenas ADMIN/SUPER_ADMIN criam planos via Atribuição de Disciplinas
- **Validação:** `validateProfessorId(professorId, instituicaoId)` garante que o professor pertence à instituição
- **Consulta:** Professor vê apenas seus planos (`req.professor.id`); Admin vê por `instituicaoId` do JWT

### Endpoints verificados
| Endpoint | Multi-tenant | Professor |
|----------|--------------|-----------|
| GET /plano-ensino | `filter.instituicaoId` | `professorIdFinal = req.professor.id` |
| POST /plano-ensino | `requireTenantScope`, `instituicaoId` no create | `validateProfessorId` |
| Horários | `instituicaoId` no where | `professorIdFilter` para PROFESSOR |

**Status:** ✅ Sincronizado

---

## 2. Plano de Ensino ↔ Estudantes

### Modelos
- **Nota:** `planoEnsinoId` obrigatório — nota sempre vinculada ao Plano
- **HistoricoAcademico:** `planoEnsinoId` — snapshot no encerramento
- **AlunoDisciplina:** aluno ↔ disciplina ↔ turma ↔ ano (matrícula)
- **getPlanoEnsino (aluno):** Aluno só vê planos APROVADOS se matriculado em `AlunoDisciplina` (disciplinaId, ano)

### Fluxo
- Estudante matricula em disciplina (AlunoDisciplina)
- Turma tem Planos de Ensino (PlanoEnsino.turmaId)
- Notas e histórico vinculam ao Plano de Ensino

**Status:** ✅ Sincronizado

---

## 3. Multi-tenant

### Princípio
- `instituicaoId` vem **exclusivamente** do JWT (token)
- **Proibido** confiar em `instituicaoId` do body ou query (exceto SUPER_ADMIN com validação)

### Entidades verificadas
| Entidade | instituicaoId | Filtro |
|----------|---------------|--------|
| PlanoEnsino | ✅ Obrigatório | `addInstitutionFilter(req)` |
| Horario | ✅ Obrigatório | `requireTenantScope`, `where.instituicaoId` |
| DistribuicaoAula | ✅ Obrigatório | `requireTenantScope`, `filter` |
| Professor | ✅ Obrigatório | `instituicaoId` no where |
| Turma, Disciplina, AnoLetivo | ✅ | `filter` em todas as queries |

### Frontend
- `useTenantFilter()`: `instituicaoId` do user (JWT)
- APIs **não** enviam `instituicaoId` — backend usa token

**Status:** ✅ Sincronizado

---

## 4. Dois tipos de instituição (Superior / Secundário)

### Enums
- **TipoInstituicao:** ENSINO_MEDIO, UNIVERSIDADE, MISTA, EM_CONFIGURACAO
- **TipoAcademico:** SECUNDARIO, SUPERIOR (identificado automaticamente)

### Frontend
- `useInstituicao()`: `isSuperior`, `isSecundario`, `tipoAcademico`
- **DistribuicaoAulasTab:** cursos (Superior) ou classes (Secundário)
- **PlanoEnsinoTab:** semestre (Superior) ou classeOuAno (Secundário)

### Backend
- **Horário:** `validarBlocoPorTipoInstituicao` — SECUNDARIO = blocos fixos (ex: 45 min)
- **PlanoEnsino:** `semestre` / `semestreId` (Superior), `classeOuAno` (Secundário)

**Status:** ✅ Sincronizado

---

## 5. Fluxo Configuração de Ensino (sharedContext)

### Contexto compartilhado entre abas
```typescript
{ cursoId?, classeId?, disciplinaId?, professorId?, anoLetivo?, turmaId? }
```

- **PlanoEnsinoTab** → busca plano por contexto
- **DistribuicaoAulasTab** → usa plano para dias (Horário) e distribuição
- **LancamentoAulasTab**, **ControlePresencasTab**, **AvaliacoesNotasTab** → mesmo contexto

### instituicaoId
- **Não** incluído no sharedContext — vem do JWT em todas as requisições
- Cada chamada API usa token; backend aplica `requireTenantScope` ou `addInstitutionFilter`

**Status:** ✅ Sincronizado

---

## 6. Resumo

| Área | Status |
|------|--------|
| Plano de Ensino ↔ Professores | ✅ |
| Plano de Ensino ↔ Estudantes | ✅ |
| Multi-tenant (instituicaoId) | ✅ |
| Tipos de instituição (Superior/Secundário) | ✅ |
| Fluxo sharedContext | ✅ |

**Conclusão:** O sistema está sincronizado com Plano de Ensino, Professores, Estudantes, multi-tenant e os dois tipos de instituição (Superior/Secundário). Não foram identificadas lacunas críticas.
