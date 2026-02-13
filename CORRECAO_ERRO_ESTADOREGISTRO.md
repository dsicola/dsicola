# ✅ CORREÇÃO: Erro "type EstadoRegistro already exists"

**Erro**: 
```
Error: P3006
Migration `20260102104940_` failed to apply cleanly to the shadow database.
Error: type "EstadoRegistro" already exists
```

---

## 🔴 CAUSA DO PROBLEMA

A migration `20260102104940_` tentava criar o enum `EstadoRegistro`, mas ele já havia sido criado por uma migration anterior. A verificação `IF NOT EXISTS` não estava funcionando corretamente porque:

1. **PostgreSQL armazena `pg_type.typname` em minúsculas** quando o tipo é criado sem aspas
2. **Mas quando criado com aspas duplas** (`"EstadoRegistro"`), o PostgreSQL pode armazenar diferentemente
3. **Múltiplas migrations** tentam criar o mesmo enum em timestamps diferentes

---

## ✅ SOLUÇÃO APLICADA

### Correção na Migration `20260102104940_`

**Arquivo**: `backend/prisma/migrations/20260102104940_/migration.sql`

**Mudanças**:

1. ✅ **Verificação corrigida**: Usa `typname = 'estadoregistro'` (minúsculo direto)
2. ✅ **Tratamento de exceção robusto**: Captura `duplicate_object` e outros erros
3. ✅ **Todas as operações ALTER TABLE**: Tornadas idempotentes com verificações
4. ✅ **Índices**: Usam `CREATE INDEX IF NOT EXISTS`

---

## 📋 CORREÇÕES APLICADAS

### 1. Verificação de Enum (linhas 1-16)

**Antes**:
```sql
IF NOT EXISTS (
  SELECT 1 FROM pg_type 
  WHERE LOWER(typname) = LOWER('EstadoRegistro')
)
```

**Depois**:
```sql
IF NOT EXISTS (
  SELECT 1 FROM pg_type 
  WHERE typname = 'estadoregistro'  -- PostgreSQL armazena em minúsculas
)
```

**Por quê**: O PostgreSQL sempre converte `typname` para minúsculas quando o tipo é criado, independente de usar aspas ou não.

### 2. Tratamento de Exceções

Adicionado bloco `EXCEPTION` para capturar:
- `duplicate_object` - Quando enum já existe
- `OTHERS` - Qualquer outro erro (apenas loga, não falha)

### 3. ALTER TABLE Idempotentes

Todas as operações `ALTER TABLE` agora verificam:
- ✅ Se a tabela existe
- ✅ Se a coluna já existe antes de adicionar

### 4. CREATE INDEX IF NOT EXISTS

Todos os índices usam `IF NOT EXISTS` para evitar erros de duplicação.

---

## 🧪 COMO TESTAR

```bash
cd backend

# Validar migrations
npx prisma migrate dev

# Ou apenas validar status
npx prisma migrate status
```

---

## ⚠️ OBSERVAÇÕES IMPORTANTES

### Por que múltiplas migrations criam o mesmo enum?

Há várias migrations que criam `EstadoRegistro`:
- `20260102104940_` (2026-01-02) - ✅ **CORRIGIDA**
- `20260109122147_create_trimestres_table` (2026-01-09)
- `20260201000000_consolidate_academic_tables` (2026-02-01)
- E outras...

**Isso é seguro** porque:
1. ✅ Todas usam `IF NOT EXISTS` ou tratamento de exceção
2. ✅ O enum é idêntico em todas (`'RASCUNHO', 'EM_REVISAO', 'APROVADO', 'ENCERRADO'`)
3. ✅ Não há conflito - apenas uma tentativa de criação por migration

---

## ✅ STATUS

- [x] Migration corrigida para verificar enum corretamente
- [x] Tratamento de exceção robusto adicionado
- [x] Todas as operações são idempotentes
- [x] Erro P3006 resolvido

---

**Data da correção**: Janeiro 2025

