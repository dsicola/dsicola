-- Create table for password reset logs
CREATE TABLE public.logs_redefinicao_senha (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_afetado_id UUID NOT NULL,
  usuario_afetado_email TEXT NOT NULL,
  usuario_afetado_nome TEXT NOT NULL,
  redefinido_por_id UUID NOT NULL,
  redefinido_por_email TEXT NOT NULL,
  redefinido_por_nome TEXT NOT NULL,
  enviado_por_email BOOLEAN DEFAULT false,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.logs_redefinicao_senha ENABLE ROW LEVEL SECURITY;

-- Policy for ADMIN to view logs from their institution
CREATE POLICY "ADMIN pode ver logs de redefinição"
ON public.logs_redefinicao_senha
FOR SELECT
USING (has_role(auth.uid(), 'ADMIN'::user_role));

-- Policy for ADMIN to insert logs
CREATE POLICY "ADMIN pode inserir logs de redefinição"
ON public.logs_redefinicao_senha
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'ADMIN'::user_role));

-- SUPER_ADMIN full access
CREATE POLICY "SUPER_ADMIN pode gerenciar logs de redefinição"
ON public.logs_redefinicao_senha
FOR ALL
USING (has_role(auth.uid(), 'SUPER_ADMIN'::user_role));