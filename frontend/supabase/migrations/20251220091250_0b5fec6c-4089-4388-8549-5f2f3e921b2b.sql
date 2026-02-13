-- Tabela para eventos do calendário acadêmico
CREATE TABLE IF NOT EXISTS public.eventos_calendario (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instituicao_id UUID REFERENCES public.instituicoes(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_inicio DATE NOT NULL,
  data_fim DATE,
  hora_inicio TIME,
  hora_fim TIME,
  tipo TEXT NOT NULL DEFAULT 'evento',
  cor TEXT DEFAULT '#3b82f6',
  recorrente BOOLEAN DEFAULT false,
  visivel_para TEXT[] DEFAULT ARRAY['todos'],
  criado_por UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para períodos letivos
CREATE TABLE IF NOT EXISTS public.periodos_letivos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instituicao_id UUID REFERENCES public.instituicoes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ano_letivo INTEGER NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'semestre',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.eventos_calendario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periodos_letivos ENABLE ROW LEVEL SECURITY;

-- Políticas para eventos_calendario
CREATE POLICY "Usuários podem ver eventos da sua instituição" 
ON public.eventos_calendario FOR SELECT 
USING (
  instituicao_id = public.get_user_instituicao(auth.uid()) 
  OR public.has_role(auth.uid(), 'SUPER_ADMIN')
);

CREATE POLICY "Admin pode gerenciar eventos" 
ON public.eventos_calendario FOR ALL 
USING (
  public.has_role(auth.uid(), 'ADMIN') 
  OR public.has_role(auth.uid(), 'SUPER_ADMIN')
  OR public.has_role(auth.uid(), 'SECRETARIA')
);

-- Políticas para periodos_letivos
CREATE POLICY "Usuários podem ver períodos da sua instituição" 
ON public.periodos_letivos FOR SELECT 
USING (
  instituicao_id = public.get_user_instituicao(auth.uid()) 
  OR public.has_role(auth.uid(), 'SUPER_ADMIN')
);

CREATE POLICY "Admin pode gerenciar períodos" 
ON public.periodos_letivos FOR ALL 
USING (
  public.has_role(auth.uid(), 'ADMIN') 
  OR public.has_role(auth.uid(), 'SUPER_ADMIN')
);

-- Triggers para updated_at
CREATE TRIGGER update_eventos_calendario_updated_at
BEFORE UPDATE ON public.eventos_calendario
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_periodos_letivos_updated_at
BEFORE UPDATE ON public.periodos_letivos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_eventos_calendario_instituicao ON public.eventos_calendario(instituicao_id);
CREATE INDEX IF NOT EXISTS idx_eventos_calendario_data ON public.eventos_calendario(data_inicio);
CREATE INDEX IF NOT EXISTS idx_periodos_letivos_instituicao ON public.periodos_letivos(instituicao_id);