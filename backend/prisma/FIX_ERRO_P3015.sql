-- ============================================
-- FIX: Erro P3015 - Migration arquivada não encontrada
-- ============================================
-- Este script remove entradas incorretas da tabela _prisma_migrations
-- que estão causando o erro P3015
-- ============================================

-- 1. Verificar entradas problemáticas
SELECT 
    migration_name,
    applied_steps_count,
    started_at,
    finished_at
FROM _prisma_migrations 
WHERE migration_name LIKE '%archived%' 
   OR migration_name = '_archived_broken_migrations'
   OR migration_name LIKE '%20250120000000_create_semestres_table%'
ORDER BY started_at DESC;

-- 2. Remover entrada incorreta (se existir)
-- ATENÇÃO: Execute apenas se você tiver certeza que a migration não deve estar aplicada
-- Se a migration já foi aplicada e substituída pelo baseline, está seguro remover

DELETE FROM _prisma_migrations 
WHERE migration_name = '_archived_broken_migrations'
   OR migration_name = '20250120000000_create_semestres_table';

-- 3. Verificar se foi removido
SELECT COUNT(*) as entradas_restantes
FROM _prisma_migrations 
WHERE migration_name LIKE '%archived%' 
   OR migration_name LIKE '%20250120000000_create_semestres_table%';

-- ============================================
-- NOTA: Se você precisar manter o histórico,
-- não execute o DELETE, apenas verifique o SELECT acima
-- ============================================

