# 🚀 Guia de Deploy em Produção - DSICOLA

Este documento descreve as melhores formas de hospedar o sistema DSICOLA em produção.

## Arquitetura do Sistema

| Componente | Stack |
|------------|-------|
| **Backend** | Node.js + Express + Prisma |
| **Frontend** | React + Vite |
| **Base de dados** | PostgreSQL |
| **Serviços externos** | Resend (email), OpenAI (assistente IA) |

---

## Opção 1: Railway (Recomendado – mais simples)

**Custo estimado:** ~$5–20/mês  
**Setup:** ~15 minutos

Railway oferece deploy de backend + PostgreSQL + frontend na mesma plataforma.

### Passos

1. **Criar conta** em [railway.app](https://railway.app)

2. **Novo projeto** → Add PostgreSQL (gera `DATABASE_URL` automaticamente)

3. **Backend:**
   - New Service → Deploy from GitHub (conectar repositório)
   - Selecionar pasta `backend/`
   - Root Directory: `backend`
   - Build Command: `npm install && npx prisma generate && npm run build`
   - Start Command: `npx prisma migrate deploy && node dist/server.js`
   - Variáveis de ambiente:
     - `DATABASE_URL` (gerada pelo PostgreSQL)
     - `JWT_SECRET`, `JWT_REFRESH_SECRET` (gerar valores seguros)
     - `FRONTEND_URL` = `https://seu-dominio.vercel.app` (ou URL do frontend)
     - `NODE_ENV` = `production`
     - `RESEND_API_KEY`, `EMAIL_FROM`
     - `OPENAI_API_KEY`

4. **Frontend:**
   - New Service → Deploy from GitHub
   - Root Directory: `frontend`
   - Build Command: `npm install && npm run build`
   - Output Directory: `dist`
   - Ou usar Vercel (ver Opção 2)

5. **Domínio:** Settings → Generate Domain (ou conectar domínio próprio)

---

## Opção 2: Vercel (Frontend) + Render (Backend + DB)

**Custo:** Grátis (tier gratuito) ou ~$7/mês  
**Setup:** ~20 minutos

- **Vercel:** Frontend estático (React/Vite) – grátis
- **Render:** Backend + PostgreSQL – grátis no tier free (com limitações)

### Passos

**1. Frontend no Vercel**

- [vercel.com](https://vercel.com) → Import Git
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`
- Variáveis:
  - `VITE_API_URL` = `https://dsicola-api.onrender.com` (URL do backend no Render)

**2. Backend + PostgreSQL no Render**

- [render.com](https://render.com) → New PostgreSQL (grátis)
- New Web Service → Deploy from Git
- Root Directory: `backend`
- Build: `npm install && npx prisma generate && npm run build`
- Start: `npx prisma migrate deploy && node dist/server.js`
- Variáveis: `DATABASE_URL` (do PostgreSQL), `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL` (URL do Vercel), etc.

**Nota:** O tier gratuito do Render “adormece” após 15 min de inatividade. A primeira requisição pode demorar ~30 s.

---

## Opção 3: Docker + VPS (DigitalOcean, Hetzner, Linode)

**Custo:** ~$6–12/mês (VPS)  
**Setup:** ~30–45 minutos  
**Controle:** Total

Ideal para quem quer mais controle e custo previsível.

### Pré-requisitos

- Servidor com Ubuntu 22.04 (ex: Droplet DigitalOcean, VPS Hetzner)
- Domínio apontando para o IP do servidor

### Passos

1. **Conectar ao servidor**
   ```bash
   ssh root@SEU_IP
   ```

2. **Instalar Docker e Docker Compose**
   ```bash
   curl -fsSL https://get.docker.com | sh
   apt install docker-compose-plugin -y
   ```

3. **Clonar o projeto**
   ```bash
   git clone https://github.com/SEU_USER/dsicola.git
   cd dsicola
   ```

4. **Configurar `.env` de produção**
   - Copiar `backend/.env` e preencher variáveis de produção
   - `DATABASE_URL` (PostgreSQL interno do Docker)
   - `FRONTEND_URL` = `https://seudominio.com`
   - `NODE_ENV` = `production`

5. **Subir serviços**
   ```bash
   cd backend
   docker compose up -d
   ```

6. **Nginx + SSL (Let's Encrypt)**
   ```bash
   apt install certbot python3-certbot-nginx -y
   certbot --nginx -dseudominio.com
   ```

---

## Opção 4: Fly.io

**Custo:** ~$5–15/mês  
**Setup:** ~25 minutos  
**Vantagem:** Múltiplas regiões, bom para Latam

```bash
# Instalar flyctl
curl -L https://fly.io/install.sh | sh

# No diretório do projeto
fly launch
fly postgres create
fly secrets set DATABASE_URL=...
fly deploy
```

---

## Checklist antes do deploy

### Variáveis de ambiente (backend)

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | URL PostgreSQL |
| `JWT_SECRET` | Sim | Chave longa e aleatória (32+ chars) |
| `JWT_REFRESH_SECRET` | Sim | Outra chave diferente |
| `FRONTEND_URL` | Sim | URL exata do frontend (ex: `https://app.dsicola.com`) |
| `NODE_ENV` | Sim | `production` |
| `RESEND_API_KEY` | Sim | Para envio de emails |
| `EMAIL_FROM` | Sim | Remetente (domínio verificado no Resend) |
| `OPENAI_API_KEY` | Opcional | Assistente IA |

### Variáveis de ambiente (frontend)

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `VITE_API_URL` | Sim | URL exata do backend (ex: `https://api.dsicola.com`) |

### Segurança

- [ ] `JWT_SECRET` e `JWT_REFRESH_SECRET` gerados aleatoriamente (não usar exemplos)
- [ ] `FRONTEND_URL` com HTTPS
- [ ] Domínio verificado no Resend para `EMAIL_FROM`
- [ ] CORS configurado com o domínio real do frontend

### Banco de dados

- [ ] `npx prisma migrate deploy` executado antes de subir o backend
- [ ] Seed executado apenas uma vez: `npx prisma db seed` (se necessário)

---

## Resumo de opções

| Opção | Custo | Facilidade | Bom para |
|-------|-------|------------|----------|
| **Railway** | $$ | ⭐⭐⭐ | Começar rápido, tudo junto |
| **Vercel + Render** | $ | ⭐⭐⭐ | Frontend grátis, backend com possível cold start |
| **Docker + VPS** | $$ | ⭐⭐ | Mais controle e custo estável |
| **Fly.io** | $$ | ⭐⭐ | Latência global, containers |

---

## Suporte

Para dúvidas específicas de cada plataforma, consulte a documentação oficial: Railway, Render, Vercel, Fly.io, DigitalOcean.
