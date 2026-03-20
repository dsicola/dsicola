# Fluxo Acadêmico Completo — Passo a Passo

**Guia didático para Admin, Direção e Professores**  
Este documento ensina o fluxo completo desde a atribuição de professores até às notas, como se estivesse numa formação.

---

## Índice

1. [Visão geral e ordem obrigatória](#1-visão-geral-e-ordem-obrigatória)
2. [Pré-requisitos (configuração inicial)](#2-pré-requisitos-configuração-inicial)
3. [Passo 1 — Atribuição de Disciplinas](#3-passo-1--atribuição-de-disciplinas)
4. [Passo 2 — Plano de Ensino](#4-passo-2--plano-de-ensino)
5. [Passo 3 — Horários](#5-passo-3--horários)
6. [Passo 4 — Distribuição de Aulas](#6-passo-4--distribuição-de-aulas)
7. [Passo 5 — Lançamento de Aulas](#7-passo-5--lançamento-de-aulas)
8. [Passo 6 — Controle de Presenças](#8-passo-6--controle-de-presenças)
9. [Passo 7 — Avaliações e notas (disciplina)](#9-passo-7-avaliacoes-notas-disciplina)
10. [Resumo do fluxo e resolução de problemas](#10-resumo-do-fluxo-e-resolução-de-problemas)

---

## 1. Visão geral e ordem obrigatória

O sistema DSICOLA segue um **fluxo académico obrigatório**. Não é possível saltar etapas — o sistema bloqueia automaticamente as abas quando os pré-requisitos não foram cumpridos.

### Diagrama do fluxo

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PRÉ-REQUISITOS (Admin/Direção)                                         │
│  Ano letivo, Cursos, Turmas, Disciplinas, Professores, Calendário        │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  PASSO 1 — Atribuição de Disciplinas (Admin)                            │
│  Gestão de Professores → Atribuição de Disciplinas                      │
│  Cria Plano de Ensino (Professor + Disciplina + Turma)                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  PASSO 2 — Plano de Ensino (Professor + Admin)                          │
│  Configuração de Ensinos → Plano de Ensino                              │
│  Planejar: adicionar aulas/tópicos → Submeter → Admin aprova            │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  PASSO 3 — Horários (Admin)                                             │
│  Gestão Acadêmica → Horários                                            │
│  Atribuir dia da semana, hora e sala a cada Plano de Ensino             │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  PASSO 4 — Distribuição de Aulas (Admin/Professor)                      │
│  Configuração de Ensinos → Distribuição de Aulas                        │
│  Gerar datas no calendário (usa dias do Horário)                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  PASSO 5 — Lançamento de Aulas (Professor)                              │
│  Configuração de Ensinos → Lançamento de Aulas                          │
│  Marcar cada aula como "Ministrada" quando for dada                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  PASSO 6 — Controle de Presenças (Professor)                            │
│  Configuração de Ensinos → Controle de Presenças                        │
│  Registar Presente/Ausente/Justificado por aluno e por aula             │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  PASSO 7 — Avaliações e notas (disciplina) (Professor)                  │
│  Configuração de Ensinos → Avaliações e notas (disciplina)             │
│  Criar avaliações → Lançar notas (alunos com ≥75% frequência)           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Pré-requisitos (configuração inicial)

**Quem faz:** Admin ou Direção

Antes de iniciar o fluxo, verifique que está tudo configurado:

| Item | Onde configurar |
|------|-----------------|
| Ano letivo ativo | Configuração de Ensinos → Anos Letivos (ou Gestão Acadêmica) |
| Cursos | Gestão Acadêmica → Cursos |
| Classes (Secundário) | Gestão Acadêmica → Classes |
| Turmas | Gestão Acadêmica → Turmas |
| Disciplinas | Gestão Acadêmica → Disciplinas |
| Professores | Gestão de Professores |
| Calendário Acadêmico | Configuração de Ensinos → Calendário Acadêmico (feriados, férias) |
| Trimestres (Secundário) ou Semestres (Superior) | Configuração de Ensinos |

**Importante:** O calendário com feriados é obrigatório para a Distribuição de Aulas. Sem ele, o sistema não consegue gerar as datas.

---

## 3. Passo 1 — Atribuição de Disciplinas

**Quem faz:** Admin  
**Onde:** Gestão de Professores → Atribuição de Disciplinas

### O que é?

A atribuição cria o **Plano de Ensino** que liga um professor a uma disciplina e a uma turma. Sem isto, o professor não aparece nas turmas e não pode lecionar.

### Passo a passo

1. No menu lateral, clique em **Gestão de Professores**.
2. Clique na aba **Atribuição de Disciplinas**.
3. Preencha:
   - **Professor** — selecione o professor (lista vem de Gestão de Professores)
   - **Disciplina** — ex.: Matemática, História
   - **Curso** (Superior) ou **Classe** (Secundário)
   - **Ano Letivo** — ex.: 2025
   - **Turma** — ex.: 10ª A - Informática
   - **Semestre** (apenas Superior) — 1 ou 2
4. Clique em **Atribuir** ou **Criar Plano de Ensino**.

**Resultado:** O sistema cria um Plano de Ensino em estado **RASCUNHO**. O professor já está atribuído, mas o plano ainda precisa de ser planejado e aprovado.

---

## 4. Passo 2 — Plano de Ensino

**Quem faz:** Professor (planeja) e Admin (aprova)  
**Onde:** Configuração de Ensinos → Plano de Ensino

### O que é?

O Plano de Ensino define **o quê** vai ser ensinado e **quantas aulas** cada tópico terá em cada trimestre/semestre. É a base para a distribuição de datas e para o lançamento de aulas.

### 4.1 — Planejar (Professor)

1. Aceda a **Configuração de Ensinos** → aba **Plano de Ensino**.
2. Selecione o contexto:
   - Curso ou Classe
   - Disciplina
   - Professor (o seu nome)
   - Ano Letivo
   - Turma
3. Se o plano ainda não existir, o sistema cria. Clique na tab **"2. Planejar"**.
4. Para cada tópico do programa:
   - Clique em **Nova Aula**
   - **Título** — ex.: "Introdução à Álgebra"
   - **Descrição** (opcional)
   - **Tipo** — Teórica ou Prática
   - **Trimestre** (Secundário) ou **Semestre** (Superior) — 1º, 2º ou 3º
   - **Quantidade de Aulas** — ex.: 4
   - Clique em **Adicionar Aula**
5. Repita para todos os tópicos.

**Exemplo:**
```
Aula 1: Introdução à Álgebra — 2 aulas — 1º Trimestre
Aula 2: Equações de 1º grau — 4 aulas — 1º Trimestre
Aula 3: Sistemas de equações — 5 aulas — 2º Trimestre
```

### 4.2 — Submeter (Professor)

1. Quando terminar de planejar, clique em **Submeter** ou **Enviar para aprovação**.
2. O estado passa a **PENDENTE_APROVACAO**.

### 4.3 — Aprovar (Admin)

1. Admin acede ao Plano de Ensino (mesmo contexto).
2. Localiza o plano com estado **Pendente**.
3. Clique em **Aprovar**.
4. O estado passa a **APROVADO**.

**Resultado:** O plano está pronto. Agora pode criar Horários e Distribuição de Aulas.

---

## 5. Passo 3 — Horários

**Quem faz:** Admin  
**Onde:** Gestão Acadêmica → Horários

### O que é?

O Horário define **quando** cada professor leciona: dia da semana, hora de início e fim, sala. É a grade semanal (ex.: Matemática às Segundas 08:00–08:45).

### Passo a passo

1. No menu lateral, clique em **Gestão Acadêmica**.
2. Clique na aba **Horários**.
3. No dropdown, selecione a **Turma** (ou Classe).
4. O sistema mostra os Planos de Ensino da turma (disciplina + professor).
5. Para cada disciplina:
   - Clique em **Adicionar horário**
   - **Plano de Ensino** — selecione a disciplina e o professor
   - **Dia da semana** — Segunda, Terça, Quarta, etc.
   - **Hora início** e **Hora fim** — use os blocos sugeridos (45 min no Secundário, 60 min no Superior)
   - **Sala** (opcional)
   - Clique em **Salvar**
6. **Sugestões automáticas (opcional):** Clique em **Obter sugestões**, escolha o turno (manhã/tarde/noite) e aplique.
7. **Aprovar** os horários quando estiver tudo correto.

**Exemplo:** Matemática — Segunda 08:00–08:45, Quarta 08:00–08:45 — Sala 101

**Resultado:** O professor vê o horário em Painel Professor → Horários. Os dias do Horário serão usados na Distribuição de Aulas.

---

## 6. Passo 4 — Distribuição de Aulas

**Quem faz:** Admin ou Professor  
**Onde:** Configuração de Ensinos → Distribuição de Aulas

### O que é?

A Distribuição de Aulas gera as **datas concretas** no calendário para cada aula do plano. Ex.: Aula 1 (2 aulas) → 05/02 e 07/02. O sistema respeita feriados e usa os dias do Horário quando existem.

### Passo a passo

1. Aceda a **Configuração de Ensinos** → aba **Distribuição de Aulas**.
2. Selecione o mesmo contexto do Plano de Ensino:
   - Curso/Classe
   - Disciplina
   - Professor
   - Ano Letivo
   - Turma
3. Configure:
   - **Data de Início** — ex.: 01/02/2025
   - **Dias da Semana** — clique nos botões (Seg, Ter, Qua…). Se já criou Horários, os dias podem vir preenchidos automaticamente.
4. Clique em **Gerar Distribuição Automática**.

**Resultado:** Uma tabela mostra cada aula do plano e as datas calculadas. O sistema ignora feriados do calendário.

---

## 7. Passo 5 — Lançamento de Aulas

**Quem faz:** Professor  
**Onde:** Configuração de Ensinos → Lançamento de Aulas

### O que é?

Quando o professor **ministra** uma aula, deve marcá-la como "Ministrada" no sistema. Só assim pode registar presenças.

### Passo a passo

1. Aceda a **Configuração de Ensinos** → aba **Lançamento de Aulas**.
2. Selecione o contexto (mesmo do plano).
3. Verá a lista de aulas do plano com as datas distribuídas.
4. Para cada aula que já deu:
   - Clique em **Lançar Aula**
   - Escolha a **Data Real** em que a aula foi dada
   - Adicione **Observações** (opcional)
   - Clique em **Confirmar**

**Exemplo:** Hoje deu a aula "Introdução à Álgebra" → Lança com data de hoje → A aula fica "Ministrada".

**Resultado:** A aula muda de "Planejada" para "Ministrada". Agora pode registar presenças.

---

## 8. Passo 6 — Controle de Presenças

**Quem faz:** Professor  
**Onde:** Configuração de Ensinos → Controle de Presenças

### O que é?

Registar quem esteve presente, ausente ou justificado em cada aula ministrada. A frequência é calculada automaticamente. Alunos com menos de 75% de frequência não podem receber notas.

### Passo a passo

1. Aceda a **Configuração de Ensinos** → aba **Controle de Presenças**.
2. Selecione o contexto.
3. Escolha uma **Aula Lançada** (só aparecem aulas já marcadas como ministradas).
4. Para cada aluno, clique no estado:
   - **Presente**
   - **Ausente**
   - **Justificado**
5. Adicione observações se necessário.
6. Clique em **Salvar Presenças**.

**Resultado:** O sistema calcula a frequência de cada aluno. A frequência aparece nos relatórios e bloqueia o lançamento de notas se for inferior a 75%.

---

<h2 id="9-passo-7-avaliacoes-notas-disciplina">9. Passo 7 — Avaliações e notas (disciplina)</h2>

**Quem faz:** Professor  
**Onde:** Configuração de Ensinos → **Avaliações e notas (disciplina)** (ou menu / atalho com o mesmo nome; rota `/admin-dashboard/avaliacoes-notas`).

**Visão por turma (várias disciplinas, pautas):** Gestão Académica → **Notas** ou **Pautas** (atalho **Notas e pautas (turma)**).

### O que é?

Criar avaliações (prova, teste, trabalho) e lançar as notas dos alunos **por disciplina e plano de ensino**. Só alunos com frequência ≥ 75% podem receber nota.

### 9.1 — Criar Avaliação

1. Aceda à aba **Avaliações e notas (disciplina)** → separador **Avaliações** (lista de avaliações da disciplina).
2. Clique em **Nova Avaliação**.
3. Preencha:
   - **Tipo** — Prova, Teste, Trabalho, etc.
   - **Trimestre** ou **Semestre**
   - **Data**
   - **Peso** (ex.: 2.0)
   - **Nome** (opcional)
4. Clique em **Criar**.

### 9.2 — Lançamento na tab «Lançamento de Notas»

1. Vá à tab **Lançamento de Notas** (mesmo ecrã).
2. Clique no botão **Lançar Notas** na avaliação desejada (rótulo do botão na interface).
3. Para cada aluno:
   - Se frequência < 75%: aluno **bloqueado** (não pode receber nota)
   - Se frequência ≥ 75%: digite a **Nota** (0 a 20)
4. Clique em **Salvar Notas**.

**Resultado:** As médias são calculadas automaticamente. As notas aparecem nas pautas e boletins.

---

## 10. Resumo do fluxo e resolução de problemas

### Resumo rápido

| Passo | Onde | Quem |
|-------|------|------|
| 1. Atribuição | Gestão de Professores → Atribuição de Disciplinas | Admin |
| 2. Plano de Ensino | Configuração de Ensinos → Plano de Ensino | Professor + Admin |
| 3. Horários | Gestão Acadêmica → Horários | Admin |
| 4. Distribuição de Aulas | Configuração de Ensinos → Distribuição de Aulas | Admin/Professor |
| 5. Lançamento de Aulas | Configuração de Ensinos → Lançamento de Aulas | Professor |
| 6. Presenças | Configuração de Ensinos → Controle de Presenças | Professor |
| 7. Avaliações e notas (disciplina) | Configuração de Ensinos → Avaliações e notas (disciplina) | Professor |

### Resolução de problemas

| Problema | Solução |
|----------|---------|
| Aba bloqueada | Conclua a etapa anterior. O sistema bloqueia automaticamente. |
| "Calendário não encontrado" | Admin deve configurar Calendário Acadêmico (feriados). |
| "Plano de Ensino não encontrado" | Crie a Atribuição de Disciplinas e o Plano de Ensino. |
| "É necessário distribuir as aulas primeiro" | Gere a Distribuição de Aulas antes de Lançamento. |
| "É necessário lançar aulas como ministradas" | Marque as aulas como Ministradas antes de Presenças. |
| Aluno bloqueado nas notas | Frequência < 75%. Verifique as presenças. |
| Nenhum Plano aparece em Horários | O Plano deve estar APROVADO e ter turmaId. |
| Professor não vê turma | Verifique Atribuição de Disciplinas e aprovação do plano. |

---

## Documentos relacionados

- [COMO_ATRIBUIR_PROFESSORES.md](../COMO_ATRIBUIR_PROFESSORES.md) — Detalhes da atribuição
- [GUIA_PROFESSOR_CONFIGURACAO_ENSINOS.md](../GUIA_PROFESSOR_CONFIGURACAO_ENSINOS.md) — Guia focado no professor
- [DISTRIBUICAO_HORARIOS_PROFESSORES_PASSO_A_PASSO.md](DISTRIBUICAO_HORARIOS_PROFESSORES_PASSO_A_PASSO.md) — Detalhes dos horários
