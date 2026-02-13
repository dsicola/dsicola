-- Criar tabela para configurações da landing page
CREATE TABLE public.configuracoes_landing (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chave text NOT NULL UNIQUE,
  valor text,
  tipo text NOT NULL DEFAULT 'text', -- text, textarea, image_url, boolean
  descricao text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.configuracoes_landing ENABLE ROW LEVEL SECURITY;

-- SUPER_ADMIN pode gerenciar
CREATE POLICY "SUPER_ADMIN pode gerenciar configurações landing"
ON public.configuracoes_landing FOR ALL
USING (public.has_role(auth.uid(), 'SUPER_ADMIN'::user_role));

-- Público pode ler
CREATE POLICY "Público pode ler configurações landing"
ON public.configuracoes_landing FOR SELECT
USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_configuracoes_landing_updated_at
  BEFORE UPDATE ON public.configuracoes_landing
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir configurações padrão
INSERT INTO public.configuracoes_landing (chave, valor, tipo, descricao) VALUES
('hero_badge', '🎓 Plataforma DSICOLA Multi-Tenant', 'text', 'Badge do hero section'),
('hero_titulo', 'Sistema de Gestão Acadêmica Completo', 'text', 'Título principal'),
('hero_subtitulo', 'Modernize a gestão da sua instituição de ensino com uma plataforma completa, segura e fácil de usar. Tudo em um só lugar.', 'textarea', 'Subtítulo do hero'),
('dias_teste', '14', 'text', 'Dias de teste grátis'),
('contato_email', 'contato@dsicola.com', 'text', 'Email de contato'),
('contato_telefone', '+244 923 000 000', 'text', 'Telefone de contato'),
('contato_whatsapp', '+244923000000', 'text', 'WhatsApp (sem espaços)'),
('rodape_texto', 'DSICOLA - Sistema de Gestão Acadêmica', 'text', 'Texto do rodapé'),
('mostrar_precos', 'true', 'boolean', 'Mostrar seção de preços');