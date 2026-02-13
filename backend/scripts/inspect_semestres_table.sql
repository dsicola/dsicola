-- Script para inspecionar a estrutura real da tabela semestres no banco
-- Execute este script para ver todas as colunas existentes

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'semestres'
ORDER BY ordinal_position;

