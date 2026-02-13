# 🔍 Solução: Debug do Erro 401 com Credenciais Corretas

## 🎯 Problema

Login retorna 401 mesmo com credenciais corretas.

## ✅ Soluções Implementadas

### 1. Script de Teste Direto no Backend

Criei um script para testar o login diretamente no banco, sem passar pelo frontend:

```bash
cd backend
npx tsx scripts/testar-login-aluno.ts
```

Este script:
- ✅ Verifica se o usuário existe
- ✅ Verifica se a senha está correta (compara diretamente com bcrypt)
- ✅ Verifica se tem role ALUNO
- ✅ Verifica se tem instituição associada

**Use este script para confirmar se o problema está no backend ou frontend.**

### 2. Logs de Debug Adicionados

Adicionei logs detalhados no `auth.service.ts` para identificar exatamente onde está falhando:

- Log quando usuário não é encontrado
- Log quando senha está incorreta
- Log quando usuário não tem roles
- Log quando login é bem-sucedido

**Os logs aparecem no console do backend quando `NODE_ENV !== 'production'`**

### 3. Verificações Adicionais

O código agora verifica:
- ✅ Se o usuário tem roles (aviso se não tiver)
- ✅ Se a senha está no formato correto
- ✅ Se a comparação de senha funcionou

---

## 🔧 Passos para Diagnosticar

### Passo 1: Testar Login Diretamente no Backend

```bash
cd backend
npx tsx scripts/testar-login-aluno.ts
```

Digite o email e senha do aluno. O script dirá exatamente onde está o problema.

### Passo 2: Verificar Logs do Backend

Ao tentar fazer login pelo frontend, verifique os logs do backend. Você verá:

```
[AUTH] Login attempt: { email: 'aluno@example.com' }
[AUTH] User found: { id: '...', email: '...', roles: [...] }
[AUTH] Password comparison: { isValid: true/false }
[AUTH] ✅ Login successful: { ... }
```

### Passo 3: Verificar no Banco de Dados

Execute estas queries para verificar o aluno:

```sql
-- Verificar se aluno existe e tem senha
SELECT id, email, 
  CASE 
    WHEN password IS NULL OR password = '' THEN 'SEM SENHA'
    WHEN password LIKE '$2%' THEN 'SENHA OK (bcrypt)'
    ELSE 'SENHA FORMATO ERRADO'
  END as status_senha,
  password IS NOT NULL as tem_senha
FROM users 
WHERE email = 'aluno@example.com';

-- Verificar roles
SELECT u.email, ur.role
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
WHERE u.email = 'aluno@example.com';

-- Verificar se conta está bloqueada
SELECT * FROM login_attempts 
WHERE email = 'aluno@example.com' 
  AND locked_until > NOW();
```

---

## 🐛 Problemas Comuns e Soluções

### Problema 1: Usuário não tem role ALUNO

**Sintoma:** Login funciona, mas retorna 401 ou não redireciona

**Solução:**
```bash
cd backend
npm run script:verificar-alunos
```

### Problema 2: Senha não está em formato bcrypt

**Sintoma:** Erro "Erro na configuração da senha"

**Solução:** Redefinir senha via API ou script

### Problema 3: Conta bloqueada

**Sintoma:** Erro "Conta temporariamente bloqueada"

**Solução:**
```sql
-- Limpar bloqueio
DELETE FROM login_attempts WHERE email = 'aluno@example.com';
```

### Problema 4: Problema de CORS ou Conexão

**Sintoma:** Erro de rede no frontend

**Solução:**
1. Verificar se backend está rodando
2. Verificar `VITE_API_URL` no frontend
3. Verificar CORS no backend

---

## 📋 Checklist de Verificação

- [ ] Executei `testar-login-aluno.ts` e senha está correta?
- [ ] Aluno tem role ALUNO no banco?
- [ ] Backend está rodando e acessível?
- [ ] `VITE_API_URL` está configurado corretamente?
- [ ] Verifiquei os logs do backend durante o login?
- [ ] Conta não está bloqueada?

---

## 🚀 Próximos Passos

1. **Execute o script de teste:**
   ```bash
   cd backend
   npx tsx scripts/testar-login-aluno.ts
   ```

2. **Se o script mostrar que tudo está correto, o problema pode ser:**
   - CORS
   - URL da API incorreta
   - Problema de rede
   - Token não sendo salvo corretamente

3. **Verifique os logs do backend** ao tentar fazer login pelo frontend

4. **Compare os resultados** do script com os logs do backend

---

## 📝 Notas

- Os logs de debug só aparecem em modo desenvolvimento (`NODE_ENV !== 'production'`)
- O script de teste usa bcrypt diretamente, então é 100% confiável
- Se o script funcionar mas o frontend não, o problema está na comunicação frontend-backend

