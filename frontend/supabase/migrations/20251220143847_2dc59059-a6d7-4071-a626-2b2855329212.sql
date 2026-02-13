-- Create storage bucket for landing page assets if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('landing-assets', 'landing-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for landing-assets bucket
CREATE POLICY "Super admins can upload landing assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'landing-assets' 
  AND public.has_role(auth.uid(), 'SUPER_ADMIN'::public.user_role)
);

CREATE POLICY "Super admins can update landing assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'landing-assets' 
  AND public.has_role(auth.uid(), 'SUPER_ADMIN'::public.user_role)
);

CREATE POLICY "Super admins can delete landing assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'landing-assets' 
  AND public.has_role(auth.uid(), 'SUPER_ADMIN'::public.user_role)
);

CREATE POLICY "Anyone can view landing assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'landing-assets');

-- Insert image configuration entries
INSERT INTO configuracoes_landing (chave, valor, tipo, descricao) VALUES
  ('logo_principal', '', 'image', 'Logo principal exibida no header e footer'),
  ('logo_icone', '', 'image', 'Ícone/favicon da marca'),
  ('hero_imagem_fundo', '', 'image', 'Imagem de fundo do hero section'),
  ('imagem_demo', '', 'image', 'Imagem de demonstração do sistema')
ON CONFLICT (chave) DO NOTHING;