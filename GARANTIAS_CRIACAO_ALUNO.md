# ✅ Garantias de Criação de Aluno

## 📋 O que foi implementado

Foram adicionadas **validações e garantias** para assegurar que ao criar um aluno, o sistema salve corretamente:

1. ✅ **Email** - Normalizado e validado
2. ✅ **Senha** - Criptografada com bcrypt
3. ✅ **Role ALUNO** - Sempre criada quando role não especificada

---

## 🔒 Melhorias Implementadas

### 1. Validação de Senha

```typescript
// Hash password - GARANTIR que senha sempre seja hasheada
if (!password || typeof password !== 'string' || password.trim() === '') {
  console.warn(`[createUser] Senha não fornecida para ${emailNormalizado}, usando senha temporária`);
}
const senhaParaHash = password && password.trim() !== '' ? password : 'temp123';
const passwordHash = await bcrypt.hash(senhaParaHash, 12);

// VALIDAÇÃO: Garantir que senha foi hasheada corretamente
if (!passwordHash || !passwordHash.startsWith('$2')) {
  throw new AppError('Erro ao criptografar senha', 500);
}
```

**Garantias:**
- ✅ Senha sempre é hasheada (mesmo se não fornecida, usa 'temp123')
- ✅ Validação de formato bcrypt ($2a$, $2b$, $2y$)
- ✅ Erro explícito se hash falhar

### 2. Validação de Role

```typescript
// Determinar role final - GARANTIR que ALUNO seja o padrão
const roleFinal = (role || 'ALUNO') as UserRole;

// VALIDAÇÃO: Garantir que role é válida
const rolesValidas: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'DIRECAO', 'COORDENADOR', 'PROFESSOR', 'ALUNO', 'SECRETARIA', 'AUDITOR', 'POS', 'RESPONSAVEL'];
if (!rolesValidas.includes(roleFinal)) {
  throw new AppError(`Role inválida: ${roleFinal}`, 400);
}
```

**Garantias:**
- ✅ Role padrão é sempre 'ALUNO' se não especificada
- ✅ Validação de role válida
- ✅ Erro explícito se role inválida

### 3. Transação Atômica

```typescript
// Create user with role - USAR TRANSAÇÃO para garantir atomicidade
const user = await prisma.$transaction(async (tx) => {
  // 1. Criar usuário
  const novoUser = await tx.user.create({
    data: {
      email: emailNormalizado,
      password: passwordHash,
      nomeCompleto: nomeCompletoValidado,
      instituicaoId: finalInstituicaoId,
      // ...
    }
  });

  // 2. Criar role ALUNO (ou role especificada) - GARANTIR que sempre seja criada
  await tx.userRole_.create({
    data: {
      userId: novoUser.id,
      role: roleFinal,
      instituicaoId: finalInstituicaoId
    }
  });

  // 3. Validação final
  // ...
});
```

**Garantias:**
- ✅ Transação atômica (ou cria tudo ou nada)
- ✅ Role sempre é criada após usuário
- ✅ Validação final confirma que tudo foi salvo

### 4. Validação Final

```typescript
// VALIDAÇÃO FINAL: Verificar se email, senha e role foram salvos corretamente
if (!userCompleto.email || userCompleto.email !== emailNormalizado) {
  throw new AppError('Erro: Email não foi salvo corretamente', 500);
}

if (!userCompleto.password || !userCompleto.password.startsWith('$2')) {
  throw new AppError('Erro: Senha não foi salva corretamente', 500);
}

const rolesSalvas = userCompleto.roles.map(r => r.role);
if (!rolesSalvas.includes(roleFinal)) {
  throw new AppError(`Erro: Role ${roleFinal} não foi salva corretamente`, 500);
}
```

**Garantias:**
- ✅ Email foi salvo corretamente
- ✅ Senha foi salva em formato bcrypt
- ✅ Role foi salva corretamente
- ✅ Erro explícito se algo falhar

---

## 📊 Fluxo Completo

```
1. Receber dados do frontend
   ↓
2. Validar email (obrigatório, formato válido)
   ↓
3. Normalizar email (lowercase + trim)
   ↓
4. Verificar se email já existe
   ↓
5. Hash senha (bcrypt, 12 rounds)
   ↓
6. Validar formato bcrypt
   ↓
7. Determinar role (padrão: ALUNO)
   ↓
8. Validar role válida
   ↓
9. INICIAR TRANSAÇÃO
   ├─ Criar usuário no banco
   ├─ Criar role ALUNO no banco
   └─ VALIDAR que tudo foi salvo
   ↓
10. Retornar usuário criado
```

---

## ✅ Checklist de Garantias

Ao criar um aluno, o sistema garante:

- [x] **Email normalizado** (lowercase, trim)
- [x] **Email único** (verificação antes de criar)
- [x] **Senha criptografada** (bcrypt, 12 rounds)
- [x] **Senha em formato válido** (validação $2...)
- [x] **Role ALUNO criada** (padrão se não especificada)
- [x] **Role válida** (validação contra enum)
- [x] **Transação atômica** (tudo ou nada)
- [x] **Validação final** (confirma que tudo foi salvo)
- [x] **Logs de debug** (em desenvolvimento)

---

## 🚨 Tratamento de Erros

O sistema agora trata explicitamente:

1. **Senha não fornecida** → Usa 'temp123' e loga warning
2. **Hash falha** → Erro 500 explícito
3. **Role inválida** → Erro 400 explícito
4. **Email não salvo** → Erro 500 explícito
5. **Senha não salva** → Erro 500 explícito
6. **Role não salva** → Erro 500 explícito

---

## 📝 Notas Importantes

1. **Senha padrão**: Se senha não fornecida, usa 'temp123' (deve ser alterada depois)
2. **Role padrão**: Se role não especificada, usa 'ALUNO'
3. **Transação**: Tudo é feito em uma transação para garantir atomicidade
4. **Validação**: Validação final confirma que tudo foi salvo corretamente

---

## 🔍 Como Verificar

Após criar um aluno, você pode verificar:

```sql
-- Verificar usuário criado
SELECT id, email, 
  CASE 
    WHEN password LIKE '$2%' THEN 'bcrypt OK'
    ELSE 'ERRO: formato inválido'
  END as senha_status
FROM users 
WHERE email = 'aluno@example.com';

-- Verificar role ALUNO
SELECT u.email, ur.role
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
WHERE u.email = 'aluno@example.com' AND ur.role = 'ALUNO';
```

Ou use o script de diagnóstico:
```bash
cd backend
npx tsx scripts/diagnostico-login-aluno.ts
```

