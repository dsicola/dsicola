# Configuração de CORS e URL da API

## Problema
Erro: "Não foi possível conectar ao servidor (URL/CORS). Verifique VITE_API_URL e CORS_ORIGIN/FRONTEND_URL no backend."

## Configurações Atuais

### Frontend (`frontend/.env.local`)
```
VITE_API_URL=http://localhost:3001
```

### Backend (`backend/.env`)
```
PORT=3001
FRONTEND_URL=http://localhost:8080,http://localhost:5173
```

## Verificações Necessárias

### 1. Verificar se o backend está rodando
```bash
cd backend
npm run dev
# Ou
npm start
```

O backend deve estar rodando em `http://localhost:3001`

### 2. Verificar se o frontend está rodando
```bash
cd frontend
npm run dev
```

O frontend deve estar rodando em `http://localhost:8080` (conforme `vite.config.ts`)

### 3. Testar conexão com o backend
```bash
curl http://localhost:3001/api/health
```

Deve retornar: `{"status":"ok","timestamp":"..."}`

### 4. Verificar variáveis de ambiente

#### Frontend
Certifique-se de que o arquivo `frontend/.env.local` existe e contém:
```
VITE_API_URL=http://localhost:3001
```

**Importante:** O Vite carrega automaticamente `.env.local`, mas você pode precisar reiniciar o servidor de desenvolvimento após criar/modificar o arquivo.

#### Backend
Certifique-se de que o arquivo `backend/.env` existe e contém:
```
FRONTEND_URL=http://localhost:8080,http://localhost:5173
PORT=3001
```

**Importante:** O backend usa `dotenv` que carrega automaticamente o arquivo `.env`. Reinicie o servidor após modificar.

## Solução de Problemas

### Problema: Frontend não consegue conectar ao backend

1. **Verificar se o backend está rodando:**
   ```bash
   curl http://localhost:3001/api/health
   ```

2. **Verificar se a URL da API está correta:**
   - Abra o console do navegador (F12)
   - Procure por `[API] Using API URL:`
   - Deve mostrar: `http://localhost:3001`

3. **Verificar CORS no backend:**
   - O backend deve permitir requisições de `http://localhost:8080`
   - Verifique os logs do backend para mensagens de CORS

### Problema: Erro de CORS no navegador

1. **Verificar FRONTEND_URL no backend:**
   ```bash
   grep FRONTEND_URL backend/.env
   ```
   Deve incluir a URL exata do frontend (ex: `http://localhost:8080`)

2. **Verificar se não há aspas extras:**
   O arquivo `.env` do backend deve ter:
   ```
   FRONTEND_URL=http://localhost:8080,http://localhost:5173
   ```
   **NÃO** deve ter aspas: `FRONTEND_URL="http://localhost:8080"` ❌

3. **Reiniciar o backend após modificar .env**

### Problema: VITE_API_URL não está sendo carregado

1. **Verificar se o arquivo está no local correto:**
   - Deve estar em `frontend/.env.local` (não `frontend/.env`)

2. **Reiniciar o servidor de desenvolvimento:**
   ```bash
   # Parar o servidor (Ctrl+C)
   # Iniciar novamente
   npm run dev
   ```

3. **Verificar no console do navegador:**
   - Abra o console (F12)
   - Procure por `[API] VITE_API_URL from env:`
   - Deve mostrar: `http://localhost:3001`

## Portas Padrão

- **Frontend:** 8080 (configurado em `vite.config.ts`)
- **Backend:** 3001 (configurado em `backend/src/server.ts`)

## Debug

Adicionei logs de debug no arquivo `frontend/src/services/api.ts`:
- `[API] Using API URL:` - mostra a URL da API sendo usada
- `[API] VITE_API_URL from env:` - mostra o valor da variável de ambiente

Esses logs aparecem apenas em modo de desenvolvimento.

## Próximos Passos

1. Reinicie ambos os servidores (frontend e backend)
2. Verifique os logs no console do navegador
3. Verifique os logs do backend para erros de CORS
4. Teste a conexão com `curl http://localhost:3001/api/health`

## Script de Diagnóstico

Execute o script de diagnóstico para verificar automaticamente todas as configurações:

```bash
./diagnostico-cors.sh
```

O script verifica:
- Se o backend está rodando
- Se as variáveis de ambiente estão configuradas corretamente
- Se as portas estão em uso
- Se o CORS está funcionando

## Melhorias Implementadas

### Frontend (`frontend/src/services/api.ts`)
- ✅ Timeout de 30 segundos configurado
- ✅ `withCredentials: true` para suporte a CORS com credenciais
- ✅ Logging detalhado de erros de conexão
- ✅ Mensagens de erro mais específicas e informativas

### Backend (`backend/src/app.ts`)
- ✅ Logging de configuração CORS no startup
- ✅ Logging detalhado de requisições CORS em desenvolvimento
- ✅ Mensagens mais claras sobre origens permitidas/bloqueadas

### Contexto de Autenticação (`frontend/src/contexts/AuthContext.tsx`)
- ✅ Mensagens de erro mais específicas para diferentes tipos de falha de conexão
- ✅ Diagnóstico automático incluído nas mensagens de erro

