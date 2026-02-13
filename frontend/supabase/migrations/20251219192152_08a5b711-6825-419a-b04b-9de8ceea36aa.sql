-- Adicionar política para POS ver profiles da sua instituição
CREATE POLICY "POS pode ver perfis da sua instituição" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'POS'::user_role) 
  AND instituicao_id = get_user_instituicao(auth.uid())
);