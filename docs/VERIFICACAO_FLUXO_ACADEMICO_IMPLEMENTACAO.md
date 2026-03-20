# Verificação: Manual vs Sistema — Fluxo Acadêmico

**Objetivo:** Comparar cada instrução do manual (`FLUXO_ACADEMICO_COMPLETO_PASSO_A_PASSO.md`) com o comportamento real do sistema (código frontend + backend).

**Data:** 2026-03-13

---

## Metodologia

Para cada passo do manual:
- **Instrução** = o que o manual diz fazer
- **Sistema** = o que o código faz quando o utilizador segue a instrução
- **Evidência** = ficheiro e linha de código
- **Resultado** = ✅ Igual | ⚠️ Pequena diferença | ❌ Diferente

---

## Passo 1 — Atribuição de Disciplinas

| # | Instrução do manual | O que o sistema faz | Evidência | Resultado |
|---|----------------------|---------------------|----------|-----------|
| 1 | Clique em **Gestão de Professores** | Menu lateral → Gestão de Professores | `GestaoProfessores.tsx` — página principal | ✅ |
| 2 | Clique na aba **Atribuição de Disciplinas** | Aba "Atribuição de Disciplinas" existe | `GestaoProfessores.tsx:29` — `<span>Atribuição de Disciplinas</span>` | ✅ |
| 3 | Preencha Professor, Disciplina, Curso/Classe, Ano Letivo, Turma, Semestre | Formulário tem todos estes campos | `AtribuicaoDisciplinasTab.tsx:401-590` — SmartSearch professor, Select disciplina, curso/classe, AnoLetivoSelect, turma, semestre | ✅ |
| 4 | Clique em **Atribuir** ou **Criar Plano de Ensino** | Botão diz **"Atribuir"** (não "Criar Plano de Ensino") | `AtribuicaoDisciplinasTab.tsx:614` — `<Button>Atribuir</Button>` | ⚠️ Manual diz "ou Criar Plano de Ensino" — no sistema o botão é só "Atribuir" |
| 5 | Resultado: Plano em estado **RASCUNHO** | `createOrGetPlanoEnsino` cria plano; schema tem `estado @default(RASCUNHO)` | `planoEnsino.controller.ts:73` — `createOrGetPlanoEnsino`; `schema.prisma:3436` — `estado EstadoRegistro @default(RASCUNHO)` | ✅ |

---

## Passo 2 — Plano de Ensino

| # | Instrução do manual | O que o sistema faz | Evidência | Resultado |
|---|----------------------|---------------------|----------|-----------|
| 1 | Aceda a **Configuração de Ensinos** → **Plano de Ensino** | Aba existe em ConfiguracaoEnsino | `ConfiguracaoEnsino.tsx` — Tabs incluem plano-ensino | ✅ |
| 2 | Selecione contexto (Curso/Classe, Disciplina, Professor, Ano Letivo, Turma) | PlanoEnsinoTab tem seletores de contexto | `PlanoEnsinoTab.tsx` — contexto partilhado | ✅ |
| 3 | Clique em **Nova Aula**, preencha Título, Tipo, Trimestre/Semestre, Quantidade de Aulas | PlanejarTab tem formulário com estes campos | `PlanejarTab.tsx` — PlanoAula com titulo, tipo, trimestre, quantidadeAulas | ✅ |
| 4 | Clique em **Submeter** ou **Enviar para aprovação** | Botão diz **"Submeter para Aprovação"** | `WorkflowActions.tsx:178` — `Submeter para Aprovação` | ✅ |
| 5 | Estado passa a **PENDENTE_APROVACAO** | Estado passa a **SUBMETIDO** (status) e **EM_REVISAO** (estado) | `workflow.controller.ts:90-91` — `novoStatus === 'SUBMETIDO'` → `estado = 'EM_REVISAO'` | ⚠️ Manual diz "PENDENTE_APROVACAO" — sistema usa **SUBMETIDO** |
| 6 | Admin clica em **Aprovar** | WorkflowActions mostra botão Aprovar quando status=SUBMETIDO | `WorkflowActions.tsx:52` — `podeAprovar = statusAtual === 'SUBMETIDO'` | ✅ |
| 7 | Estado passa a **APROVADO** | `workflow.controller` atualiza status e estado para APROVADO | `workflow.controller.ts:86-87` — `updateData.estado = 'APROVADO'` | ✅ |

---

## Passo 3 — Horários

| # | Instrução do manual | O que o sistema faz | Evidência | Resultado |
|---|----------------------|---------------------|----------|-----------|
| 1 | Clique em **Gestão Acadêmica** → **Horários** | GestaoAcademica tem aba Horários | `GestaoAcademica.tsx:232` — `<HorariosTab />` | ✅ |
| 2 | Selecione a **Turma** | Dropdown para selecionar turma | `HorariosTab.tsx:136` — `selectedTurma`, `turmas` | ✅ |
| 3 | Sistema mostra Planos de Ensino da turma | `planosRaw` busca planos por `turmaId` | `HorariosTab.tsx:158-166` — `planoEnsinoApi.getAll({ turmaId: selectedTurma })` | ✅ |
| 4 | Adicionar horário: Plano de Ensino, Dia, Hora início/fim, Sala | Formulário com `plano_ensino_id`, `dia_semana`, `hora_inicio`, `hora_fim`, `sala` | `HorariosTab.tsx:137-143` — formData | ✅ |
| 5 | Clique em **Salvar** | `createHorarioMutation` chama `horariosApi.create` | `HorariosTab.tsx:179-194` | ✅ |
| 6 | **Obter sugestões** (opcional) | Secção "Sugestões Automáticas de Horários" existe | `HorariosTab.tsx:447` — "Sugestões Automáticas de Horários" | ✅ |
| 7 | Professor vê em **Painel Professor → Horários** | HorariosProfessor usa `horariosApi.getGradeProfessor` | `HorariosProfessor.tsx` — `horariosApi.getGradeProfessor(professorId)` | ✅ |

---

## Passo 4 — Distribuição de Aulas

| # | Instrução do manual | O que o sistema faz | Evidência | Resultado |
|---|----------------------|---------------------|----------|-----------|
| 1 | Aceda a **Configuração de Ensinos** → **Distribuição de Aulas** | Aba existe | `ConfiguracaoEnsino.tsx` — distribuicao-aulas | ✅ |
| 2 | Selecione contexto (Curso/Classe, Disciplina, Professor, Ano Letivo, Turma) | DistribuicaoAulasTab usa sharedContext | `DistribuicaoAulasTab.tsx` | ✅ |
| 3 | Configure **Data de Início** e **Dias da Semana** | Formulário com dataInicio e diasSemana | `distribuicaoAulas.controller.ts:17` — `dataInicio`, `diasSemana` | ✅ |
| 4 | Dias podem vir do Horário automaticamente | Backend busca `horariosDoPlano` e usa `diasDoHorario` se existirem | `distribuicaoAulas.controller.ts:57-70` — prioriza dias do Horário | ✅ |
| 5 | Clique em **Gerar Distribuição Automática** | POST `/distribuicao-aulas/gerar` | `distribuicaoAulas.controller.ts:11` — `gerarDistribuicao` | ✅ |
| 6 | Plano deve estar **APROVADO** | Backend valida `plano.status === 'APROVADO' \|\| plano.estado === 'APROVADO'` | `distribuicaoAulas.controller.ts:44-54` | ✅ |
| 7 | Sistema ignora feriados | Busca `feriados` em eventoCalendario e exclui | `distribuicaoAulas.controller.ts:90-98` | ✅ |

---

## Passo 5 — Lançamento de Aulas

| # | Instrução do manual | O que o sistema faz | Evidência | Resultado |
|---|----------------------|---------------------|----------|-----------|
| 1 | Aceda a **Configuração de Ensinos** → **Lançamento de Aulas** | Aba existe | `ConfiguracaoEnsino.tsx` — lancamento-aulas | ✅ |
| 2 | Selecione contexto | LancamentoAulasTab usa sharedContext | `LancamentoAulasTab.tsx:75-84` | ✅ |
| 3 | Ver lista de aulas com datas distribuídas | `getAulasPlanejadas` retorna aulas com `distribuicoes`, `datasDistribuidas` | `aulasLancadas.controller.ts:82-97` — include distribuicoes | ✅ |
| 4 | Clique em **Lançar Aula** | Botão "Lançar Aula" existe | `LancamentoAulasTab.tsx:664` — `Lançar Aula` | ✅ |
| 5 | Escolha **Data Real** | Dialog "Lançar Aula como Ministrada" com input de data | `LancamentoAulasTab.tsx:698` — DialogTitle | ✅ |
| 6 | Clique em **Confirmar** | Mutation chama API para criar aula lançada | `aulasLancadas.controller.ts` — createAulaLancada | ✅ |
| 7 | Aula muda de "Planejada" para "Ministrada" | Badge mostra "Ministrada" vs "Planejada" | `LancamentoAulasTab.tsx:613-619` — status MINISTRADA/PLANEJADA | ✅ |
| 8 | Validação: distribuição obrigatória antes | Backend lança erro se não houver distribuição | `aulasLancadas.controller.ts:356` — "É necessário distribuir as aulas antes de realizar lançamentos" | ✅ |

---

## Passo 6 — Controle de Presenças

| # | Instrução do manual | O que o sistema faz | Evidência | Resultado |
|---|----------------------|---------------------|----------|-----------|
| 1 | Aceda a **Configuração de Ensinos** → **Controle de Presenças** | Aba existe | `ConfiguracaoEnsino.tsx` — controle-presencas | ✅ |
| 2 | Selecione aula lançada (só aparecem ministradas) | Lista de aulas lançadas/ministradas | `ControlePresencasTab.tsx` — aulas do plano com status ministrada | ✅ |
| 3 | Estados: **Presente**, **Ausente**, **Justificado** | Badges e botões com estes valores | `ControlePresencasTab.tsx:441-444, 941-958` — PRESENTE, AUSENTE, JUSTIFICADO | ✅ |
| 4 | Clique em **Salvar Presenças** | Botão "Salvar Presenças" | `ControlePresencasTab.tsx:988` — `Salvar Presenças` | ✅ |
| 5 | Sistema calcula frequência | `frequencia.service.ts` — `calcularFrequenciaAluno` | `frequencia.service.ts` | ✅ |

---

## Passo 7 — Avaliações e notas (disciplina)

| # | Instrução do manual | O que o sistema faz | Evidência | Resultado |
|---|----------------------|---------------------|----------|-----------|
| 1 | Aceda a **Avaliações e notas (disciplina)** → separador **Avaliações** | AvaliacoesNotasTab tem tabs | `AvaliacoesNotasTab.tsx` | ✅ |
| 2 | **Nova Avaliação**: Tipo, Trimestre/Semestre, Data, Peso | Formulário de criação de avaliação | `avaliacao.controller.ts` — createAvaliacao | ✅ |
| 3 | **Lançamento de Notas** (tab): para cada aluno | Interface de lançamento por avaliação | `nota.controller.ts` | ✅ |
| 4 | Frequência < 75% → aluno **bloqueado** | `bloqueado: !temFrequenciaMinima` (75%) | `nota.controller.ts:2734-2761` — `temFrequenciaMinima = frequenciaPercentual >= 75` | ✅ |
| 5 | Nota de 0 a 20 | Validação de valor da nota | `nota.controller.ts` — validação de valor | ✅ |

---

## Bloqueio de abas e fluxo obrigatório

| Instrução do manual | O que o sistema faz | Evidência | Resultado |
|---------------------|---------------------|----------|-----------|
| Sistema bloqueia abas quando pré-requisitos não cumpridos | `isTabBlocked()` bloqueia plano-ensino sem calendário; distribuição/lançamento/presenças/notas sem contexto | `ConfiguracaoEnsino.tsx:138-159` | ✅ |
| Calendário obrigatório para Distribuição | Backend exige `calendarioAtivo` | `distribuicaoAulas.controller.ts:79-88` | ✅ |

---

## Resumo de discrepâncias (Manual vs Sistema)

| Item | Manual diz | Sistema faz | Ação sugerida |
|------|------------|-------------|---------------|
| Passo 1, botão | "Atribuir ou Criar Plano de Ensino" | Botão diz só **"Atribuir"** | Manual pode manter "ou Criar Plano de Ensino" como alternativa conceptual, ou simplificar para "Atribuir" |
| Passo 2, estado após submeter | "PENDENTE_APROVACAO" | **SUBMETIDO** (status) / **EM_REVISAO** (estado) | Corrigir manual para "SUBMETIDO" ou "aguardando aprovação" |

---

## Conclusão

O sistema **implementa** o fluxo descrito no manual. As diferenças são pequenas (nomes de botões e estados). O comportamento funcional é o mesmo: atribuir → planejar → submeter → aprovar → horários → distribuir → lançar aulas → presenças → notas, com bloqueios e validações conforme descrito.
