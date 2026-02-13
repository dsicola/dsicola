# 🔧 Solução: Problema de Conexão com API

## ✅ Arquivos Criados/Verificados

### Frontend `.env` criado
Arquivo: `/frontend/.env`
```env
VITE_API_URL=http://localhost:3001
```

### Backend `.env` verificado
Arquivo: `/backend/.env`
```env
PORT=3001
FRONTEND_URL=http://localhost:8080,http://localhost:5173
```

## 🚀 Passos para Resolver

### 1. Iniciar o Backend

```bash
cd backend
npm run dev
```

**Verificar se está rodando:**
- Deve aparecer: `🚀 Server running on http://localhost:3001`
- Se aparecer erro de porta em uso, verifique: `lsof -ti:3001`

### 2. Iniciar o Frontend (em outro terminal)

```bash
cd frontend
npm run dev
```

**Verificar:**
- O frontend deve abrir em `http://localhost:5173` (ou porta configurada)
- No console do navegador, deve aparecer: `[API] Using API URL: http://localhost:3001`

### 3. Verificar Conexão

1. Abra o DevTools do navegador (F12)
2. Vá na aba "Network"
3. Tente fazer login ou qualquer ação
4. Verifique se as requisições estão indo para `http://localhost:3001`

## 🔍 Troubleshooting

### Problema: Backend não inicia

**Erro de porta em uso:**
```bash
# Verificar o que está usando a porta 3001
lsof -ti:3001

# Matar o processo (se necessário)
kill -9 $(lsof -ti:3001)
```

**Erro de banco de dados:**
```bash
cd backend
# Verificar se DATABASE_URL está no .env
cat .env | grep DATABASE_URL

# Se não estiver, adicione:
# DATABASE_URL="postgresql://user:password@localhost:5432/dsicola"
```

### Problema: Frontend não encontra API

**Verificar variável de ambiente:**
```bash
cd frontend
cat .env
# Deve mostrar: VITE_API_URL=http://localhost:3001
```

**Reiniciar o servidor de desenvolvimento:**
- Pare o servidor (Ctrl+C)
- Inicie novamente: `npm run dev`
- Variáveis de ambiente são carregadas apenas na inicialização

### Problema: CORS Error

**Verificar se o frontend está nas URLs permitidas:**
- Backend aceita: `http://localhost:8080` e `http://localhost:5173`
- Se usar outra porta, adicione no `.env` do backend:
  ```env
  FRONTEND_URL=http://localhost:8080,http://localhost:5173,http://localhost:3000
  ```

## 📋 Checklist Rápido

- [ ] Backend rodando na porta 3001
- [ ] Frontend `.env` criado com `VITE_API_URL=http://localhost:3001`
- [ ] Backend `.env` tem `FRONTEND_URL` configurado
- [ ] Frontend reiniciado após criar `.env`
- [ ] Sem erros no console do navegador
- [ ] Requisições aparecem no Network tab

## 🎯 Teste Rápido

Após iniciar ambos os servidores, teste a conexão:

```bash
# Em um novo terminal
curl http://localhost:3001/health
```

**Resposta esperada:**
```json
{"status":"ok","timestamp":"2025-01-XX..."}
```

Se funcionar, a API está respondendo corretamente!

