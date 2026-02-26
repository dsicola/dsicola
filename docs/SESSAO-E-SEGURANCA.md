# Política de Sessão e Rate Limit — DSICOLA

Garantir **sessão que expira após inatividade** e **proteção contra ataques de login** (multi-institucional).

---

## 1. Expirar após inatividade

O sistema usa **JWT** (access + refresh). A sessão efectiva expira por inatividade da seguinte forma:

| Variável | Valor recomendado | Significado |
|----------|-------------------|-------------|
| `JWT_EXPIRES_IN` | `15m` | Token de **acesso** expira em 15 minutos. Se o utilizador não fizer nenhum pedido à API durante 15 minutos, o token deixa de ser válido. |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Token de **refresh** expira em 7 dias. O utilizador deve usar o refresh (ex.: ao reabrir a aplicação) antes de 7 dias; caso contrário terá de fazer login de novo. |

**Comportamento:**

- **Inatividade curta:** Após 15 minutos sem pedidos à API, o acesso expira. O frontend deve usar o endpoint `/auth/refresh` com o refresh token para obter um novo par de tokens (se ainda dentro dos 7 dias).
- **Inatividade longa:** Após 7 dias sem usar o refresh, a sessão termina e é obrigatório novo login.

**Configuração (backend):** Definir no ambiente (produção):

```env
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

Se não definido, o backend usa estes valores por defeito (ver `backend/src/services/auth.service.ts`).

---

## 2. Rate limit (evitar ataques de login)

| Endpoint | Limite | Janela | Objetivo |
|----------|--------|--------|----------|
| `POST /auth/login` | 10 req (prod) / 30 (dev) | 1 minuto por IP | Brute force no login |
| `POST /auth/login-step2` | 5 req (prod) / 20 (dev) | 1 minuto por IP | Brute force no código 2FA |
| `POST /auth/register` | igual ao login | 1 minuto por IP | Abuso de registo |
| `POST /auth/reset-password` | 5 req | 15 minutos por IP | Abuso de recuperação de senha |
| `POST /auth/confirm-reset-password` | 5 req | 15 minutos por IP | Abuso de confirmação de reset |
| API global (`app.ts`) | 200 req | 1 minuto por IP | Abuso geral; `/health` e `/api-docs` excluídos |

Implementação: `express-rate-limit` em `backend/src/routes/auth.routes.ts` e `backend/src/app.ts`.

---

## 3. Resumo

- **Sessão:** Expira após **15 minutos** de inatividade (token de acesso). Refresh válido até **7 dias**; depois é necessário novo login.
- **Rate limit:** Login e recuperação de senha limitados por IP; reduz risco de ataques de força bruta.

*Documento no âmbito do [ROADMAP-100.md](./ROADMAP-100.md) e [PRIORIDADE-SEGURANCA-PERFORMANCE.md](./PRIORIDADE-SEGURANCA-PERFORMANCE.md).*
