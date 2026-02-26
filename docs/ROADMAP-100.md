# Roadmap para Nível 100% — DSICOLA

Documento de **registro de progresso** em direção ao nível profissional 100% (SIGAE ou superior).  
Atualizar as checkboxes conforme as tarefas forem concluídas. **Quando todos os itens estiverem marcados, considerar o sistema no nível 100%.**

---

## 1. Testes

| Estado | Item |
|--------|------|
| ☑ | **E2E** – Fluxo completo: login (Admin/Secretaria/Professor/Aluno), navegação por módulos principais — `e2e/roadmap-100-login-nav.spec.ts`; `npm run test:e2e:roadmap-login-nav` ou `test:e2e:full-system` |
| ☑ | **E2E** – Matrícula: criar aluno, matricular em turma — `e2e/roadmap-100-matricula.spec.ts`; `npm run test:e2e:roadmap-matricula` |
| ☑ | **E2E** – Académico: lançar notas (Secundário + Superior), pauta — Spec: `e2e/roadmap-100-academico.spec.ts`; Comando: `./scripts/run-e2e-academico.sh` ou `npm run test:e2e:roadmap-academico` (requer backend + seed multi-tenant; ver [PRODUCAO-TESTES.md](./PRODUCAO-TESTES.md)) |
| ☑ | **E2E** – Financeiro: listar mensalidades, registrar pagamento — Spec: `e2e/roadmap-100-financeiro.spec.ts`; Comando: `npm run test:e2e:roadmap-financeiro` (requer backend + seed multi-tenant) |
| ☐ | **E2E** – Configurações: salvar configuração da instituição (sem quebrar) |
| ☐ | **Integração** – Auth: login, refresh, logout, recuperação de senha |
| ☐ | **Integração** – Configuração instituição: GET/PUT com tenant |
| ☐ | **Integração** – Mensalidades: listagem e aplicação de multas/juros |
| ☑ | **Unitários** – Cálculo de multa e juros (lógica de negócio) — `calculoMultaJuros.test.ts` |
| ☐ | **Unitários** – Outras regras de negócio críticas (validações, médias) |
| ☐ | Tratamento de erros uniforme (mensagens e códigos HTTP consistentes) |
| ☐ | Monitorização de erros em produção (ex.: Sentry) configurada e ativa |

---

## 2. Performance

| Estado | Item |
|--------|------|
| ☐ | Métricas de tempo de resposta definidas (ex.: p95 &lt; 2–3s para salvamentos e listagens críticas) |
| ☐ | Medição em produção ou staging (logs/APM) para endpoints críticos |
| ☐ | Paginação em todas as listagens que podem crescer (alunos, mensalidades, notas, documentos, logs) |
| ☐ | Revisão de queries (N+1, select mínimo) nos fluxos mais usados |
| ☐ | Índices de base de dados revisados/criados onde necessário (Prisma/DB) |
| ☐ | Cache onde fizer sentido (ex.: configuração da instituição, listas estáticas) |
| ☐ | Política de uploads (tamanho, tipos, armazenamento) documentada e aplicada |

---

## 3. UX

| Estado | Item |
|--------|------|
| ☐ | Loading/feedback em todas as ações de salvamento e submissão (botões desativados, “Salvando…”) |
| ☐ | Toasts de sucesso/erro consistentes em fluxos críticos |
| ☐ | Acessibilidade básica: contraste, foco, labels, navegação por teclado (WCAG 2.1 AA onde possível) |
| ☐ | Responsividade verificada nas páginas principais (admin, secretaria, professor, relatórios) |
| ☐ | Design system estável (componentes, espaçamentos, tipografia) em todo o produto |
| ☐ | Empty states e mensagens de erro úteis com ação sugerida onde aplicável |

---

## 4. Segurança

| Estado | Item |
|--------|------|
| ☐ | Auditoria de acessos e alterações sensíveis (notas, matrículas, dados fiscais) com logs imutáveis e consultáveis |
| ☐ | Rate limiting em APIs públicas e em login/recuperação de senha (já parcial; revisar cobertura) |
| ☐ | Política de senha e de sessão (expiração, renovação de token) documentada e aplicada |
| ☐ | Alinhamento a boas práticas de dados pessoais (minimização, retenção, direito ao esquecimento onde aplicável) |
| ☐ | Backups automatizados com restores testados periodicamente e política de retenção definida |

---

## 5. Paridade SIGAE

| Estado | Item |
|--------|------|
| ☐ | Lista de funcionalidades vs SIGAE (ou referencial) fechada e validada – ver [PARIDADE-SIGAE.md](./PARIDADE-SIGAE.md) |
| ☐ | Relatórios oficiais exigidos por instituições/Ministério implementados e validados com utilizadores |
| ☐ | Exportações obrigatórias (SAFT, Excel, PDF) estáveis e testadas |
| ☐ | Se houver API pública: documentação e versionamento definidos |

---

## 6. Operação

| Estado | Item |
|--------|------|
| ☐ | Documentação de utilizador por perfil (Admin, Secretaria, Professor, etc.) e FAQ |
| ☐ | Onboarding guiado e verificação de “primeiro uso” (dados mínimos) antes de módulos pesados |
| ☑ | Health check estável (API + opcionalmente DB) – ver endpoint `/health` (inclui `version`) |
| ☐ | Processo de release estável: testes automatizados antes do deploy, staging, rollback possível |
| ☐ | Changelog ou versionamento da API para integradores e frontend |
| ☑ | Checklist de release estável disponível — ver [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md) (usar antes de cada deploy) |

---

## Registro de conclusão “Nível 100%”

- **Data em que todos os itens acima foram marcados:** _\_\_\_\_\_\_\_\_\_\_\_\_\_\_
- **Responsável / equipa:** _\_\_\_\_\_\_\_\_\_\_\_\_\_\_
- **Notas (regressões, exceções, próximos passos):** _\_\_\_\_\_\_\_\_\_\_\_\_\_\_

---

*Última atualização do documento: fevereiro 2026.*
