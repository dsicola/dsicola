-- Tabela para frequência de funcionários
CREATE TABLE public.funcionario_frequencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  turno TEXT NOT NULL DEFAULT 'Manhã',
  status TEXT NOT NULL DEFAULT 'Presente',
  hora_entrada TIME,
  hora_saida TIME,
  justificativa TEXT,
  aprovado_por UUID REFERENCES public.profiles(id),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(funcionario_id, data)
);

-- Tabela para folha de pagamento
CREATE TABLE public.folha_pagamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  ano INTEGER NOT NULL,
  salario_base NUMERIC NOT NULL DEFAULT 0,
  descontos_faltas NUMERIC NOT NULL DEFAULT 0,
  horas_extras NUMERIC NOT NULL DEFAULT 0,
  valor_horas_extras NUMERIC NOT NULL DEFAULT 0,
  bonus NUMERIC NOT NULL DEFAULT 0,
  beneficio_transporte NUMERIC NOT NULL DEFAULT 0,
  beneficio_alimentacao NUMERIC NOT NULL DEFAULT 0,
  outros_beneficios NUMERIC NOT NULL DEFAULT 0,
  outros_descontos NUMERIC NOT NULL DEFAULT 0,
  inss NUMERIC NOT NULL DEFAULT 0,
  irt NUMERIC NOT NULL DEFAULT 0,
  salario_liquido NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pendente',
  data_pagamento DATE,
  forma_pagamento TEXT,
  observacoes TEXT,
  gerado_por UUID REFERENCES public.profiles(id),
  aprovado_por UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(funcionario_id, mes, ano)
);

-- Tabela para contratos de funcionários
CREATE TABLE public.contratos_funcionario (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  tipo_contrato TEXT NOT NULL DEFAULT 'Efetivo',
  data_inicio DATE NOT NULL,
  data_fim DATE,
  salario NUMERIC NOT NULL DEFAULT 0,
  carga_horaria TEXT NOT NULL DEFAULT '8h/dia',
  arquivo_url TEXT,
  nome_arquivo TEXT,
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'Ativo',
  renovado_de UUID REFERENCES public.contratos_funcionario(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para benefícios dos funcionários
CREATE TABLE public.beneficios_funcionario (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para avaliações de funcionários
CREATE TABLE public.avaliacoes_funcionario (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funcionario_id UUID NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  periodo TEXT NOT NULL,
  ano INTEGER NOT NULL,
  nota_desempenho NUMERIC CHECK (nota_desempenho >= 0 AND nota_desempenho <= 20),
  nota_pontualidade NUMERIC CHECK (nota_pontualidade >= 0 AND nota_pontualidade <= 20),
  nota_relacionamento NUMERIC CHECK (nota_relacionamento >= 0 AND nota_relacionamento <= 20),
  nota_competencia NUMERIC CHECK (nota_competencia >= 0 AND nota_competencia <= 20),
  media_final NUMERIC,
  pontos_fortes TEXT,
  pontos_melhoria TEXT,
  metas TEXT,
  observacoes TEXT,
  avaliado_por UUID REFERENCES public.profiles(id),
  data_avaliacao DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Em Análise',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.funcionario_frequencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folha_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos_funcionario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficios_funcionario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacoes_funcionario ENABLE ROW LEVEL SECURITY;

-- RLS Policies for funcionario_frequencias
CREATE POLICY "ADMIN e SUPER_ADMIN podem gerenciar frequências"
ON public.funcionario_frequencias FOR ALL
USING (has_role(auth.uid(), 'ADMIN'::user_role) OR has_role(auth.uid(), 'SUPER_ADMIN'::user_role));

CREATE POLICY "Funcionários podem ver suas próprias frequências"
ON public.funcionario_frequencias FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.funcionarios f 
  WHERE f.id = funcionario_frequencias.funcionario_id 
  AND f.user_id = auth.uid()
));

-- RLS Policies for folha_pagamento
CREATE POLICY "ADMIN e SUPER_ADMIN podem gerenciar folha pagamento"
ON public.folha_pagamento FOR ALL
USING (has_role(auth.uid(), 'ADMIN'::user_role) OR has_role(auth.uid(), 'SUPER_ADMIN'::user_role));

CREATE POLICY "Funcionários podem ver sua própria folha pagamento"
ON public.folha_pagamento FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.funcionarios f 
  WHERE f.id = folha_pagamento.funcionario_id 
  AND f.user_id = auth.uid()
));

-- RLS Policies for contratos_funcionario
CREATE POLICY "ADMIN e SUPER_ADMIN podem gerenciar contratos"
ON public.contratos_funcionario FOR ALL
USING (has_role(auth.uid(), 'ADMIN'::user_role) OR has_role(auth.uid(), 'SUPER_ADMIN'::user_role));

CREATE POLICY "Funcionários podem ver seus próprios contratos"
ON public.contratos_funcionario FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.funcionarios f 
  WHERE f.id = contratos_funcionario.funcionario_id 
  AND f.user_id = auth.uid()
));

-- RLS Policies for beneficios_funcionario
CREATE POLICY "ADMIN e SUPER_ADMIN podem gerenciar benefícios"
ON public.beneficios_funcionario FOR ALL
USING (has_role(auth.uid(), 'ADMIN'::user_role) OR has_role(auth.uid(), 'SUPER_ADMIN'::user_role));

CREATE POLICY "Funcionários podem ver seus próprios benefícios"
ON public.beneficios_funcionario FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.funcionarios f 
  WHERE f.id = beneficios_funcionario.funcionario_id 
  AND f.user_id = auth.uid()
));

-- RLS Policies for avaliacoes_funcionario
CREATE POLICY "ADMIN e SUPER_ADMIN podem gerenciar avaliações"
ON public.avaliacoes_funcionario FOR ALL
USING (has_role(auth.uid(), 'ADMIN'::user_role) OR has_role(auth.uid(), 'SUPER_ADMIN'::user_role));

CREATE POLICY "Funcionários podem ver suas próprias avaliações"
ON public.avaliacoes_funcionario FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.funcionarios f 
  WHERE f.id = avaliacoes_funcionario.funcionario_id 
  AND f.user_id = auth.uid()
));

-- Triggers for updated_at
CREATE TRIGGER update_funcionario_frequencias_updated_at
BEFORE UPDATE ON public.funcionario_frequencias
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_folha_pagamento_updated_at
BEFORE UPDATE ON public.folha_pagamento
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contratos_funcionario_updated_at
BEFORE UPDATE ON public.contratos_funcionario
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_beneficios_funcionario_updated_at
BEFORE UPDATE ON public.beneficios_funcionario
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_avaliacoes_funcionario_updated_at
BEFORE UPDATE ON public.avaliacoes_funcionario
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();