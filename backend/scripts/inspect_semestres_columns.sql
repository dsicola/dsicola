-- Script para inspecionar colunas da tabela semestres no banco PostgreSQL
-- Execute este script para ver TODAS as colunas que existem atualmente

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'semestres'
ORDER BY ordinal_position;

