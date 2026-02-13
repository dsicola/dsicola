-- Tabela de comunicados/avisos gerais
CREATE TABLE public.comunicados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'Geral', -- Geral, Urgente, Academico, Financeiro
  destinatarios TEXT NOT NULL DEFAULT 'Todos', -- Todos, Alunos, Professores, Responsaveis
  autor_id UUID REFERENCES auth.users(id),
  data_publicacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_expiracao TIMESTAMP WITH TIME ZONE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de notificações individuais
CREATE TABLE public.notificacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'Info', -- Info, Sucesso, Aviso, Erro
  lida BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de log de emails enviados
CREATE TABLE public.emails_enviados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  destinatario_email TEXT NOT NULL,
  destinatario_nome TEXT,
  assunto TEXT NOT NULL,
  tipo TEXT NOT NULL, -- boas_vindas, lembrete_pagamento, comunicado, nota_lancada
  status TEXT NOT NULL DEFAULT 'Enviado', -- Enviado, Falhou
  erro TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de templates de email
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  assunto TEXT NOT NULL,
  corpo_html TEXT NOT NULL,
  variaveis TEXT[], -- Lista de variáveis disponíveis no template
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de preferências de notificação
CREATE TABLE public.preferencias_notificacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email_comunicados BOOLEAN NOT NULL DEFAULT true,
  email_financeiro BOOLEAN NOT NULL DEFAULT true,
  email_academico BOOLEAN NOT NULL DEFAULT true,
  notificacao_push BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.comunicados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails_enviados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferencias_notificacao ENABLE ROW LEVEL SECURITY;

-- Políticas para comunicados
CREATE POLICY "Comunicados visíveis para todos autenticados" 
ON public.comunicados FOR SELECT 
TO authenticated 
USING (ativo = true);

CREATE POLICY "Admin e Secretaria podem gerenciar comunicados" 
ON public.comunicados FOR ALL 
USING (has_role(auth.uid(), 'ADMIN'::user_role) OR has_role(auth.uid(), 'SECRETARIA'::user_role));

-- Políticas para notificações
CREATE POLICY "Usuários veem suas próprias notificações" 
ON public.notificacoes FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas notificações" 
ON public.notificacoes FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Sistema pode inserir notificações" 
ON public.notificacoes FOR INSERT 
WITH CHECK (true);

-- Políticas para emails enviados (apenas admin/secretaria)
CREATE POLICY "Admin e Secretaria veem emails enviados" 
ON public.emails_enviados FOR SELECT 
USING (has_role(auth.uid(), 'ADMIN'::user_role) OR has_role(auth.uid(), 'SECRETARIA'::user_role));

CREATE POLICY "Sistema pode inserir emails" 
ON public.emails_enviados FOR INSERT 
WITH CHECK (true);

-- Políticas para templates
CREATE POLICY "Admin pode gerenciar templates" 
ON public.email_templates FOR ALL 
USING (has_role(auth.uid(), 'ADMIN'::user_role));

CREATE POLICY "Todos autenticados podem ver templates" 
ON public.email_templates FOR SELECT 
TO authenticated 
USING (ativo = true);

-- Políticas para preferências
CREATE POLICY "Usuários gerenciam suas preferências" 
ON public.preferencias_notificacao FOR ALL 
USING (auth.uid() = user_id);

-- Triggers para updated_at
CREATE TRIGGER update_comunicados_updated_at
BEFORE UPDATE ON public.comunicados
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_preferencias_notificacao_updated_at
BEFORE UPDATE ON public.preferencias_notificacao
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime para notificações
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comunicados;

-- Inserir templates padrão
INSERT INTO public.email_templates (nome, assunto, corpo_html, variaveis) VALUES
('comunicado_geral', 'Comunicado: {{titulo}}', '<h1>{{titulo}}</h1><p>{{conteudo}}</p><p>Atenciosamente,<br>{{instituicao}}</p>', ARRAY['titulo', 'conteudo', 'instituicao']),
('lembrete_pagamento', 'Lembrete de Pagamento - {{mes_referencia}}', '<h1>Lembrete de Pagamento</h1><p>Prezado(a) {{nome}},</p><p>Lembramos que sua mensalidade de {{mes_referencia}} no valor de {{valor}} vence em {{data_vencimento}}.</p>', ARRAY['nome', 'mes_referencia', 'valor', 'data_vencimento']),
('nota_lancada', 'Nova Nota Lançada - {{disciplina}}', '<h1>Nova Nota Disponível</h1><p>Prezado(a) {{nome}},</p><p>Uma nova nota foi lançada na disciplina {{disciplina}}.</p><p>Acesse o portal para visualizar.</p>', ARRAY['nome', 'disciplina']);