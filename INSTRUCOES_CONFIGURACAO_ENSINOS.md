# 📚 Guia de Uso - Configuração de Ensinos

## Visão Geral

O módulo **Configuração de Ensinos** gerencia todo o fluxo académico da instituição, desde o calendário até o lançamento de notas. É **obrigatório** seguir a ordem das etapas abaixo.

---

## ⚠️ IMPORTANTE: Ordem Obrigatória

O sistema **bloqueia** automaticamente as etapas seguintes até que as anteriores sejam concluídas. Esta ordem **NÃO pode ser alterada**:

1. ✅ **Calendário Académico** (Sempre disponível)
2. ✅ **Plano de Ensino** (Requer: Calendário Ativo)
3. ✅ **Distribuição de Aulas** (Requer: Plano de Ensino Aprovado)
4. ✅ **Lançamento de Aulas** (Requer: Aulas Distribuídas)
5. ✅ **Controle de Presenças** (Requer: Aulas Lançadas)
6. ✅ **Avaliações e notas (disciplina)** (Requer: Presenças Registradas + Frequência Mínima). *Visão por turma / pautas:* Gestão Académica → Notas ou Pautas.

---

## 👤 Para ADMIN / DIREÇÃO

### 1️⃣ Calendário Académico

**O que é:**
- Base de todo o sistema académico
- Define dias letivos, feriados, períodos especiais

**Como usar:**

1. Acesse a aba **"Calendário Académico"**
2. Clique em **"Novo Evento"**
3. Preencha:
   - **Título**: Nome do evento (obrigatório)
   - **Data Início**: Data inicial (obrigatório)
   - **Data Fim**: Data final (opcional, para eventos de múltiplos dias)
   - **Tipo**: Escolha o tipo:
     - 🟦 **Evento**: Eventos gerais
     - 🔴 **Feriado**: Feriados nacionais/locais
     - 🟧 **Prova/Exame**: Períodos de avaliação
     - 🟣 **Reunião**: Reuniões pedagógicas
     - 🟢 **Férias**: Períodos de férias
     - 🔵 **Período Matrícula**: Matrículas
     - 🩷 **Aula Inaugural**: Início do ano letivo
   - **Hora Início / Fim**: Opcional
   - **Descrição**: Observações adicionais

4. Clique em **"Criar"**

**⚠️ ATENÇÃO:**
- **O Calendário deve ser configurado ANTES de qualquer outro módulo**
- Sem eventos no calendário, o sistema bloqueia a criação de Planos de Ensino
- Feriados e férias são automaticamente **ignorados** na distribuição de aulas

**Dicas:**
- Configure todos os feriados do ano letivo
- Marque períodos de férias escolares
- Adicione datas importantes (provas, reuniões)

---

## 👨‍🏫 Para PROFESSOR

### 2️⃣ Plano de Ensino

**O que é:**
- Documento que define o conteúdo programático
- Especifica as aulas, trimestres e carga horária

**Como usar:**

1. Acesse a aba **"Plano de Ensino"** (só disponível após Calendário configurado)
2. Selecione o contexto:
   - **Curso** ou **Classe** (conforme sua instituição)
   - **Disciplina**
   - **Professor**
   - **Ano Letivo**
   - **Turma** (opcional)
3. Siga as 5 etapas do plano:

   **1. Apresentação:**
   - Preencha dados gerais do plano
   - Objetivos, metodologia, avaliação

   **2. Planejar:**
   - Adicione as aulas do plano
   - Para cada aula, defina:
     - Título
     - Descrição do conteúdo
     - Tipo (Teórica/Prática)
     - Trimestre
     - Quantidade de aulas

   **3. Executar:**
   - Visualize o plano completo
   - Verifique a carga horária

   **4. Gerenciar:**
   - Edite ou remova aulas
   - Reordene aulas

   **5. Finalizar:**
   - Visualize o plano final
   - Imprima se necessário

4. Após finalizar, o plano fica disponível para **Distribuição de Aulas**

**⚠️ ATENÇÃO:**
- O plano deve ter pelo menos uma aula cadastrada
- Verifique se a carga horária está correta
- O plano pode ser **bloqueado** por administradores após aprovação

---

### 3️⃣ Distribuição Automática de Aulas

**O que é:**
- Gera automaticamente as **datas** para cada aula do plano
- Respeita o calendário académico (ignora feriados e férias)

**Como usar:**

1. Acesse a aba **"Distribuição de Aulas"** (só disponível após Plano criado)
2. Selecione o mesmo contexto do Plano de Ensino:
   - **Curso/Classe**, **Disciplina**, **Professor**, **Ano Letivo**, **Turma**
3. Configure a distribuição:
   - **Data de Início**: Primeira data de aula
   - **Dias da Semana**: Selecione os dias em que a disciplina é ministrada
     - Ex: Segunda, Quarta, Sexta
4. Clique em **"Gerar Distribuição Automática"**

**O que acontece:**
- O sistema calcula automaticamente as datas para todas as aulas
- **Ignora** automaticamente:
  - Feriados cadastrados
  - Períodos de férias
  - Eventos do tipo "feriado" ou "ferias"
- As datas são salvas e ficam disponíveis para lançamento

**⚠️ ATENÇÃO:**
- A distribuição considera apenas dias letivos
- Selecione corretamente os dias da semana da disciplina
- Após gerar, as datas podem ser ajustadas manualmente no próximo módulo

**Visualização:**
- Veja todas as aulas com suas respectivas datas
- As datas aparecem como badges no formato DD/MM

---

### 4️⃣ Lançamento de Aulas

**O que é:**
- Registra a **execução real** das aulas
- Marca aulas como **"Ministradas"**

**Como usar:**

1. Acesse a aba **"Lançamento de Aulas"** (só disponível após Distribuição)
2. Selecione o contexto (mesmo do Plano)
3. Visualize todas as aulas do plano com suas datas distribuídas
4. Para cada aula que foi ministrada:
   - Clique em **"Lançar Aula"**
   - Confirme ou ajuste a **data**
   - Adicione **observações** (opcional)
   - Clique em **"Confirmar Lançamento"**

**O que acontece:**
- A aula é marcada como **"Ministrada"**
- A data real de execução é registrada
- A aula fica disponível para **Controle de Presenças**

**⚠️ ATENÇÃO:**
- Só é possível lançar aulas que foram **distribuídas**
- Você pode lançar uma aula mais de uma vez (se tiver quantidade > 1)
- Apenas aulas lançadas podem ter presenças registradas

**Status:**
- 🟡 **Planejada**: Aula ainda não foi ministrada
- 🟢 **Ministrada**: Aula foi lançada e executada

---

### 5️⃣ Controle de Presenças

**O que é:**
- Registra a presença dos alunos em cada aula ministrada

**Como usar:**

1. Acesse a aba **"Controle de Presenças"** (só disponível após aulas lançadas)
2. Selecione o contexto (Curso/Classe, Disciplina, Professor, Ano Letivo, Turma)
3. Selecione a **Aula Lançada** desejada
4. Visualize a lista de alunos matriculados
5. Para cada aluno, marque o status:
   - ✅ **PRESENTE**: Aluno compareceu
   - ❌ **AUSENTE**: Aluno faltou
   - ⚠️ **JUSTIFICADO**: Falta justificada (ex: atestado médico)
6. Adicione **observações** se necessário
7. Clique em **"Salvar Presenças"**

**O que acontece:**
- As presenças são salvas automaticamente
- O sistema calcula a **frequência** de cada aluno
- A frequência é usada para validar lançamento de notas

**⚠️ ATENÇÃO:**
- Só é possível controlar presenças de aulas **lançadas como ministradas**
- A frequência mínima padrão é **75%**
- Alunos com frequência < 75% ficam **bloqueados** para avaliações

**Estatísticas:**
- Veja o total de alunos, presentes, ausentes e justificados
- A frequência é calculada automaticamente: (Presentes + Justificados) / Total de Aulas

---

### 6️⃣ Avaliações e notas (disciplina)

**O que é:**
- Cria avaliações (Provas, Testes, Trabalhos)
- Lança notas dos alunos respeitando frequência mínima

**Como usar:**

#### Criar Avaliação:

1. Acesse a aba **"Avaliações e notas (disciplina)"** (Configuração de ensino ou menu)
2. Selecione o contexto (mesmo do Plano)
3. Vá para a tab **"Avaliações"**
4. Clique em **"Nova Avaliação"**
5. Preencha:
   - **Tipo**: Prova, Teste, Trabalho, Prova Final ou Recuperação
   - **Trimestre**: 1º, 2º ou 3º Trimestre
   - **Data**: Data da avaliação
   - **Peso**: Peso da avaliação (padrão: 1)
   - **Nome**: Nome da avaliação (opcional)
   - **Descrição**: Detalhes (opcional)
6. Clique em **"Criar"**

#### Lançamento de notas (tab no mesmo ecrã):

1. Vá para a tab **"Lançamento de Notas"**
2. Selecione a avaliação desejada
3. Clique em **"Lançar Notas"**
4. Visualize a lista de alunos com:
   - **Frequência**: Percentual calculado automaticamente
   - **Status**: 
     - ✅ **OK**: Frequência ≥ 75% (pode receber nota)
     - ❌ **Bloqueado**: Frequência < 75% (NÃO pode receber nota)
5. Para alunos **não bloqueados**, digite a nota (0 a 20)
6. Adicione **observações** se necessário
7. Clique em **"Salvar Notas"**

**⚠️ ATENÇÃO CRÍTICA:**
- Alunos com frequência < **75%** ficam **BLOQUEADOS** e não podem receber notas
- O sistema **impede** o lançamento de notas para alunos bloqueados
- A frequência é calculada até a **data da avaliação**
- Apenas faltas justificadas contam como presença para frequência

**Regras de Frequência:**
- **Frequência Mínima**: 75%
- **Cálculo**: (Aulas Presentes + Justificadas) / Total de Aulas
- Alunos bloqueados precisam regularizar presenças antes de receber notas

---

## 🔄 Fluxo Completo - Exemplo Prático

### Exemplo: Disciplina "Matemática" - 1º Trimestre

1. **Admin configura Calendário:**
   - Adiciona feriados de 2024
   - Marca período de férias

2. **Professor cria Plano de Ensino:**
   - Curso: Engenharia
   - Disciplina: Matemática
   - Adiciona 30 aulas teóricas
   - Define conteúdos para cada aula

3. **Professor distribui aulas:**
   - Data início: 01/03/2024
   - Dias: Segunda, Quarta, Sexta
   - Sistema gera 30 datas (ignora feriados automaticamente)

4. **Professor lança aulas ministradas:**
   - A cada semana, lança as aulas que foram dadas
   - Registra data real e observações

5. **Professor controla presenças:**
   - Seleciona aula lançada
   - Marca presentes/ausentes/justificados
   - Salva

6. **Professor cria avaliação:**
   - Tipo: Prova
   - Trimestre: 1
   - Data: 30/04/2024
   - Peso: 2

7. **Professor lança notas:**
   - Sistema verifica frequência de cada aluno
   - Alunos com ≥ 75% podem receber nota
   - Alunos com < 75% ficam bloqueados
   - Professor lança apenas notas permitidas

---

## ❓ Perguntas Frequentes

### Por que não consigo criar um Plano de Ensino?

**Resposta:** É necessário ter pelo menos **um evento** cadastrado no Calendário Académico. O sistema exige calendário ativo como pré-requisito.

### Por que não consigo distribuir aulas?

**Resposta:** Você precisa:
1. Ter criado um Plano de Ensino
2. Ter adicionado pelo menos uma aula ao plano
3. Ter selecionado o contexto correto (mesmo do plano)

### Por que não consigo lançar uma aula?

**Resposta:** A aula precisa ter sido **distribuída** primeiro. Acesse a aba "Distribuição de Aulas" e gere as datas.

### Por que não consigo controlar presenças?

**Resposta:** É necessário ter **lançado pelo menos uma aula como ministrada**. Só aulas lançadas podem ter presenças.

### Por que um aluno está bloqueado para receber nota?

**Resposta:** O aluno tem frequência < **75%**. Verifique as presenças e regularize faltas justificadas se aplicável.

### Posso pular alguma etapa?

**Resposta:** **NÃO**. O sistema bloqueia automaticamente etapas seguintes até que as anteriores sejam concluídas. Esta ordem é obrigatória por questões pedagógicas e legais.

### Como regularizar frequência de um aluno?

**Resposta:** Volte para "Controle de Presenças" e marque faltas como **"JUSTIFICADO"** quando houver documentação (atestado médico, etc.). Isso aumenta a frequência do aluno.

---

## 📞 Suporte

Em caso de dúvidas ou problemas:
1. Verifique se todas as etapas anteriores foram concluídas
2. Confira se o contexto (Curso, Disciplina, Professor, Ano) está correto
3. Entre em contato com o administrador do sistema

---

## ✅ Checklist de Uso

Use esta checklist para garantir que tudo está configurado:

- [ ] Calendário Académico com eventos cadastrados
- [ ] Plano de Ensino criado e aulas adicionadas
- [ ] Distribuição de Aulas gerada com datas corretas
- [ ] Aulas ministradas foram lançadas
- [ ] Presenças dos alunos registradas
- [ ] Avaliações (disciplina) criadas
- [ ] Notas lançadas (apenas para alunos com frequência ≥ 75%)

---

**Última atualização:** Janeiro 2024
**Versão do Sistema:** DSICOLA v1.0

