-- ============================================
-- SCRIPT DE INSPEÇÃO: Verificar colunas existentes em semestres
-- ============================================
-- Execute este script para ver quais colunas existem no banco REAL
-- ============================================

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'semestres'
ORDER BY ordinal_position;

-- Contar total de colunas
SELECT 
    COUNT(*) as total_colunas,
    'semestres' as tabela
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'semestres';

