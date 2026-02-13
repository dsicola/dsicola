# ⚡ Solução Rápida: Erro 401 no Login de Aluno

## 🎯 Problema

Login de aluno retorna: `401 - Email ou senha inválidos`

## ✅ Solução Rápida (2 minutos)

### Passo 1: Verificar e Corrigir Roles

Execute o script que já existe no projeto:

```bash
cd backend
npm run script:verificar-alunos
```

Este script:
- ✅ Identifica alunos sem role ALUNO
- ✅ Pergunta antes de corrigir
- ✅ Adiciona role ALUNO automaticamente

### Passo 2: Testar Login

Tente fazer login novamente com as credenciais do aluno.

---

## 🔍 Se Ainda Não Funcionar

### Verificar Aluno Específico

Para diagnosticar um aluno específico:

```bash
cd backend
npx tsx scripts/diagnostico-login-aluno.ts
```

Digite o email do aluno quando solicitado. O script verifica:
- ✅ Usuário existe?
- ✅ Tem senha?
- ✅ Senha em formato correto?
- ✅ Tem role ALUNO?
- ✅ Tem instituição associada?

---

## 📋 Checklist Rápido

- [ ] Executei `npm run script:verificar-alunos`?
- [ ] O aluno tem role ALUNO no banco?
- [ ] A senha do aluno está correta?
- [ ] Testei o login novamente?

---

## ⚠️ Problemas Comuns

### 1. Aluno não tem role ALUNO
**Solução:** Execute `npm run script:verificar-alunos`

### 2. Aluno não tem senha
**Solução:** Use a API de redefinição de senha ou contate o admin

### 3. Senha incorreta
**Solução:** Verifique a senha ou use redefinição de senha

### 4. Conta bloqueada (muitas tentativas)
**Solução:** Aguarde 5 minutos ou limpe a tabela `login_attempts`

---

## 📚 Documentação Completa

Para diagnóstico detalhado, veja: `DIAGNOSTICO_ERRO_401.md`

