-- ============================================
-- SCRIPT: Adicionar Colunas de Notas em Semestres
-- ============================================
-- Execute este script diretamente no banco de dados PostgreSQL
-- 
-- IMPORTANTE: Este script é idempotente (pode ser executado múltiplas vezes)
-- ============================================

-- Adicionar data_inicio_notas (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'semestres' 
    AND column_name = 'data_inicio_notas'
  ) THEN
    ALTER TABLE "public"."semestres" 
    ADD COLUMN "data_inicio_notas" TIMESTAMP(3);
    
    RAISE NOTICE '✅ Coluna data_inicio_notas adicionada à tabela semestres';
  ELSE
    RAISE NOTICE 'ℹ️  Coluna data_inicio_notas já existe na tabela semestres';
  END IF;
END $$;

-- Adicionar data_fim_notas (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'semestres' 
    AND column_name = 'data_fim_notas'
  ) THEN
    ALTER TABLE "public"."semestres" 
    ADD COLUMN "data_fim_notas" TIMESTAMP(3);
    
    RAISE NOTICE '✅ Coluna data_fim_notas adicionada à tabela semestres';
  ELSE
    RAISE NOTICE 'ℹ️  Coluna data_fim_notas já existe na tabela semestres';
  END IF;
END $$;

-- Verificar resultado
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'semestres' 
            AND column_name = 'data_inicio_notas'
        ) THEN '✅ data_inicio_notas existe'
        ELSE '❌ data_inicio_notas NÃO existe'
    END as status_inicio_notas,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'semestres' 
            AND column_name = 'data_fim_notas'
        ) THEN '✅ data_fim_notas existe'
        ELSE '❌ data_fim_notas NÃO existe'
    END as status_fim_notas;

-- Mostrar estrutura da tabela semestres
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'semestres'
  AND table_schema = 'public'
  AND column_name IN ('data_inicio', 'data_fim', 'data_inicio_notas', 'data_fim_notas')
ORDER BY 
    CASE column_name
        WHEN 'data_inicio' THEN 1
        WHEN 'data_fim' THEN 2
        WHEN 'data_inicio_notas' THEN 3
        WHEN 'data_fim_notas' THEN 4
    END;

RAISE NOTICE '✅ Script concluído!';

