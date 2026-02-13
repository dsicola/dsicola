# Debug: Problemas com Requisições GET (403)

## Correções Aplicadas

### Backend

1. **Logs de Debug Adicionados**
   - Middleware de autenticação (`auth.ts`)
   - Middleware de licença (`license.middleware.ts`)
   - Error handler (`errorHandler.ts`)

2. **Status HTTP Padronizados**
   - 401: Token ausente/inválido/expirado
   - 403: Permissão negada / Licença bloqueada
   - Campos `reason` adicionados para identificar o tipo de erro

3. **Mensagens de Erro Melhoradas**
   - Erros incluem campo `reason` explicativo
   - Logs detalhados em desenvolvimento

### Frontend

1. **Interceptor Melhorado**
   - Logs detalhados de erros 403
   - Tratamento específico para diferentes tipos de 403
   - Mensagens mais claras para problemas de licença

## Possíveis Causas de 403

### 1. Licença não encontrada (LICENSE_NOT_FOUND)
**Sintoma**: Requisições GET retornam 403 com `reason: "LICENSE_NOT_FOUND"`

**Solução para Desenvolvimento**:
```bash
# No arquivo .env do backend:
BYPASS_LICENSE_VALIDATION=true
# OU
AUTO_CREATE_LICENSE=true
```

### 2. Licença com status inválido (LICENSE_STATUS_INVALID)
**Sintoma**: `reason: "LICENSE_STATUS_INVALID"`

**Solução**: Verificar status da assinatura no banco de dados:
```sql
SELECT * FROM assinaturas WHERE instituicao_id = '<instituicao_id>';
```

Status deve ser `'ativa'`

### 3. Licença expirada (LICENSE_EXPIRED)
**Sintoma**: `reason: "LICENSE_EXPIRED"`

**Solução**: Atualizar `data_fim` da assinatura ou renovar

### 4. Permissões insuficientes (INSUFFICIENT_PERMISSIONS)
**Sintoma**: `reason: "INSUFFICIENT_PERMISSIONS"`

**Solução**: Verificar roles do usuário no token JWT

## Como Testar

### 1. Teste via cURL

```bash
# Sem token (deve retornar 401)
curl -i http://localhost:3001/users

# Com token válido (deve retornar 200)
curl -i -H "Authorization: Bearer <TOKEN>" http://localhost:3001/users

# Com token válido mas sem licença (deve retornar 403 com reason)
curl -i -H "Authorization: Bearer <TOKEN>" http://localhost:3001/users
```

### 2. Verificar Logs do Backend

Quando uma requisição GET for feita, você verá logs como:

```
[validateLicense] 📋 Iniciando validação de licença: { ... }
[AUTH] User authenticated: { ... }
[getUsers] Request: { ... }
```

Se houver bloqueio, verá:
```
[validateLicense] ❌ BLOQUEADO: Instituição sem assinatura
[ERROR_HANDLER] AppError: { reason: "LICENSE_NOT_FOUND", ... }
```

### 3. Verificar no Frontend

No console do navegador (dev tools), você verá:

```javascript
[API Error] {
  status: 403,
  reason: "LICENSE_NOT_FOUND",
  error: "Acesso bloqueado: sua instituição não possui uma assinatura ativa...",
  ...
}
```

## Solução Rápida para Desenvolvimento

1. **Opção 1: Bypass de Licença** (Recomendado para dev)
```bash
# backend/.env
BYPASS_LICENSE_VALIDATION=true
```

2. **Opção 2: Criar Assinatura Automática**
```bash
# backend/.env
AUTO_CREATE_LICENSE=true
```

3. **Opção 3: Criar Assinatura Manualmente**
```sql
-- Inserir assinatura ativa para sua instituição
INSERT INTO assinaturas (
  id,
  instituicao_id,
  plano_id,
  status,
  data_fim
) VALUES (
  gen_random_uuid(),
  '<sua_instituicao_id>',
  (SELECT id FROM planos WHERE ativo = true LIMIT 1),
  'ativa',
  NOW() + INTERVAL '1 year'
);
```

## Verificação de Funcionamento

Após aplicar as correções:

✅ GET sem token → 401 Unauthorized
✅ GET com token válido + licença ativa → 200 OK
✅ GET com token válido + sem licença → 403 com reason explicativo
✅ Logs detalhados aparecem no console do backend
✅ Erros claros aparecem no console do frontend

