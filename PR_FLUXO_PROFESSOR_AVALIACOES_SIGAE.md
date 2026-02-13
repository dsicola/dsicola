# PR: Fluxo Professor em Avaliações e Notas — Padrão SIGAE

## Objetivo
Ajustar o fluxo do PROFESSOR em "Avaliações e Notas" para o padrão SIGAE, com o mínimo de mudanças e zero quebra.

## Arquivos alterados

### Backend
| Arquivo | Alterações |
|---------|------------|
| `backend/src/controllers/turma.controller.ts` | Retorno `GET /turmas/professor`: sempre incluir `anoLetivoAtivo` em todos os retornos (sucesso e erro); cada item já tem `planoEnsinoId`, `disciplinaId`, `turmaId`, `cursoId`, `semestre`, `estadoPlano`, `bloqueado`, `podeLancarNota`, `podeLancarNotas` (alias), `podeRegistrarAula`, `podeMarcarPresenca`, `motivoBloqueio` |
| `backend/src/controllers/avaliacao.controller.ts` | Validação: plano sem turma retorna 400 "Plano sem turma alocada. Aguarde a atribuição de turma antes de criar avaliações." |
| `backend/src/routes/nota.routes.ts` | Adicionado `resolveProfessorOptional` em GET `/notas/turma/alunos` para garantir validação de acesso à turma via Plano de Ensino |
| `backend/src/controllers/nota.controller.ts` | `getAlunosNotasByTurma`: professor sem `req.professor.id` retorna []; validação via Plano de Ensino obrigatória para professor |

### Frontend
| Arquivo | Alterações |
|---------|------------|
| `frontend/src/pages/admin/AvaliacoesNotas.tsx` | Fluxo SIGAE para Professor: dropdown único "Turma/Disciplina (do meu Plano de Ensino)" unificando turmas + disciplinasSemTurma; carregamento via `getTurmasProfessor()`; estado vazio com CTA; disciplinas sem turma exibidas com "(Aguardando alocação de turma)"; bloqueio de ações quando `podeLancarNota` = false |
| `frontend/src/pages/professor/GestaoNotas.tsx` | Bloqueio por `podeLancarNota`/`podeLancarNotas`: inputs desabilitados, botão Salvar desabilitado e Alert quando plano bloqueado; exibição de `motivoBloqueio` no dropdown; label ajustado para `disciplinaNome` |

## Rotas afetadas

| Rota | Método | Alteração |
|------|--------|-----------|
| `/api/turmas/professor` | GET | Sempre retorna `anoLetivoAtivo: { id, ano }` (ou null em erros); itens com `podeLancarNota`, `motivoBloqueio` |
| `/api/notas/turma/alunos` | GET | `resolveProfessorOptional` aplicado; professor sem vínculo via Plano retorna [] |
| `/admin-dashboard/avaliacoes-notas` | — | Professor: dropdown único; Admin/Secretaria: fluxo completo |
| `/painel-professor/notas` | — | Bloqueio por `podeLancarNota`; inputs e botão desabilitados quando plano não aprovado |

## Como testar manualmente (5 passos)

1. **Professor sem plano**
   - Login como professor sem atribuições no Plano de Ensino
   - Acesse "Avaliações e Notas" (/admin-dashboard/avaliacoes-notas) ou "Lançar Notas" (/painel-professor/notas)
   - Verifique: dropdown mostra "Sem atribuições no Plano de Ensino" e CTA orientativa

2. **Professor com plano aprovado e turma**
   - Login como professor com plano APROVADO e turma vinculada
   - Acesse "Avaliações e Notas"
   - Verifique: dropdown lista turma/disciplina; ao selecionar, avaliações aparecem; botão "Nova Avaliação" ativo

3. **Professor com plano aprovado sem turma**
   - Login como professor com plano APROVADO mas sem turma
   - Verifique: item aparece no dropdown com "(Aguardando alocação de turma)"; ao selecionar, avaliações listadas (consulta); botão "Nova Avaliação" desativado

4. **Professor com plano bloqueado**
   - Login como professor com plano bloqueado ou em RASCUNHO/EM_REVISAO
   - Verifique: turma aparece no dropdown com indicação de bloqueio; ao selecionar, avaliações existentes visíveis; botão "Nova Avaliação" desativado

5. **Admin — compatibilidade e dashboard**
   - Login como ADMIN: acesse "Avaliações e Notas" e verifique fluxo completo (Curso/Classe, Disciplina, Professor, Turma) mantido
   - Login como professor com planos: acesse dashboard e verifique que turmas/disciplinas listadas vêm do Plano de Ensino (não aparece "Nenhuma atribuição" quando existe no banco)

## Regras garantidas

- **Multi-tenant:** todas as queries filtram por `req.user.instituicaoId`
- **Professor:** não seleciona Professor nem Curso; contexto vem do Plano de Ensino
- **Backend:** `instituicaoId` e `professorId` extraídos do JWT (nunca do frontend)
- **Sem plano:** retorno 200 com arrays vazios (estado válido)
- **Ensino Secundário:** comportamento preservado (condicionado por `req.user.tipoAcademico`)
