-- ============================================================
-- MIGRAÇÃO: Modelo Disciplina-Curso-Professor (SIGA/SIGAE)
-- ============================================================
-- Este script migra os dados existentes para o novo modelo
-- Execute APÓS a migração do schema Prisma
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ADICIONAR CAMPOS NOVOS NA TABELA DISCIPLINAS
-- ============================================================
-- (Estes campos já devem ter sido criados pela migração do Prisma)
-- Adicionar código padrão para disciplinas sem código
UPDATE disciplinas 
SET codigo = CONCAT('DISC-', LPAD(ROW_NUMBER() OVER (PARTITION BY instituicao_id ORDER BY created_at)::text, 4, '0'))
WHERE codigo IS NULL;

-- ============================================================
-- 2. MIGRAR DISCIPLINAS EXISTENTES PARA CURSO_DISCIPLINA
-- ============================================================
-- Para cada disciplina com cursoId, criar vínculo em CursoDisciplina
INSERT INTO curso_disciplina (id, curso_id, disciplina_id, semestre, carga_horaria, obrigatoria, created_at, updated_at)
SELECT 
    gen_random_uuid() as id,
    d.curso_id,
    d.id as disciplina_id,
    d.semestre,
    d.carga_horaria,
    COALESCE(d.obrigatoria, true) as obrigatoria,
    d.created_at,
    NOW() as updated_at
FROM disciplinas d
WHERE d.curso_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM curso_disciplina cd 
    WHERE cd.curso_id = d.curso_id 
      AND cd.disciplina_id = d.id
  );

-- ============================================================
-- 3. CRIAR REGISTROS DE PROFESSOR PARA USUÁRIOS COM ROLE PROFESSOR
-- ============================================================
-- Criar registros na tabela professores para usuários que têm role PROFESSOR
INSERT INTO professores (id, user_id, instituicao_id, created_at, updated_at)
SELECT 
    gen_random_uuid() as id,
    u.id as user_id,
    u.instituicao_id,
    u.created_at,
    NOW() as updated_at
FROM users u
INNER JOIN user_roles ur ON ur.user_id = u.id
WHERE ur.role = 'PROFESSOR'
  AND u.instituicao_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM professores p 
    WHERE p.user_id = u.id 
      AND p.instituicao_id = u.instituicao_id
  );

-- ============================================================
-- 4. MIGRAR VÍNCULOS PROFESSOR-CURSO (se existirem em planos de ensino)
-- ============================================================
-- Criar vínculos ProfessorCurso baseados em planos de ensino existentes
INSERT INTO professor_curso (id, professor_id, curso_id, created_at, updated_at)
SELECT DISTINCT
    gen_random_uuid() as id,
    p.id as professor_id,
    pe.curso_id,
    MIN(pe.created_at) as created_at,
    NOW() as updated_at
FROM plano_ensino pe
INNER JOIN users u ON u.id = pe.professor_id
INNER JOIN professores p ON p.user_id = u.id AND p.instituicao_id = u.instituicao_id
WHERE pe.curso_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM professor_curso pc 
    WHERE pc.professor_id = p.id 
      AND pc.curso_id = pe.curso_id
  )
GROUP BY p.id, pe.curso_id;

-- ============================================================
-- 5. MIGRAR VÍNCULOS PROFESSOR-DISCIPLINA (baseado em planos de ensino)
-- ============================================================
-- Criar vínculos ProfessorDisciplina baseados em planos de ensino existentes
INSERT INTO professor_disciplina (id, professor_id, disciplina_id, curso_id, created_at, updated_at)
SELECT DISTINCT
    gen_random_uuid() as id,
    p.id as professor_id,
    pe.disciplina_id,
    pe.curso_id,
    MIN(pe.created_at) as created_at,
    NOW() as updated_at
FROM plano_ensino pe
INNER JOIN users u ON u.id = pe.professor_id
INNER JOIN professores p ON p.user_id = u.id AND p.instituicao_id = u.instituicao_id
WHERE pe.disciplina_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM professor_disciplina pd 
    WHERE pd.professor_id = p.id 
      AND pd.disciplina_id = pe.disciplina_id
      AND (pd.curso_id = pe.curso_id OR (pd.curso_id IS NULL AND pe.curso_id IS NULL))
  )
GROUP BY p.id, pe.disciplina_id, pe.curso_id;

COMMIT;

-- ============================================================
-- VERIFICAÇÕES PÓS-MIGRAÇÃO
-- ============================================================
-- Execute estas queries para verificar a migração:

-- Verificar quantas disciplinas foram migradas para CursoDisciplina
-- SELECT COUNT(*) FROM curso_disciplina;

-- Verificar quantos professores foram criados
-- SELECT COUNT(*) FROM professores;

-- Verificar quantos vínculos ProfessorCurso foram criados
-- SELECT COUNT(*) FROM professor_curso;

-- Verificar quantos vínculos ProfessorDisciplina foram criados
-- SELECT COUNT(*) FROM professor_disciplina;

