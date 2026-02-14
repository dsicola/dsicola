# Frontend + Domínio Real: Guia Completo

Como fazer o frontend funcionar com o backend em produção e, opcionalmente, usar um domínio próprio.

---

## Visão Geral

| Componente | Estado atual | URL de exemplo |
|------------|--------------|----------------|
| Backend | ✅ Deployado no Railway | `https://dsicola-production.up.railway.app` |
| Frontend | Precisa de deploy | — |
| Domínio próprio | Opcional | `app.dsicola.com` / `api.dsicola.com` |

---

## Parte 1: Deploy do Frontend

Pode usar **Vercel**, **Railway** ou **Netlify**. O projeto já tem `vercel.json`, então Vercel é a opção mais direta.

### Opção A: Vercel (Recomendado)

1. Aceda a [vercel.com](https://vercel.com) e faça login (pode usar GitHub).

2. **Add New** → **Project** → importe o repositório DSICOLA.

3. Configure:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

4. **Environment Variables** (antes do primeiro deploy):

   | Variável | Valor |
   |----------|-------|
   | `VITE_API_URL` | `https://dsicola-production.up.railway.app` |

   Substitua pelo URL real do seu backend no Railway.

5. **Deploy**. A Vercel gera um URL tipo `dsicola-xxx.vercel.app`.

6. Anote o URL do frontend (ex: `https://dsicola-xxx.vercel.app`).

---

### Opção B: Railway (mesmo projeto)

1. No projeto Railway (onde está o backend e o Postgres), clique em **+ New** → **GitHub Repo**.

2. Selecione o **mesmo repositório** DSICOLA.

3. Configure:
   - **Root Directory:** `frontend`
   - O Railway deve detectar como frontend estático (Vite).

4. **Variables**:

   | Variável | Valor |
   |----------|-------|
   | `VITE_API_URL` | `https://dsicola-production.up.railway.app` |

5. **Generate Domain** (Settings → Networking).

6. Anote o URL gerado.

---

### Opção C: Netlify

1. Aceda a [netlify.com](https://netlify.com) e faça login.

2. **Add new site** → **Import an existing project** → conecte o GitHub.

3. Configure:
   - **Base directory:** `frontend`
   - **Build command:** `npm run build`
   - **Publish directory:** `frontend/dist`

4. **Environment variables**:
   - `VITE_API_URL` = `https://dsicola-production.up.railway.app`

5. **Deploy** e anote o URL gerado.

---

## Parte 2: Ligar Frontend e Backend (CORS)

O backend só aceita pedidos do frontend se o domínio estiver configurado em CORS.

1. No Railway, abra o serviço **dsicola** (backend).

2. **Variables** → edite ou adicione `FRONTEND_URL`:

   - **Vercel:** `https://dsicola-xxx.vercel.app`
   - **Railway frontend:** `https://dsicola-frontend-xxx.up.railway.app`
   - **Netlify:** `https://xxx.netlify.app`

3. **Vários frontends** (dev + prod): use vírgulas:
   ```
   https://dsicola-xxx.vercel.app,https://localhost:5173
   ```

4. Guarde. O Railway fará um novo deploy automático.

---

## Parte 3: Domínio Próprio (Opcional)

Para usar `app.dsicola.com` (frontend) e `api.dsicola.com` (backend):

### 3.1 Backend (API)

1. **Railway** → serviço dsicola → **Settings** → **Networking**.
2. **Custom Domain** → adicione `api.dsicola.com`.
3. O Railway mostra um **CNAME** para configurar no DNS.

### 3.2 Frontend

1. **Vercel/Netlify/Railway** → Settings do projeto frontend.
2. **Custom Domain** → adicione `app.dsicola.com`.
3. Siga as instruções de DNS (geralmente CNAME ou A).

### 3.3 DNS (no provedor do domínio)

| Tipo | Nome | Valor |
|------|------|-------|
| CNAME | `api` | (valor dado pelo Railway) |
| CNAME | `app` | (valor dado pela Vercel/Netlify) |

Exemplo: se o domínio for `dsicola.com`:
- `api.dsicola.com` → backend
- `app.dsicola.com` → frontend

### 3.4 Atualizar Variáveis

Depois de o DNS propagar:

1. **Backend (Railway):**
   - `FRONTEND_URL` = `https://app.dsicola.com`

2. **Frontend (Vercel/Railway/Netlify):**
   - `VITE_API_URL` = `https://api.dsicola.com`

3. **Novo build do frontend** (as variáveis Vite são fixadas no build).

---

## Parte 4: Variáveis de Produção (Checklist)

### Backend (Railway – dsicola)

| Variável | Obrigatório | Exemplo |
|----------|-------------|---------|
| `DATABASE_URL` | ✅ | `${{Postgres.DATABASE_URL}}` |
| `JWT_SECRET` | ✅ | `openssl rand -base64 32` |
| `JWT_REFRESH_SECRET` | ✅ | `openssl rand -base64 32` |
| `FRONTEND_URL` | ✅ | URL do frontend (CORS) |
| `NODE_ENV` | Recomendado | `production` |
| `RESEND_API_KEY` | Se usar email | `re_xxxx` |
| `EMAIL_FROM` | Se usar email | `noreply@seudominio.com` |
| `OPENAI_API_KEY` | Opcional | Para AI assistant |
| `BACKUP_ENCRYPTION_KEY` | Se usar backups | `openssl rand -base64 32` |

### Frontend (Vercel/Railway/Netlify)

| Variável | Obrigatório | Exemplo |
|----------|-------------|---------|
| `VITE_API_URL` | ✅ | `https://dsicola-production.up.railway.app` |

---

## Resumo do Fluxo

```
Utilizador → app.dsicola.com (frontend)
                 ↓
            VITE_API_URL
                 ↓
         api.dsicola.com (backend)
                 ↓
            Postgres (Railway)
```

1. O utilizador acede ao frontend.
2. O frontend faz pedidos ao backend usando `VITE_API_URL`.
3. O backend valida CORS com `FRONTEND_URL`.
4. O backend usa o JWT enviado pelo frontend (após login).

---

## Troubleshooting

### "Token não fornecido"
- Normal em rotas protegidas sem login.
- Faça login em `/auth/login`; o frontend guarda o token e envia-o nas próximas chamadas.

### CORS bloqueado
- Confirme que `FRONTEND_URL` no backend inclui exatamente o URL do frontend (sem `/` no fim).
- Use `https://` em produção.

### Frontend não fala com a API
- Confirme `VITE_API_URL` no momento do build.
- Altere a variável e faça um novo deploy.

### Domínio próprio não funciona
- DNS pode demorar até 48h a propagar.
- Confirme CNAME/A no provedor de DNS.
