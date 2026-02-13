-- Update RLS policies for mensalidades to allow SECRETARIA access
CREATE POLICY "Secretaria pode visualizar mensalidades"
ON public.mensalidades
FOR SELECT
USING (has_role(auth.uid(), 'SECRETARIA'));

CREATE POLICY "Secretaria pode atualizar mensalidades"
ON public.mensalidades
FOR UPDATE
USING (has_role(auth.uid(), 'SECRETARIA'));

-- Secretaria can view student profiles for financial management
CREATE POLICY "Secretaria pode ver perfis de alunos"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'SECRETARIA'));

-- Secretaria can view turmas for search functionality
CREATE POLICY "Secretaria pode ver turmas"
ON public.turmas
FOR SELECT
USING (has_role(auth.uid(), 'SECRETARIA'));

-- Secretaria can view cursos for search functionality  
CREATE POLICY "Secretaria pode ver cursos"
ON public.cursos
FOR SELECT
USING (has_role(auth.uid(), 'SECRETARIA'));

-- Add payment method field to mensalidades
ALTER TABLE public.mensalidades 
ADD COLUMN IF NOT EXISTS forma_pagamento TEXT,
ADD COLUMN IF NOT EXISTS recibo_numero TEXT;