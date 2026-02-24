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
- **E2E full-system:** interface para todos os roles nas duas instituições (login, navegação, páginas críticas).

---

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
