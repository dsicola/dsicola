# Troubleshooting - Backend não está respondendo

## Problema
O frontend não consegue conectar ao backend em `http://localhost:3001`.

## Diagnóstico Rápido

### 1. Verificar se o backend está rodando

```bash
# Verificar processos
ps aux | grep "tsx watch" | grep -v grep

# Verificar porta
lsof -i :3001

# Testar conexão
curl http://localhost:3001/
```

### 2. Verificar logs do backend

O backend deve estar rodando em um terminal. Verifique se há erros como:
- Erro de conexão com banco de dados
- Erro de variáveis de ambiente faltando
- Erro de porta já em uso

### 3. Verificar variáveis de ambiente

```bash
cd backend
cat .env | grep -E "PORT|DATABASE_URL|JWT_SECRET"
```

Certifique-se de que:
- `PORT=3001` (ou não definido, usando padrão)
- `DATABASE_URL` está configurado
- `JWT_SECRET` está configurado

### 4. Reiniciar o backend

```bash
# Parar processos existentes
pkill -f "tsx watch"

# Iniciar novamente
cd backend
npm run dev
```

### 5. Verificar se a porta está livre

```bash
# Verificar se outra aplicação está usando a porta 3001
lsof -i :3001

# Se houver, matar o processo
kill -9 <PID>
```

### 6. Verificar CORS

O backend está configurado para aceitar requisições de:
- `http://localhost:8080` (frontend)
- `http://localhost:5173` (Vite default)
- `http://localhost:3000` (alternativa)

Se o frontend estiver em outra porta, adicione no `.env` do backend:
```
FRONTEND_URL=http://localhost:8080,http://localhost:5173
```

## Solução Rápida

1. **Parar todos os processos do backend:**
```bash
pkill -f "tsx watch"
pkill -f "npm run dev"
```

2. **Verificar se a porta está livre:**
```bash
lsof -i :3001
# Se houver processo, matar: kill -9 <PID>
```

3. **Iniciar o backend:**
```bash
cd backend
npm run dev
```

4. **Verificar se iniciou corretamente:**
Você deve ver no terminal:
```
🚀 Server running on http://localhost:3001
📚 Environment: development
```

5. **Testar conexão:**
```bash
curl http://localhost:3001/
```

## Erros Comuns

### Erro: "Port 3001 is already in use"
**Solução:** Matar o processo que está usando a porta:
```bash
lsof -i :3001
kill -9 <PID>
```

### Erro: "Cannot connect to database"
**Solução:** Verificar `DATABASE_URL` no `.env` e se o PostgreSQL está rodando.

### Erro: "JWT_SECRET is not defined"
**Solução:** Adicionar `JWT_SECRET` no `.env` do backend.

## Verificar Logs em Tempo Real

Se o backend estiver rodando, você deve ver logs no terminal onde executou `npm run dev`.

Procure por:
- ✅ `🚀 Server running on http://localhost:${PORT}` - Servidor iniciou
- ❌ Erros de conexão com banco
- ❌ Erros de variáveis de ambiente
- ❌ Erros de importação de módulos

## Próximos Passos

Se após seguir estes passos o problema persistir:

1. Verifique os logs completos do backend
2. Verifique se todas as dependências estão instaladas: `npm install`
3. Verifique se o Prisma está configurado: `npx prisma generate`
4. Verifique se o banco de dados está acessível

