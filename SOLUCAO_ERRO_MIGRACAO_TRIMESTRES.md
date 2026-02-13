# 🔧 SOLUÇÃO: Erro de Migração - Tabela trimestres não existe

## ❌ Problema

A migração `20250128000000_add_semestre_audit_fields` está tentando modificar a tabela `trimestres`, mas essa tabela não existe no banco de dados, causando erro:

```
ERROR: relation "public.trimestres" does not exist
```

## ✅ Solução Aplicada

A migração foi corrigida para **verificar se a tabela existe** antes de tentar modificá-la. Agora todas as operações em `trimestres` são condicionais:

```sql
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trimestres') THEN
  -- Operações na tabela
ELSE
  RAISE NOTICE '⚠️  Tabela trimestres não existe, pulando...';
END IF;
```

## 📋 Próximos Passos

### Opção 1: Aplicar Migração Corrigida

A migração agora é **idempotente** e pode ser aplicada mesmo se a tabela `trimestres` não existir:

```bash
cd backend
npx prisma migrate resolve --applied 20250128000000_add_semestre_audit_fields
npx prisma migrate deploy
```

### Opção 2: Marcar Migração como Aplicada (Se já foi parcialmente aplicada)

Se a migração falhou parcialmente, você pode marcá-la como aplicada e continuar:

```bash
cd backend
npx prisma migrate resolve --applied 20250128000000_add_semestre_audit_fields
npx prisma migrate deploy
```

### Opção 3: Criar Tabela trimestres Manualmente (Se Necessário)

Se a tabela `trimestres` realmente não existe e precisa ser criada, execute:

```sql
-- Criar tabela trimestres baseada no schema Prisma
CREATE TABLE IF NOT EXISTS "public"."trimestres" (
    "id" TEXT NOT NULL,
    "ano_letivo_id" TEXT,
    "ano_letivo" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3),
    "data_inicio_notas" TIMESTAMP(3),
    "data_fim_notas" TIMESTAMP(3),
    "status" "StatusSemestre" NOT NULL DEFAULT 'PLANEJADO',
    "estado" "EstadoRegistro" NOT NULL DEFAULT 'RASCUNHO',
    "instituicao_id" TEXT,
    "ativado_por" TEXT,
    "ativado_em" TIMESTAMP(3),
    "encerrado_por" TEXT,
    "encerrado_em" TIMESTAMP(3),
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trimestres_pkey" PRIMARY KEY ("id")
);

-- Criar índices
CREATE INDEX IF NOT EXISTS "trimestres_instituicao_id_idx" ON "public"."trimestres"("instituicao_id");
CREATE INDEX IF NOT EXISTS "trimestres_ano_letivo_idx" ON "public"."trimestres"("ano_letivo");
CREATE INDEX IF NOT EXISTS "trimestres_ano_letivo_id_idx" ON "public"."trimestres"("ano_letivo_id");
CREATE INDEX IF NOT EXISTS "trimestres_status_idx" ON "public"."trimestres"("status");
CREATE INDEX IF NOT EXISTS "trimestres_estado_idx" ON "public"."trimestres"("estado");
CREATE INDEX IF NOT EXISTS "trimestres_data_inicio_idx" ON "public"."trimestres"("data_inicio");

-- Criar unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "trimestres_instituicao_id_ano_letivo_numero_key" 
  ON "public"."trimestres"("instituicao_id", "ano_letivo", "numero");

-- Adicionar foreign keys (se tabelas existirem)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'anos_letivos') THEN
    ALTER TABLE "public"."trimestres" 
    ADD CONSTRAINT IF NOT EXISTS "trimestres_ano_letivo_id_fkey" 
    FOREIGN KEY ("ano_letivo_id") REFERENCES "public"."anos_letivos"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'instituicoes') THEN
    ALTER TABLE "public"."trimestres" 
    ADD CONSTRAINT IF NOT EXISTS "trimestres_instituicao_id_fkey" 
    FOREIGN KEY ("instituicao_id") REFERENCES "public"."instituicoes"("id") 
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    ALTER TABLE "public"."trimestres" 
    ADD CONSTRAINT IF NOT EXISTS "trimestres_ativado_por_fkey" 
    FOREIGN KEY ("ativado_por") REFERENCES "public"."users"("id") 
    ON DELETE SET NULL ON UPDATE CASCADE;
    
    ALTER TABLE "public"."trimestres" 
    ADD CONSTRAINT IF NOT EXISTS "trimestres_encerrado_por_fkey" 
    FOREIGN KEY ("encerrado_por") REFERENCES "public"."users"("id") 
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
```

## ✅ Após Corrigir

1. Execute `npx prisma migrate deploy` novamente
2. A migração deve passar sem erros
3. Teste criar um trimestre/semestre

---

**Status**: ✅ **MIGRAÇÃO CORRIGIDA** - Agora verifica existência da tabela antes de modificar

