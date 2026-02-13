# ⚡ Solução Rápida - Erro de Conexão

## 🚨 Problema
Backend não está respondendo na porta 3001, mesmo com processos rodando.

## ✅ Solução Imediata

### Passo 1: Parar todos os processos do backend
```bash
# Matar todos os processos do backend
pkill -f "tsx.*server.ts"
pkill -f "node.*server"

# Verificar se parou
lsof -ti:3001 || echo "Porta 3001 liberada"
```

### Passo 2: Verificar banco de dados
```bash
# Testar conexão com PostgreSQL
psql "postgresql://postgres:Dpa211088@localhost:5432/dsicola" -c "SELECT 1;" || echo "❌ Banco não conecta"
```

### Passo 3: Iniciar backend limpo
```bash
cd /Users/dpa/Documents/dsicola/backend

# Limpar cache e reinstalar (se necessário)
# npm install

# Iniciar backend
npm run dev
```

**Aguarde ver:**
```
🚀 Server running on http://localhost:3001
📚 Environment: development
[CORS] Allowed origins: [...]
```

### Passo 4: Verificar se está respondendo
**Em outro terminal:**
```bash
curl http://localhost:3001
```

**Deve retornar:** `Cannot GET /` (isso é normal, significa que o servidor está rodando)

---

## 🔍 Se ainda não funcionar:

### Verificar logs de erro
O backend pode estar falhando silenciosamente. Procure por:
- ❌ Erro de conexão com banco
- ❌ Erro de porta em uso
- ❌ Erro de módulo não encontrado

### Verificar variáveis de ambiente
```bash
cd backend
cat .env | grep -E "PORT|DATABASE_URL|FRONTEND_URL"
```

**Deve mostrar:**
```
PORT=3001
DATABASE_URL=postgresql://postgres:Dpa211088@localhost:5432/dsicola
FRONTEND_URL=http://localhost:8080,http://localhost:5173
```

---

## 📋 Checklist Final

- [ ] Todos os processos antigos foram parados
- [ ] PostgreSQL está rodando
- [ ] Arquivo `.env` existe e está correto
- [ ] Backend inicia sem erros
- [ ] `curl http://localhost:3001` retorna algo (mesmo que erro 404)
- [ ] Frontend tem `VITE_API_URL=http://localhost:3001` configurado

---

## 🎯 Comando Completo (Copiar e Colar)

```bash
# 1. Parar processos
pkill -f "tsx.*server.ts"

# 2. Ir para backend
cd /Users/dpa/Documents/dsicola/backend

# 3. Iniciar backend
npm run dev
```

**Aguarde 5-10 segundos e verifique:**
```bash
curl http://localhost:3001
```

Se retornar algo (mesmo erro), o backend está funcionando! ✅

