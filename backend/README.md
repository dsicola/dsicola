# DSICOLA Backend

Backend API para o Sistema de Gestão Escolar DSICOLA.

## Tecnologias

- **Node.js** + **Express** - Runtime e framework web
- **TypeScript** - Tipagem estática
- **Prisma** - ORM para PostgreSQL
- **JWT** - Autenticação com tokens
- **Docker** - Containerização

## Requisitos

- Node.js 18+ ou Docker
- PostgreSQL 14+

## Instalação Local

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Edite o arquivo .env com suas configurações

# Gerar Prisma Client
npx prisma generate

# Rodar migrations
npx prisma migrate dev

# Iniciar em desenvolvimento
npm run dev
```

## Deploy com Docker

### Desenvolvimento

```bash
# Iniciar API + PostgreSQL
docker-compose up -d

# Ver logs
docker-compose logs -f api

# Parar serviços
docker-compose down
```

### Produção

```bash
# Usar script de deploy
chmod +x scripts/deploy.sh
./scripts/deploy.sh

# Ou manualmente com nginx
docker-compose --profile production up -d
```

## Deploy no Railway

Para o frontend em produção (`https://www.dsicola.com`) conseguir falar com a API, configure no Railway:

- **`FRONTEND_URL`** – Origens permitidas (CORS), separadas por vírgula. Ex.: `https://www.dsicola.com,https://dsicola.com`
- **`PLATFORM_BASE_DOMAIN`** – Domínio base para subdomínios. Ex.: `dsicola.com` (sem `https://`)

Se `FRONTEND_URL` não estiver definido, o backend permite automaticamente `https://www.<PLATFORM_BASE_DOMAIN>` e `https://<PLATFORM_BASE_DOMAIN>`.

## Estrutura do Projeto

```
backend/
├── prisma/
│   └── schema.prisma      # Schema do banco de dados
├── src/
│   ├── controllers/       # Controladores (lógica de negócio)
│   ├── routes/            # Rotas da API
│   ├── middlewares/       # Middlewares (auth, errors)
│   ├── services/          # Serviços (auth, etc)
│   ├── lib/               # Utilitários (prisma client)
│   ├── app.ts             # Configuração Express
│   └── server.ts          # Entrada da aplicação
├── nginx/                 # Configuração Nginx
├── scripts/               # Scripts de deploy
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Endpoints da API

### Autenticação
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registro
- `POST /api/auth/refresh` - Renovar token
- `POST /api/auth/logout` - Logout

### Recursos Principais
- `/api/users` - Usuários
- `/api/instituicoes` - Instituições
- `/api/cursos` - Cursos
- `/api/disciplinas` - Disciplinas
- `/api/turmas` - Turmas
- `/api/matriculas` - Matrículas
- `/api/notas` - Notas
- `/api/frequencias` - Frequências
- `/api/mensalidades` - Mensalidades

### Health Check
- `GET /api/health` - Status da API

## Variáveis de Ambiente

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `DATABASE_URL` | URL de conexão PostgreSQL | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Chave secreta JWT | `min-32-caracteres` |
| `JWT_REFRESH_SECRET` | Chave secreta refresh token | `min-32-caracteres` |
| `JWT_EXPIRES_IN` | Expiração do token | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Expiração refresh token | `7d` |
| `FRONTEND_URL` | URL do frontend (CORS) | `https://app.dsicola.com` |
| `PORT` | Porta do servidor | `3000` |
| `NODE_ENV` | Ambiente | `production` |

## Segurança

- JWT com refresh tokens
- Rate limiting via Nginx
- Helmet para headers de segurança
- CORS configurado
- Senhas hasheadas com bcrypt
- Multi-tenancy por instituição

## Scripts Disponíveis

```bash
npm run dev        # Desenvolvimento com hot-reload
npm run build      # Compilar TypeScript
npm run start      # Produção
npm run db:migrate # Rodar migrations
npm run db:generate # Gerar Prisma Client
npm run db:push    # Push schema para DB
```

## Licença

Proprietário - DSICOLA © 2024
