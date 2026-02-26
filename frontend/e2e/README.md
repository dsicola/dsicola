# E2E - Testes End-to-End (Playwright)

Suite E2E 100% funcional para o frontend. Requer **frontend** acessível e **backend** com dados de seed multi-tenant.

- **Local:** frontend em `http://localhost:8080`, backend (ex.: `:3001`).
- **Staging/Produção:** use `E2E_BASE_URL` (ver secção abaixo).

## Pré-requisitos

1. **Backend** a correr (API com auth e dados de teste).
2. **Frontend** será iniciado automaticamente pelo Playwright (`npm run test:e2e`) ou pode correr manualmente: `npm run dev`.

## Credenciais de teste

Usar utilizadores do seed multi-tenant. Podem ser sobrescritos por variáveis de ambiente:

| Perfil       | Variável (email)              | Variável (password)     | Default (email)                 |
|-------------|-------------------------------|-------------------------|---------------------------------|
| Super Admin | `TEST_SUPER_ADMIN_EMAIL`      | `TEST_SUPER_ADMIN_PASSWORD` | superadmin@dsicola.com     |
| Admin       | `TEST_USER_INST_A_EMAIL`      | `TEST_MULTITENANT_PASS` | admin.inst.a@teste.dsicola.com  |
| Aluno       | `TEST_ALUNO_INST_A_EMAIL`     | `TEST_MULTITENANT_PASS` | aluno.inst.a@teste.dsicola.com  |
| Professor   | `TEST_PROF_INST_A_EMAIL`      | `TEST_MULTITENANT_PASS` | prof.inst.a@teste.dsicola.com   |
| Secretaria  | `TEST_SECRETARIA_INST_A_EMAIL`| `TEST_MULTITENANT_PASS` | secretaria.inst.a@teste.dsicola.com |
| Responsável | `TEST_RESPONSAVEL_INST_A_EMAIL`| `TEST_MULTITENANT_PASS`| responsavel.inst.a@teste.dsicola.com |

## Sistema já em produção: como usar o E2E

Quando o sistema já está no ar (produção ou staging), não precisas de levantar o frontend localmente. Define o URL e as credenciais de teste e corre a suite:

```bash
cd frontend

# URL do teu sistema (ex.: https://app.dsicola.com ou https://staging.dsicola.com)
export E2E_BASE_URL=https://app.dsicola.com

# Credenciais de teste (utilizadores que existem nesse ambiente)
export TEST_SUPER_ADMIN_EMAIL=superadmin@dsicola.com
export TEST_SUPER_ADMIN_PASSWORD="SuperAdmin@123"
export TEST_USER_INST_A_EMAIL=admin.inst.a@teste.dsicola.com
export TEST_MULTITENANT_PASS="TestMultiTenant123!"
# Opcional: TEST_ALUNO_INST_A_EMAIL, TEST_PROF_INST_A_EMAIL, etc.

npm run test:e2e
```

Com `E2E_BASE_URL` definido, o Playwright **não inicia** o dev server e usa esse URL para todos os testes. Recomenda-se usar um ambiente de **staging** ou utilizadores só de teste para não afectar dados reais.

---

## Como funciona em produção / staging

- **A aplicação em produção** usa a API por **same-origin** (o backend atrás do mesmo domínio, via reverse proxy). A URL da API é definida em build com `VITE_API_URL` ou, em domínios não-localhost, o frontend usa `window.location.origin`.
- **E2E contra um URL no ar:** defina **E2E_BASE_URL**; o Playwright não inicia o dev server.
- Em **CI**, pode subir frontend+backend no job ou fazer deploy para um preview e usar `E2E_BASE_URL` com credenciais `TEST_*`.

## Teste full do sistema (multi-tenant + dois tipos de instituição)

### Opção 1: Script único (raiz do projeto)

Com o **backend já a correr** noutro terminal (`cd backend && npm run dev`), na raiz do repositório:

```bash
./scripts/run-full-system-test.sh
```

O script executa: seeds → verifica saúde do backend → `npm run test:full-system` (backend) → `npx playwright install chromium` (se necessário) → `npm run test:e2e:full-system` (frontend).

**Nota:** Na primeira vez, ou se o Playwright tiver sido atualizado, pode ser preciso instalar os browsers: `cd frontend && npx playwright install chromium`.

### Opção 2: Passo a passo

1. **Backend:** com o servidor da API a correr (ex.: `npm run dev` noutro terminal), rodar:
   ```bash
   cd backend
   npm run test:full-system
   ```
   Isto executa: `seed-multi-tenant-test` → `seed-perfis-completos` → `test-multitenant-tipo-instituicao` → `test-suite-completa-all-roles`.

2. **Frontend E2E:** com backend e frontend a correr, rodar o spec full-system:
   ```bash
   cd frontend
   npm run test:e2e -- e2e/full-system-multitenant.spec.ts
   ```
   Ou contra um URL já no ar:
   ```bash
   E2E_BASE_URL=https://staging.dsicola.com E2E_SKIP_WEB_SERVER=1 npm run test:e2e -- e2e/full-system-multitenant.spec.ts
   ```

Credenciais Inst B (Superior) e POS podem ser sobrescritas por env: `TEST_USER_INST_B_EMAIL`, `TEST_PROF_INST_B_EMAIL`, `TEST_ALUNO_INST_B_EMAIL`, `TEST_SECRETARIA_INST_B_EMAIL`, `TEST_POS_INST_A_EMAIL`, `TEST_POS_INST_B_EMAIL`, `TEST_MULTITENANT_PASS`.

## Comandos

```bash
# Documentos + Folha: liga backend e frontend (se não estiverem a correr) e corre E2E
./scripts/run-e2e-documentos-folha.sh

# Todos os testes E2E (Chromium) – inicia o dev server automaticamente
npm run test:e2e

# Teste full: multi-tenant + todos os roles + Inst A (Secundário) e Inst B (Superior)
npm run test:e2e:full-system
# ou: npm run test:e2e -- e2e/full-system-multitenant.spec.ts

# Contra staging/preview (não inicia dev server)
E2E_BASE_URL=https://staging.dsicola.com npm run test:e2e

# Se o dev server já estiver a correr (evita arranque do servidor)
E2E_SKIP_WEB_SERVER=1 npm run test:e2e

# Por área
npm run test:e2e:auth      # Login e auth
npm run test:e2e:admin     # Admin dashboard
npm run test:e2e:flows     # Auth + Admin + i18n
npm run test:e2e:sentry    # ErrorBoundary + report Sentry (rota /test-sentry-error, só em dev)

# Mobile
npm run test:mobile:e2e
npm run test:super-admin-mobile
```

## Estrutura

- `fixtures/auth.ts` – Helpers de login por perfil e credenciais.
- `auth-login.spec.ts` – Login, credenciais inválidas, “Esqueceu a senha”.
- `admin-dashboard.spec.ts` – Admin: dashboard, Gestão Académica, Configurações.
- `aluno.spec.ts` – Aluno: painel, Boletim, Horários.
- `professor.spec.ts` – Professor: painel, Turmas, Notas.
- `secretaria.spec.ts` – Secretaria: painel e Gestão de Alunos.
- `responsavel.spec.ts` – Responsável: painel.
- `matricula-notas.spec.ts` – Admin: matrículas e avaliações/notas.
- `documentos-folha-e2e.spec.ts` – **Documentos oficiais (Secundário + Superior)** e **Folha de Pagamento**: emissão de Declaração de Matrícula na UI, tipos de documento (Inst A e Inst B), listagem de folha de pagamento e filtros (backend e frontend alinhados).
- `full-system-multitenant.spec.ts` – **Teste full:** Inst A (Secundário) e Inst B (Superior), todos os roles (Admin, Professor, Aluno, Secretaria, POS, Responsável), navegação em Gestão Acadêmica, CRUD, Plano de Ensino, Notas, Presenças, multi-tenant.
- `i18n.spec.ts` – Troca de idioma (pt-BR, en, pt-AO) na página de login.
- `mobile-responsive.spec.ts` – Responsividade (landing e auth).
- `super-admin-mobile.spec.ts` – Super Admin em viewport mobile.
- `sentry-error-boundary.spec.ts` – Rota `/test-sentry-error` dispara erro; valida que o ErrorBoundary mostra o fallback (e que o erro é reportado ao Sentry quando configurado). Rota só existe em desenvolvimento.

## CI

Em CI, use `reuseExistingServer: false` (já tratado quando `CI` está definido). Defina as variáveis de teste conforme o seed do ambiente.
