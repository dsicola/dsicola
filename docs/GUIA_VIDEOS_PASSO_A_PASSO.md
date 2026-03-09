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
| **FIM** | Vídeo 24 — Super Admin (gestão da plataforma) |

**Fluxo lógico:** Do utilizador mais simples (Aluno) ao mais complexo (Super Admin), passando por todos os perfis intermédios.

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

### Bloco 1 — Introdução e acesso
| # | Vídeo | Duração estimada | Estado |
|---|-------|-----------------|--------|
| 1 | Visão geral e login | 3–5 min | [ ] |
| 2 | Onboarding (primeira configuração) | 5–8 min | [ ] |

### Bloco 2 — Perfil Aluno
| # | Vídeo | Duração estimada | Estado |
|---|-------|-----------------|--------|
| 3 | Aluno: Dashboard e boletim | 4–6 min | [ ] |
| 4 | Aluno: Horários e mensalidades | 3–5 min | [ ] |
| 5 | Aluno: Histórico académico | 2–3 min | [ ] |

### Bloco 3 — Perfil Responsável
| # | Vídeo | Duração estimada | Estado |
|---|-------|-----------------|--------|
| 6 | Responsável: Painel e acompanhamento | 4–5 min | [ ] |

### Bloco 4 — Perfil Professor
| # | Vídeo | Duração estimada | Estado |
|---|-------|-----------------|--------|
| 7 | Professor: Dashboard e turmas | 4–6 min | [ ] |
| 8 | Professor: Lançar notas | 5–7 min | [ ] |
| 9 | Professor: Aulas e presenças | 5–6 min | [ ] |
| 10 | Professor: Horários e relatórios | 3–4 min | [ ] |

### Bloco 5 — Perfil Secretaria
| # | Vídeo | Duração estimada | Estado |
|---|-------|-----------------|--------|
| 11 | Secretaria: Dashboard e gestão de alunos | 5–7 min | [ ] |
| 12 | Secretaria: Matrículas e documentos | 5–6 min | [ ] |
| 13 | Secretaria: Relatórios oficiais (pauta, boletim) | 4–5 min | [ ] |

### Bloco 6 — Perfil POS / Ponto de Venda
| # | Vídeo | Duração estimada | Estado |
|---|-------|-----------------|--------|
| 14 | POS: Ponto de venda e pagamentos | 5–7 min | [ ] |

### Bloco 7 — Perfil Admin (gestão institucional)
| # | Vídeo | Duração estimada | Estado |
|---|-------|-----------------|--------|
| 15 | Admin: Dashboard e navegação | 4–5 min | [ ] |
| 16 | Admin: Gestão Académica (cursos, turmas, planos) | 8–10 min | [ ] |
| 17 | Admin: Gestão de Alunos e Professores | 6–8 min | [ ] |
| 18 | Admin: Finanças e Contabilidade | 8–10 min | [ ] |
| 19 | Admin: Configurações e Sistema | 6–8 min | [ ] |

### Bloco 8 — Módulos específicos
| # | Vídeo | Duração estimada | Estado |
|---|-------|-----------------|--------|
| 20 | Contabilidade (plano de contas, lançamentos) | 8–10 min | [ ] |
| 21 | RH: Funcionários e folha de pagamento | 6–8 min | [ ] |
| 22 | Exportar SAFT e relatórios financeiros | 5–6 min | [ ] |

### Bloco 9 — Super Admin (plataforma)
| # | Vídeo | Duração estimada | Estado |
|---|-------|-----------------|--------|
| 23 | Super Admin: Instituições e planos | 6–8 min | [ ] |
| 24 | Super Admin: Assinaturas e backup | 5–6 min | [ ] |

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

### Vídeo 3 — Aluno: Dashboard e boletim
1. Login como **Aluno**
2. Mostrar o dashboard do aluno
3. Ir a **Boletim** (menu lateral)
4. Mostrar as notas e média
5. Explicar como imprimir o boletim

---

### Vídeo 4 — Aluno: Horários e mensalidades
1. Login como **Aluno**
2. Ir a **Meu Horário** — mostrar a grade horária
3. Ir a **Minhas Mensalidades** — mostrar extrato e recibos
4. Mostrar como imprimir um recibo

---

### Vídeo 5 — Aluno: Histórico académico
1. Login como **Aluno**
2. Ir a **Histórico Académico**
3. Mostrar disciplinas, notas e conclusões
4. Mostrar impressão do histórico

---

### Vídeo 6 — Responsável: Painel e acompanhamento
1. Login como **Responsável**
2. Mostrar o painel com visão dos dependentes
3. Navegar entre os alunos associados
4. Mostrar boletim e mensalidades do dependente

---

### Vídeo 7 — Professor: Dashboard e turmas
1. Login como **Professor**
2. Mostrar o dashboard
3. Ir a **Turmas** — listar turmas atribuídas
4. Entrar numa turma e ver a lista de alunos

---

### Vídeo 8 — Professor: Lançar notas
1. Login como **Professor**
2. Ir a **Notas** (ou **Lançar Notas**)
3. Selecionar turma, disciplina e avaliação
4. Preencher notas dos alunos
5. Guardar e mostrar confirmação

---

### Vídeo 9 — Professor: Aulas e presenças
1. Login como **Professor**
2. Ir a **Aulas e Presenças** (ou **Frequência**)
3. Mostrar como marcar presenças
4. Registrar uma aula e marcar presentes/ausentes

---

### Vídeo 10 — Professor: Horários e relatórios
1. Login como **Professor**
2. Ir a **Meus Horários** — mostrar a grade
3. Ir a **Relatórios** — pauta, lista de alunos, mapa de presenças
4. Mostrar impressão de um relatório

---

### Vídeo 11 — Secretaria: Dashboard e gestão de alunos
1. Login como **Secretaria**
2. Mostrar o dashboard
3. Ir a **Administrativo** ou **Gestão de Alunos**
4. Pesquisar um aluno
5. Abrir ficha de um aluno e mostrar os dados

---

### Vídeo 12 — Secretaria: Matrículas e documentos
1. Login como **Secretaria**
2. Criar nova matrícula (ou mostrar matrícula existente)
3. Emitir documento: Ficha Cadastral ou Declaração
4. Mostrar o PDF gerado

---

### Vídeo 13 — Secretaria: Relatórios oficiais
1. Login como **Secretaria**
2. Ir a **Relatórios Oficiais**
3. Gerar **Pauta** de uma turma
4. Gerar **Boletim** de um aluno
5. Mostrar impressão/exportação

---

### Vídeo 14 — POS: Ponto de venda e pagamentos
1. Login como **POS**
2. Ir ao **Ponto de Venda**
3. Mostrar o ecrã do PDV
4. Registrar um pagamento (mensalidade ou taxa)
5. Emitir recibo

---

### Vídeo 15 — Admin: Dashboard e navegação
1. Login como **Admin**
2. Mostrar o dashboard com os módulos
3. Explicar a sidebar: Académica, Professores, Finanças, etc.
4. Navegar rapidamente por 2–3 módulos

---

### Vídeo 16 — Admin: Gestão Académica
1. Login como **Admin**
2. Ir a **Académica**
3. Mostrar: Cursos, Disciplinas, Classes, Turmas
4. Criar ou editar um curso (demonstração)
5. Mostrar **Plano de Ensino** — atribuir professor a turma/disciplina

---

### Vídeo 17 — Admin: Gestão de Alunos e Professores
1. Login como **Admin**
2. Ir a **Professores** — listar, criar ou editar professor
3. Ir a **Administrativo** / **Gestão de Alunos**
4. Criar um aluno (passo a passo)
5. Matricular aluno numa turma

---

### Vídeo 18 — Admin: Finanças e Contabilidade
1. Login como **Admin**
2. Ir a **Finanças** — mostrar pagamentos, mensalidades
3. Ir a **Contabilidade** — plano de contas, lançamentos
4. Mostrar **Relatórios Financeiros** (receitas, atrasos)

---

### Vídeo 19 — Admin: Configurações e Sistema
1. Login como **Admin**
2. Ir a **Sistema** ou **Configurações**
3. Mostrar: Configurações da instituição, Ano letivo, Calendário
4. Mostrar Períodos de lançamento de notas
5. Mostrar Auditoria (logs)

---

### Vídeo 20 — Contabilidade (detalhe)
1. Login como **Admin** ou **Financeiro**
2. Ir a **Contabilidade**
3. **Plano de Contas:** criar plano padrão, adicionar conta
4. **Configuração:** definir contas (Caixa, Banco, Receitas)
5. **Lançamentos:** criar um lançamento manual
6. **Relatórios:** balancete
7. (Opcional) Fecho de exercício

*Consulte também:* [CONTABILIDADE_GUIA_UTILIZACAO.md](CONTABILIDADE_GUIA_UTILIZACAO.md)

---

### Vídeo 21 — RH: Funcionários e folha de pagamento
1. Login como **Admin** ou **RH**
2. Ir a **Recursos Humanos**
3. Mostrar: Cargos, Departamentos, Funcionários
4. Criar ou editar um funcionário
5. Mostrar folha de pagamento (se aplicável)

*Consulte também:* [GUIA_CARGOS_DEPARTAMENTOS.md](GUIA_CARGOS_DEPARTAMENTOS.md)

---

### Vídeo 22 — Exportar SAFT e relatórios financeiros
1. Login como **Admin**
2. Ir a **Exportar SAFT** — explicar o que é, gerar ficheiro
3. Ir a **Relatórios Financeiros** — receitas, mapa de atrasos
4. Mostrar exportação em PDF

---

### Vídeo 23 — Super Admin: Instituições e planos
1. Login como **Super Admin**
2. Mostrar o dashboard Super Admin
3. Ir a **Instituições** — listar, criar instituição
4. Ir a **Planos** — mostrar planos disponíveis
5. Ir a **Onboarding** — fluxo de criação de instituição

---

### Vídeo 24 — Super Admin: Assinaturas e backup
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
1. Visão geral e login
2. Onboarding
  ↓
3–5. Aluno (Dashboard, Horários/Mensalidades, Histórico)
6. Responsável
  ↓
7–10. Professor (Turmas, Notas, Presenças, Relatórios)
  ↓
11–13. Secretaria (Alunos, Matrículas, Relatórios)
14. POS
  ↓
15–19. Admin (Dashboard, Académica, Alunos/Professores, Finanças, Configurações)
  ↓
20–22. Módulos específicos (Contabilidade, RH, SAFT)
  ↓
23–24. Super Admin (Instituições, Assinaturas/Backup)
  ↓
FIM
```

---

*Documento criado para apoio à gravação de tutoriais em vídeo do sistema DSICOLA.*
