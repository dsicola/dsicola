# Roadmap para Nível 100% — DSICOLA

Documento de **registro de progresso** em direção ao nível profissional 100% (institucional ou superior).  
Atualizar as checkboxes conforme as tarefas forem concluídas. **Quando todos os itens estiverem marcados, considerar o sistema no nível 100%.**

**Ordem de prioridade:** 1. Paridade institucional → 2. Segurança → 3. Estabilidade → 4. Performance (nível institucional) → 5. UX. Ver [PRIORIDADE-100.md](./PRIORIDADE-100.md). UX detalhado em [UX-100.md](./UX-100.md).

---

## 1. Testes

| Estado | Item |
|--------|------|
| ☑ | **E2E** – Fluxo completo: login (Admin/Secretaria/Professor/Aluno), navegação por módulos principais — `e2e/roadmap-100-login-nav.spec.ts`; `npm run test:e2e:roadmap-login-nav` ou `test:e2e:full-system` |
| ☑ | **E2E** – Matrícula: criar aluno, matricular em turma — `e2e/roadmap-100-matricula.spec.ts`; `npm run test:e2e:roadmap-matricula` |
| ☑ | **E2E** – Académico: lançar notas (Secundário + Superior), pauta — Spec: `e2e/roadmap-100-academico.spec.ts`; Comando: `./scripts/run-e2e-academico.sh` ou `npm run test:e2e:roadmap-academico` (requer backend + seed multi-tenant; ver [PRODUCAO-TESTES.md](./PRODUCAO-TESTES.md)) |
| ☑ | **E2E** – Financeiro: listar mensalidades, registrar pagamento — Spec: `e2e/roadmap-100-financeiro.spec.ts`; Comando: `npm run test:e2e:roadmap-financeiro` (requer backend + seed multi-tenant) |
| ☑ | **E2E** – Configurações: `e2e/roadmap-100-configuracoes.spec.ts`; `npm run test:e2e:roadmap-configuracoes` |
| ☑ | **Integração** – Auth: login, refresh, logout — `integration-auth-config.test.ts` |
| ☑ | **Integração** – Configuração instituição: GET/PUT com tenant — `integration-auth-config.test.ts` |
| ☑ | **Integração** – Mensalidades: listagem e multas/juros — `integration-mensalidades.test.ts` |
| ☑ | **Unitários** – Cálculo de multa e juros (lógica de negócio) — `calculoMultaJuros.test.ts` |
| ☑ | **Unitários** – Validações cargo/departamento — `cargo-departamento.test.ts` |
| ☑ | Tratamento de erros uniforme — códigos (VALIDATION_ERROR, NOT_FOUND, etc.) em errorHandler |
| ☑ | Monitorização de erros em produção (ex.: Sentry) — ver [SENTRY_CONFIG.md](./SENTRY_CONFIG.md) |

---

## 2. Performance

| Estado | Item |
|--------|------|
| ☑ | Métricas de tempo de resposta — ver [PERFORMANCE_CHECKLIST.md](./PERFORMANCE_CHECKLIST.md) |
| ☑ | Medição em produção — Sentry Performance (tracesSampleRate); ver [SENTRY_CONFIG.md](./SENTRY_CONFIG.md) |
| ☑ | Paginação em listagens críticas — ver [PERFORMANCE_CHECKLIST.md](./PERFORMANCE_CHECKLIST.md) |
| ☑ | Revisão de queries — ver [QUERIES_REVISAO.md](./QUERIES_REVISAO.md) |
| ☑ | Índices — Mensalidade (alunoId, status); ver schema.prisma |
| ☑ | Cache — configuração da instituição (TTL 5 min); ver configCache.service.ts |
| ☑ | Política de uploads — ver [POLITICA_UPLOADS.md](./POLITICA_UPLOADS.md) |

---

## 3. UX

Ver checklist detalhado em **[UX-100.md](./UX-100.md)** (Loading, Feedback visual, Responsivo, Empty states).

| Estado | Item |
|--------|------|
| ☑ | **Loading em tudo** — Botão mostra “Processando...” / “Salvando…”; listas com skeleton/spinner |
| ☑ | **Feedback visual** — Toasts (sonner) em fluxos críticos; getApiErrorMessage para erros |
| ☑ | **Responsivo** — viewport meta, overflow-x; `npm run test:mobile` e `test:mobile:e2e` |
| ☑ | **Empty states** — EmptyState e ResponsiveTable; GestaoFinanceira, Alojamentos, etc. |
| ☑ | Acessibilidade — ver [ACESSIBILIDADE.md](./ACESSIBILIDADE.md); shadcn/Radix; aria-labels em fluxos críticos |
| ☑ | Design system — ver [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md); shadcn + Tailwind tokens |

---

## 4. Segurança

| Estado | Item |
|--------|------|
| ☑ | Auditoria — CorrecaoNota, backup logs; ver [AUDITORIA_BACKUPS.md](./AUDITORIA_BACKUPS.md) |
| ☑ | Rate limiting — login 5/15min, API 200/min; ver [POLITICAS_SESSAO_SENHA.md](./POLITICAS_SESSAO_SENHA.md) |
| ☑ | Política de senha e de sessão — ver [POLITICAS_SESSAO_SENHA.md](./POLITICAS_SESSAO_SENHA.md) |
| ☑ | LGPD — ver [POLITICA_LGPD.md](./POLITICA_LGPD.md) |
| ☑ | Backups — BackupScheduler; procedimento restore em [AUDITORIA_BACKUPS.md](./AUDITORIA_BACKUPS.md) |

---

## 5. Paridade institucional

| Estado | Item |
|--------|------|
| ☑ | Lista de funcionalidades vs referencial — ver [PARIDADE-SIGAE.md](./PARIDADE-SIGAE.md) |
| ☑ | Relatórios oficiais — implementados; ver [VALIDACAO_RELATORIOS_EXPORTACOES.md](./VALIDACAO_RELATORIOS_EXPORTACOES.md) para validação |
| ☑ | Exportações (SAFT, Excel, PDF) — implementadas; ver VALIDACAO_RELATORIOS_EXPORTACOES.md |
| ☑ | API — documentação em /api-docs; ver [API_VERSIONING.md](./API_VERSIONING.md) |

---

## 6. Operação

| Estado | Item |
|--------|------|
| ☑ | Documentação de utilizador por perfil — ver [DOCUMENTACAO_UTILIZADOR.md](./DOCUMENTACAO_UTILIZADOR.md) |
| ☑ | Onboarding guiado — ver [ONBOARDING.md](./ONBOARDING.md) |
| ☑ | Health check estável (API + opcionalmente DB) – ver endpoint `/health` (inclui `version`) |
| ☑ | Processo de release — ver [PROCESSO_RELEASE.md](./PROCESSO_RELEASE.md) |
| ☑ | Changelog — ver [CHANGELOG.md](./CHANGELOG.md) |
| ☑ | Checklist de release estável disponível — ver [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md) (usar antes de cada deploy) |

---

## Registro de conclusão “Nível 100%”

- **Data em que todos os itens acima foram marcados:** _\_\_\_\_\_\_\_\_\_\_\_\_\_\_
- **Responsável / equipa:** _\_\_\_\_\_\_\_\_\_\_\_\_\_\_
- **Notas (regressões, exceções, próximos passos):** _\_\_\_\_\_\_\_\_\_\_\_\_\_\_

---

*Última atualização do documento: fevereiro 2026.*
