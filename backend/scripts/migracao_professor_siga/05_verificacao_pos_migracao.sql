-- ============================================================
-- VERIFICAÇÃO PÓS-MIGRAÇÃO - MIGRAÇÃO PROFESSOR SIGA/SIGAE
-- ============================================================
-- OBJETIVO: Validar que a migração foi executada com sucesso
-- ============================================================
-- DATA: 2025-01-XX
-- SISTEMA: DSICOLA
-- ============================================================

DO $$
DECLARE
  -- Contadores
  total_professores INTEGER;
  professores_sem_user INTEGER;
  professores_duplicados INTEGER;
  total_planos INTEGER;
  planos_com_professor_id INTEGER;
  planos_com_professor_valido INTEGER;
  planos_com_professor_invalido INTEGER;
  planos_sem_professor_id INTEGER;
  
  -- Validações
  professores_ok BOOLEAN := TRUE;
  planos_ok BOOLEAN := TRUE;
  migracao_ok BOOLEAN := TRUE;
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  VERIFICAÇÃO PÓS-MIGRAÇÃO';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  
  -- ============================================================
  -- ETAPA 1: VALIDAR TABELA PROFESSORES
  -- ============================================================
  RAISE NOTICE '📋 ETAPA 1: Validando tabela professores...';
  
  -- Total de professores
  SELECT COUNT(*) INTO total_professores FROM professores;
  
  IF total_professores = 0 THEN
    RAISE WARNING '  ⚠️  Nenhum professor encontrado na tabela professores';
    RAISE WARNING '     Execute o script de popular professores primeiro!';
    professores_ok := FALSE;
  ELSE
    RAISE NOTICE '  ✅ Total de professores: %', total_professores;
  END IF;
  
  -- Professores sem user válido
  SELECT COUNT(*) INTO professores_sem_user
  FROM professores p
  WHERE NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = p.user_id
  );
  
  IF professores_sem_user > 0 THEN
    RAISE WARNING '  ⚠️  Professores sem user válido: %', professores_sem_user;
    professores_ok := FALSE;
  ELSE
    RAISE NOTICE '  ✅ Todos os professores têm user válido';
  END IF;
  
  -- Verificar duplicados
  SELECT COUNT(*) INTO professores_duplicados
  FROM (
    SELECT user_id, instituicao_id, COUNT(*) as cnt
    FROM professores
    GROUP BY user_id, instituicao_id
    HAVING COUNT(*) > 1
  ) duplicados;
  
  IF professores_duplicados > 0 THEN
    RAISE WARNING '  ⚠️  Professores duplicados detectados: %', professores_duplicados;
    professores_ok := FALSE;
  ELSE
    RAISE NOTICE '  ✅ Nenhum duplicado detectado';
  END IF;
  
  -- Verificar se todos os usuários com role PROFESSOR têm registro em professores
  DECLARE
    users_professor_sem_registro INTEGER;
  BEGIN
    SELECT COUNT(DISTINCT u.id) INTO users_professor_sem_registro
    FROM users u
    INNER JOIN user_roles ur ON u.id = ur.user_id
    WHERE ur.role = 'PROFESSOR'
      AND u.instituicao_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 
        FROM professores p 
        WHERE p.user_id = u.id 
          AND p.instituicao_id = u.instituicao_id
      );
    
    IF users_professor_sem_registro > 0 THEN
      RAISE WARNING '  ⚠️  Usuários PROFESSOR sem registro em professores: %', users_professor_sem_registro;
      professores_ok := FALSE;
    ELSE
      RAISE NOTICE '  ✅ Todos os usuários PROFESSOR têm registro em professores';
    END IF;
  END;
  
  RAISE NOTICE '';
  
  -- ============================================================
  -- ETAPA 2: VALIDAR PLANO_ENSINO.PROFESSOR_ID
  -- ============================================================
  RAISE NOTICE '📋 ETAPA 2: Validando plano_ensino.professor_id...';
  
  -- Total de planos
  SELECT COUNT(*) INTO total_planos FROM plano_ensino;
  RAISE NOTICE '  Total de planos de ensino: %', total_planos;
  
  -- Planos com professor_id preenchido
  SELECT COUNT(*) INTO planos_com_professor_id
  FROM plano_ensino
  WHERE professor_id IS NOT NULL;
  RAISE NOTICE '  Planos com professor_id: %', planos_com_professor_id;
  
  -- Planos que referenciam professores.id corretamente
  SELECT COUNT(*) INTO planos_com_professor_valido
  FROM plano_ensino pe
  WHERE pe.professor_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM professores p WHERE p.id = pe.professor_id
    );
  
  IF planos_com_professor_valido = planos_com_professor_id THEN
    RAISE NOTICE '  ✅ Todos os planos referenciam professores.id corretamente';
  ELSE
    RAISE WARNING '  ⚠️  Apenas % de % planos referenciam professores.id', planos_com_professor_valido, planos_com_professor_id;
    planos_ok := FALSE;
  END IF;
  
  -- Planos que ainda referenciam users.id diretamente
  SELECT COUNT(*) INTO planos_com_professor_invalido
  FROM plano_ensino pe
  WHERE pe.professor_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM professores p WHERE p.id = pe.professor_id
    )
    AND EXISTS (
      SELECT 1 FROM users u WHERE u.id = pe.professor_id
    );
  
  IF planos_com_professor_invalido > 0 THEN
    RAISE WARNING '  ⚠️  Planos ainda referenciando users.id: %', planos_com_professor_invalido;
    RAISE WARNING '     Execute o script de migração novamente!';
    planos_ok := FALSE;
  END IF;
  
  -- Planos sem professor_id (pode ser normal se permitido pelo modelo)
  SELECT COUNT(*) INTO planos_sem_professor_id
  FROM plano_ensino
  WHERE professor_id IS NULL;
  
  IF planos_sem_professor_id > 0 THEN
    RAISE NOTICE '  ℹ️  Planos sem professor_id: % (verifique se é permitido pelo modelo)', planos_sem_professor_id;
  END IF;
  
  RAISE NOTICE '';
  
  -- ============================================================
  -- ETAPA 3: VALIDAR INTEGRIDADE REFERENCIAL
  -- ============================================================
  RAISE NOTICE '📋 ETAPA 3: Validando integridade referencial...';
  
  -- Verificar se há planos com professor_id que não pertence à mesma instituição
  DECLARE
    planos_instituicao_invalida INTEGER;
  BEGIN
    SELECT COUNT(*) INTO planos_instituicao_invalida
    FROM plano_ensino pe
    INNER JOIN professores p ON p.id = pe.professor_id
    WHERE pe.instituicao_id IS NOT NULL
      AND p.instituicao_id IS NOT NULL
      AND pe.instituicao_id != p.instituicao_id;
    
    IF planos_instituicao_invalida > 0 THEN
      RAISE WARNING '  ⚠️  Planos com professor de instituição diferente: %', planos_instituicao_invalida;
      RAISE WARNING '     Isso viola o isolamento multi-tenant!';
      planos_ok := FALSE;
    ELSE
      RAISE NOTICE '  ✅ Isolamento multi-tenant preservado';
    END IF;
  END;
  
  RAISE NOTICE '';
  
  -- ============================================================
  -- ETAPA 4: RESUMO FINAL
  -- ============================================================
  migracao_ok := professores_ok AND planos_ok;
  
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '  RESUMO DA VERIFICAÇÃO';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  
  IF professores_ok THEN
    RAISE NOTICE '✅ Tabela professores: OK';
  ELSE
    RAISE WARNING '❌ Tabela professores: PROBLEMAS DETECTADOS';
  END IF;
  
  IF planos_ok THEN
    RAISE NOTICE '✅ Tabela plano_ensino: OK';
  ELSE
    RAISE WARNING '❌ Tabela plano_ensino: PROBLEMAS DETECTADOS';
  END IF;
  
  RAISE NOTICE '';
  
  IF migracao_ok THEN
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE '  ✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '📝 PRÓXIMOS PASSOS:';
    RAISE NOTICE '  1. Atualizar schema Prisma (se necessário)';
    RAISE NOTICE '  2. Rodar: npx prisma generate';
    RAISE NOTICE '  3. Testar login de professores';
    RAISE NOTICE '  4. Testar painel do professor';
    RAISE NOTICE '  5. Validar que planos aparecem corretamente';
  ELSE
    RAISE WARNING '═══════════════════════════════════════════════════════════';
    RAISE WARNING '  ⚠️  MIGRAÇÃO COM PROBLEMAS';
    RAISE WARNING '═══════════════════════════════════════════════════════════';
    RAISE WARNING '';
    RAISE WARNING '📝 AÇÕES NECESSÁRIAS:';
    RAISE WARNING '  1. Revise os avisos acima';
    RAISE WARNING '  2. Execute os scripts de migração novamente se necessário';
    RAISE WARNING '  3. Corrija problemas antes de continuar';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  
END $$;

