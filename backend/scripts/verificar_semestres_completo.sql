-- Script para verificar se TODAS as colunas do Semestre existem no banco
-- Execute este script ANTES e DEPOIS da migration para comparar

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    CASE 
        WHEN column_name IN (
            'id', 'ano_letivo_id', 'ano_letivo', 'numero', 'data_inicio', 'data_fim',
            'data_inicio_notas', 'data_fim_notas', 'status', 'estado', 'instituicao_id',
            'ativado_por', 'ativado_em', 'encerrado_por', 'encerrado_em', 'observacoes',
            'created_at', 'updated_at', 'encerramento_ativado_id', 'encerramento_encerrado_id'
        ) THEN '✅ ESPERADA'
        ELSE '⚠️  EXTRA'
    END as status
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'semestres'
ORDER BY 
    CASE 
        WHEN column_name IN (
            'id', 'ano_letivo_id', 'ano_letivo', 'numero', 'data_inicio', 'data_fim',
            'data_inicio_notas', 'data_fim_notas', 'status', 'estado', 'instituicao_id',
            'ativado_por', 'ativado_em', 'encerrado_por', 'encerrado_em', 'observacoes',
            'created_at', 'updated_at', 'encerramento_ativado_id', 'encerramento_encerrado_id'
        ) THEN 0
        ELSE 1
    END,
    ordinal_position;

-- Resumo
SELECT 
    COUNT(*) FILTER (WHERE column_name IN (
        'id', 'ano_letivo_id', 'ano_letivo', 'numero', 'data_inicio', 'data_fim',
        'data_inicio_notas', 'data_fim_notas', 'status', 'estado', 'instituicao_id',
        'ativado_por', 'ativado_em', 'encerrado_por', 'encerrado_em', 'observacoes',
        'created_at', 'updated_at', 'encerramento_ativado_id', 'encerramento_encerrado_id'
    )) as colunas_esperadas_encontradas,
    COUNT(*) as total_colunas,
    CASE 
        WHEN COUNT(*) FILTER (WHERE column_name IN (
            'id', 'ano_letivo_id', 'ano_letivo', 'numero', 'data_inicio', 'data_fim',
            'data_inicio_notas', 'data_fim_notas', 'status', 'estado', 'instituicao_id',
            'ativado_por', 'ativado_em', 'encerrado_por', 'encerrado_em', 'observacoes',
            'created_at', 'updated_at', 'encerramento_ativado_id', 'encerramento_encerrado_id'
        )) = 20 THEN '✅ COMPLETO'
        ELSE '⚠️  INCOMPLETO'
    END as status_sincronizacao
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'semestres';

