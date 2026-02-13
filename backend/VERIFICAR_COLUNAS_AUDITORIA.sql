-- ============================================
-- SCRIPT DE VALIDAÇÃO: Verificar colunas de auditoria
-- ============================================
-- Execute este script para verificar se as colunas existem no banco
-- ============================================

-- Verificar colunas em semestres
SELECT 
  'semestres' as tabela,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'semestres'
  AND column_name IN ('ativado_por', 'ativado_em', 'encerrado_por', 'encerrado_em', 'iniciado_por', 'iniciado_em')
ORDER BY column_name;

-- Verificar colunas em trimestres
SELECT 
  'trimestres' as tabela,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'trimestres'
  AND column_name IN ('ativado_por', 'ativado_em', 'encerrado_por', 'encerrado_em')
ORDER BY column_name;

-- Verificar foreign keys
SELECT 
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('semestres', 'trimestres')
  AND kcu.column_name IN ('ativado_por', 'encerrado_por')
ORDER BY tc.table_name, kcu.column_name;

