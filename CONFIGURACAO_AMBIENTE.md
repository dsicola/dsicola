# Configuração de Ambiente - DSICOLA

## Problema: "Não foi possível conectar ao servidor"

Este erro ocorre quando o frontend não consegue se conectar ao backend. Siga os passos abaixo para resolver.

---

## 📋 Passo 1: Criar arquivo `.env` no Backend

Crie o arquivo `/backend/.env` com o seguinte conteúdo:

```env
# DSICOLA Backend - Variáveis de Ambiente

# Porta do servidor
PORT=3001

# URL do frontend (para CORS)
FRONTEND_URL=http://localhost:8080,http://localhost:5173,http://localhost:3000

# Database
DATABASE_URL="postgresql://usuario:senha@localhost:5432/dsicola?schema=public"

# JWT
JWT_SECRET=seu_jwt_secret_super_seguro_aqui_mude_em_producao
JWT_REFRESH_SECRET=seu_jwt_refresh_secret_super_seguro_aqui_mude_em_producao
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Ambiente
NODE_ENV=development

# Uploads
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

**⚠️ IMPORTANTE:**
- Substitua `usuario:senha` na `DATABASE_URL` pelas credenciais reais do seu PostgreSQL
- Substitua `dsicola` pelo nome real do seu banco de dados
- Altere `JWT_SECRET` e `JWT_REFRESH_SECRET` por valores seguros (use um gerador de strings aleatórias)

---

## 📋 Passo 2: Criar arquivo `.env` no Frontend

Crie o arquivo `/frontend/.env` com o seguinte conteúdo:

```env
# DSICOLA Frontend - Variáveis de Ambiente

# URL da API Backend
VITE_API_URL=http://localhost:3001

# Porta da API (opcional)
VITE_API_PORT=3001
```

---

## 📋 Passo 3: Iniciar o Backend

No terminal, execute:

```bash
cd backend
npm install  # Se ainda não instalou as dependências
npm run dev  # Inicia o servidor na porta 3001
```

Você deve ver a mensagem:
```
🚀 Server running on http://localhost:3001
```

---

## 📋 Passo 4: Iniciar o Frontend

Em outro terminal, execute:

```bash
cd frontend
npm install  # Se ainda não instalou as dependências
npm run dev  # Inicia o frontend (geralmente na porta 8080 ou 5173)
```

---

## ✅ Verificação

1. **Backend rodando:**
   - Acesse `http://localhost:3001/health` no navegador
   - Deve retornar: `{"status":"ok","timestamp":"..."}`

2. **Frontend conectado:**
   - Abra o console do navegador (F12)
   - Deve ver: `[API] Using API URL: http://localhost:3001`
   - Não deve aparecer erros de conexão

---

## 🔧 Troubleshooting

### Erro: "Porta 3001 já está em uso"
```bash
# Verificar qual processo está usando a porta
lsof -ti:3001

# Matar o processo (substitua PID pelo número retornado)
kill -9 PID

# Ou usar outra porta (altere PORT no .env do backend)
```

### Erro: "Cannot connect to database"
- Verifique se o PostgreSQL está rodando
- Verifique se a `DATABASE_URL` está correta
- Execute: `npx prisma migrate dev` para criar as tabelas

### Erro: "CORS policy"
- Verifique se `FRONTEND_URL` no backend inclui a URL do frontend
- Exemplo: Se frontend está em `http://localhost:8080`, adicione essa URL ao `FRONTEND_URL`

### Frontend ainda não conecta após criar .env
- **Reinicie o servidor de desenvolvimento do frontend** (Ctrl+C e `npm run dev` novamente)
- Variáveis de ambiente do Vite só são carregadas na inicialização

---

## 📝 Notas

- Os arquivos `.env` são ignorados pelo git (não são commitados)
- Nunca compartilhe seus arquivos `.env` publicamente
- Em produção, use variáveis de ambiente do servidor/hospedagem

---

**Criado em:** 2025-01-27  
**Última atualização:** 2025-01-27

