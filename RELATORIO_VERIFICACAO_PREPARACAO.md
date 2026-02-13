# ✅ RELATÓRIO: VERIFICAÇÃO DE PREPARAÇÃO DO SISTEMA
## PARTE 0 — PREPARAÇÃO (NÃO PULAR)

**Data**: 2025-01-27  
**Analista**: Engenheiro de Sistemas Multi-tenant Sênior  
**Status**: ⏳ **AGUARDANDO VERIFICAÇÃO MANUAL**

---

## 📋 CHECKLIST DE VERIFICAÇÃO

### ✅ 1. Variáveis de Ambiente - Backend

**Arquivo**: `backend/.env`

**Status**: ⏳ **VERIFICAR MANUALMENTE**

**Variáveis Obrigatórias**:
- [ ] `DATABASE_URL` - String de conexão PostgreSQL
  - **Formato**: `postgresql://usuario:senha@localhost:5432/dsicola?schema=public`
  - **Verificar**: `grep DATABASE_URL backend/.env`
  
- [ ] `JWT_SECRET` - Chave secreta para JWT
  - **Requisito**: String aleatória segura (mínimo 32 caracteres)
  - **Verificar**: `grep JWT_SECRET backend/.env`
  
- [ ] `JWT_REFRESH_SECRET` - Chave secreta para refresh token
  - **Requisito**: String aleatória segura (mínimo 32 caracteres)
  - **Verificar**: `grep JWT_REFRESH_SECRET backend/.env`
  
- [ ] `PORT` - Porta do servidor
  - **Padrão**: `3001`
  - **Verificar**: `grep PORT backend/.env`
  
- [ ] `FRONTEND_URL` - URL(s) do frontend para CORS
  - **Formato**: `http://localhost:8080,http://localhost:5173`
  - **Verificar**: `grep FRONTEND_URL backend/.env`
  
- [ ] `NODE_ENV` - Ambiente
  - **Valores**: `development` ou `production`
  - **Verificar**: `grep NODE_ENV backend/.env`

**Template Mínimo**:
```env
PORT=3001
FRONTEND_URL=http://localhost:8080,http://localhost:5173
DATABASE_URL="postgresql://usuario:senha@localhost:5432/dsicola?schema=public"
JWT_SECRET=sua_chave_secreta_super_segura_aqui_mude_em_producao
JWT_REFRESH_SECRET=sua_chave_refresh_super_segura_aqui_mude_em_producao
NODE_ENV=development
```

**Comando de Verificação**:
```bash
cd backend
if [ -f .env ]; then
  echo "✅ .env existe"
  grep -E "DATABASE_URL|JWT_SECRET|PORT|FRONTEND_URL|NODE_ENV" .env
else
  echo "❌ .env NÃO existe - CRIE O ARQUIVO!"
fi
```

---

### ✅ 2. Variáveis de Ambiente - Frontend

**Arquivo**: `frontend/.env`

**Status**: ⏳ **VERIFICAR MANUALMENTE**

**Variáveis Obrigatórias**:
- [ ] `VITE_API_URL` - URL da API backend
  - **Formato**: `http://localhost:3001`
  - **Verificar**: `grep VITE_API_URL frontend/.env`

**Template Mínimo**:
```env
VITE_API_URL=http://localhost:3001
```

**Comando de Verificação**:
```bash
cd frontend
if [ -f .env ]; then
  echo "✅ .env existe"
  grep VITE_API_URL .env
else
  echo "❌ .env NÃO existe - CRIE O ARQUIVO!"
fi
```

**⚠️ IMPORTANTE**: Após alterar `.env` no frontend, **reinicie o servidor de desenvolvimento**.

---

### ✅ 3. Backend Rodando

**Status**: ⏳ **VERIFICAR MANUALMENTE**

**Verificação Passo a Passo**:

1. **Instalar Dependências**:
   ```bash
   cd backend
   npm install
   ```

2. **Gerar Prisma Client**:
   ```bash
   npm run db:generate
   ```

3. **Executar Migrações**:
   ```bash
   npm run db:migrate
   ```

4. **Iniciar Servidor**:
   ```bash
   npm run dev
   ```

5. **Verificar Logs Esperados**:
   ```
   🚀 Server running on http://localhost:3001
   📚 Environment: development
   ✅ Database connected
   ```

6. **Testar Health Check**:
   ```bash
   curl http://localhost:3001/health
   # Ou
   curl http://localhost:3001/api/auth/health
   ```

**Problemas Comuns**:
- ❌ **Porta 3001 já em uso**: 
  ```bash
  lsof -i :3001  # Verificar processo
  kill -9 <PID>  # Matar processo
  ```
  
- ❌ **Banco de dados não conecta**: 
  - Verificar `DATABASE_URL` no `.env`
  - Verificar se PostgreSQL está rodando
  - Verificar credenciais
  
- ❌ **Erro de migração**: 
  ```bash
  npm run db:migrate  # Executar migrações
  ```

**Checklist**:
- [ ] Dependências instaladas (`node_modules` existe)
- [ ] Prisma Client gerado
- [ ] Migrações aplicadas
- [ ] Servidor inicia sem erros
- [ ] Health check responde
- [ ] Logs aparecem no console

---

### ✅ 4. Frontend Rodando

**Status**: ⏳ **VERIFICAR MANUALMENTE**

**Verificação Passo a Passo**:

1. **Instalar Dependências**:
   ```bash
   cd frontend
   npm install
   ```

2. **Iniciar Servidor**:
   ```bash
   npm run dev
   ```

3. **Verificar Logs Esperados**:
   ```
   VITE v5.x.x  ready in xxx ms
   ➜  Local:   http://localhost:8080/
   ```

4. **Verificar Console do Navegador**:
   ```javascript
   // Deve aparecer:
   [API] Using API URL: http://localhost:3001
   [API] VITE_API_URL from env: http://localhost:3001
   ```

**Problemas Comuns**:
- ❌ **Erro de conexão**: 
  - Verificar `VITE_API_URL` no `.env`
  - Reiniciar servidor após alterar `.env`
  
- ❌ **CORS error**: 
  - Verificar `FRONTEND_URL` no backend `.env`
  - Incluir porta correta (8080 ou 5173)
  
- ❌ **Porta diferente**: 
  - Verificar qual porta o Vite está usando
  - Atualizar `FRONTEND_URL` no backend se necessário

**Checklist**:
- [ ] Dependências instaladas (`node_modules` existe)
- [ ] Servidor inicia sem erros
- [ ] Página carrega no navegador
- [ ] Console mostra URL da API correta
- [ ] Sem erros de conexão no console

---

### ✅ 5. Dados de Teste - Instituições

**Requisito**: Pelo menos 2 instituições de teste

**Status**: ⏳ **VERIFICAR MANUALMENTE**

**Verificação via SQL**:
```sql
-- Conectar ao PostgreSQL
psql $DATABASE_URL

-- Verificar instituições
SELECT 
  id, 
  nome, 
  subdominio, 
  tipo_instituicao, 
  tipo_academico,
  status
FROM instituicoes 
WHERE tipo_instituicao != 'EM_CONFIGURACAO'
ORDER BY nome;
```

**Verificação via API** (requer SUPER_ADMIN):
```bash
# Fazer login como SUPER_ADMIN primeiro
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@dsicola.com","password":"SuperAdmin@123"}'

# Usar token retornado
curl -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/instituicoes
```

**Criar Instituições de Teste** (se necessário):

**Opção 1: Via Interface**:
1. Fazer login como SUPER_ADMIN
2. Acessar `/super-admin/instituicoes`
3. Criar instituições:
   - **Instituição 1**: Ensino Superior
     - Nome: "Universidade Teste Superior"
     - Tipo: UNIVERSIDADE
     - Tipo Acadêmico: SUPERIOR
   - **Instituição 2**: Ensino Secundário
     - Nome: "Escola Teste Secundário"
     - Tipo: ESCOLA_SECUNDARIA
     - Tipo Acadêmico: SECUNDARIO

**Opção 2: Via Script**:
```bash
cd backend
tsx scripts/create-instituciones-superior.ts
# Ou criar script similar para secundário
```

**Checklist**:
- [ ] Instituição 1: Ensino Superior criada
- [ ] Instituição 2: Ensino Secundário criada
- [ ] Ambas com `tipoInstituicao` diferente de `EM_CONFIGURACAO`
- [ ] Ambas com assinatura ativa (ou `BYPASS_LICENSE_VALIDATION=true` em dev)
- [ ] Ambas com configuração de cores e dados básicos

---

### ✅ 6. Dados de Teste - Usuários por Perfil

**Requisito**: Pelo menos 1 usuário de cada perfil por instituição

**Status**: ⏳ **VERIFICAR MANUALMENTE**

**Perfis Necessários**:

**Global**:
- [ ] `SUPER_ADMIN` - 1 usuário (pode ser global)
  - **Credenciais padrão**: `superadmin@dsicola.com` / `SuperAdmin@123`
  - **Criado via**: Seed automático (`npm run db:seed`)

**Por Instituição**:
- [ ] `ADMIN` - 1 por instituição
- [ ] `SECRETARIA` - 1 por instituição
- [ ] `PROFESSOR` - 1 por instituição
- [ ] `ALUNO` - 1 por instituição
- [ ] `DIRECAO` - 1 por instituição (opcional)
- [ ] `COORDENADOR` - 1 por instituição (opcional)

**Verificação via SQL**:
```sql
-- Verificar usuários por perfil e instituição
SELECT 
  u.id,
  u.email,
  u.nome_completo,
  ur.role,
  u.instituicao_id,
  i.nome as instituicao_nome
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN instituicoes i ON u.instituicao_id = i.id
WHERE ur.role IN ('ADMIN', 'SECRETARIA', 'PROFESSOR', 'ALUNO', 'DIRECAO', 'COORDENADOR')
  AND i.tipo_instituicao != 'EM_CONFIGURACAO'
ORDER BY i.nome, ur.role;
```

**Criar Usuários de Teste** (se necessário):

1. **Fazer Login como ADMIN ou SUPER_ADMIN**
2. **Acessar área de administração**
3. **Criar usuários para cada perfil**:
   - ADMIN: `admin@instituicao.edu` / `admin123`
   - SECRETARIA: `secretaria@instituicao.edu` / `secretaria123`
   - PROFESSOR: `professor@instituicao.edu` / `professor123`
   - ALUNO: `aluno@instituicao.edu` / `aluno123`

**Checklist por Instituição**:
- [ ] ADMIN criado e funcional
- [ ] SECRETARIA criado e funcional
- [ ] PROFESSOR criado e funcional
- [ ] ALUNO criado e funcional
- [ ] DIRECAO criado (se necessário)
- [ ] COORDENADOR criado (se necessário)

---

### ✅ 7. Logs e Modo de Erro Amigável

**Status**: ✅ **IMPLEMENTADO**

**Backend - Logs**:

**Arquivo**: `backend/src/middlewares/errorHandler.ts`

**Características Implementadas**:
- ✅ Logs aparecem no console durante desenvolvimento
- ✅ Erros são logados com detalhes em `NODE_ENV=development`
- ✅ Logs incluem: rota, método, userId, instituicaoId
- ✅ Erros Prisma são logados com detalhes
- ✅ Mensagens amigáveis em produção
- ✅ Detalhes técnicos em desenvolvimento
- ✅ Códigos de erro específicos (P2002, P2025, etc.)
- ✅ Headers CORS mesmo em erros

**Exemplo de Log em Desenvolvimento**:
```
[ERROR_HANDLER] AppError: {
  statusCode: 400,
  message: 'Ano letivo não encontrado',
  route: 'POST /semestres',
  userId: 'xxx',
  instituicaoId: 'yyy'
}
```

**Frontend - Tratamento de Erros**:

**Arquivo**: `frontend/src/services/api.ts`

**Características Implementadas**:
- ✅ Interceptor de erros Axios
- ✅ Mensagens específicas por tipo de erro
- ✅ Tratamento de erros de rede
- ✅ Tratamento de erros de autenticação
- ✅ Mensagens amigáveis para usuário
- ✅ Detalhes técnicos apenas em desenvolvimento

**Exemplo de Mensagem Amigável**:
```javascript
// Erro de conexão
"Não foi possível conectar ao servidor. URL da API: http://localhost:3001. 
Verifique: 1) Se o backend está rodando na porta 3001, 
2) Se VITE_API_URL está configurado no frontend, 
3) Se FRONTEND_URL está configurado no backend."
```

**Teste de Erros**:
```bash
# Testar erro 404
curl http://localhost:3001/api/nao-existe

# Testar erro 401 (sem token)
curl http://localhost:3001/api/protected-route

# Deve retornar mensagem amigável
```

**Checklist**:
- [x] Backend loga erros com detalhes em desenvolvimento
- [x] Frontend mostra mensagens amigáveis
- [x] Erros de conexão têm mensagens claras
- [x] Erros de autenticação têm mensagens específicas
- [x] Erros 500 têm mensagens amigáveis em produção

---

## 🔧 SCRIPTS DE VERIFICAÇÃO

### Script 1: Verificar Preparação Completa

**Arquivo**: `scripts/verificar-preparacao.sh`

**Uso**:
```bash
./scripts/verificar-preparacao.sh
```

**O que verifica**:
- ✅ Variáveis de ambiente (backend e frontend)
- ✅ Serviços rodando (backend e frontend)
- ✅ Dependências instaladas
- ✅ Prisma Client gerado
- ✅ Banco de dados acessível
- ✅ Migrações aplicadas

---

## 📊 RESUMO DA VERIFICAÇÃO

### Status Atual:

| Item | Status | Observações |
|------|--------|-------------|
| **1. Variáveis Backend** | ⏳ | Verificar manualmente |
| **2. Variáveis Frontend** | ⏳ | Verificar manualmente |
| **3. Backend Rodando** | ⏳ | Verificar manualmente |
| **4. Frontend Rodando** | ⏳ | Verificar manualmente |
| **5. Instituições** | ⏳ | Verificar manualmente |
| **6. Usuários** | ⏳ | Verificar manualmente |
| **7. Logs e Erros** | ✅ | Implementado corretamente |

---

## 🚨 AÇÕES NECESSÁRIAS

### Antes de Continuar:

1. **Executar Script de Verificação**:
   ```bash
   ./scripts/verificar-preparacao.sh
   ```

2. **Corrigir Itens com ❌**:
   - Criar arquivos `.env` se não existirem
   - Configurar variáveis obrigatórias
   - Iniciar serviços se não estiverem rodando
   - Criar dados de teste se não existirem

3. **Verificar Manualmente**:
   - Testar login com cada perfil
   - Verificar se instituições estão ativas
   - Verificar se assinaturas estão ativas (ou bypass em dev)

---

## 📝 PRÓXIMOS PASSOS

Após completar este checklist:

1. ✅ **PARTE 1**: Testar fluxo acadêmico completo
2. ✅ **PARTE 2**: Validar multi-tenant
3. ✅ **PARTE 3**: Validar RBAC
4. ✅ **PARTE 4**: Testar casos extremos

---

---

## ✅ VERIFICAÇÃO RÁPIDA EXECUTADA

**Data da Verificação**: 2025-01-27

### Resultados:

| Item | Status | Detalhes |
|------|--------|----------|
| `backend/.env` | ✅ **EXISTE** | Arquivo encontrado |
| `frontend/.env` | ❌ **NÃO EXISTE** | **AÇÃO NECESSÁRIA**: Criar arquivo |
| Backend rodando (porta 3001) | ❌ **NÃO ESTÁ RODANDO** | **AÇÃO NECESSÁRIA**: Iniciar servidor |
| Frontend rodando | ❌ **NÃO ESTÁ RODANDO** | **AÇÃO NECESSÁRIA**: Iniciar servidor |

### Ações Imediatas Necessárias:

1. **Criar `frontend/.env`**:
   ```bash
   cd frontend
   echo "VITE_API_URL=http://localhost:3001" > .env
   ```

2. **Iniciar Backend**:
   ```bash
   cd backend
   npm run dev
   ```

3. **Iniciar Frontend** (em outro terminal):
   ```bash
   cd frontend
   npm run dev
   ```

4. **Verificar Dados de Teste**:
   - Executar seed: `cd backend && npm run db:seed`
   - Verificar instituições no banco
   - Criar usuários de teste se necessário

---

**Relatório Gerado**: 2025-01-27  
**Versão**: 1.0  
**Status**: ⏳ **AGUARDANDO AÇÕES DO USUÁRIO**

