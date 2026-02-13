# 🔧 INSTRUÇÕES: Criar Tabela Trimestres

## ❌ Problema

O erro indica que a tabela `trimestres` não existe no banco de dados:

```
Error: P1014
The underlying table for model `trimestres` does not exist.
```

## ✅ Solução

### Passo 1: Criar a tabela trimestres

Execute o arquivo `backend/CRIAR_TABELA_TRIMESTRES.sql` diretamente no banco de dados:

**Via psql:**
```bash
psql -U seu_usuario -d seu_banco -f backend/CRIAR_TABELA_TRIMESTRES.sql
```

**Via pgAdmin ou DBeaver:**
1. Abra o arquivo `backend/CRIAR_TABELA_TRIMESTRES.sql`
2. Execute o script completo

### Passo 2: Aplicar colunas de notas (se ainda não aplicou)

Execute também o script para adicionar as colunas de notas:
```bash
psql -U seu_usuario -d seu_banco -f backend/APLICAR_COLUNAS_DATA_NOTAS_URGENTE.sql
```

### Passo 3: Sincronizar com Prisma

Depois de criar a tabela, você pode:

**Opção A: Usar prisma db push (recomendado para desenvolvimento)**
```bash
cd backend
npx prisma db push
```

**Opção B: Criar migração formal**
```bash
cd backend
npx prisma migrate dev --name create_trimestres_table
```

## 📋 O que o Script Faz

1. ✅ Cria enums necessários (`StatusSemestre`, `EstadoRegistro`) se não existirem
2. ✅ Cria tabela `trimestres` com todas as colunas
3. ✅ Cria índices para performance
4. ✅ Cria unique constraint
5. ✅ Adiciona foreign keys para:
   - `anos_letivos` (obrigatória)
   - `instituicoes` (opcional)
   - `users` (ativado_por e encerrado_por)

## ⚠️ Importante

- O script é **idempotente** (pode ser executado múltiplas vezes)
- Verifica se tabelas relacionadas existem antes de criar FKs
- Não afeta dados existentes

## ✅ Após Aplicar

1. Execute `npx prisma db push` ou crie uma migração
2. Reinicie o servidor backend
3. Teste criar/listar trimestres
4. O erro deve estar resolvido

---

**Status**: 🔴 **URGENTE** - Aplicar antes de usar trimestres

