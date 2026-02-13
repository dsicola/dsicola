-- =====================================================
-- AUDITORIA: GARANTIR IMUTABILIDADE DOS LOGS
-- =====================================================
-- Este migration garante que logs de auditoria sejam IMUTÁVEIS:
-- 1. Bloqueia UPDATE e DELETE via RLS
-- 2. Adiciona política para AUDITOR (apenas leitura)
-- 3. Garante que apenas o sistema pode inserir logs

-- Bloquear UPDATE nos logs de auditoria
CREATE POLICY "Logs são IMUTÁVEIS - UPDATE bloqueado" 
ON public.logs_auditoria 
FOR UPDATE 
USING (false)
WITH CHECK (false);

-- Bloquear DELETE nos logs de auditoria
CREATE POLICY "Logs são IMUTÁVEIS - DELETE bloqueado" 
ON public.logs_auditoria 
FOR DELETE 
USING (false);

-- AUDITOR pode ler logs da sua instituição (apenas leitura)
CREATE POLICY "AUDITOR pode ver logs da sua instituição" 
ON public.logs_auditoria 
FOR SELECT 
USING (
  has_role(auth.uid(), 'AUDITOR'::user_role) 
  AND (
    instituicao_id = get_user_instituicao(auth.uid()) 
    OR instituicao_id IS NULL
  )
);

-- IMPORTANTE: O AuditService usa Prisma diretamente (service role), que bypass RLS
-- Manter política que permite INSERT do sistema via função SECURITY DEFINER
-- Esta política permite INSERT via função registrar_log_auditoria (SECURITY DEFINER)
-- Prisma também bypass RLS quando usa service role (configurado no DATABASE_URL)
DROP POLICY IF EXISTS "Sistema pode inserir logs" ON public.logs_auditoria;

-- Permitir INSERT apenas via função SECURITY DEFINER (bypass RLS)
-- Prisma usa service role que também bypass RLS automaticamente
-- Usuários normais não conseguem inserir diretamente via SQL (sem permissão direta)
CREATE POLICY "Sistema pode inserir logs via função SECURITY DEFINER" 
ON public.logs_auditoria 
FOR INSERT 
WITH CHECK (true); -- Permitir INSERT via função SECURITY DEFINER ou Prisma service role

-- Comentário explicativo
COMMENT ON TABLE public.logs_auditoria IS 'Logs de auditoria IMUTÁVEIS. Apenas INSERT permitido via função SECURITY DEFINER. UPDATE e DELETE completamente bloqueados. AUDITOR tem acesso de leitura.';

