-- Create storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovativos', 'comprovativos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for comprovativos bucket
CREATE POLICY "ADMIN pode fazer upload de comprovativos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'comprovativos' 
  AND has_role(auth.uid(), 'ADMIN'::user_role)
);

CREATE POLICY "ADMIN pode ver seus comprovativos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'comprovativos' 
  AND (
    has_role(auth.uid(), 'ADMIN'::user_role)
    OR has_role(auth.uid(), 'SUPER_ADMIN'::user_role)
  )
);

CREATE POLICY "SUPER_ADMIN pode gerenciar comprovativos"
ON storage.objects FOR ALL
USING (
  bucket_id = 'comprovativos' 
  AND has_role(auth.uid(), 'SUPER_ADMIN'::user_role)
);

-- Add telefone_contato field to pagamentos_instituicao
ALTER TABLE public.pagamentos_instituicao 
ADD COLUMN IF NOT EXISTS telefone_contato TEXT;

-- Add data_analise field
ALTER TABLE public.pagamentos_instituicao 
ADD COLUMN IF NOT EXISTS data_analise TIMESTAMP WITH TIME ZONE;

-- Add analisado_por field
ALTER TABLE public.pagamentos_instituicao 
ADD COLUMN IF NOT EXISTS analisado_por UUID REFERENCES profiles(id);

-- Add nova_data_vencimento field (for when payment is confirmed)
ALTER TABLE public.pagamentos_instituicao 
ADD COLUMN IF NOT EXISTS nova_data_vencimento DATE;

-- Update assinaturas to add grace period tracking
ALTER TABLE public.assinaturas
ADD COLUMN IF NOT EXISTS dias_carencia_analise INTEGER DEFAULT 3;