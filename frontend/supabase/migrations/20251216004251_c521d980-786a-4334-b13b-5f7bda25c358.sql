-- Tabela de Departamentos
CREATE TABLE public.departamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  instituicao_id UUID REFERENCES public.instituicoes(id),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Cargos
CREATE TABLE public.cargos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  salario_base NUMERIC DEFAULT 0,
  instituicao_id UUID REFERENCES public.instituicoes(id),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Funcionários (complementar a profiles)
CREATE TABLE public.funcionarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  departamento_id UUID REFERENCES public.departamentos(id),
  cargo_id UUID REFERENCES public.cargos(id),
  salario NUMERIC DEFAULT 0,
  data_admissao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_demissao DATE,
  data_fim_contrato DATE,
  tipo_contrato TEXT DEFAULT 'Efetivo',
  carga_horaria TEXT DEFAULT '8h/dia',
  status TEXT NOT NULL DEFAULT 'Ativo',
  observacoes TEXT,
  instituicao_id UUID REFERENCES public.instituicoes(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Tabela de Documentos de Funcionários
CREATE TABLE public.documentos_funcionario (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  tipo_documento TEXT NOT NULL,
  nome_arquivo TEXT NOT NULL,
  arquivo_url TEXT NOT NULL,
  descricao TEXT,
  data_vencimento DATE,
  tamanho_bytes INTEGER,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Histórico RH
CREATE TABLE public.historico_rh (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  tipo_alteracao TEXT NOT NULL,
  campo_alterado TEXT,
  valor_anterior TEXT,
  valor_novo TEXT,
  observacao TEXT,
  alterado_por UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.departamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_funcionario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_rh ENABLE ROW LEVEL SECURITY;

-- Políticas para departamentos
CREATE POLICY "ADMIN e SUPER_ADMIN podem gerenciar departamentos"
ON public.departamentos FOR ALL
USING (has_role(auth.uid(), 'ADMIN'::user_role) OR has_role(auth.uid(), 'SUPER_ADMIN'::user_role));

CREATE POLICY "Usuários autenticados podem ver departamentos ativos"
ON public.departamentos FOR SELECT
USING (ativo = true);

-- Políticas para cargos
CREATE POLICY "ADMIN e SUPER_ADMIN podem gerenciar cargos"
ON public.cargos FOR ALL
USING (has_role(auth.uid(), 'ADMIN'::user_role) OR has_role(auth.uid(), 'SUPER_ADMIN'::user_role));

CREATE POLICY "Usuários autenticados podem ver cargos ativos"
ON public.cargos FOR SELECT
USING (ativo = true);

-- Políticas para funcionários
CREATE POLICY "ADMIN e SUPER_ADMIN podem gerenciar funcionários"
ON public.funcionarios FOR ALL
USING (has_role(auth.uid(), 'ADMIN'::user_role) OR has_role(auth.uid(), 'SUPER_ADMIN'::user_role));

-- Políticas para documentos de funcionário
CREATE POLICY "ADMIN e SUPER_ADMIN podem gerenciar documentos de funcionários"
ON public.documentos_funcionario FOR ALL
USING (has_role(auth.uid(), 'ADMIN'::user_role) OR has_role(auth.uid(), 'SUPER_ADMIN'::user_role));

-- Políticas para histórico RH
CREATE POLICY "ADMIN e SUPER_ADMIN podem ver histórico RH"
ON public.historico_rh FOR SELECT
USING (has_role(auth.uid(), 'ADMIN'::user_role) OR has_role(auth.uid(), 'SUPER_ADMIN'::user_role));

CREATE POLICY "Sistema pode inserir histórico RH"
ON public.historico_rh FOR INSERT
WITH CHECK (true);

-- Triggers para updated_at
CREATE TRIGGER update_departamentos_updated_at
BEFORE UPDATE ON public.departamentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cargos_updated_at
BEFORE UPDATE ON public.cargos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_funcionarios_updated_at
BEFORE UPDATE ON public.funcionarios
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_documentos_funcionario_updated_at
BEFORE UPDATE ON public.documentos_funcionario
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket para documentos de funcionários
INSERT INTO storage.buckets (id, name, public) VALUES ('documentos_funcionarios', 'documentos_funcionarios', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage
CREATE POLICY "ADMIN e SUPER_ADMIN podem gerenciar documentos funcionários"
ON storage.objects FOR ALL
USING (bucket_id = 'documentos_funcionarios' AND (has_role(auth.uid(), 'ADMIN'::user_role) OR has_role(auth.uid(), 'SUPER_ADMIN'::user_role)));