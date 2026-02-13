-- Adicionar policy para Admin excluir emails
CREATE POLICY "Admin pode excluir emails"
ON public.emails_enviados
FOR DELETE
USING (has_role(auth.uid(), 'ADMIN'::user_role));