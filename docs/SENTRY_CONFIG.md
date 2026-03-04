# Configuração Sentry - Monitorização de Erros

O DSICOLA integra o Sentry para monitorização de erros em produção. A configuração é **opcional** — se não definir as variáveis, a aplicação funciona normalmente sem enviar dados ao Sentry.

---

## 1. Criar projeto no Sentry

1. Aceda a [sentry.io](https://sentry.io) e crie uma conta (ou use a existente).
2. Crie um **projeto** para o backend (ex.: `dsicola-backend`, plataforma Node.js).
3. Crie outro **projeto** para o frontend (ex.: `dsicola-frontend`, plataforma React).
4. Copie o **DSN** de cada projeto (formato: `https://xxx@xxx.ingest.sentry.io/xxx`).

---

## 2. Variáveis de ambiente

### Backend (Railway, Render, etc.)

| Variável | Valor | Obrigatório |
|----------|-------|-------------|
| `SENTRY_DSN` | DSN do projeto backend | Sim (para ativar) |
| `NODE_ENV` | `production` | Sim (Sentry só ativa em produção) |

### Frontend (Vercel, Railway, etc.)

| Variável | Valor | Obrigatório |
|----------|-------|-------------|
| `VITE_SENTRY_DSN` | DSN do projeto frontend | Sim (para ativar) |

**Importante:** O frontend usa variáveis `VITE_*` — estas são injetadas no build. Se alterar `VITE_SENTRY_DSN`, é necessário fazer um novo deploy do frontend.

---

## 3. Source Maps (opcional)

Para ver o código original nos erros (em vez de código minificado):

### Backend
- O Sentry Node captura stack traces automaticamente.

### Frontend
Configure no painel do Railway/Vercel (ou `.env`):

| Variável | Descrição |
|----------|-----------|
| `SENTRY_AUTH_TOKEN` | Token de autenticação Sentry (Settings → Auth Tokens) |
| `SENTRY_ORG` | Nome da organização no Sentry |
| `SENTRY_PROJECT` | Nome do projeto frontend |

O `vite.config.ts` já está preparado para enviar source maps quando estas variáveis existirem.

---

## 4. Verificação

1. Faça deploy com `SENTRY_DSN` e `VITE_SENTRY_DSN` configurados.
2. Provoque um erro (ex.: aceda a uma rota inexistente ou force um erro no frontend).
3. Verifique no painel Sentry se o erro foi registado (pode demorar 1–2 minutos).

---

## 5. O que é capturado

- **Backend:** Exceções não tratadas, erros 500, falhas em rotas.
- **Frontend:** Erros JavaScript, erros de React (ErrorBoundary), falhas de rede.
- **Replay:** Gravação de sessão (10% das sessões) para reproduzir erros — texto mascarado por privacidade.
- **Performance (APM):** tracesSampleRate 0.1 — transações e spans para medir tempo de resposta (p95, p99).

---

## 6. Medição em Produção (ROADMAP-100)

Com SENTRY_DSN e VITE_SENTRY_DSN: Sentry Performance mostra transações por rota, p95, p99. Alternativas: Morgan, Prometheus, Artillery/k6.

---

## Referências

- [Sentry Node.js](https://docs.sentry.io/platforms/javascript/guides/node/)
- [Sentry React](https://docs.sentry.io/platforms/javascript/guides/react/)
