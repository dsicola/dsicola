# 🔧 Solução: Erro de Conexão de Rede (ERR_NETWORK)

## ❌ Problema Identificado

O erro `ERR_NETWORK` ocorre porque o **backend não está rodando**. O frontend está tentando se conectar a `http://localhost:3001`, mas não há servidor escutando nessa porta.

**Erro no console:**
```
[API Connection Error] 
Object { 
  apiUrl: "http://localhost:3001", 
  errorCode: "ERR_NETWORK", 
  errorMessage: "Network Error" 
}
```

## ✅ Solução: Iniciar o Backend

### Passo 1: Navegar até a pasta do backend

```bash
cd backend
```

### Passo 2: Verificar se as dependências estão instaladas

```bash
npm install
```

### Passo 3: Verificar/Criar arquivo `.env`

Certifique-se de que existe um arquivo `.env` na pasta `backend/` com pelo menos:

```env
DATABASE_URL="postgresql://usuario:senha@localhost:5432/dsicola"
JWT_SECRET="sua-chave-secreta-jwt-aqui-minimo-32-caracteres"
JWT_REFRESH_SECRET="sua-chave-secreta-refresh-aqui-minimo-32-caracteres"
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:8080,http://localhost:5173
```

**⚠️ IMPORTANTE:** Substitua `usuario`, `senha` e `dsicola` pelos valores corretos do seu banco de dados PostgreSQL.

### Passo 4: Gerar o Prisma Client

```bash
npm run db:generate
```

### Passo 5: Executar Migrações (se necessário)

```bash
npm run db:migrate
# ou
npm run db:push
```

### Passo 6: Iniciar o Servidor Backend

```bash
npm run dev
```

**Você deve ver:**
```
🚀 Server running on http://localhost:3001
📚 Environment: development
✅ Database connected
```

## 🔍 Verificar se o Backend Está Rodando

### Teste 1: Verificar porta 3001

```bash
lsof -ti:3001
```

Se retornar um número de processo, o backend está rodando.

### Teste 2: Testar endpoint de health

Em outro terminal:

```bash
curl http://localhost:3001/api/health
```

Deve retornar:
```json
{"status":"ok","timestamp":"..."}
```

### Teste 3: Verificar no navegador

Abra o console do navegador (F12) e procure por:
```
[API] Using API URL: http://localhost:3001
```

## 🚨 Problemas Comuns

### Problema 1: Porta 3001 já está em uso

**Solução:**
```bash
# Verificar qual processo está usando a porta
lsof -ti:3001

# Matar o processo (substitua PID pelo número retornado)
kill -9 PID

# Ou matar diretamente
kill -9 $(lsof -ti:3001)
```

### Problema 2: Erro de conexão com banco de dados

**Verificar:**
1. PostgreSQL está rodando?
2. A `DATABASE_URL` no `.env` está correta?
3. O banco de dados existe?

**Testar conexão:**
```bash
psql -U usuario -d dsicola -h localhost
```

### Problema 3: Erro de CORS

**Verificar:**
- O `FRONTEND_URL` no `.env` do backend inclui `http://localhost:8080`?

**Exemplo correto:**
```env
FRONTEND_URL=http://localhost:8080,http://localhost:5173
```

### Problema 4: Erro de migração do Prisma

**Solução:**
```bash
# Gerar Prisma Client novamente
npm run db:generate

# Executar migrações
npm run db:migrate

# Ou fazer push direto do schema
npm run db:push
```

## 📋 Checklist Rápido

- [ ] Backend está na pasta `backend/`
- [ ] Dependências instaladas (`npm install`)
- [ ] Arquivo `.env` existe e está configurado
- [ ] Prisma Client gerado (`npm run db:generate`)
- [ ] Migrações executadas (`npm run db:migrate`)
- [ ] Backend iniciado (`npm run dev`)
- [ ] Porta 3001 está em uso (`lsof -ti:3001`)
- [ ] Health check funciona (`curl http://localhost:3001/api/health`)
- [ ] Frontend mostra `[API] Using API URL: http://localhost:3001` no console

## 🎯 Ordem de Inicialização

1. **Primeiro:** Inicie o backend (`cd backend && npm run dev`)
2. **Depois:** Inicie o frontend (`cd frontend && npm run dev`)

O frontend **não pode funcionar** sem o backend rodando.

## 📞 Ainda com Problemas?

Se após seguir todos os passos o problema persistir:

1. Verifique os logs do backend no terminal
2. Verifique o console do navegador (F12) para erros específicos
3. Verifique se o PostgreSQL está rodando
4. Verifique se as variáveis de ambiente estão corretas

