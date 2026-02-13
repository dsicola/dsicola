# MIGRAÇÃO SIGA/SIGAE REAL - DSICOLA

## 📋 OBJETIVO

Migrar o modelo acadêmico do DSICOLA para o padrão SIGA/SIGAE REAL, onde:
- **Professor** é uma ENTIDADE própria (tabela `professores`)
- **Plano de Ensino** referencia `professores.id` (NÃO `users.id`)
- **Painel do Professor** consome EXCLUSIVAMENTE Plano de Ensino
- **Multi-tenant** rigoroso preservado

## ⚠️ IMPORTANTE

- ⚠️ O SISTEMA JÁ EXISTE
- ⚠️ EXISTEM DADOS EM PRODUÇÃO
- ⚠️ A MIGRAÇÃO DEVE SER SEGURA E CONTROLADA

## 🚀 COMO EXECUTAR A MIGRAÇÃO

### Pré-requisitos

1. Fazer backup do banco de dados
2. Verificar que o schema Prisma está atualizado
3. Garantir que não há processos ativos usando o sistema

### Passo 1: Executar Script de Migração

```bash
cd backend
npx tsx scripts/migrate-siga-real.ts
```

O script irá:
1. ✅ Popular tabela `professores` com todos os usuários que possuem role `PROFESSOR`
2. ✅ Migrar `plano_ensino.professor_id` de `users.id` para `professores.id`
3. ✅ Validar a migração e reportar problemas

### Passo 2: Verificar Resultados

O script exibirá um resumo detalhado:
- Quantos professores foram criados
- Quantos planos foram migrados
- Se há problemas que precisam ser corrigidos manualmente

### Passo 3: Testar Sistema

Após a migração, testar:
1. Login como professor
2. Acessar painel do professor
3. Verificar se turmas e disciplinas aparecem corretamente
4. Verificar se planos de ensino estão vinculados corretamente

## 📊 ESTRUTURA DA MIGRAÇÃO

### ETAPA 1: Popular Tabela Professores

Cria registros em `professores` para TODOS os usuários que:
- Possuem role `PROFESSOR`
- Pertencem a uma instituição (`instituicaoId` não é null)

**Garantias:**
- Um professor por usuário
- Sem duplicações
- Com índices e constraints corretos

### ETAPA 2: Migrar Plano de Ensino

Atualiza `plano_ensino.professor_id`:

**ANTES:**
- `plano_ensino.professor_id` = `users.id`

**DEPOIS:**
- `plano_ensino.professor_id` = `professores.id`
  (resolvido via `professores.user_id`)

**Características:**
- Preserva todos os planos existentes
- Mantém histórico
- É idempotente (pode ser executada múltiplas vezes)
- Roda em transação

### ETAPA 3: Validação

Valida que:
- Todos os users com role PROFESSOR têm registro em `professores`
- Todos os `plano_ensino.professor_id` referenciam `professores.id`

## 🔧 ARQUITETURA APÓS MIGRAÇÃO

### Resolução de Professor

O backend resolve automaticamente:

```
JWT.userId (users.id) 
  → resolveProfessorId() 
  → professores.id 
  → PlanoEnsino.professorId
```

### Fluxo de Dados

1. **Frontend** continua usando o mesmo login (não muda)
2. **JWT** continua trazendo `userId` (users.id)
3. **Backend** resolve `userId → professor → professor.id`
4. **PlanoEnsino** referencia `professores.id` (não `users.id`)

### Rotas Ajustadas

Todas as rotas do professor agora:
1. Extraem `userId` do JWT
2. Resolvem `professor.id` usando `resolveProfessorId()`
3. Usam `professor.id` nas queries de:
   - Plano de Ensino
   - Turmas
   - Disciplinas
   - Aulas
   - Notas

## 📝 SCHEMA PRISMA

O schema já está correto:

```prisma
model Professor {
  id            String   @id @default(uuid())
  userId        String   @unique
  instituicaoId String
  user          User     @relation(fields: [userId], references: [id])
  planosEnsino  PlanoEnsino[]
}

model PlanoEnsino {
  professorId   String
  professor     Professor @relation(fields: [professorId], references: [id])
}
```

## ✅ VALIDAÇÕES OBRIGATÓRIAS

Após a migração, validar:

- ✅ Professor com plano COM turma aparece
- ✅ Professor com plano SEM turma aparece
- ✅ Professor sem plano vê estado vazio válido
- ✅ Nenhuma atribuição gera erro HTTP
- ✅ Multi-tenant preservado
- ✅ Admin e Professor veem a mesma verdade

## 🐛 TROUBLESHOOTING

### Problema: Professor não encontra dados

**Solução:**
1. Verificar se existe registro em `professores` para o usuário
2. Verificar se `plano_ensino.professor_id` referencia `professores.id`
3. Verificar logs do backend para erros de resolução

### Problema: Planos não aparecem

**Solução:**
1. Verificar se `plano_ensino.professor_id` está correto
2. Verificar se `instituicaoId` está correto no plano
3. Verificar se o professor pertence à mesma instituição

### Problema: Erro ao criar plano

**Solução:**
1. Verificar se o professor existe em `professores`
2. Verificar se `resolveProfessorId()` está funcionando
3. Verificar logs do backend

## 📞 SUPORTE

Em caso de problemas:
1. Verificar logs do script de migração
2. Verificar logs do backend
3. Consultar documentação do código

## 📅 HISTÓRICO

- **2025-01-XX**: Migração inicial para modelo SIGA/SIGAE REAL

