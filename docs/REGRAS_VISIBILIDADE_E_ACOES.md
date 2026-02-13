# Regras de Visibilidade e Ações

**Projeto:** DSICOLA  
**Padrão:** SIGA/SIGAE  
**Última atualização:** 2025-02

---

## Resumo das Regras Mestras

| # | Regra | O que controla |
|---|-------|----------------|
| 1 | **Plano de Ensino** | Fonte da verdade para atribuição (o que aparece) |
| 2 | **Estado do plano** | Ações permitidas (ativo/bloqueado/somente leitura) |
| 3 | **Calendário/períodos** | Fechamento de lançamentos (ano letivo, trimestre, semestre) |
| 4 | **Bloqueios institucionais** | Notas/documentos (política acadêmica/financeira) |

---

## 1. Plano de Ensino é a Fonte da Verdade (Atribuição)

**O que aparece** para o professor vem unicamente do Plano de Ensino:

- **Turmas** → planos com `turmaId` preenchido
- **Disciplinas** → planos com `disciplinaId`
- **Ano letivo** → `anoLetivoId` no plano

**Implementação:**
- `buscarTurmasProfessorComPlanos()` / `buscarTurmasEDisciplinasProfessorComPlanoAtivo()`
- `GET /turmas/professor` – Painel do Professor
- `GET /professor-disciplinas/me` – Minhas atribuições

**Sem Plano de Ensino** → não há disciplinas nem turmas atribuídas ao professor.

---

## 2. Estado do Plano Controla Ações

| Estado | Bloqueado? | Professor vê? | Pode agir? |
|--------|------------|---------------|------------|
| RASCUNHO | - | ✅ Sim | ❌ Não |
| EM_REVISAO | - | ✅ Sim | ❌ Não |
| APROVADO | ❌ Não | ✅ Sim | ✅ Sim |
| APROVADO | ✅ Sim | ✅ Sim | ❌ Não |
| ENCERRADO | - | ✅ Sim | ❌ Não (somente leitura) |

**Plano ATIVO** = `estado === 'APROVADO'` **e** `bloqueado === false`.

**Ações bloqueadas** sem plano ATIVO:
- Registrar aulas
- Marcar presenças
- Lançar notas
- Criar avaliações

**Implementação:**
- `validarPlanoEnsinoAtivo()` em `validacaoAcademica.service.ts`
- `usePlanoPermissoes()` no frontend
- `validarVinculoProfessorDisciplinaTurma()` quando há turma

---

## 3. Calendário/Períodos Podem Fechar Lançamentos

**Ano letivo encerrado** → bloqueia mutations em:
- Lançamento de aulas
- Presenças
- Notas
- Avaliações
- Plano de ensino (criar/editar)

**Trimestre/Semestre encerrado** → bloqueia:
- Notas do trimestre
- Correção de notas (exceto ADMIN com justificativa)

**Implementação:**
- `bloquearAnoLetivoEncerrado` middleware
- `verificarTrimestreEncerrado()` em `encerramentoAcademico.controller.ts`
- `verificarAnoEncerrado()` em `encerramentoAcademico.controller.ts`

---

## 4. Bloqueios Acadêmico/Financeiro impedem Notas/Documentos

**Política depende da configuração institucional:**

| Bloqueio | O que impede | Onde |
|----------|--------------|------|
| **Acadêmico** | Notas, presenças, relatórios | `bloqueioAcademico.service.ts` |
| **Financeiro** | Documentos, certificados | `relatoriosOficiais.service.ts`, `nota.controller.ts` |

**Implementação:**
- `verificarBloqueioAcademico()` / `validarBloqueioAcademicoInstitucionalOuErro()`
- `bloqueioAcademico.service.ts`
- `bloqueio-academico` API (configuração e verificação)

---

## Hierarquia de Bloqueios

```
1. Plano de Ensino ATIVO? (estado + bloqueado)
   └─ Não → Nenhuma ação pedagógica
   └─ Sim → Continua
2. Ano letivo ENCERRADO?
   └─ Sim → Nenhuma mutation
   └─ Não → Continua
3. Trimestre/Semestre ENCERRADO?
   └─ Sim → Bloqueia notas (ADMIN pode corrigir com justificativa)
   └─ Não → Continua
4. Bloqueio acadêmico/financeiro institucional?
   └─ Sim → Bloqueia conforme política
   └─ Não → Ação permitida
```

---

## Referências no Código

| Regra | Backend | Frontend |
|-------|---------|----------|
| Plano = fonte | `validacaoAcademica.service.ts` | `ProfessorDashboard` |
| Estado = ações | `validarPlanoEnsinoAtivo()` | `usePlanoPermissoes` |
| Períodos | `bloquearAnoLetivoEncerrado.middleware` | `useAnoLetivoAtivo` |
| Bloqueios | `bloqueioAcademico.service.ts` | Configuração |
