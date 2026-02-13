# 🔧 Diagnóstico de Conexão Frontend ↔ Backend

## ❌ Problema Identificado
**Erro:** "Não foi possível conectar ao servidor. URL da API: http://localhost:3001"

## ✅ Solução Passo a Passo

### 1️⃣ Verificar se o Backend está Rodando

**No terminal, execute:**
```bash
cd backend
npm run dev
```

**Você deve ver:**
```
🚀 Server running on http://localhost:3001
📚 Environment: development
[CORS] Allowed origins: [...]
```

**Se não aparecer, verifique:**
- ✅ Node.js instalado: `node --version`
- ✅ Dependências instaladas: `npm install`
- ✅ Banco de dados PostgreSQL rodando
- ✅ Variáveis de ambiente configuradas (`.env`)

---

### 2️⃣ Verificar Configuração do Frontend

**No arquivo `.env` do frontend (ou `.env.local`):**
```env
VITE_API_URL=http://localhost:3001
```

**Ou no terminal do frontend:**
```bash
cd frontend
VITE_API_URL=http://localhost:3001 npm run dev
```

---

### 3️⃣ Verificar Configuração do Backend

**No arquivo `.env` do backend:**
```env
PORT=3001
FRONTEND_URL=http://localhost:8080,http://localhost:5173
NODE_ENV=development
```

---

### 4️⃣ Testar Conexão Manualmente

**Abra um novo terminal e teste:**
```bash
# Teste 1: Verificar se porta está aberta
curl http://localhost:3001

# Teste 2: Verificar CORS (deve retornar erro CORS, mas não "connection refused")
curl -H "Origin: http://localhost:8080" http://localhost:3001
```

---

### 5️⃣ Verificar Logs do Backend

**Procure por erros no console do backend:**
- ❌ Erro de conexão com banco de dados
- ❌ Erro de porta já em uso
- ❌ Erro de variáveis de ambiente faltando

---

## 🚨 Problemas Comuns

### Problema 1: Porta 3001 já em uso
**Solução:**
```bash
# Verificar qual processo está usando a porta
lsof -ti:3001

# Matar o processo (substitua PID pelo número retornado)
kill -9 PID

# Ou usar outra porta
PORT=3002 npm run dev
```

### Problema 2: Banco de dados não conecta
**Solução:**
- Verificar se PostgreSQL está rodando
- Verificar `DATABASE_URL` no `.env` do backend
- Testar conexão: `psql $DATABASE_URL`

### Problema 3: CORS bloqueando
**Solução:**
- Verificar `FRONTEND_URL` no `.env` do backend
- Adicionar a URL do frontend: `FRONTEND_URL=http://localhost:8080`

### Problema 4: Variáveis de ambiente não carregadas
**Solução:**
- Verificar se arquivo `.env` existe na raiz do backend
- Reiniciar o servidor após alterar `.env`

---

## ✅ Checklist Rápido

- [ ] Backend rodando na porta 3001
- [ ] Frontend configurado com `VITE_API_URL=http://localhost:3001`
- [ ] Backend com `FRONTEND_URL` configurado
- [ ] PostgreSQL rodando e conectado
- [ ] Nenhum erro no console do backend
- [ ] Nenhum erro no console do frontend (F12)

---

## 📞 Próximos Passos

1. **Inicie o backend primeiro:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Aguarde aparecer:**
   ```
   🚀 Server running on http://localhost:3001
   ```

3. **Depois inicie o frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

4. **Acesse:** `http://localhost:8080` (ou a porta que o Vite indicar)

---

## 🔍 Debug Avançado

**No console do navegador (F12), verifique:**
- URL da API sendo usada
- Erros de CORS
- Status da requisição (Network tab)

**No console do backend, verifique:**
- Requisições chegando
- Erros de autenticação
- Erros de banco de dados
