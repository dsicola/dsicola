# Distribuição de Horários aos Professores — Passo a Passo

**Guia didático para Admin/Direção/Secretaria**  
Este documento ensina como atribuir horários (dia da semana, hora, sala) aos professores no DSICOLA.

---

## Índice

1. [O que é a distribuição de horários?](#1-o-que-é-a-distribuição-de-horários)
2. [Pré-requisitos](#2-pré-requisitos)
3. [Passo a passo — Admin](#3-passo-a-passo--admin)
4. [Sugestões automáticas](#4-sugestões-automáticas)
5. [Aprovação e impressão](#5-aprovação-e-impressão)
6. [Visualização pelo professor](#6-visualização-pelo-professor)
7. [Relação com Distribuição de Aulas](#7-relação-com-distribuição-de-aulas)
8. [Resolução de problemas](#8-resolução-de-problemas)

---

## 1. O que é a distribuição de horários?

O **horário** define **quando** cada professor leciona cada disciplina em cada turma:

- **Dia da semana** (Segunda, Terça, etc.)
- **Hora de início e fim** (ex.: 08:00–08:45)
- **Sala** (opcional)

Cada horário está ligado a um **Plano de Ensino** (Professor + Disciplina + Turma). Ao criar horários, o sistema distribui os blocos de aula aos professores.

**Diferença importante:**
- **Horários** = grade semanal (ex.: Matemática às Segundas 08:00–08:45)
- **Distribuição de Aulas** = datas concretas no calendário (ex.: 05/02, 07/02, 12/02…)

---

## 2. Pré-requisitos

Antes de distribuir horários, verifique:

| Item | Onde configurar |
|------|-----------------|
| Ano letivo ativo | Gestão Acadêmica → Anos Letivos |
| Cursos e Classes (Secundário) ou Cursos (Superior) | Gestão Acadêmica → Cursos / Classes |
| Turmas | Gestão Acadêmica → Turmas |
| Disciplinas | Gestão Acadêmica → Disciplinas |
| Professores | Gestão de Professores |
| **Atribuição Professor–Disciplina–Turma** | Gestão Acadêmica → Atribuição de Disciplinas (cria Plano de Ensino) |
| Plano de Ensino **aprovado** | Plano de Ensino → submeter e aprovar |
| Salas (opcional) | Gestão Acadêmica → Salas |
| Parâmetros (duração hora-aula, intervalos) | Configurações → Parâmetros do Sistema |

**Regra:** Só aparecem na lista de horários os **Planos de Ensino** que têm `turmaId` preenchido e estado **APROVADO**.

---

## 3. Passo a passo — Admin

### Passo 3.1 — Aceder ao módulo de Horários

1. No menu lateral, clique em **Gestão Acadêmica**.
2. Clique na aba **Horários** (ícone de relógio).
3. A página abre com o seletor de turma no topo.

### Passo 3.2 — Selecionar a turma

1. No dropdown **Turma** (ou **Classe**, no Secundário), selecione a turma para a qual quer definir horários.
2. O sistema carrega:
   - Os **Planos de Ensino** da turma (disciplina + professor)
   - Os **horários já cadastrados** (se existirem)

### Passo 3.3 — Adicionar horário manualmente

1. Clique em **Adicionar horário** (ou **Novo horário**).
2. Preencha:
   - **Plano de Ensino** — selecione a disciplina e o professor (ex.: Matemática – Prof. João)
   - **Dia da semana** — Segunda, Terça, Quarta, etc.
   - **Hora início** e **Hora fim** — use os blocos sugeridos (45 min no Secundário, 60 min no Superior) ou digite manualmente
   - **Sala** (opcional)
3. Clique em **Salvar** ou **Adicionar**.

**Exemplo:** Matemática, Segunda-feira, 08:00–08:45, Sala 101.

### Passo 3.4 — Repetir para todas as disciplinas

Para cada disciplina da turma, adicione os horários necessários. O sistema valida:

- **Conflitos de professor** — o mesmo professor não pode ter duas aulas no mesmo dia e hora
- **Conflitos de sala** — a mesma sala não pode estar ocupada duas vezes no mesmo bloco
- **Duração da hora-aula** — no Secundário, blocos de 45 min; no Superior, 60 min (ou conforme parâmetros)

---

## 4. Sugestões automáticas

Para acelerar o preenchimento, use as **sugestões**:

1. Com a turma selecionada, clique em **Obter sugestões** (ou ícone de estrela).
2. Selecione o **turno** (manhã, tarde ou noite), se aplicável.
3. O sistema gera sugestões considerando:
   - Planos de Ensino sem horário
   - Dias em que o professor não está indisponível (`diasIndisponiveis`)
   - Blocos livres (sem conflito de professor ou sala)
   - Limite de aulas consecutivas por professor
4. Revise as sugestões e clique em **Aplicar sugestões** ou **Criar em lote** para gravar.

**Nota:** As sugestões são semi-automáticas. O admin pode ajustar manualmente depois.

---

## 5. Aprovação e impressão

### Aprovar horários

1. Após criar os horários, cada um fica em estado **Rascunho**.
2. Para aprovar, clique no ícone **Aprovar** (cadeado ou check) em cada horário, ou use a ação em lote se existir.
3. Horários aprovados não podem ser editados (apenas visualizados). Para alterar, é necessário desaprovar (se o sistema permitir) ou criar novos.

### Imprimir horário da turma

1. Com a turma selecionada, clique em **Imprimir** ou **Exportar PDF**.
2. O sistema gera um PDF com a grade da turma (todos os horários da semana).

### Imprimir horário do professor

1. Aceda a **Gestão de Professores** (ou ao perfil do professor).
2. Use a opção **Imprimir horário** do professor.
3. Ou: o professor pode imprimir o próprio horário em **Painel Professor → Horários**.

---

## 6. Visualização pelo professor

1. O professor faz login e acede ao **Painel Professor**.
2. No menu, clica em **Horários** (ou **Meus Horários**).
3. O sistema mostra a **grade semanal** com todas as disciplinas e turmas do professor.
4. O professor pode **imprimir** o horário em PDF.

**Restrição:** O professor **não pode** criar, editar ou aprovar horários. Apenas visualiza.

---

## 7. Relação com Distribuição de Aulas

A **Distribuição de Aulas** (Configuração de Ensinos → Distribuição de Aulas) usa os **dias da semana** do Horário para gerar as datas no calendário:

1. Se o Horário estiver cadastrado (ex.: Segunda e Quarta), a Distribuição de Aulas usa esses dias automaticamente.
2. Se não houver Horário, o admin deve selecionar os dias manualmente ao gerar a distribuição.
3. **Ordem recomendada:** Primeiro cadastrar Horários, depois gerar Distribuição de Aulas.

---

## 8. Resolução de problemas

| Problema | Solução |
|----------|---------|
| Nenhum Plano de Ensino aparece | Verifique a Atribuição de Disciplinas. O plano deve ter `turmaId` e estar **APROVADO**. |
| "Conflito de professor" | O professor já tem aula nesse dia e hora. Escolha outro bloco. |
| "Conflito de sala" | A sala está ocupada. Escolha outra sala ou outro bloco. |
| Bloco inválido (Secundário) | No Secundário, a duração padrão é 45 min. Use blocos de 45 min (ex.: 08:00–08:45). |
| Professor não vê horário | Verifique se o Plano de Ensino está aprovado e se o professor está correto no token (professorId). |
| Sugestões vazias | Pode não haver blocos livres ou os professores têm muitos dias indisponíveis. Tente outro turno. |

---

## Resumo rápido

| Ação | Onde |
|------|------|
| Atribuir professor a disciplina/turma | Gestão Acadêmica → Atribuição de Disciplinas |
| Aprovar plano de ensino | Plano de Ensino → Submeter → Admin aprova |
| Cadastrar horários | Gestão Acadêmica → Horários → Selecionar turma → Adicionar |
| Usar sugestões | Horários → Obter sugestões → Aplicar |
| Imprimir grade da turma | Horários → Imprimir |
| Professor ver horário | Painel Professor → Horários |

---

## Documentos relacionados

- [COMO_ATRIBUIR_PROFESSORES.md](../COMO_ATRIBUIR_PROFESSORES.md) — Atribuição de professores a turmas e disciplinas
- [GUIA_PROFESSOR_CONFIGURACAO_ENSINOS.md](../GUIA_PROFESSOR_CONFIGURACAO_ENSINOS.md) — Fluxo completo do professor (Plano → Distribuição → Lançamento → Presenças → Notas)
- [VERIFICACAO_HORARIOS_MULTITENANT_TIPOS.md](VERIFICACAO_HORARIOS_MULTITENANT_TIPOS.md) — Detalhes técnicos e multi-tenant
