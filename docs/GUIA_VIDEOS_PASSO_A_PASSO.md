# Guia Passo a Passo — Gravação de Vídeos Tutorial DSICOLA

> Use este guia para gravar vídeos mostrando como funciona o sistema. Siga a ordem indicada: comece pelo **início** e termine no **fim**.

---

## Índice

1. [Onde começar e onde terminar](#onde-começar-e-onde-terminar)
2. [Preparação antes de gravar](#preparação-antes-de-gravar)
3. [Ordem dos vídeos (checklist)](#ordem-dos-vídeos-checklist)
4. [Detalhe passo a passo de cada vídeo](#detalhe-passo-a-passo-de-cada-vídeo)
5. [Dicas técnicas para gravação](#dicas-técnicas-para-gravação)

---

## Onde começar e onde terminar

| | Descrição |
|---|-----------|
| **INÍCIO** | Vídeo 1 — Visão geral e login |
| **FIM** | Vídeo 20 — Super Admin (gestão da plataforma) |

**Fluxo lógico:** Começar pela **configuração da instituição** (como quem monta a escola do zero) e seguir a sequência natural: instituição → ano letivo → académica → professores → alunos → finanças. Depois mostrar o **uso operacional** de cada perfil (Professor, Secretaria, POS, Aluno).

---

## Preparação antes de gravar

- [ ] Sistema a correr (backend + frontend)
- [ ] Base de dados com dados de teste (seeds multi-tenant)
- [ ] Contas de teste prontas (admin, professor, aluno, secretaria, POS, responsável)
- [ ] Software de gravação de ecrã (OBS, Loom, QuickTime, etc.)
- [ ] Microfone com boa qualidade
- [ ] Resolução 1920x1080 (Full HD)
- [ ] Desativar notificações do sistema durante a gravação

---

## Ordem dos vídeos (checklist)

A ordem segue o **passo a passo natural** de quem monta uma instituição: primeiro configurar tudo, depois mostrar como cada perfil usa o sistema.

### Bloco 1 — Introdução
| # | Vídeo | Duração estimada | Estado |
|---|-------|-----------------|--------|
| 1 | Visão geral e login | 3–5 min | [ ] |
| 2 | Onboarding (primeira configuração) | 5–8 min | [ ] |

### Bloco 2 — Configuração da instituição (sequência lógica)
| # | Vídeo | Duração estimada | Estado |
|---|-------|-----------------|--------|
| 3 | Configurar instituição (dados, logo, endereço) | 5–7 min | [ ] |
| 4 | Configurar ano letivo e calendário académico | 5–6 min | [ ] |
| 5 | Configurar gestão académica (cursos, disciplinas, classes, turmas) | 8–10 min | [ ] |
| 6 | Configurar plano de ensino (atribuir professores às turmas) | 5–7 min | [ ] |
| 7 | Gestão de Professores (criar e cadastrar) | 5–7 min | [ ] |
| 8 | Gestão de Alunos e matrículas (criar alunos, matricular em turma) | 6–8 min | [ ] |
| 9 | Configurar períodos de lançamento de notas | 4–5 min | [ ] |
| 10 | Configurar Finanças (mensalidades, taxas, multas) | 5–7 min | [ ] |
| 11 | Configurar RH (cargos, departamentos, funcionários) | 6–8 min | [ ] |
| 12 | Configurar Contabilidade (plano de contas, regras) | 6–8 min | [ ] |

### Bloco 3 — Uso operacional (por perfil)
| # | Vídeo | Duração estimada | Estado |
|---|-------|-----------------|--------|
| 13 | Professor: Turmas, notas e presenças | 6–8 min | [ ] |
| 14 | Secretaria: Alunos, matrículas, documentos e relatórios | 6–8 min | [ ] |
| 15 | POS: Ponto de venda e pagamentos | 5–7 min | [ ] |
| 16 | Aluno: Boletim, horários e mensalidades | 4–6 min | [ ] |
| 17 | Responsável: Painel e acompanhamento dos dependentes | 4–5 min | [ ] |

### Bloco 4 — Relatórios e exportações
| # | Vídeo | Duração estimada | Estado |
|---|-------|-----------------|--------|
| 18 | Relatórios financeiros e exportar SAFT | 5–6 min | [ ] |

### Bloco 5 — Super Admin (plataforma)
| # | Vídeo | Duração estimada | Estado |
|---|-------|-----------------|--------|
| 19 | Super Admin: Instituições e planos | 6–8 min | [ ] |
| 20 | Super Admin: Assinaturas e backup | 5–6 min | [ ] |

---

## Detalhe passo a passo de cada vídeo

### Vídeo 1 — Visão geral e login
**Onde começar.**

1. Abrir o browser e ir ao URL do sistema (ex.: `https://app.dsicola.com` ou `localhost:8080`)
2. Mostrar a página de login
3. Explicar os campos: email e senha
4. Fazer login com uma conta de teste (ex.: admin)
5. Mostrar o dashboard após login
6. Fazer logout e mostrar onde fica o botão

---

### Vídeo 2 — Onboarding (primeira configuração)
1. Login com conta nova (sem onboarding concluído)
2. Mostrar o fluxo de onboarding passo a passo
3. Preencher dados da instituição
4. Configurar ano letivo
5. Concluir onboarding e aceder ao dashboard

---

### Vídeo 3 — Configurar instituição (dados, logo, endereço)
1. Login como **Admin**
2. Ir a **Sistema** ou **Configurações**
3. Mostrar: nome da instituição, logo, endereço, contacto
4. Configurar dados fiscais (NIF, etc.) se aplicável
5. Guardar e mostrar confirmação

---

### Vídeo 4 — Configurar ano letivo e calendário académico
1. Login como **Admin**
2. Ir a **Configuração de Ensino** / **Ano Letivo**
3. Criar ou ativar um ano letivo
4. Ir a **Calendário Académico** — definir datas de início/fim, períodos
5. Mostrar intervalos e horários (se configurável)

---

### Vídeo 5 — Configurar gestão académica (cursos, disciplinas, classes, turmas)
1. Login como **Admin**
2. Ir a **Académica**
3. **Cursos:** criar um curso (ex.: 10ª Classe, Licenciatura em X)
4. **Disciplinas:** criar disciplinas e associar ao curso
5. **Classes:** criar classes (ex.: 10ª, 11ª)
6. **Turmas:** criar turmas (ex.: 10ª Classe - Turma A)
7. Mostrar a estrutura completa

---

### Vídeo 6 — Configurar plano de ensino (atribuir professores às turmas)
1. Login como **Admin**
2. Ir a **Académica** → **Plano de Ensino**
3. Mostrar como atribuir um professor a uma turma e disciplina
4. Aprovar ou criar planos de ensino
5. Mostrar a lista de planos configurados

---

### Vídeo 7 — Gestão de Professores (criar e cadastrar)
1. Login como **Admin**
2. Ir a **Professores**
3. Criar um novo professor (dados pessoais, contacto)
4. Associar o professor às disciplinas
5. Mostrar a ficha do professor criado

---

### Vídeo 8 — Gestão de Alunos e matrículas (criar alunos, matricular em turma)
1. Login como **Admin** ou **Secretaria**
2. Ir a **Administrativo** / **Gestão de Alunos**
3. Criar um novo aluno (dados pessoais)
4. Criar matrícula anual (ano letivo, classe)
5. Matricular o aluno numa turma
6. Mostrar a ficha completa do aluno

---

### Vídeo 9 — Configurar períodos de lançamento de notas
1. Login como **Admin**
2. Ir a **Configuração de Ensino** → **Períodos de Lançamento**
3. Criar ou editar um período (ex.: 1º Trimestre)
4. Definir datas de início e fim
5. Mostrar como isso afeta o lançamento de notas pelo professor

---

### Vídeo 10 — Configurar Finanças (mensalidades, taxas, multas)
1. Login como **Admin**
2. Ir a **Finanças** ou **Configurações**
3. Mostrar: valor de mensalidade, taxas de matrícula
4. Configurar multas e juros (se aplicável)
5. Mostrar configuração de multas por instituição

---

### Vídeo 11 — Configurar RH (cargos, departamentos, funcionários)
1. Login como **Admin** ou **RH**
2. Ir a **Recursos Humanos**
3. Criar **Cargos** e **Departamentos**
4. Criar ou editar um funcionário
5. Associar funcionário a cargo e departamento

*Consulte também:* [GUIA_CARGOS_DEPARTAMENTOS.md](GUIA_CARGOS_DEPARTAMENTOS.md)

---

### Vídeo 12 — Configurar Contabilidade (plano de contas, regras)
1. Login como **Admin** ou **Financeiro**
2. Ir a **Contabilidade**
3. **Plano de Contas:** criar plano padrão, adicionar contas
4. **Configuração:** definir contas (Caixa, Banco, Receitas)
5. **Integração:** regras de lançamento automático (se aplicável)

*Consulte também:* [CONTABILIDADE_GUIA_UTILIZACAO.md](CONTABILIDADE_GUIA_UTILIZACAO.md)

---

### Vídeo 13 — Professor: Turmas, notas e presenças
1. Login como **Professor**
2. Mostrar o dashboard e ir a **Turmas**
3. **Lançar notas:** selecionar turma, disciplina, avaliação; preencher notas
4. **Aulas e presenças:** marcar presenças de uma aula
5. Mostrar **Meus Horários** e **Relatórios** (pauta, mapa de presenças)

---

### Vídeo 14 — Secretaria: Alunos, matrículas, documentos e relatórios
1. Login como **Secretaria**
2. Ir a **Administrativo** — pesquisar aluno, ver ficha
3. Criar matrícula ou emitir documento (Ficha Cadastral, Declaração)
4. Ir a **Relatórios Oficiais** — gerar pauta, boletim
5. Mostrar impressão/exportação

---

### Vídeo 15 — POS: Ponto de venda e pagamentos
1. Login como **POS**
2. Ir ao **Ponto de Venda**
3. Mostrar o ecrã do PDV
4. Registrar um pagamento (mensalidade ou taxa)
5. Emitir recibo

---

### Vídeo 16 — Aluno: Boletim, horários e mensalidades
1. Login como **Aluno**
2. Mostrar o dashboard
3. Ir a **Boletim** — mostrar notas e média
4. Ir a **Meu Horário** — grade horária
5. Ir a **Minhas Mensalidades** — extrato e imprimir recibo

---

### Vídeo 17 — Responsável: Painel e acompanhamento dos dependentes
1. Login como **Responsável**
2. Mostrar o painel com visão dos dependentes
3. Navegar entre os alunos associados
4. Mostrar boletim e mensalidades do dependente

---

### Vídeo 18 — Relatórios financeiros e exportar SAFT
1. Login como **Admin**
2. Ir a **Relatórios Financeiros** — receitas, mapa de atrasos
3. Mostrar exportação em PDF
4. Ir a **Exportar SAFT** — explicar o que é, gerar ficheiro
5. Mostrar o ficheiro gerado

---

### Vídeo 19 — Super Admin: Instituições e planos
1. Login como **Super Admin**
2. Mostrar o dashboard Super Admin
3. Ir a **Instituições** — listar, criar instituição
4. Ir a **Planos** — mostrar planos disponíveis
5. Ir a **Onboarding** — fluxo de criação de instituição

---

### Vídeo 20 — Super Admin: Assinaturas e backup
**Onde terminar.**

1. Login como **Super Admin**
2. Ir a **Assinaturas** — mostrar assinaturas das instituições
3. Ir a **Pagamentos** — comprovativos de licença
4. Ir a **Backup** — mostrar opções de backup do sistema
5. (Opcional) Estatísticas e Segurança

---

## Dicas técnicas para gravação

### Antes de gravar
- Use uma conta de teste com dados realistas (nomes, turmas, notas)
- Feche abas e programas desnecessários
- Desative notificações (email, Slack, etc.)
- Teste o microfone e o áudio

### Durante a gravação
- Fale de forma clara e pausada
- Clique com calma — evite movimentos bruscos do rato
- Se errar, pause, corrija e continue (pode editar depois)
- Mantenha cada vídeo entre 3–10 minutos (ideal: 5–7 min)

### Depois de gravar
- Revise o vídeo e corte silêncios longos
- Adicione legendas ou texto no início (título do vídeo)
- Exporte em MP4 (H.264) — boa compatibilidade
- Guarde numa pasta organizada: `videos/01-visao-geral-login.mp4`

### Onde publicar
- YouTube (lista de reprodução «DSICOLA — Tutoriais»)
- Portal de videoaulas do sistema (se existir)
- Base de conhecimento ou FAQ do site

---

## Resumo: ordem de gravação

```
INÍCIO
  ↓
1–2. Introdução (Login, Onboarding)
  ↓
3–12. CONFIGURAÇÃO DA INSTITUIÇÃO (sequência lógica)
      → Instituição → Ano letivo → Académica → Plano de ensino
      → Professores → Alunos/Matrículas → Períodos de notas
      → Finanças → RH → Contabilidade
  ↓
13–17. USO OPERACIONAL (por perfil)
        → Professor → Secretaria → POS → Aluno → Responsável
  ↓
18. Relatórios e SAFT
  ↓
19–20. Super Admin (Instituições, Assinaturas/Backup)
  ↓
FIM
```

---

*Documento criado para apoio à gravação de tutoriais em vídeo do sistema DSICOLA.*
