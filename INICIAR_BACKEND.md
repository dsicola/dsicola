# Como Iniciar o Backend

## Problema
Se você está vendo o erro:
```
Erro ao buscar cursos: Error: Não foi possível conectar ao servidor. URL da API: http://localhost:3001
```

Isso significa que o **backend não está rodando**.

## Solução Rápida

### 1. Navegue até a pasta do backend
```bash
cd backend
```

### 2. Instale as dependências (se ainda não instalou)
```bash
npm install
```

### 3. Configure as variáveis de ambiente
Crie um arquivo `.env` na pasta `backend/` com:
```env
DATABASE_URL="postgresql://usuario:senha@localhost:5432/dsicola"
JWT_SECRET="seu-jwt-secret-aqui"
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173,http://localhost:8080
```

### 4. Execute as migrations do Prisma
```bash
npm run db:migrate
# ou
npm run db:push
```

### 5. Inicie o servidor
```bash
npm run dev
```

Você deve ver:
```
🚀 Server running on http://localhost:3001
📚 Environment: development
```

## Verificar se está rodando

Abra outro terminal e teste:
```bash
curl http://localhost:3001/health
```

Deve retornar:
```json
{"status":"ok","timestamp":"..."}
```

## Portas Padrão

- **Backend**: `http://localhost:3001`
- **Frontend**: `http://localhost:5173` ou `http://localhost:8080`

## Configuração do Frontend

O frontend está configurado para usar `http://localhost:3001` por padrão.

Se você quiser usar outra porta, crie um arquivo `.env` na pasta `frontend/`:
```env
VITE_API_URL=http://localhost:3001
```

## Troubleshooting

### Porta 3001 já em uso
Se a porta 3001 estiver ocupada, você pode:
1. Mudar a porta no `.env` do backend: `PORT=3002`
2. Atualizar o `.env` do frontend: `VITE_API_URL=http://localhost:3002`

### Erro de conexão com banco de dados
Verifique se:
1. O PostgreSQL está rodando
2. A `DATABASE_URL` no `.env` está correta
3. O banco de dados existe

### Erro de CORS
Verifique se o `FRONTEND_URL` no `.env` do backend inclui a URL do frontend.

