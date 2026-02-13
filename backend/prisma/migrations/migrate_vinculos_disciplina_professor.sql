-- ============================================================
-- MIGRAÇÃO SEGURA: VÍNCULOS DISCIPLINA-CURSO E PROFESSOR
-- ============================================================
-- Este script migra dados existentes para o novo modelo de vínculos
-- NÃO apaga colunas antigas (mantidas como legacy)
-- ============================================================

BEGIN;

-- ============================================================
-- 1. MIGRAR DISCIPLINAS PARA CURSO_DISCIPLINA
-- ============================================================
-- Para cada disciplina com cursoId, criar vínculo em CursoDisciplina
-- Ignorar duplicatas (disciplina já pode estar vinculada)

INSERT INTO curso_disciplina (id, curso_id, disciplina_id, semestre, trimestre, carga_horaria, obrigatoria, created_at, updated_at)
SELECT 
  gen_random_uuid() as id,
  d.curso_id as curso_id,
  d.id as disciplina_id,
  d.semestre as semestre,
  NULL as trimestre, -- Trimestre não estava na tabela antiga
  d.carga_horaria as carga_horaria,
  COALESCE(d.obrigatoria, true) as obrigatoria,
  NOW() as created_at,
  NOW() as updated_at
FROM disciplinas d
WHERE d.curso_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM curso_disciplina cd 
    WHERE cd.curso_id = d.curso_id 
      AND cd.disciplina_id = d.id
  )
ON CONFLICT (curso_id, disciplina_id) DO NOTHING;

-- Log do resultado
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM curso_disciplina;
  
  RAISE NOTICE 'Migração CursoDisciplina: % vínculos criados', v_count;
END $$;

-- ============================================================
-- 2. CRIAR REGISTROS PROFESSOR PARA USUÁRIOS COM ROLE PROFESSOR
-- ============================================================
-- Para cada User com role PROFESSOR, criar registro em Professor
-- Se já existir, não fazer nada

INSERT INTO professores (id, user_id, instituicao_id, created_at, updated_at)
SELECT 
  gen_random_uuid() as id,
  u.id as user_id,
  u.instituicao_id as instituicao_id,
  NOW() as created_at,
  NOW() as updated_at
FROM users u
INNER JOIN user_roles ur ON ur.user_id = u.id
WHERE ur.role = 'PROFESSOR'
  AND u.instituicao_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM professores p 
    WHERE p.user_id = u.id 
      AND p.instituicao_id = u.instituicao_id
  )
ON CONFLICT (user_id, instituicao_id) DO NOTHING;

-- Log do resultado
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM professores;
  
  RAISE NOTICE 'Migração Professor: % registros criados', v_count;
END $$;

-- ============================================================
-- 3. MIGRAR VÍNCULOS PROFESSOR-CURSO (se existirem em outras tabelas)
-- ============================================================
-- Se houver alguma tabela intermediária ou lógica que vincule
-- professor a curso, migrar aqui
-- Por enquanto, esta seção está vazia pois não há dados legados

-- ============================================================
-- 4. MIGRAR VÍNCULOS PROFESSOR-DISCIPLINA (se existirem)
-- ============================================================
-- Se houver planos de ensino ou turmas que indiquem vínculos
-- professor-disciplina, migrar aqui
-- Por enquanto, esta seção está vazia pois os vínculos serão
-- criados dinamicamente conforme necessário

-- ============================================================
-- VERIFICAÇÃO FINAL
-- ============================================================

DO $$
DECLARE
  v_disciplinas_sem_curso INTEGER;
  v_disciplinas_com_vinculo INTEGER;
  v_professores_criados INTEGER;
BEGIN
  -- Contar disciplinas sem curso (agora permitido)
  SELECT COUNT(*) INTO v_disciplinas_sem_curso
  FROM disciplinas
  WHERE curso_id IS NULL;
  
  -- Contar disciplinas com vínculo via CursoDisciplina
  SELECT COUNT(DISTINCT disciplina_id) INTO v_disciplinas_com_vinculo
  FROM curso_disciplina;
  
  -- Contar professores criados
  SELECT COUNT(*) INTO v_professores_criados
  FROM professores;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RESUMO DA MIGRAÇÃO:';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Disciplinas sem curso (institucionais): %', v_disciplinas_sem_curso;
  RAISE NOTICE 'Disciplinas com vínculo via CursoDisciplina: %', v_disciplinas_com_vinculo;
  RAISE NOTICE 'Registros Professor criados: %', v_professores_criados;
  RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ============================================================
-- NOTAS IMPORTANTES:
-- ============================================================
-- 1. As colunas curso_id e classe_id em disciplinas foram
--    mantidas como LEGACY para compatibilidade
-- 2. Novos vínculos devem ser criados via CursoDisciplina
-- 3. Professores agora têm registro na tabela professores
-- 4. Vínculos Professor-Curso e Professor-Disciplina devem
--    ser criados via endpoints específicos
-- ============================================================

