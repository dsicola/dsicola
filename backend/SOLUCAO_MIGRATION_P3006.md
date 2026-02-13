# 🔧 SOLUÇÃO: Erro P3006 - Migration Shadow Database

## ❌ Problema

```
P3006 – Migration failed to apply cleanly to the shadow database
P1014 – The underlying table for model `public.semestres` does not exist
```

**Causa**: O banco REAL já possui tabelas, mas o SHADOW DATABASE (criado pelo Prisma) não tem.

---

## ✅ ESTRATÉGIA DE RESOLUÇÃO

### PASSO 1: Verificar Tabela no Banco Real

Execute no PostgreSQL (via psql, pgAdmin ou DBeaver):

```sql
-- Verificar se tabela semestres existe
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'semestres'
);

-- Se existir, verificar estrutura
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'semestres'
ORDER BY ordinal_position;

-- Verificar dados
SELECT COUNT(*) as total FROM semestres;
```

**Se a tabela EXISTIR**: Continue para PASSO 2  
**Se a tabela NÃO EXISTIR**: Execute a migration `20260101000134_init_academic_modules` primeiro

---

### PASSO 2: Marcar Migrations Antigas como Aplicadas

Execute no terminal (dentro da pasta `backend`):

```bash
# Marcar migrations antigas como aplicadas (uma por uma)
npx prisma migrate resolve --applied 20250127120000_add_ano_letivo_id_to_semestres_trimestres
npx prisma migrate resolve --applied 20250127150000_add_semestre_audit_fields
npx prisma migrate resolve --applied 20250128000000_add_semestre_audit_fields
npx prisma migrate resolve --applied 20250127180000_add_ano_letivo_id_fix
npx prisma migrate resolve --applied 20260101000134_init_academic_modules
npx prisma migrate resolve --applied 20260102095243_fix_semestre_encerramento_relations
npx prisma migrate resolve --applied 20260108154847_add_ano_letivo_id_to_semestres_trimestres
npx prisma migrate resolve --applied 20260125000000_create_anos_letivos_table
npx prisma migrate resolve --applied 20260130000000_make_ano_letivo_id_required
```

**⚠️ IMPORTANTE**: Execute apenas as migrations que já foram aplicadas no banco real.

---

### PASSO 3: Sincronizar Schema com Banco Real

```bash
# Sincronizar schema.prisma com o banco real
npx prisma db push

# ⚠️ NÃO usar --force-reset
```

Isso irá:
- ✅ Aplicar mudanças do schema que ainda não estão no banco
- ✅ NÃO apagar dados existentes
- ✅ NÃO recriar tabelas

---

### PASSO 4: Gerar Prisma Client

```bash
npx prisma generate
```

---

### PASSO 5: Validar

```bash
# Verificar status das migrations
npx prisma migrate status

# Iniciar backend e verificar erros
npm run dev
```

**Critérios de Sucesso**:
- ✅ `prisma migrate status` mostra todas as migrations como aplicadas
- ✅ Backend inicia sem erro P3006 ou P2022
- ✅ Scheduler roda sem erro
- ✅ Criação de Ano Letivo e Semestre funciona

---

## 🔄 ALTERNATIVA: Se PASSO 2 Falhar

Se `prisma migrate resolve` falhar, você pode marcar manualmente no banco:

```sql
-- Verificar migrations aplicadas
SELECT * FROM "_prisma_migrations" ORDER BY finished_at DESC;

-- Inserir migration manualmente (se necessário)
INSERT INTO "_prisma_migrations" (
  id,
  checksum,
  finished_at,
  migration_name,
  logs,
  rolled_back_at,
  started_at,
  applied_steps_count
) VALUES (
  gen_random_uuid(),
  'checksum_aqui', -- Obter do arquivo migration.sql
  NOW(),
  '20250128000000_add_semestre_audit_fields',
  NULL,
  NULL,
  NOW(),
  1
);
```

**⚠️ CUIDADO**: Use apenas se souber o que está fazendo.

---

## 📋 CHECKLIST FINAL

- [ ] Tabela `semestres` existe no banco real
- [ ] Migrations antigas marcadas como aplicadas
- [ ] `prisma db push` executado com sucesso
- [ ] `prisma generate` executado
- [ ] Backend inicia sem erro
- [ ] Scheduler roda sem erro
- [ ] Criação de Ano Letivo funciona
- [ ] Criação de Semestre funciona
- [ ] Nenhum erro P3006 ou P2022

---

## 🚨 SE AINDA FALHAR

1. **Desabilitar Shadow Database temporariamente**:

Edite `backend/prisma/schema.prisma` e adicione:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  shadowDatabaseUrl = env("SHADOW_DATABASE_URL") // Comentar se não existir
}
```

2. **Usar apenas `prisma db push`** para desenvolvimento:

```bash
# Em vez de migrate dev, use:
npx prisma db push
npx prisma generate
```

3. **Para produção**, use `prisma migrate deploy` (não cria shadow database).

---

**Status**: ✅ **ESTRATÉGIA DEFINIDA**  
**Próximo Passo**: Executar PASSO 1 e seguir sequência

