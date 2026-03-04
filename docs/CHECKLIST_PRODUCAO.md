# ✅ Checklist Produção e Segurança - DSICOLA

**Objetivo:** Validar que o sistema está pronto para produção com segurança.

---

## 1. SEGURANÇA (OBRIGATÓRIO)

### 1.1 Autenticação e Autorização

| # | Item | Comando/Verificação |
|---|------|---------------------|
| 1 | Senhas criptografadas (bcrypt) | `npm run test:criterio-seguranca` |
| 2 | JWT com expiração configurada | `.env`: `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` (ex: 15m, 7d) |
| 3 | Secrets fortes (min 32 chars) | `.env`: `JWT_SECRET`, `JWT_REFRESH_SECRET` ≠ valores de exemplo |
| 4 | Rotas protegidas retornam 401 sem token | `npm run test:criterio-seguranca` |
| 5 | RBAC: role insuficiente retorna 403 | `npm run test:security-rbac-api` |
| 6 | Refresh token funcional | `npm run test:criterio-seguranca` |
| 7 | Rate limit no login (brute force) | Já configurado em `auth.routes.ts` |
| 8 | 2FA validado (se ativado) | `npm run test:criterio-seguranca` |

### 1.2 Multi-tenant

| # | Item | Comando |
|---|------|---------|
| 9 | Isolamento: Admin A não vê dados B | `npm run test:multi-tenant` |
| 10 | Professor A não vê alunos B | `npm run test:multi-tenant` |
| 11 | instituicaoId apenas do JWT (não do body) | `npm run test` (rbac-p0) |

### 1.3 Dados e Infraestrutura

| # | Item | Verificação |
|---|------|-------------|
| 12 | .env no .gitignore | Nunca commitar .env |
| 13 | Backup automático do banco | SchedulerService + BackupService |
| 14 | Logs de auditoria ativos | `logs_auditoria` populado em ações sensíveis |

---

## 2. AMBIENTE DE PRODUÇÃO

### 2.1 Variáveis de Ambiente (Backend)

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=<gerar 64 chars aleatórios>
JWT_REFRESH_SECRET=<gerar 64 chars aleatórios>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=https://seu-dominio.com
CORS_ORIGINS=https://seu-dominio.com
```

### 2.2 HTTPS

| # | Item |
|---|------|
| 15 | Backend atrás de proxy HTTPS (Nginx, Railway, etc.) |
| 16 | Frontend servido via HTTPS |
| 17 | Cookies com `Secure` e `SameSite` (se aplicável) |

### 2.3 Base de Dados

| # | Item |
|---|------|
| 18 | Migrations aplicadas: `npx prisma migrate deploy` |
| 19 | Seeds de teste removidos ou isolados (não usar credenciais de teste) |
| 20 | Conexão SSL para PostgreSQL em produção |

---

## 3. TESTES ANTES DO DEPLOY

### Ordem recomendada

```bash
# 1. Testes unitários RBAC (não precisa de backend)
cd backend && npm run test -- src/__tests__/rbac-p0.test.ts

# 2. Critério de segurança (backend deve estar rodando)
cd backend && npm run test:criterio-seguranca

# 3. RBAC via API (backend + seeds)
cd backend && npm run seed:multi-tenant && npm run seed:perfis-completos
cd backend && npm run test:security-rbac-api

# 4. Multi-tenant (backend + seeds)
cd backend && npm run test:multi-tenant

# 5. E2E full-system (backend + frontend + seeds)
./scripts/run-e2e-full-system-standalone.sh
```

### Resumo dos scripts

| Script | O que valida |
|--------|--------------|
| `npm run test` | Testes Vitest (rbac-p0, etc.) |
| `npm run test:criterio-seguranca` | Senhas, JWT, rotas protegidas, refresh, 2FA, rate limit, backup, .env |
| `npm run test:security-rbac-api` | ALUNO/PROFESSOR bloqueados em rotas ADMIN |
| `npm run test:multi-tenant` | Isolamento entre instituições |
| `./scripts/run-e2e-full-system-standalone.sh` | Fluxo completo UI (15 testes) |

---

## 4. PÓS-DEPLOY

| # | Item |
|---|------|
| 21 | GET /health retorna 200 |
| 22 | Login e navegação básica (admin) |
| 23 | Verificar logs de erro (Sentry ou servidor) |
| 24 | Backup da base confirmado |

---

## 5. REFERÊNCIAS

- [DEPLOY_PRODUCAO.md](./DEPLOY_PRODUCAO.md) – Guia de deploy (Railway, Vercel, Docker)
- [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md) – Checklist de release
- [TESTES_PRE_PRODUCAO.md](./TESTES_PRE_PRODUCAO.md) – Testes manuais detalhados
- [SESSAO-E-SEGURANCA.md](./SESSAO-E-SEGURANCA.md) – Sessão e segurança
