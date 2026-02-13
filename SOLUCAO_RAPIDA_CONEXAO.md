# ⚡ Solução Rápida - Erro de Conexão API

## 🚨 Erro
```
Não foi possível conectar ao servidor. URL da API: http://localhost:3001
```

## ✅ Solução em 3 Passos

### Passo 1: Criar arquivos .env

**Backend (`backend/.env`):**
```bash
PORT=3001
FRONTEND_URL=http://localhost:8080,http://localhost:5173
DATABASE_URL="postgresql://usuario:senha@localhost:5432/dsicola?schema=public"
JWT_SECRET=sua_chave_secreta_aqui
JWT_REFRESH_SECRET=sua_chave_refresh_aqui
NODE_ENV=development
```

**Frontend (`frontend/.env`):**
```bash
VITE_API_URL=http://localhost:3001
```

### Passo 2: Iniciar Backend
```bash
cd backend
npm run dev
```

**Deve aparecer:**
```
🚀 Server running on http://localhost:3001
```

### Passo 3: Iniciar Frontend (novo terminal)
```bash
cd frontend
npm run dev
```

**Deve aparecer:**
```
➜  Local:   http://localhost:8080/
```

## 🔍 Verificação Rápida

Execute o script de verificação:
```bash
./verificar-conexao.sh
```

Ou verifique manualmente:
```bash
# Backend rodando?
curl http://localhost:3001/health

# Porta em uso?
lsof -i :3001
```

## ❌ Ainda não funciona?

1. **Reinicie ambos os servidores**
2. **Limpe o cache do navegador** (Ctrl+Shift+R)
3. **Verifique o console do navegador** (F12)
4. **Consulte:** `DIAGNOSTICO_CONEXAO_API.md` para diagnóstico completo

