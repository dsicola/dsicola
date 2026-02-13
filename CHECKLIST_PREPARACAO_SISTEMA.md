# ✅ CHECKLIST: PREPARAÇÃO DO SISTEMA DSICOLA
## PARTE 0 — PREPARAÇÃO (NÃO PULAR)

**Data**: 2025-01-27  
**Versão**: 1.0

---

## 📋 CHECKLIST COMPLETO

### ✅ 1. Variáveis de Ambiente - Backend

**Arquivo**: `backend/.env`

**Variáveis Obrigatórias**:
- [ ] `DATABASE_URL` - String de conexão PostgreSQL
- [ ] `JWT_SECRET` - Chave secreta para JWT
- [ ] `JWT_REFRESH_SECRET` - Chave secreta para refresh token
- [ ] `PORT` - Porta do servidor (padrão: 3001)
- [ ] `FRONTEND_URL` - URL(s) do frontend para CORS
- [ ] `NODE_ENV` - Ambiente (development/production)

**Variáveis Opcionais**:
- [ ] `JWT_EXPIRES_IN` - Tempo de expiração do token (padrão: 24h)
- [ ] `JWT_REFRESH_EXPIRES_IN` - Tempo de expiração do refresh (padrão: 7d)
- [ ] `SMTP_HOST` - Servidor SMTP para emails
- [ ] `SMTP_PORT` - Porta SMTP
- [ ] `SMTP_USER` - Usuário SMTP
- [ ] `SMTP_PASS` - Senha SMTP
- [ ] `UPLOAD_DIR` - Diretório de uploads
- [ ] `MAX_FILE_SIZE` - Tamanho máximo de arquivo

**Template Mínimo**:
```env
# Backend .env
PORT=3001
FRONTEND_URL=http://localhost:8080,http://localhost:5173
DATABASE_URL="postgresql://usuario:senha@localhost:5432/dsicola?schema=public"
JWT_SECRET=sua_chave_secreta_super_segura_aqui
JWT_REFRESH_SECRET=sua_chave_refresh_super_segura_aqui
NODE_ENV=development
```

**Verificação**:
```bash
cd backend
# Verificar se arquivo existe
ls -la .env

# Verificar variáveis críticas
grep -E "DATABASE_URL|JWT_SECRET|PORT" .env
```

---

### ✅ 2. Variáveis de Ambiente - Frontend

**Arquivo**: `frontend/.env`

**Variáveis Obrigatórias**:
- [ ] `VITE_API_URL` - URL da API backend (ex: http://localhost:3001)

**Variáveis Opcionais**:
- [ ] `VITE_API_PORT` - Porta da API (padrão: 3001)

**Template Mínimo**:
```env
# Frontend .env
VITE_API_URL=http://localhost:3001
```

**Verificação**:
```bash
cd frontend
# Verificar se arquivo existe
ls -la .env

# Verificar variáveis críticas
grep "VITE_API_URL" .env
```

**⚠️ IMPORTANTE**: Após alterar `.env` no frontend, **reinicie o servidor de desenvolvimento**.

---

### ✅ 3. Backend Rodando

**Verificação**:

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

5. **Verificar Logs**:
   ```
   Deve aparecer:
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
- ❌ Porta 3001 já em uso: `lsof -i :3001` e matar processo
- ❌ Banco de dados não conecta: Verificar `DATABASE_URL`
- ❌ Erro de migração: Executar `npm run db:migrate`

---

### ✅ 4. Frontend Rodando

**Verificação**:

1. **Instalar Dependências**:
   ```bash
   cd frontend
   npm install
   ```

2. **Iniciar Servidor**:
   ```bash
   npm run dev
   ```

3. **Verificar Logs**:
   ```
   Deve aparecer:
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
- ❌ Erro de conexão: Verificar `VITE_API_URL` no `.env`
- ❌ CORS error: Verificar `FRONTEND_URL` no backend `.env`
- ❌ Porta diferente: Verificar qual porta o Vite está usando

---

### ✅ 5. Dados de Teste - Instituições

**Requisito**: Pelo menos 2 instituições de teste

**Verificação**:
```sql
-- No PostgreSQL
SELECT id, nome, subdominio, tipo_instituicao, tipo_academico 
FROM instituicoes 
WHERE tipo_instituicao != 'EM_CONFIGURACAO';
```

**Ou via API** (requer SUPER_ADMIN):
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/instituicoes
```

**Criar Instituições de Teste** (se necessário):
1. Acessar `/super-admin/instituicoes`
2. Criar pelo menos 2 instituições:
   - Uma de Ensino Superior (tipoAcademico: SUPERIOR)
   - Uma de Ensino Secundário (tipoAcademico: SECUNDARIO)

**Checklist**:
- [ ] Instituição 1: Ensino Superior criada
- [ ] Instituição 2: Ensino Secundário criada
- [ ] Ambas com `tipoInstituicao` diferente de `EM_CONFIGURACAO`
- [ ] Ambas com assinatura ativa (ou `BYPASS_LICENSE_VALIDATION=true` em dev)

---

### ✅ 6. Dados de Teste - Usuários por Perfil

**Requisito**: Pelo menos 1 usuário de cada perfil por instituição

**Perfis Necessários**:
- [ ] `SUPER_ADMIN` - 1 usuário (pode ser global)
- [ ] `ADMIN` - 1 por instituição
- [ ] `SECRETARIA` - 1 por instituição
- [ ] `PROFESSOR` - 1 por instituição
- [ ] `ALUNO` - 1 por instituição
- [ ] `DIRECAO` - 1 por instituição (opcional)
- [ ] `COORDENADOR` - 1 por instituição (opcional)

**Verificação**:
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
ORDER BY i.nome, ur.role;
```

**Criar Usuários de Teste** (se necessário):
1. Acessar área de administração
2. Criar usuários para cada perfil
3. Atribuir roles corretas
4. Vincular à instituição correta

**Checklist por Instituição**:
- [ ] ADMIN criado e funcional
- [ ] SECRETARIA criado e funcional
- [ ] PROFESSOR criado e funcional
- [ ] ALUNO criado e funcional
- [ ] DIRECAO criado (se necessário)
- [ ] COORDENADOR criado (se necessário)

---

### ✅ 7. Logs e Modo de Erro Amigável

**Backend - Logs**:

**Verificação**:
- [ ] Logs aparecem no console durante desenvolvimento
- [ ] Erros são logados com detalhes em `NODE_ENV=development`
- [ ] Logs incluem: rota, método, userId, instituicaoId
- [ ] Erros Prisma são logados com detalhes

**Arquivo**: `backend/src/middlewares/errorHandler.ts`

**Características**:
- ✅ Mensagens amigáveis em produção
- ✅ Detalhes técnicos em desenvolvimento
- ✅ Códigos de erro específicos (P2002, P2025, etc.)
- ✅ Headers CORS mesmo em erros

**Frontend - Tratamento de Erros**:

**Verificação**:
- [ ] Erros de conexão mostram mensagem clara
- [ ] Erros 401/403 mostram mensagem específica
- [ ] Erros 500 mostram mensagem amigável
- [ ] Detalhes técnicos apenas em desenvolvimento

**Arquivo**: `frontend/src/services/api.ts`

**Características**:
- ✅ Interceptor de erros Axios
- ✅ Mensagens específicas por tipo de erro
- ✅ Tratamento de erros de rede
- ✅ Tratamento de erros de autenticação

**Teste de Erros**:
```bash
# Testar erro 404
curl http://localhost:3001/api/nao-existe

# Testar erro 401 (sem token)
curl http://localhost:3001/api/protected-route

# Testar erro 500 (forçar erro)
# Criar rota de teste que lança erro
```

---

## 🔧 SCRIPTS DE VERIFICAÇÃO

### Script 1: Verificar Variáveis de Ambiente

```bash
#!/bin/bash
# verificar-env.sh

echo "🔍 Verificando variáveis de ambiente..."

# Backend
echo ""
echo "📦 BACKEND:"
if [ -f "backend/.env" ]; then
  echo "✅ backend/.env existe"
  echo "   Variáveis encontradas:"
  grep -E "DATABASE_URL|JWT_SECRET|PORT|FRONTEND_URL|NODE_ENV" backend/.env | sed 's/=.*/=***/' || echo "   ⚠️  Algumas variáveis podem estar faltando"
else
  echo "❌ backend/.env NÃO existe"
fi

# Frontend
echo ""
echo "📦 FRONTEND:"
if [ -f "frontend/.env" ]; then
  echo "✅ frontend/.env existe"
  echo "   Variáveis encontradas:"
  grep "VITE_API_URL" frontend/.env | sed 's/=.*/=***/' || echo "   ⚠️  VITE_API_URL não encontrado"
else
  echo "❌ frontend/.env NÃO existe"
fi
```

### Script 2: Verificar Serviços Rodando

```bash
#!/bin/bash
# verificar-servicos.sh

echo "🔍 Verificando serviços..."

# Backend
echo ""
echo "📦 BACKEND (porta 3001):"
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
  echo "✅ Backend está rodando"
else
  echo "❌ Backend NÃO está rodando"
  echo "   Execute: cd backend && npm run dev"
fi

# Frontend
echo ""
echo "📦 FRONTEND (porta 8080 ou 5173):"
if curl -s http://localhost:8080 > /dev/null 2>&1; then
  echo "✅ Frontend está rodando na porta 8080"
elif curl -s http://localhost:5173 > /dev/null 2>&1; then
  echo "✅ Frontend está rodando na porta 5173"
else
  echo "❌ Frontend NÃO está rodando"
  echo "   Execute: cd frontend && npm run dev"
fi
```

### Script 3: Verificar Dados de Teste

```bash
#!/bin/bash
# verificar-dados-teste.sh

echo "🔍 Verificando dados de teste..."

# Requer conexão com banco de dados
# Este script deve ser executado após conectar ao PostgreSQL

echo ""
echo "📦 INSTITUIÇÕES:"
psql $DATABASE_URL -c "
  SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN tipo_instituicao != 'EM_CONFIGURACAO' THEN 1 END) as ativas
  FROM instituicoes;
" 2>/dev/null || echo "❌ Não foi possível conectar ao banco de dados"

echo ""
echo "📦 USUÁRIOS POR PERFIL:"
psql $DATABASE_URL -c "
  SELECT 
    ur.role,
    COUNT(DISTINCT u.id) as total
  FROM users u
  JOIN user_roles ur ON u.id = ur.user_id
  GROUP BY ur.role
  ORDER BY ur.role;
" 2>/dev/null || echo "❌ Não foi possível conectar ao banco de dados"
```

---

## ✅ CHECKLIST FINAL

### Antes de Continuar, Verificar:

- [ ] ✅ Backend `.env` configurado corretamente
- [ ] ✅ Frontend `.env` configurado corretamente
- [ ] ✅ Backend rodando na porta 3001
- [ ] ✅ Frontend rodando (porta 8080 ou 5173)
- [ ] ✅ Banco de dados conectado
- [ ] ✅ Pelo menos 2 instituições criadas
- [ ] ✅ Usuários de teste criados (todos os perfis)
- [ ] ✅ Logs funcionando corretamente
- [ ] ✅ Erros sendo tratados de forma amigável

---

## 🚨 PROBLEMAS COMUNS E SOLUÇÕES

### Problema 1: "Cannot read properties of undefined (reading 'findFirst')"

**Causa**: Prisma não inicializado ou variável de ambiente faltando

**Solução**:
1. Verificar se `DATABASE_URL` está correto no `.env`
2. Executar `npm run db:generate` no backend
3. Reiniciar o servidor backend

### Problema 2: "Não foi possível conectar ao servidor"

**Causa**: Backend não está rodando ou `VITE_API_URL` incorreto

**Solução**:
1. Verificar se backend está rodando: `curl http://localhost:3001/health`
2. Verificar `VITE_API_URL` no frontend `.env`
3. Reiniciar frontend após alterar `.env`

### Problema 3: Erro CORS

**Causa**: `FRONTEND_URL` no backend não inclui a porta do frontend

**Solução**:
1. Verificar porta do frontend (8080 ou 5173)
2. Adicionar porta no `FRONTEND_URL` do backend: `http://localhost:8080,http://localhost:5173`
3. Reiniciar backend

### Problema 4: Erro 403 - Licença

**Causa**: Instituição sem assinatura ativa

**Solução (Desenvolvimento)**:
1. Adicionar no backend `.env`: `BYPASS_LICENSE_VALIDATION=true`
2. Ou criar assinatura ativa para a instituição
3. Ou usar usuário `SUPER_ADMIN`

---

## 📝 PRÓXIMOS PASSOS

Após completar este checklist:

1. ✅ **PARTE 1**: Testar fluxo acadêmico completo
2. ✅ **PARTE 2**: Validar multi-tenant
3. ✅ **PARTE 3**: Validar RBAC
4. ✅ **PARTE 4**: Testar casos extremos

---

**Checklist Atualizado**: 2025-01-27  
**Status**: ⏳ Aguardando verificação

