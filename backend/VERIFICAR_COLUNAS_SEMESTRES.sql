-- Script para verificar colunas da tabela semestres
-- Execute este script no banco de dados PostgreSQL

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'semestres'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Verificar especificamente se as colunas de notas existem
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

