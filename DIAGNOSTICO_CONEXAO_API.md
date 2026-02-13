# 🔍 Diagnóstico de Conexão API - DSICOLA

## Problema
```
Não foi possível conectar ao servidor. URL da API: http://localhost:3001
```

## ✅ Checklist Rápido

### 1. Backend está rodando?

**Verificar:**
```bash
# No diretório backend/
cd backend
npm run dev
```

**Deve aparecer:**
```
🚀 Server running on http://localhost:3001
📚 Environment: development
```

**Se não aparecer:**
- Verifique se a porta 3001 está livre: `lsof -i :3001`
- Verifique se há erros no console
- Verifique se o banco de dados está acessível

---

### 2. Variáveis de Ambiente - Backend

**Criar/Verificar arquivo:** `backend/.env`

```bash
# Porta do servidor
PORT=3001

# URL do Frontend (para CORS)
FRONTEND_URL=http://localhost:8080,http://localhost:5173

# Database
DATABASE_URL="postgresql://usuario:senha@localhost:5432/dsicola?schema=public"

# JWT
JWT_SECRET=sua_chave_secreta_aqui
JWT_REFRESH_SECRET=sua_chave_refresh_aqui

# Node Environment
NODE_ENV=development
```

**Importante:**
- `FRONTEND_URL` deve incluir a porta onde o frontend está rodando (8080 ou 5173)
- Se usar múltiplas portas, separar por vírgula

---

### 3. Variáveis de Ambiente - Frontend

**Criar/Verificar arquivo:** `frontend/.env`

```bash
# URL da API Backend
VITE_API_URL=http://localhost:3001

# Porta da API (opcional, padrão é 3001)
VITE_API_PORT=3001
```

**Importante:**
- Variáveis no Vite devem começar com `VITE_`
- Após alterar `.env`, **reinicie o servidor de desenvolvimento**

---

### 4. Frontend está rodando?

**Verificar:**
```bash
# No diretório frontend/
cd frontend
npm run dev
```

**Deve aparecer:**
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:8080/
```

**Verificar no console do navegador:**
```javascript
// Deve aparecer:
[API] Using API URL: http://localhost:3001
[API] VITE_API_URL from env: http://localhost:3001
```

---

### 5. Testar Conexão Manualmente

**No terminal:**
```bash
# Testar se backend responde
curl http://localhost:3001/health

# Ou testar uma rota pública
curl http://localhost:3001/api/auth/health
```

**No navegador:**
```
http://localhost:3001/health
```

**Se não responder:**
- Backend não está rodando
- Porta está bloqueada
- Firewall bloqueando

---

### 6. Verificar CORS

**No console do navegador (F12):**
```
[CORS] Allowed origins: http://localhost:8080, http://localhost:5173
[CORS] FRONTEND_URL from env: http://localhost:8080,http://localhost:5173
```

**Se CORS estiver bloqueando:**
- Verifique `FRONTEND_URL` no backend `.env`
- Adicione a porta correta do frontend
- Reinicie o backend

---

## 🚀 Solução Rápida

### Passo 1: Criar arquivos .env

**Backend (`backend/.env`):**
```bash
PORT=3001
FRONTEND_URL=http://localhost:8080,http://localhost:5173
DATABASE_URL="postgresql://usuario:senha@localhost:5432/dsicola?schema=public"
JWT_SECRET=seu_jwt_secret_aqui
JWT_REFRESH_SECRET=seu_jwt_refresh_secret_aqui
NODE_ENV=development
```

**Frontend (`frontend/.env`):**
```bash
VITE_API_URL=http://localhost:3001
```

### Passo 2: Iniciar Backend
```bash
cd backend
npm install  # Se necessário
npm run dev
```

### Passo 3: Iniciar Frontend (em outro terminal)
```bash
cd frontend
npm install  # Se necessário
npm run dev
```

### Passo 4: Verificar
1. Backend rodando em `http://localhost:3001`
2. Frontend rodando em `http://localhost:8080`
3. Abrir navegador em `http://localhost:8080`
4. Verificar console do navegador (F12)

---

## 🔧 Comandos Úteis

### Verificar porta em uso
```bash
# macOS/Linux
lsof -i :3001

# Windows
netstat -ano | findstr :3001
```

### Matar processo na porta
```bash
# macOS/Linux
kill -9 $(lsof -t -i:3001)

# Windows
taskkill /PID <PID> /F
```

### Testar API diretamente
```bash
# Health check
curl http://localhost:3001/health

# Com autenticação (substituir TOKEN)
curl -H "Authorization: Bearer TOKEN" http://localhost:3001/api/user/profile
```

---

## ❌ Erros Comuns

### Erro: "ECONNREFUSED"
**Causa:** Backend não está rodando
**Solução:** Iniciar backend com `npm run dev`

### Erro: "CORS policy"
**Causa:** `FRONTEND_URL` não inclui a porta do frontend
**Solução:** Adicionar porta no `FRONTEND_URL` do backend `.env`

### Erro: "VITE_API_URL is not defined"
**Causa:** Arquivo `.env` não existe ou variável incorreta
**Solução:** Criar `frontend/.env` com `VITE_API_URL=http://localhost:3001`

### Erro: "Port 3001 already in use"
**Causa:** Outro processo usando a porta
**Solução:** Matar processo ou mudar porta no `.env`

---

## 📝 Checklist Final

- [ ] Backend rodando em `http://localhost:3001`
- [ ] Frontend rodando em `http://localhost:8080`
- [ ] `backend/.env` existe e tem `FRONTEND_URL` correto
- [ ] `frontend/.env` existe e tem `VITE_API_URL=http://localhost:3001`
- [ ] Console do navegador mostra `[API] Using API URL: http://localhost:3001`
- [ ] Backend mostra `[CORS] Allowed origins: ...` no console
- [ ] Teste `curl http://localhost:3001/health` funciona

---

## 🆘 Ainda não funciona?

1. **Verificar logs do backend** - Procure por erros
2. **Verificar logs do frontend** - Console do navegador (F12)
3. **Verificar firewall** - Pode estar bloqueando porta 3001
4. **Verificar banco de dados** - `DATABASE_URL` está correto?
5. **Reiniciar tudo** - Parar ambos, limpar cache, reiniciar

---

**Última atualização:** 2024

