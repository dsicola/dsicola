# Diagnóstico: Erro 401 "Email ou senha inválidos"

## 🔍 Análise do Erro

O erro `401 - Email ou senha inválidos` pode ocorrer por **duas razões** no código de autenticação:

### 1️⃣ Usuário não encontrado (linha 192 do auth.service.ts)
```typescript
if (!user) {
  await this.recordFailedLogin(email);
  throw new AppError('Email ou senha inválidos', 401);
}
```

### 2️⃣ Senha incorreta (linha 221 do auth.service.ts)
```typescript
if (!isValidPassword) {
  await this.recordFailedLogin(email);
  throw new AppError('Email ou senha inválidos', 401);
}
```

---

## 🛠️ Scripts de Diagnóstico

Existem scripts para diagnosticar e corrigir o problema:

### 1. Diagnóstico Individual (`backend/scripts/diagnostico-login-aluno.ts`) - NOVO

**Use quando:** Quer diagnosticar um aluno específico por email

**Como usar:**
```bash
cd backend
npx tsx scripts/diagnostico-login-aluno.ts
```

Este script verifica:
- ✅ Se o usuário existe no banco
- ✅ Se o usuário tem senha configurada
- ✅ Se a senha está no formato bcrypt correto
- ✅ Se o usuário tem role ALUNO
- ✅ Se há instituição associada

**Exemplo de saída:**
```
=== DIAGNÓSTICO DE LOGIN DE ALUNO ===

1️⃣ Verificando se usuário existe...
✅ Usuário encontrado:
   ID: xxx
   Nome: João Silva
   Email: joao@example.com

2️⃣ Verificando senha...
✅ Senha existe

3️⃣ Verificando formato da senha...
✅ Senha está no formato bcrypt correto

4️⃣ Verificando roles...
❌ PROBLEMA CRÍTICO: Usuário NÃO TEM NENHUMA ROLE
```

### 2. Verificar e Corrigir Alunos Sem Role (`backend/scripts/verificar-corrigir-role-aluno.ts`) - RECOMENDADO

**Use quando:** Quer corrigir vários alunos de uma vez

**Como usar:**
```bash
cd backend
npm run script:verificar-alunos
# ou
npx tsx scripts/verificar-corrigir-role-aluno.ts
```

Este script (já existente):
- ✅ Busca todos os usuários que parecem ser alunos (tem matrícula ou statusAluno)
- ✅ Mas não têm role ALUNO
- ✅ Pergunta antes de adicionar role ALUNO
- ✅ Adiciona role ALUNO aos usuários identificados

**Vantagens:**
- Usa critérios inteligentes (matrícula, statusAluno)
- Mais seguro (pergunta antes de alterar)
- Já está no package.json como script npm

### 3. Adicionar Role ALUNO em Lote (`backend/scripts/adicionar-role-aluno.ts`) - ALTERNATIVA

**Use quando:** Quer adicionar role ALUNO a TODOS os usuários sem role (menos seguro)

**Como usar:**
```bash
cd backend
npx tsx scripts/adicionar-role-aluno.ts
```

Este script:
- Busca todos os usuários sem role ALUNO
- Adiciona role ALUNO a todos (sem filtros)

---

## 🔧 Soluções Comuns

### Problema 1: Aluno não tem role ALUNO

**Sintoma:** Login retorna 401, mas o aluno existe no banco

**Solução:**
```sql
-- Adicionar role ALUNO manualmente
INSERT INTO user_roles (id, user_id, role, instituicao_id, created_at)
VALUES (
  gen_random_uuid(),
  'USER_ID_AQUI',
  'ALUNO',
  'INSTITUICAO_ID_AQUI',
  NOW()
)
ON CONFLICT (user_id, role) DO NOTHING;
```

Ou usar o script:
```bash
npx tsx scripts/adicionar-role-aluno.ts
```

### Problema 2: Aluno não tem senha

**Sintoma:** Erro específico "Usuário sem senha cadastrada"

**Solução:**
```typescript
// Via API de atualização de senha
PUT /api/auth/password
{
  "currentPassword": "",
  "newPassword": "novaSenha123"
}
```

Ou via redefinição de senha:
```typescript
POST /api/auth/reset-password
{
  "email": "aluno@example.com"
}
```

### Problema 3: Senha não está em formato bcrypt

**Sintoma:** Erro "Erro na configuração da senha"

**Solução:** A senha deve começar com `$2a$`, `$2b$` ou `$2y$`

```typescript
import bcrypt from 'bcryptjs';
const hash = await bcrypt.hash('senha123', 12);
// Resultado: $2a$12$...
```

### Problema 4: Email/Senha realmente incorretos

**Sintoma:** Login falha com credenciais válidas (verificar se realmente são válidas)

**Solução:**
1. Verificar se o email está correto (case-insensitive, mas verificar espaços)
2. Verificar se a senha está correta
3. Testar reset de senha

---

## 📋 Checklist de Verificação

Use este checklist para diagnosticar problemas de login:

- [ ] Usuário existe no banco de dados?
  ```sql
  SELECT * FROM users WHERE email = 'aluno@example.com';
  ```

- [ ] Usuário tem senha configurada?
  ```sql
  SELECT id, email, password IS NOT NULL as tem_senha 
  FROM users 
  WHERE email = 'aluno@example.com';
  ```

- [ ] Senha está no formato bcrypt?
  ```sql
  SELECT id, email, 
    CASE 
      WHEN password LIKE '$2%' THEN 'bcrypt'
      ELSE 'outro formato'
    END as formato_senha
  FROM users 
  WHERE email = 'aluno@example.com';
  ```

- [ ] Usuário tem role ALUNO?
  ```sql
  SELECT u.email, ur.role
  FROM users u
  LEFT JOIN user_roles ur ON u.id = ur.user_id
  WHERE u.email = 'aluno@example.com';
  ```

- [ ] Conta está bloqueada?
  ```sql
  SELECT * FROM login_attempts 
  WHERE email = 'aluno@example.com' 
    AND locked_until > NOW();
  ```

---

## 🚀 Próximos Passos

1. **Para diagnosticar um aluno específico:**
   ```bash
   cd backend
   npx tsx scripts/diagnostico-login-aluno.ts
   ```
   (Digite o email do aluno quando solicitado)

2. **Para corrigir vários alunos de uma vez (RECOMENDADO):**
   ```bash
   cd backend
   npm run script:verificar-alunos
   ```
   (Este script identifica alunos sem role ALUNO e pergunta antes de corrigir)

3. **Verifique os logs do servidor** para erros adicionais:
   ```bash
   # Se usando PM2
   pm2 logs backend
   
   # Se usando npm/node diretamente
   # Verificar console onde o servidor está rodando
   ```

4. **Teste o login novamente** após aplicar as correções

---

## 📝 Notas Importantes

- O erro **não diferencia** entre "usuário não encontrado" e "senha incorreta" por segurança
- O sistema bloqueia após 5 tentativas falhadas (5 minutos)
- Senhas devem sempre estar em formato bcrypt ($2a$, $2b$ ou $2y$)
- A role ALUNO é obrigatória para alunos fazerem login

