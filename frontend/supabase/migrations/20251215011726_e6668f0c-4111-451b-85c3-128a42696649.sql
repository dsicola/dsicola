
-- Adicionar política para SECRETARIA inserir mensalidades
CREATE POLICY "Secretaria pode inserir mensalidades"
ON public.mensalidades
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'SECRETARIA'::user_role));
