# Script: Verificar e Corrigir Alunos sem Role ALUNO

## 📋 Descrição

Este script verifica se existem usuários no banco de dados que deveriam ser alunos mas não possuem a role ALUNO vinculada.

## 🚀 Como Usar

### Opção 1: Via npm script

```bash
cd backend
npm run script:verificar-alunos
```

### Opção 2: Diretamente com tsx

```bash
cd backend
npx tsx scripts/verificar-corrigir-role-aluno.ts
```

## 🔍 O que o script faz

1. **Lista todos os usuários** do sistema
2. **Identifica usuários que parecem ser alunos** mas não têm role ALUNO:
   - Usuários com matrícula(s)
   - Usuários com `statusAluno` definido
   - Que não possuem a role ALUNO
3. **Mostra uma lista** dos usuários encontrados com suas informações
4. **Pergunta se deseja corrigir** (adicionar role ALUNO)
5. **Adiciona a role ALUNO** aos usuários identificados

## 📊 Critérios de Identificação

O script considera um usuário como "aluno sem role ALUNO" se:
- ✅ Tem pelo menos uma matrícula (`matriculas.length > 0`), OU
- ✅ Tem `statusAluno` definido (não nulo), E
- ❌ NÃO possui a role ALUNO na tabela `user_roles`

## ⚠️ Importante

- O script **NÃO remove** roles existentes, apenas **adiciona** a role ALUNO
- O script pergunta confirmação antes de fazer alterações
- Se um usuário já tiver a role ALUNO, será pulado (não cria duplicatas)

## 📝 Exemplo de Saída

```
🔍 Verificando alunos sem role ALUNO...

📊 Total de usuários no sistema: 150

⚠️  Encontrados 3 usuário(s) sem role ALUNO:

1. João Silva (joao@example.com)
   - ID: abc-123-def
   - Status Aluno: Ativo
   - Tem Matrícula: Sim
   - Roles Atuais: Nenhuma
   - Instituição ID: xyz-789

2. Maria Santos (maria@example.com)
   - ID: def-456-ghi
   - Status Aluno: Ativo
   - Tem Matrícula: Sim
   - Roles Atuais: Nenhuma
   - Instituição ID: xyz-789

❓ Deseja adicionar a role ALUNO a estes usuários? (s/n): s

🔄 Adicionando role ALUNO...

✅ Role ALUNO adicionada: joao@example.com
✅ Role ALUNO adicionada: maria@example.com

📊 Resumo:
   - ✅ Sucesso: 2
   - ❌ Erros: 0
   - 📝 Total processado: 2

✅ Todos os alunos agora possuem a role ALUNO!
```

## 🔧 Troubleshooting

### Erro: "Cannot connect to database"
- Verifique se o arquivo `.env` está configurado corretamente
- Verifique se `DATABASE_URL` está definido
- Verifique se o banco de dados está rodando

### Nenhum usuário encontrado
- Isso é bom! Significa que todos os alunos já têm a role ALUNO
- O script mostrará estatísticas de quantos usuários têm a role ALUNO

### Erro ao adicionar role
- Verifique se o usuário já não tem a role ALUNO (duplicatas não são permitidas)
- Verifique se `instituicaoId` está definido (pode ser null)

## 📌 Notas

- Este script é **seguro** e **não destrutivo**
- Pode ser executado múltiplas vezes sem problemas
- Ideal para corrigir dados após migrações ou importações

