# Impressão de Recibos e Relatórios — dsicola

Documentação do que pode ser impresso, por quem e onde, numa perspetiva de sistema de gestão académica profissional (padrão SIGA/SIGAE).

---

## 1. Visão geral por documento

| Documento | Quem pode imprimir | Onde (tela) | Formato |
|-----------|--------------------|-------------|---------|
| **Recibo de pagamento (mensalidade)** | ADMIN, SECRETARIA, POS, FINANCEIRO, ALUNO (próprios) | Secretaria, POS, Minhas Mensalidades | PDF A4 / Térmico |
| **Comprovante de matrícula** | ADMIN, SECRETARIA (contexto de matrícula) | Admin › Matrículas (Aluno/Turma) | PDF A4 / Térmico |
| **Boletim do aluno** | ADMIN, SECRETARIA, PROFESSOR, COORDENADOR, DIRECAO, ALUNO (próprio) | Relatórios Oficiais, Painel Aluno, Admin | `window.print` / visualização |
| **Histórico escolar** | ADMIN, SECRETARIA, PROFESSOR, COORDENADOR, DIRECAO, ALUNO (próprio) | Relatórios Oficiais, Painel Aluno | `window.print` / visualização |
| **Pauta (plano de ensino)** | ADMIN, SECRETARIA, PROFESSOR, COORDENADOR, DIRECAO | Relatórios Oficiais, Painel Professor | `window.print` / visualização |
| **Certificado de conclusão** | ADMIN, SECRETARIA, COORDENADOR, DIRECAO | Relatórios Oficiais (após conclusão) | PDF |
| **Recibo folha de pagamento (RH)** | ADMIN, RH | Recursos Humanos › Folha de Pagamento | PDF (jsPDF) |
| **Extrato financeiro do aluno** | ALUNO (próprio) | Minhas Mensalidades › Imprimir Extrato | PDF |
| **Mapa de propinas em atraso** | ADMIN, SECRETARIA, FINANCEIRO | Gestão Financeira › Mapa de Atrasos (PDF) | PDF |
| **Lista de alunos por turma** | PROFESSOR | Relatórios Professor › Lista de Alunos › Imprimir | Janela impressão |

---

## 2. Recibos de pagamento (mensalidades)

### Backend
- **Rotas:** `GET /api/recibos`, `GET /api/recibos/:id`
- **Permissões:** ADMIN, SECRETARIA, POS, FINANCEIRO, SUPER_ADMIN

### Frontend
- **Secretaria:** `SecretariaDashboard` › `PrintReceiptDialog` — recibo por pagamento
- **POS:** `POSDashboard` › `PrintReceiptDialog`
- **Aluno:** `MinhasMensalidades` — gera recibo a partir da mensalidade (sem usar API `/recibos`)

### Formato
- `PrintReceiptDialog`: PDF A4 ou térmico (58mm) via `pdfGenerator.ts` — `downloadReciboA4`, `downloadReciboTermico`

### Observação
O **ALUNO** imprime recibos das próprias mensalidades a partir dos dados já disponíveis (mensalidade), sem aceder às rotas `/recibos`. É um fluxo independente e seguro.

---

## 3. Comprovante de matrícula

### Backend
- Usa dados de matrícula/turma; não há rota dedicada para impressão.

### Frontend
- **Admin › Matrículas:** `MatriculasTurmasTab`, `MatriculasAlunoTab` › `PrintMatriculaDialog`
- **Funções:** `downloadMatriculaReciboA4`, `downloadMatriculaReciboTermico` em `pdfGenerator.ts`

### Quem imprime
- ADMIN, SECRETARIA (no contexto de gestão de matrículas)

---

## 4. Relatórios académicos

### Backend — Relatórios oficiais (`/api/relatorios-oficiais`)

| Endpoint | Permissões |
|----------|------------|
| `GET /historico/:alunoId` | ADMIN, SECRETARIA, PROFESSOR, COORDENADOR, DIRECAO, ALUNO |
| `GET /boletim/:alunoId` | ADMIN, SECRETARIA, PROFESSOR, COORDENADOR, DIRECAO, ALUNO |
| `GET /pauta/:planoEnsinoId` | ADMIN, SECRETARIA, PROFESSOR, COORDENADOR, DIRECAO |
| `POST /certificado` | ADMIN, SECRETARIA, COORDENADOR, DIRECAO |
| `GET /bloqueio/:alunoId` | ADMIN, SECRETARIA, PROFESSOR, COORDENADOR, DIRECAO, ALUNO |
| `GET /situacao-financeira/:alunoId` | ADMIN, SECRETARIA, PROFESSOR, COORDENADOR, DIRECAO, ALUNO |

### Regras
- **PROFESSOR:** apenas pautas dos seus próprios planos de ensino.
- **ALUNO:** apenas histórico e boletim próprios.
- **SECRETARIA:** pode gerar todos os relatórios oficiais em nome de qualquer aluno/turma.

### Frontend — Onde imprimir
- **Boletim:** `BoletimVisualizacao.tsx` — botão "Imprimir" com `window.print()`
- **Histórico:** `HistoricoEscolarVisualizacao.tsx` — botão "Imprimir" com `window.print()`
- **Pauta:** `PautaVisualizacao.tsx` — botão "Imprimir" com `window.print()`

### Onde aceder
- **Secretaria:** `/secretaria-dashboard/relatorios-oficiais` › `RelatoriosOficiaisTab`
- **Aluno:** painel do aluno › boletim e histórico (só dados próprios)
- **Professor:** painel do professor › pautas das suas turmas
- **Admin:** configuração de ensino › Relatórios Oficiais

---

## 5. Recibo de folha de pagamento (RH)

### Onde
- **Recursos Humanos › Folha de Pagamento** › `FolhaPagamentoTab`

### Quem
- ADMIN, RH, SUPER_ADMIN

### Formato
- PDF gerado com jsPDF (`generateReciboPDF`)
- **Quando:** apenas quando a folha está com status **PAID**
- **Ações:** "Imprimir recibo" (por funcionário) e "Imprimir Todos"

---

## 6. Matriz resumida por perfil

| Perfil | Recibo mensalidade | Comprovante matrícula | Boletim | Histórico | Pauta | Certificado | Recibo folha (RH) |
|--------|--------------------|----------------------|---------|-----------|-------|-------------|-------------------|
| SUPER_ADMIN | ✅ (recibos) | — | — | — | — | — | — |
| ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| SECRETARIA | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| POS | ✅ | — | — | — | — | — | — |
| FINANCEIRO | ✅ | — | — | — | — | — | — |
| PROFESSOR | — | — | ✅ (turmas) | ✅ (turmas) | ✅ (seus planos) | — | — |
| COORDENADOR | — | — | ✅ | ✅ | ✅ | ✅ | — |
| DIRECAO | — | — | ✅ | ✅ | ✅ | ✅ | — |
| ALUNO | ✅ (próprios) | — | ✅ (próprio) | ✅ (próprio) | — | — | — |
| RH | — | — | — | — | — | — | ✅ |

---

## 7. Ficheiros principais

### Backend
- `backend/src/routes/recibo.routes.ts`
- `backend/src/routes/relatoriosOficiais.routes.ts`
- `backend/src/routes/relatorios.routes.ts`
- `backend/src/controllers/recibo.controller.ts`
- `backend/src/controllers/relatoriosOficiais.controller.ts`

### Frontend
- `frontend/src/utils/pdfGenerator.ts` — geração de PDFs (recibo, matrícula)
- `frontend/src/components/secretaria/PrintReceiptDialog.tsx`
- `frontend/src/components/secretaria/PrintMatriculaDialog.tsx`
- `frontend/src/components/secretaria/RelatoriosOficiaisTab.tsx`
- `frontend/src/components/relatorios/BoletimVisualizacao.tsx`
- `frontend/src/components/relatorios/HistoricoEscolarVisualizacao.tsx`
- `frontend/src/components/relatorios/PautaVisualizacao.tsx`
- `frontend/src/config/reportsByRole.ts` — mapeamento de relatórios por perfil

---

## 8. Fluxos típicos

### Aluno imprime recibo
1. Aceder a **Minhas Mensalidades**.
2. Escolher mensalidade paga.
3. Clicar em "Baixar recibo" ou abrir diálogo de impressão.
4. O recibo é gerado no frontend a partir da mensalidade (sem chamar `/recibos`).

### Secretaria imprime relatório para aluno
1. Aceder a **Relatórios Oficiais**.
2. Escolher tipo: Boletim, Histórico ou Pauta.
3. Selecionar aluno ou plano de ensino.
4. Gerar relatório e usar o botão "Imprimir" do browser.

### Secretaria imprime recibo de pagamento
1. Em **Secretaria Dashboard** ou **POS**.
2. Localizar pagamento.
3. Abrir `PrintReceiptDialog` e escolher A4 ou térmico.

---

## 9. Alterações recentes (2025-02)

- **SECRETARIA** adicionada às rotas de relatórios oficiais: histórico, boletim, pauta, certificado, bloqueio e situação financeira.
- **resolveProfessor** ajustado para permitir que SECRETARIA, COORDENADOR e DIRECAO acedam a pautas mesmo sem registo na tabela `professores`.
- **Extrato financeiro:** botão "Imprimir Extrato" em Minhas Mensalidades (ALUNO) — gera PDF com histórico de mensalidades.
- **Mapa de propinas em atraso:** botão "Mapa de Atrasos (PDF)" em Gestão Financeira (ADMIN/FINANCEIRO).
- **Lista de alunos:** botão "Imprimir" na Lista de Alunos em Professor Relatórios.
- **FINANCEIRO** em `reportsByRole`: Recibos e Pagamentos Recebidos.
- **Fatura** para mensalidades: opção em PrintReceiptDialog (Fatura A4).
- **Relatório mensal/anual de receitas:** botões em Gestão Financeira.
- **Ficha cadastral do aluno:** EmitirDocumentoTab › Gerar Ficha Cadastral.
- **Declaração personalizada:** EmitirDocumentoTab › texto livre + PDF.

## 10. Checklist profissional (conforme especificação)

| Item | Status |
|------|--------|
| **Ensino Secundário** | |
| Pauta trimestral por turma | ✅ Pauta Final, Pauta por Plano |
| Boletim de notas (por trimestre) | ✅ BoletimVisualizacao |
| Declaração de matrícula | ✅ EmitirDocumentoTab, PrintMatriculaDialog |
| Declaração de frequência | ✅ EmitirDocumentoTab |
| Histórico escolar | ✅ relatoriosOficiais |
| Ata de resultados | ✅ ATA_AVALIACOES via /relatorios/gerar |
| Lista de alunos por turma | ✅ ProfessorRelatorios + Imprimir |
| Mapa estatístico de aproveitamento | ⚠️ Parcial (MAPA_PRESENCAS, ATA_AVALIACOES) |
| **Ensino Superior** | |
| Pauta por disciplina | ✅ relatoriosOficiais/pauta |
| Histórico académico completo | ✅ |
| Ficha individual do estudante | ⚠️ Boletim cumpre papel similar |
| Certificado de conclusão | ✅ |
| Plano curricular | ✅ Plano de Ensino Oficial |
| Ata final de semestre | ✅ ATA_AVALIACOES |
| Lista de estudantes por disciplina | ✅ Via turma/plano |
| **Área Financeira** | |
| Recibo de pagamento | ✅ |
| Fatura | ✅ PrintReceiptDialog › Fatura A4 |
| Extrato financeiro do aluno | ✅ Minhas Mensalidades |
| Mapa de propinas em atraso | ✅ Gestão Financeira |
| Relatório mensal de receitas | ✅ Gestão Financeira › Rel. Receitas Mês |
| Relatório anual financeiro | ✅ Gestão Financeira › Rel. Receitas Ano |
| **Área Administrativa** | |
| Lista de presenças | ✅ MAPA_PRESENCAS |
| Relatório de faltas | ✅ Incluído em MAPA_PRESENCAS |
| Contrato de matrícula | ⚠️ Comprovante de matrícula existe |
| Ficha cadastral do aluno | ✅ EmitirDocumentoTab › Ficha Cadastral |
| Declaração personalizada | ✅ EmitirDocumentoTab › Declaração Personalizada |
