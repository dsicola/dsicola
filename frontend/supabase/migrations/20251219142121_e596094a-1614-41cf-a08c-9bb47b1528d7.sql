-- Drop existing restrictive policies
DROP POLICY IF EXISTS "ADMIN e SUPER_ADMIN podem gerenciar cargos" ON public.cargos;
DROP POLICY IF EXISTS "Usuários autenticados podem ver cargos ativos" ON public.cargos;

-- Create PERMISSIVE policies (default behavior)
CREATE POLICY "ADMIN e SUPER_ADMIN podem gerenciar cargos" 
ON public.cargos 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'ADMIN'::user_role) OR has_role(auth.uid(), 'SUPER_ADMIN'::user_role))
WITH CHECK (has_role(auth.uid(), 'ADMIN'::user_role) OR has_role(auth.uid(), 'SUPER_ADMIN'::user_role));

CREATE POLICY "Usuários autenticados podem ver cargos ativos" 
ON public.cargos 
FOR SELECT 
TO authenticated
USING (ativo = true);