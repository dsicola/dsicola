# Validação Completa para Produção — DSICOLA

Guia unificado para validar o sistema antes, durante e após o deploy em produção. Use este documento como fluxo único de validação.

---

## Visão Geral do Fluxo

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  1. PRÉ-DEPLOY  │ →  │  2. STAGING      │ →  │  3. DEPLOY      │ →  │  4. PÓS-DEPLOY  │
│  (local)        │    │  (opcional)      │    │  (produção)     │    │  (produção)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## 1. PRÉ-DEPLOY (Local)

Executar na máquina de desenvolvimento, antes de qualquer deploy.

### 1.1 Builds

```bash
cd backend && npm run build
cd frontend && npm run build
```

| Item | Verificação |
|------|-------------|
| [ ] | Backend compila sem erros |
| [ ] | Frontend compila sem erros |

### 1.2 Testes Automatizados (ordem recomendada)

```bash
# 1. Testes unitários RBAC (não precisa de backend a correr)
cd backend && npm run test -- src/__tests__/rbac-p0.test.ts

# 2. Critério de segurança (backend deve estar a correr)
cd backend && npm run test:criterio-seguranca

# 3. RBAC via API (requer seeds)
cd backend && npm run seed:multi-tenant && npm run seed:perfis-completos
cd backend && npm run test:security-rbac-api

# 4. Multi-tenant
cd backend && npm run test:multi-tenant

# 5. E2E full-system (backend + frontend + seeds)
./scripts/run-e2e-full-system-standalone.sh
```

| Script | O que valida |
|--------|--------------|
| `npm run test` | RBAC, instituicaoId do JWT |
| `npm run test:criterio-seguranca` | Senhas, JWT, rotas protegidas, refresh, 2FA, rate limit |
| `npm run test:security-rbac-api` | ALUNO/PROFESSOR bloqueados em rotas ADMIN |
| `npm run test:multi-tenant` | Isolamento entre instituições |
| `run-e2e-full-system-standalone.sh` | Fluxo completo UI (15+ testes) |

**Critério de sucesso:** Todos os testes passam. Se `run-e2e-full-system-standalone.sh` terminar com `✅ TESTE E2E FULL-SYSTEM CONCLUÍDO COM SUCESSO`, o sistema está validado.

### 1.3 Backup da Base de Dados

| Item | Ação |
|------|------|
| [ ] | Fazer backup da base de produção antes do deploy |
| [ ] | Ou confirmar que backup automático está ativo (SchedulerService) |

---

## 2. STAGING (Opcional mas Recomendado)

Se tiver ambiente de staging (ex.: `staging.dsicola.com`), valide lá antes de produção.

### 2.1 Configuração de Staging

| Item | Verificação |
|------|-------------|
| [ ] | Base de dados separada (nunca a de produção) |
| [ ] | Variáveis de ambiente corretas (ver secção 5) |
| [ ] | Volume persistente para `/app/uploads` ou equivalente |
| [ ] | Domínio de teste configurado |

### 2.2 Seeds de Teste (Staging)

```bash
npx tsx backend/scripts/seed-multi-tenant-test.ts
npx tsx backend/scripts/seed-perfis-completos.ts
```

### 2.3 Checklist Manual em Staging

Use o checklist completo em [TESTE_FULL_SISTEMA_E2E.md](./TESTE_FULL_SISTEMA_E2E.md) (Opção C). Resumo:

| Área | Itens principais |
|------|------------------|
| Autenticação | Login com Admin, Professor, Aluno; logout; redirecionamento |
| Gestão Académica | Cursos, turmas, disciplinas, planos, notas, presenças |
| Gestão de Pessoas | Alunos, professores, documentos, matrículas |
| Professor | Painel, turmas, notas, frequência |
| Aluno | Painel, boletim, horários, mensalidades |
| Secretaria | Gestão, POS, recibos |
| Financeiro | Mensalidades, pagamentos, relatórios |
| Documentos | Upload, visualização, exclusão de comprovativos |
| Biblioteca | Listar, preview PDF, thumbnails |
| Configurações | Instituição, parâmetros, ano letivo |
| Super Admin | Dashboard, instituições, assinaturas, backups |
| Multi-tenant | Admin Inst A não vê dados da Inst B |

### 2.4 Credenciais de Teste (após seeds)

| Perfil | Email | Senha |
|--------|-------|-------|
| Super Admin | superadmin@dsicola.com | SuperAdmin@123 |
| Admin Inst A | admin.inst.a@teste.dsicola.com | TestMultiTenant123! |
| Professor Inst A | prof.inst.a@teste.dsicola.com | TestMultiTenant123! |
| Aluno Inst A | aluno.inst.a@teste.dsicola.com | TestMultiTenant123! |
| Secretaria Inst A | secretaria.inst.a@teste.dsicola.com | TestMultiTenant123! |
| POS Inst A | pos.inst.a@teste.dsicola.com | TestMultiTenant123! |
| Responsável Inst A | responsavel.inst.a@teste.dsicola.com | TestMultiTenant123! |
| Admin Inst B | admin.inst.b@teste.dsicola.com | TestMultiTenant123! |

### 2.5 Monitorização em Staging

| Item | Verificação |
|------|-------------|
| [ ] | Logs do backend sem erros 403/500 |
| [ ] | Console do browser sem erros JS |
| [ ] | Documentos abrem sem TOKEN_MISSING (ver [TROUBLESHOOTING_UPLOADS_DOCUMENTOS.md](./TROUBLESHOOTING_UPLOADS_DOCUMENTOS.md)) |

---

## 3. DEPLOY EM PRODUÇÃO

### 3.1 Antes do Go-Live

| Item | Verificação |
|------|-------------|
| [ ] | SSL/HTTPS configurado |
| [ ] | Variáveis de produção definidas (secção 5) |
| [ ] | Volume persistente para uploads |
| [ ] | Migrations aplicadas: `npx prisma migrate deploy` |
| [ ] | Seeds de teste **não** usados em produção (credenciais reais) |

### 3.2 Plataformas

- **Railway:** Ver [DEPLOY_RAILWAY.md](./DEPLOY_RAILWAY.md)
- **Vercel + Render:** Ver [DEPLOY_PRODUCAO.md](./DEPLOY_PRODUCAO.md)
- **Docker + VPS:** Ver [DEPLOY_PRODUCAO.md](./DEPLOY_PRODUCAO.md)

### 3.3 Plano de Rollback

| Item | Ação |
|------|------|
| [ ] | Usar rollback da plataforma (Railway, Vercel) se disponível |
| [ ] | Manter backup da base antes do deploy |
| [ ] | Em caso de erro crítico: restaurar backup e reverter código |

---

## 4. PÓS-DEPLOY (Produção)

Executar imediatamente após o deploy e nas primeiras 24–48 horas.

### 4.1 Verificações Imediatas

| Item | Comando/Ação |
|------|--------------|
| [ ] | `GET /health` retorna 200 e `{"status":"ok"}` |
| [ ] | Login com conta real (admin ou secretaria) |
| [ ] | Navegação básica: dashboard, listagens |
| [ ] | Upload e visualização de comprovativo |
| [ ] | Ficheiros em `/uploads` servidos corretamente |

### 4.2 Monitorização (24–48 h)

| Item | Verificação |
|------|-------------|
| [ ] | Logs de erro (Sentry ou servidor) |
| [ ] | Sentry configurado: `SENTRY_DSN` (backend), `VITE_SENTRY_DSN` (frontend) — ver [SENTRY_CONFIG.md](./SENTRY_CONFIG.md) |
| [ ] | Backup da base confirmado (automático ou manual) |
| [ ] | Feedback de 2–3 utilizadores reais |

### 4.3 Validação de Fluxo Completo

| Fluxo | Verificação |
|-------|-------------|
| [ ] | Matrícula → pagamento → comprovativo |
| [ ] | Professor lança notas e presenças |
| [ ] | Aluno visualiza boletim e mensalidades |
| [ ] | Secretaria emite recibo no POS |
| [ ] | Multi-tenant: Inst A não vê dados da Inst B |

---

## 5. VARIÁVEIS DE AMBIENTE (Produção)

### 5.1 Backend (obrigatórias)

| Variável | Valor | Notas |
|----------|-------|-------|
| `NODE_ENV` | `production` | Obrigatório |
| `DATABASE_URL` | `postgresql://...` | Conexão SSL em produção |
| `JWT_SECRET` | 64+ caracteres aleatórios | `openssl rand -base64 32` |
| `JWT_REFRESH_SECRET` | 64+ caracteres aleatórios | Diferente do JWT_SECRET |
| `JWT_EXPIRES_IN` | `15m` | Ajustar conforme política |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Ajustar conforme política |
| `FRONTEND_URL` | `https://seu-dominio.com` | URL do frontend |
| `CORS_ORIGINS` | `https://seu-dominio.com` | Origens permitidas |
| `BACKUP_ENCRYPTION_KEY` | base64 (32 bytes) | Para backups encriptados |
| `BACKUP_DIR` | `/data` | Se usar volume persistente |

### 5.2 Backend (opcionais)

| Variável | Uso |
|----------|-----|
| `RESEND_API_KEY`, `EMAIL_FROM` | Emails transacionais |
| `OPENAI_API_KEY` | Assistente IA |
| `SENTRY_DSN` | Monitorização de erros |
| `PLATFORM_BASE_DOMAIN` | Subdomínios (ex: `dsicola.com`) |

### 5.3 Frontend

| Variável | Valor |
|----------|-------|
| `VITE_API_URL` | `https://seu-backend.com` |
| `VITE_SENTRY_DSN` | (opcional) Monitorização |

### 5.4 Segurança

| Item | Verificação |
|------|-------------|
| [ ] | `.env` no `.gitignore` — nunca commitar |
| [ ] | Secrets ≠ valores de exemplo |
| [ ] | HTTPS em backend e frontend |
| [ ] | Cookies com `Secure` e `SameSite` (se aplicável) |

---

## 6. RESUMO RÁPIDO (Checklist de 1 Página)

### Pré-deploy
- [ ] `cd backend && npm run build && npm run test`
- [ ] `cd frontend && npm run build`
- [ ] `./scripts/run-e2e-full-system-standalone.sh` (sucesso)
- [ ] Backup da base

### Staging (se existir)
- [ ] Deploy em staging
- [ ] Checklist manual (TESTE_FULL_SISTEMA_E2E.md Opção C)
- [ ] Sem erros 403/500 nos logs

### Deploy
- [ ] Variáveis de produção configuradas
- [ ] Volume para uploads
- [ ] `npx prisma migrate deploy`
- [ ] Plano de rollback definido

### Pós-deploy
- [ ] `GET /health` → 200
- [ ] Login e navegação
- [ ] Upload/visualização de comprovativo
- [ ] Sentry ou logs nas primeiras 24–48 h

---

## 7. RESOLUÇÃO DE PROBLEMAS

| Problema | Solução |
|----------|---------|
| Backend não inicia | Verificar `DATABASE_URL`, migrations, porta |
| TOKEN_MISSING em documentos | Ver [TROUBLESHOOTING_UPLOADS_DOCUMENTOS.md](./TROUBLESHOOTING_UPLOADS_DOCUMENTOS.md) |
| 403 em `/stats/uso-instituicao` | Corrigir chamadas no frontend para perfis sem permissão |
| Testes E2E falham | Seeds executados? Backend e frontend a correr? `npx playwright install chromium` |
| Build falha | Verificar dependências, Node 18+ |

---

## 8. REFERÊNCIAS

| Documento | Conteúdo |
|-----------|----------|
| [CHECKLIST_PRODUCAO.md](./CHECKLIST_PRODUCAO.md) | Segurança e ambiente detalhado |
| [TESTE_FULL_SISTEMA_E2E.md](./TESTE_FULL_SISTEMA_E2E.md) | Checklist manual completo |
| [DEPLOY_PRODUCAO.md](./DEPLOY_PRODUCAO.md) | Guia de deploy (Railway, Vercel, Docker) |
| [DEPLOY_RAILWAY.md](./DEPLOY_RAILWAY.md) | Passo a passo Railway |
| [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md) | Checklist de release |
| [SENTRY_CONFIG.md](./SENTRY_CONFIG.md) | Monitorização de erros |
| [SESSAO-E-SEGURANCA.md](./SESSAO-E-SEGURANCA.md) | Sessão e segurança |
