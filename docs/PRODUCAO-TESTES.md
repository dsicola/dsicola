# Teste completo do sistema – Pronto para produção

Forma **correta e recomendada** de validar que o DSICOLA está pronto para produção.

---

## Ordem recomendada

| # | Passo | O que valida | Comando |
|---|--------|--------------|---------|
| 1 | Build backend | Código compila; Prisma e TypeScript OK | `cd backend && npm run build` |
| 2 | Build frontend | Frontend compila sem erros | `cd frontend && npm run build` |
| 3 | Testes unitários/integração (Vitest) | RBAC, multi-tenant, recibo, plano de ensino, OpenAPI, etc. | `cd backend && npm run test` |
| 4 | Backend a correr | API disponível | `cd backend && npm run dev` (noutro terminal) |
| 5 | Seeds (ambiente de teste) | Dados multi-tenant + todos os perfis | `cd backend && npm run seed:multi-tenant && npm run seed:perfis-completos` |
| 6 | Teste full backend | Multi-tenant, dois tipos (Secundário/Superior), todos os perfis (Admin, Secretaria, Professor, Aluno, POS) | `cd backend && npm run test:full-system` |
| 7 | E2E (Playwright) | Fluxos no browser: todos os roles, Inst A e Inst B | `cd frontend && npm run test:e2e:full-system` |

---

## Script único (tudo em sequência)

Com o **backend já a correr** (noutro terminal: `cd backend && npm run dev`):

```bash
./scripts/run-full-system-test.sh
```

Este script faz: seeds → verifica saúde da API → test:full-system → E2E full-system.

Para incluir **builds + Vitest** antes (validação máxima antes de subir servidor):

```bash
./scripts/run-producao-check.sh
```

(O script verifica build backend/frontend, Vitest, e depois o full-system se a API estiver disponível.)

---

## O que cada parte garante

- **Build backend/frontend:** sem erros de compilação; dependências e Prisma OK.
- **Vitest (backend):** regras de negócio, RBAC, isolamento por tenant, **validação por subdomínio (multi-tenant por domínio, SECUNDARIO/SUPERIOR)**, recibo, plano de ensino, OpenAPI.
- **test:full-system:** API com dois tipos de instituição (Secundário/Superior), isolamento multi-tenant, e fluxos de todos os perfis (Admin, Secretaria, Professor, Aluno, POS).
- **E2E full-system:** interface para todos os roles nas duas instituições (login, navegação, páginas críticas). O item “E2E – Fluxo completo login e navegação” do [ROADMAP-100](ROADMAP-100.md) pode ser validado com `npm run test:e2e:roadmap-login-nav` (spec `e2e/roadmap-100-login-nav.spec.ts`). O item "E2E – Matrícula: criar aluno, matricular em turma" com `npm run test:e2e:roadmap-matricula` (spec `e2e/roadmap-100-matricula.spec.ts`). O item "E2E – Académico: lançar notas, fechar avaliação, pauta" com `npm run test:e2e:roadmap-academico` (spec `e2e/roadmap-100-academico.spec.ts`); cobre Secundário (Inst A) e Superior (Inst B) e pauta; requer seeds multi-tenant. O item "E2E – Financeiro: listar mensalidades, registrar pagamento" com `npm run test:e2e:roadmap-financeiro` (spec `e2e/roadmap-100-financeiro.spec.ts`); requer seed multi-tenant (que cria uma mensalidade Pendente para Aluno A).

---

**E2E – browser:** Se o Chromium headless falhar ("browser has been closed"), use `npx playwright test e2e/full-system-multitenant.spec.ts --project=chrome` ou `--project=firefox`. Com frontend já em 8080: `E2E_SKIP_WEB_SERVER=1 npm run test:e2e:full-system`.

## Testes por módulo (académico, RH, professores, estudante, etc.)

Para garantir que **cada área** está a funcionar, podes correr os testes por módulo. Pré-requisito: backend a correr (`cd backend && npm run dev`) e, para a maioria, seeds aplicados (`npm run seed:multi-tenant` e `npm run seed:perfis-completos`).

| Módulo | O que cobre | Comando (backend) | E2E (frontend) |
|--------|--------------|--------------------|----------------|
| **Admin** | Gestão da instituição, usuários, configurações, gestão académica | `cd backend && npm run test:admin-fluxo-completo` | `npm run test:e2e:admin`; full-system: “Admin Inst A/B: dashboard, Gestão Alunos/Professores, Plano de Ensino, Notas, Presenças” |
| **RH** | Perfis RH, folha, financeiro associado | `cd backend && npm run test:rh-financeiro` | Credenciais: `rh.inst.a@teste.dsicola.com` / `rh.inst.b@teste.dsicola.com` (teste manual ou E2E se existir spec) |
| **Professores** | Painel, turmas, pautas, avaliações, planos de ensino | `cd backend && npm run test:professor-fluxo-completo` | `npm run test:e2e -- e2e/professor.spec.ts`; full-system: “Professor Inst A/B: painel, turmas, notas, frequência” |
| **Estudante (Aluno)** | Notas, disciplinas, mensalidades, documentos | `cd backend && npm run test:estudante-fluxo-completo` | full-system: login Aluno Inst A/B e navegação; `test:perfil-estudante` para API |
| **Secretaria** | Matrículas, documentos, operações administrativas | `cd backend && npm run test:secretaria-fluxo-completo` | full-system: “Secretaria Inst A/B” |
| **POS / Financeiro** | Pagamentos, recibos, ponto de venda | `cd backend && npm run test:pos-fluxo-completo` | full-system: “POS Inst A/B” |
| **Plano de ensino** | Cursos, disciplinas, distribuição por turma (Secundário + Superior) | `cd backend && npm run test:plano-ensino-fluxo-secundario` e `npm run test:plano-ensino-fluxo-superior`; suite: `npm run test:plano-ensino-e-professor-suite` | full-system: “Admin: Plano de Ensino”; “Professor: turmas” |
| **Horários** | Distribuição de horários, sugestões, conflitos (Secundário + Superior) | `cd backend && npm run test:horarios:full`; sugestões: `npm run test:horarios:sugestoes:secundario-superior:full`; com intervalos: `npm run test:plano-ensino-horarios-intervalos` | Navegação em horários via Admin/Professor no E2E full-system |
| **Aulas** | Registo de aulas (ligado a plano de ensino e turma) | Incluído em `test:professor-fluxo-completo` e em Vitest (professor-plano-dashboard); validações em `TESTES_CENARIOS_PROFESSOR.md` | Professor: painel e turmas (implicitamente aulas) |
| **Avaliações / Notas** | Período de lançamento, lançamento de notas, pautas | `cd backend && npm run test:lancamento-notas`; `npm run test:periodo-lancamento-notas`; período multi-tenant: `npx tsx scripts/test-periodo-lancamento-multitenant.ts` | full-system: “Avaliações/Notas”, “Professor: notas”; `npm run test:e2e -- e2e/matricula-notas.spec.ts` |
| **Exames** | (Se existir módulo de exames específico) | Verificar em `backend/scripts/test-*.ts` ou rotas de exames | — |
| **Validação por subdomínio (tenant)** | Subdomínio por instituição, domínio central (app), localhost ignorado, SECUNDARIO/SUPERIOR, erros 403/404 controlados | `cd backend && npm run test -- --run src/__tests__/validateTenantDomain.test.ts` | — |
| **Académico (geral)** | Cursos, turmas, matrículas, diferenciação Sec/Sup | `cd backend && npm run test:fluxo-planos-secundario-superior`; `npm run test:matricula-turma-disciplina`; `npm run test:diferenciacao-sec-sup` | full-system: “Gestão Acadêmica”, “Gestão Alunos”, “Plano de Ensino, Avaliações, Presenças” |

### Suite de produção (todos os módulos principais)

Com o backend a correr, a **suite de produção** executa multi-tenant, todos os perfis (Admin, Secretaria, Professor, Estudante, POS), académico (planos, matrículas), financeiro (recibos, RH) e segurança:

```bash
cd backend
npm run seed:multi-tenant
npm run test:suite-producao
```

Isto não substitui o **test:full-system** nem o **E2E full-system**; o full-system inclui ainda tipos de instituição (Secundário/Superior) e a suite E2E no browser. Para validar **tudo** (incluindo todos os módulos acima):

1. `./scripts/run-producao-check.sh` (build + Vitest + full-system + E2E se API estiver ativa), ou  
2. Backend a correr → `npm run test:full-system` → `cd frontend && npm run test:e2e:full-system`.

---

## Em CI (GitHub Actions)

O workflow em `.github/workflows/ci.yml` executa apenas **build** backend e frontend. Os passos 3–7 (Vitest, seeds, test:full-system, E2E) podem ser adicionados ao CI com base de dados e serviços configurados no workflow.

---

## Resumo rápido

1. `cd backend && npm run build && npm run test`
2. `cd frontend && npm run build`
3. Noutro terminal: `cd backend && npm run dev`
4. `./scripts/run-full-system-test.sh`

Se todos passarem, o sistema está validado para produção do ponto de vista de testes automatizados.

---

## Release estável (ROADMAP-100)

Para garantir que cada release não quebra nada e que o sistema caminha para o nível 100%, ver:

- **[docs/ROADMAP-100.md](ROADMAP-100.md)** — Checklist completo (testes, performance, UX, segurança, paridade SIGAE, operação) e registro de conclusão.
- **[docs/PARIDADE-SIGAE.md](PARIDADE-SIGAE.md)** — Lista de funcionalidades e relatórios oficiais a validar.
- **[docs/BACKUP-VERIFICACAO.md](BACKUP-VERIFICACAO.md)** — Verificação de backups e restores.
- **[docs/DOCS-USUARIO.md](DOCS-USUARIO.md)** — Esqueleto da documentação do utilizador por perfil.

Antes de cada deploy: executar build + testes (backend e frontend) e, quando possível, teste E2E ou full-system.

---

## E2E: Chromium/Chrome a crashar (SIGSEGV/SIGABRT) no macOS

Em alguns ambientes (macOS, sandbox, ou quando o Chromium/Chrome do Playwright falha), os testes E2E podem falhar com:

- **Erro:** `browserType.launch: Target page, context or browser has been closed` e nos logs do browser: `SIGSEGV` ou `SIGABRT` (processo do browser terminado).

**Como resolver:**

1. **Usar o Chrome instalado no sistema** em vez do Chromium do Playwright:
   - Garante que tens [Google Chrome](https://www.google.com/chrome/) instalado.
   - No `frontend`, corre os testes com o projeto `chrome`:
     ```bash
     npm run test:e2e:roadmap-academico:chrome
     ```
     Ou, com frontend já a correr em `http://localhost:8080`:
     ```bash
     npm run test:e2e:roadmap-academico:chrome:no-server
     ```
   - Para outros specs E2E: `npx playwright test --project=chrome` (ex.: `npx playwright test e2e/roadmap-100-login-nav.spec.ts --project=chrome`).

2. **Correr no terminal local** (fora do Cursor/IDE), com backend e, se usares `no-server`, frontend a correr. Evita correr Playwright dentro de sandboxes que limitem o browser.

3. **Usar Firefox em vez de Chrome:** se o Chrome continuar a crashar, instala o browser Firefox do Playwright e corre com o projeto `firefox`:
   ```bash
   cd frontend && npx playwright install firefox
   PLAYWRIGHT_PROJECT=firefox ./scripts/run-e2e-academico.sh
   ```
   Ou só os testes: `E2E_SKIP_WEB_SERVER=1 E2E_BASE_URL=http://localhost:8080 npx playwright test e2e/roadmap-100-academico.spec.ts --project=firefox`

4. **Atualizar Playwright e browsers:** `cd frontend && npx playwright install` (e, se necessário, `npx playwright install chromium`). Em máquinas mais antigas, uma versão mais recente pode corrigir o crash.

---

## Garantir que os E2E académico passem

1. **Backend a correr:** `cd backend && npm run dev` (porta 3001).
2. **Seed multi-tenant (obrigatório):** `cd backend && npm run seed:multi-tenant` — cria Inst A (Secundário) e Inst B (Superior), professores, alunos, turmas, planos de ensino, exames e período de lançamento.
3. **Frontend a correr:** `cd frontend && npm run dev` (porta 8080).
4. **Correr com Chrome (evita crash do Chromium):**  
   `cd frontend && npm run test:e2e:roadmap-academico:chrome:no-server`  
   Ou, para o Playwright iniciar o frontend:  
   `cd frontend && npm run test:e2e:roadmap-academico:chrome`

Se o teste falhar à espera da opção do combobox ou do input de nota, confirma que o seed foi executado e que o backend está a responder em 3001 (e que o frontend usa essa API).

**Diagnóstico (turmas do professor na BD):** para confirmar que a base tem dados para o professor do seed:

```bash
cd backend && npx tsx scripts/verificar-turmas-professor.ts
```

Se aparecer "Planos de Ensino: 0", o problema está nos dados (ou na BD que o backend usa). Se aparecer 1 ou mais planos, o problema pode ser token/request (frontend não envia token ou backend em outra instância).

**Comandos (executar a partir da raiz do projeto, ex.: `~/Documents/dsicola`):**

- **Só o seed multi-tenant** (o script está em `backend/scripts/`):
  ```bash
  cd backend && npx tsx scripts/seed-multi-tenant-test.ts
  ```
- **E2E académico (script único: seed + backend/frontend + testes):**
  ```bash
  ./scripts/run-e2e-academico.sh
  ```
- **E2E académico com Firefox:**
  ```bash
  PLAYWRIGHT_PROJECT=firefox ./scripts/run-e2e-academico.sh
  ```

O script único: verifica/inicia backend (3001) → corre seed multi-tenant → verifica/inicia frontend (8080) → instala Chrome para Playwright → corre `e2e/roadmap-100-academico.spec.ts`. Para usar Firefox: `npx playwright install firefox` (uma vez) e depois `PLAYWRIGHT_PROJECT=firefox ./scripts/run-e2e-academico.sh`.
