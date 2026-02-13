# 🚂 Guia Completo: Hospedar DSICOLA no Railway

Passo a passo detalhado para colocar o sistema em produção no Railway.

---

## Pré-requisitos

- [ ] Conta no [GitHub](https://github.com) com o projeto DSICOLA
- [ ] Conta no [Railway](https://railway.app)
- [ ] Código num repositório Git (GitHub, GitLab ou Bitbucket)

---

## Parte 1: PostgreSQL (Base de Dados)

1. Aceda a [railway.app](https://railway.app) e faça login (pode usar GitHub).

2. Clique em **New Project**.

3. Selecione **Provision PostgreSQL**.
   - Railway cria a base de dados e gera automaticamente a variável `DATABASE_URL`.

4. Clique no serviço PostgreSQL → **Variables** e anote que existe `DATABASE_URL` (ou `DATABASE_PRIVATE_URL`). Será ligada ao backend em seguida.

---

## Parte 2: Backend (API)

1. No mesmo projeto, clique em **+ New** → **GitHub Repo**.

2. **Conecte o repositório** DSICOLA (autorize o Railway se for pedido).

3. Configure o serviço:
   - **Root Directory:** deixe **VAZIO** (o Dockerfile está na raiz do repo)
   - O `railway.toml` na raiz força `builder = "DOCKERFILE"`
   - Se ainda usar Railpack, adicione variável: `RAILWAY_DOCKERFILE_PATH` = `Dockerfile`
   - **Build Command:** deixe vazio (o Dockerfile trata do build)
   - **Start Command:** (o CMD do Dockerfile já inclui migração e arranque)
     ```
     npx prisma migrate deploy && node dist/server.js
     ```

4. **Variáveis de ambiente** (Settings → Variables → Add Variable):

   | Variável | Valor | Onde obter |
   |----------|-------|------------|
   | `DATABASE_URL` | (ligar ao PostgreSQL) | Clique em **Add Reference** → selecione a variável do serviço PostgreSQL |
   | `JWT_SECRET` | texto longo e aleatório | Ex: `openssl rand -base64 32` |
   | `JWT_REFRESH_SECRET` | outro texto aleatório | Ex: `openssl rand -base64 32` |
   | `NODE_ENV` | `production` | — |
   | `FRONTEND_URL` | `https://placeholder.railway.app` | Será atualizado depois com o URL do frontend |
   | `RESEND_API_KEY` | `re_xxxx...` | Sua chave Resend |
   | `EMAIL_FROM` | `noreply@seudominio.com` | Domínio verificado no Resend |
   | `OPENAI_API_KEY` | `sk-...` | (Opcional) Chave OpenAI |
   | `BACKUP_ENCRYPTION_KEY` | chave base64 (32 bytes) | Ex: `openssl rand -base64 32` – obrigatório para backups |
   | `BACKUP_DIR` | `/data` | Só se usar Volume (passo 4b) |

   Para **DATABASE_URL**: em Variables → **Add Variable** → **Add Reference** → escolha o serviço PostgreSQL e a variável `DATABASE_URL`.

4b. **Volume para backups** (recomendado – armazenamento persistente):
   - Settings → **Volumes** → **Add Volume** (nome: `backups`).
   - O volume é montado em `/data`.
   - Adicione: `BACKUP_DIR` = `/data` nas variáveis.

5. **Gerar domínio** para o backend:
   - Settings → **Networking** → **Generate Domain**
   - Anote o URL (ex: `https://dsicola-backend-production-xxxx.up.railway.app`)

6. Faça o **deploy** (Deployments → o primeiro deploy deve iniciar automaticamente).

7. Aguarde o build e verifique nos logs se aparece:
   - `🚀 Server running on...`
   - Sem erros de migração do Prisma.

8. Teste o health check:
   ```
   https://SEU-BACKEND-URL.up.railway.app/health
   ```
   Deve retornar: `{"status":"ok","timestamp":"..."}`

---

## Parte 3: Frontend (React/Vite)

1. No mesmo projeto Railway, clique em **+ New** → **GitHub Repo**.

2. Selecione o **mesmo repositório** DSICOLA.

3. Configure o serviço:
   - **Root Directory:** `frontend`
   - **Build Command:**
     ```
     npm install && npm run build
     ```
   - **Output Directory:** `dist`
   - **Install Command:** (opcional) `npm install`

4. **Variáveis de ambiente**:

   | Variável | Valor |
   |----------|-------|
   | `VITE_API_URL` | `https://SEU-BACKEND-URL.up.railway.app` |

   Substitua pelo URL real do backend da Parte 2.

5. **Tipo de serviço:** Railway deve detetar como **Static Site**. Se não:
   - Settings → **Source** → altere para **Static Site** (se existir).

6. ** Gerar domínio** para o frontend:
   - Settings → **Networking** → **Generate Domain**
   - Anote o URL (ex: `https://dsicola-frontend-production-xxxx.up.railway.app`)

7. Faça o deploy e espere o build terminar.

---

## Parte 4: Ligar Backend e Frontend (CORS)

1. No serviço **Backend**, vá a **Variables**.

2. Edite `FRONTEND_URL` e coloque o URL do frontend:
   ```
   https://dsicola-frontend-production-xxxx.up.railway.app
   ```

3. Salve. O Railway fará um novo deploy automaticamente.

4. O backend passa a aceitar pedidos vindos do frontend (CORS).

---

## Parte 5: Seed Inicial (Opcional)

Para criar o superadmin e dados iniciais:

1. **Opção A – Railway CLI:**
   ```bash
   npm install -g @railway/cli
   railway login
   railway link  # selecionar o projeto
   cd backend
   railway run npx prisma db seed
   ```

2. **Opção B – One-off no serviço:**
   - Na interface do Railway, Services → Backend → pode não haver comando direto para seed.
   - Mais fiável usar o CLI (Opção A).

---

## Resumo das URLs

| Componente | Exemplo de URL |
|------------|----------------|
| Backend API | `https://dsicola-backend-production-xxxx.up.railway.app` |
| Frontend | `https://dsicola-frontend-production-xxxx.up.railway.app` |
| Health check | `https://dsicola-backend-production-xxxx.up.railway.app/health` |

---

## Domínio Personalizado (Opcional)

1. **Frontend:** Settings → Networking → **Custom Domain** → adicione `app.dsicola.com`.
2. **Backend:** adicione `api.dsicola.com`.
3. No seu fornecedor de DNS, crie registos CNAME apontando para o domínio gerado pelo Railway (informação no painel).
4. Atualize:
   - `FRONTEND_URL` → `https://app.dsicola.com`
   - `VITE_API_URL` → `https://api.dsicola.com`

---

## Troubleshooting

### Erro: "Cannot find module"
- Confirme que o **Root Directory** está correto (`backend` ou `frontend`).
- Confirme que o **Build Command** inclui `npx prisma generate` no backend.

### Erro de migração Prisma
- Verifique se `DATABASE_URL` está referenciada corretamente.
- Pode executar manualmente: `railway run npx prisma migrate deploy`.

### CORS bloqueando
- Verifique se `FRONTEND_URL` no backend é exatamente o URL do frontend (sem barra final).
- Em produção, não use `http://`; use `https://`.

### Frontend não carrega a API
- Confirme que `VITE_API_URL` foi definida **antes** do build (variáveis Vite são injetadas no build).
- Se alterar `VITE_API_URL`, é necessário fazer um novo deploy do frontend.

### Backups falham ("pg_dump not found")
- O `backend` deve usar o Dockerfile (via `railway.toml`). Verifique em Settings → Build que o builder é **Dockerfile**.
- O Dockerfile inclui `postgresql-client`; se usar Nixpacks, os backups não funcionarão.

### Backups perdidos após re-deploy
- Adicione um **Volume** (Settings → Volumes) e defina `BACKUP_DIR=/data` para armazenamento persistente.

---

## Custos Estimados

- **Hobby Plan (grátis):** créditos limitados/mês, útil para testes.
- **Pro Plan ($5/mês):** créditos incluídos, adequado para produção pequena.
- O consumo depende de uso de CPU/RAM e tráfego.

Mais detalhes em [railway.app/pricing](https://railway.app/pricing).
