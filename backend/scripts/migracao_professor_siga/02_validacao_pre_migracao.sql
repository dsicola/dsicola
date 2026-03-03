-- ============================================================
-- VALIDAÇÃO PRÉ-MIGRAÇÃO - MIGRAÇÃO PROFESSOR
-- ============================================================
-- OBJETIVO: Validar estado do banco antes da migração
-- ============================================================
-- DATA: 2025-01-XX
-- SISTEMA: DSICOLA
-- ============================================================

-- Este script valida:
-- 1. Existência das tabelas necessárias
-- 2. Estado atual dos dados
-- 3. Integridade referencial básica
-- 4. Preparação para migração

DO $$
DECLARE
  -- Contadores
  total_users INTEGER;
  total_professores INTEGER;
  total_planos_ensino INTEGER;
  users_com_role_professor INTEGER;
  users_sem_instituicao INTEGER;
  planos_com_professor_id INTEGER;
  planos_sem_professor_id INTEGER;
  planos_com_professor_invalido INTEGER;
  
  -- Flags de validação
  tabelas_ok BOOLEAN := TRUE;
  dados_ok BOOLEAN := TRUE;
  
  -- Mensagens
  mensagem TEXT;
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  VALIDAÇÃO PRÉ-MIGRAÇÃO';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  
  -- ============================================================
  -- ETAPA 1: VALIDAR EXISTÊNCIA DAS TABELAS
  -- ============================================================
  RAISE NOTICE '📋 ETAPA 1: Validando existência das tabelas...';
  
  -- Verificar tabela users
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    RAISE EXCEPTION '❌ ERRO: Tabela users não existe';
  END IF;
  RAISE NOTICE '  ✅ Tabela users existe';
  
  -- Verificar tabela user_roles
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_roles') THEN
    RAISE EXCEPTION '❌ ERRO: Tabela user_roles não existe';
  END IF;
  RAISE NOTICE '  ✅ Tabela user_roles existe';
  
  -- Verificar tabela professores
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'professores') THEN
    RAISE EXCEPTION '❌ ERRO: Tabela professores não existe';
  END IF;
  RAISE NOTICE '  ✅ Tabela professores existe';
  
  -- Verificar tabela plano_ensino
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plano_ensino') THEN
    RAISE EXCEPTION '❌ ERRO: Tabela plano_ensino não existe';
  END IF;
  RAISE NOTICE '  ✅ Tabela plano_ensino existe';
  
  -- Verificar tabela instituicoes
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'instituicoes') THEN
    RAISE EXCEPTION '❌ ERRO: Tabela instituicoes não existe';
  END IF;
  RAISE NOTICE '  ✅ Tabela instituicoes existe';
  
  RAISE NOTICE '';
  
  -- ============================================================
  -- ETAPA 2: CONTAR DADOS ATUAIS
  -- ============================================================
  RAISE NOTICE '📊 ETAPA 2: Contando dados atuais...';
  
  -- Total de usuários
  SELECT COUNT(*) INTO total_users FROM users;
  RAISE NOTICE '  Total de usuários: %', total_users;
  
  -- Usuários com role PROFESSOR
  SELECT COUNT(DISTINCT u.id) INTO users_com_role_professor
  FROM users u
  INNER JOIN user_roles ur ON u.id = ur.user_id
  WHERE ur.role = 'PROFESSOR';
  RAISE NOTICE '  Usuários com role PROFESSOR: %', users_com_role_professor;
  
  -- Usuários sem instituição
  SELECT COUNT(*) INTO users_sem_instituicao
  FROM users u
  INNER JOIN user_roles ur ON u.id = ur.user_id
  WHERE ur.role = 'PROFESSOR'
    AND u.instituicao_id IS NULL;
  
  IF users_sem_instituicao > 0 THEN
    RAISE WARNING '  ⚠️  Usuários PROFESSOR sem instituição: %', users_sem_instituicao;
    RAISE WARNING '     Estes usuários NÃO serão migrados (requerem instituição)';
  ELSE
    RAISE NOTICE '  ✅ Todos os professores têm instituição';
  END IF;
  
  -- Total de professores na tabela professores
  SELECT COUNT(*) INTO total_professores FROM professores;
  RAISE NOTICE '  Total de registros em professores: %', total_professores;
  
  -- Total de planos de ensino
  SELECT COUNT(*) INTO total_planos_ensino FROM plano_ensino;
  RAISE NOTICE '  Total de planos de ensino: %', total_planos_ensino;
  
  -- Planos com professor_id preenchido
  SELECT COUNT(*) INTO planos_com_professor_id
  FROM plano_ensino
  WHERE professor_id IS NOT NULL;
  RAISE NOTICE '  Planos com professor_id preenchido: %', planos_com_professor_id;
  
  -- Planos sem professor_id
  SELECT COUNT(*) INTO planos_sem_professor_id
  FROM plano_ensino
  WHERE professor_id IS NULL;
  
  IF planos_sem_professor_id > 0 THEN
    RAISE WARNING '  ⚠️  Planos sem professor_id: %', planos_sem_professor_id;
    RAISE WARNING '     Estes planos NÃO serão migrados';
  END IF;
  
  RAISE NOTICE '';
  
  -- ============================================================
  -- ETAPA 3: VALIDAR INTEGRIDADE DOS DADOS
  -- ============================================================
  RAISE NOTICE '🔍 ETAPA 3: Validando integridade dos dados...';
  
  -- Verificar se há planos com professor_id que não corresponde a users.id
  SELECT COUNT(*) INTO planos_com_professor_invalido
  FROM plano_ensino pe
  WHERE pe.professor_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM users u WHERE u.id = pe.professor_id
    );
  
  IF planos_com_professor_invalido > 0 THEN
    RAISE WARNING '  ⚠️  Planos com professor_id inválido (não existe em users): %', planos_com_professor_invalido;
    RAISE WARNING '     Estes planos NÃO serão migrados automaticamente';
    dados_ok := FALSE;
  ELSE
    RAISE NOTICE '  ✅ Todos os professor_id em planos são válidos (existem em users)';
  END IF;
  
  -- Verificar se há planos com professor_id que não tem role PROFESSOR
  SELECT COUNT(*) INTO planos_com_professor_invalido
  FROM plano_ensino pe
  WHERE pe.professor_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 
      FROM users u
      INNER JOIN user_roles ur ON u.id = ur.user_id
      WHERE u.id = pe.professor_id
        AND ur.role = 'PROFESSOR'
    );
  
  IF planos_com_professor_invalido > 0 THEN
    RAISE WARNING '  ⚠️  Planos com professor_id que não tem role PROFESSOR: %', planos_com_professor_invalido;
    RAISE WARNING '     Estes planos NÃO serão migrados automaticamente';
    dados_ok := FALSE;
  ELSE
    RAISE NOTICE '  ✅ Todos os professor_id em planos correspondem a usuários com role PROFESSOR';
  END IF;
  
  RAISE NOTICE '';
  
  -- ============================================================
  -- ETAPA 4: RESUMO E RECOMENDAÇÕES
  -- ============================================================
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  RESUMO DA VALIDAÇÃO';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '📊 ESTATÍSTICAS:';
  RAISE NOTICE '  • Total de usuários: %', total_users;
  RAISE NOTICE '  • Usuários com role PROFESSOR: %', users_com_role_professor;
  RAISE NOTICE '  • Professores já na tabela professores: %', total_professores;
  RAISE NOTICE '  • Total de planos de ensino: %', total_planos_ensino;
  RAISE NOTICE '  • Planos com professor_id: %', planos_com_professor_id;
  RAISE NOTICE '';
  
  IF dados_ok THEN
    RAISE NOTICE '✅ VALIDAÇÃO: Banco está pronto para migração';
    RAISE NOTICE '';
    RAISE NOTICE '📝 PRÓXIMOS PASSOS:';
    RAISE NOTICE '  1. Executar script de popular professores';
    RAISE NOTICE '  2. Executar script de migrar plano_ensino.professor_id';
    RAISE NOTICE '  3. Executar script de verificação pós-migração';
  ELSE
    RAISE WARNING '⚠️  VALIDAÇÃO: Existem problemas que precisam ser corrigidos antes da migração';
    RAISE WARNING '   Revise os avisos acima antes de continuar';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  
END $$;

