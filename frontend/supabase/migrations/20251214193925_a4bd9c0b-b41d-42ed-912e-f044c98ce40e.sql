-- Criar tabela de disciplinas
CREATE TABLE public.disciplinas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  curso_id UUID NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  semestre INTEGER NOT NULL CHECK (semestre >= 1 AND semestre <= 12),
  carga_horaria INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.disciplinas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para disciplinas
CREATE POLICY "Admins podem gerenciar disciplinas" 
ON public.disciplinas 
FOR ALL 
USING (has_role(auth.uid(), 'ADMIN'::user_role));

CREATE POLICY "Todos autenticados podem ver disciplinas" 
ON public.disciplinas 
FOR SELECT 
USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_disciplinas_updated_at
BEFORE UPDATE ON public.disciplinas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para melhor performance
CREATE INDEX idx_disciplinas_curso_id ON public.disciplinas(curso_id);
CREATE INDEX idx_disciplinas_semestre ON public.disciplinas(semestre);