-- Tabela de Exames
CREATE TABLE public.exames (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  turma_id UUID NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'Escrito',
  data_exame DATE NOT NULL,
  hora_inicio TIME,
  hora_fim TIME,
  sala TEXT,
  peso NUMERIC NOT NULL DEFAULT 1.0,
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'Agendado',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Horários
CREATE TABLE public.horarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  turma_id UUID NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  dia_semana TEXT NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  sala TEXT,
  disciplina_id UUID REFERENCES public.disciplinas(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.exames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios ENABLE ROW LEVEL SECURITY;

-- Políticas para exames
CREATE POLICY "Admins podem gerenciar exames" ON public.exames
  FOR ALL USING (has_role(auth.uid(), 'ADMIN'::user_role));

CREATE POLICY "Professores podem gerenciar exames de suas turmas" ON public.exames
  FOR ALL USING (EXISTS (
    SELECT 1 FROM turmas WHERE turmas.id = exames.turma_id AND turmas.professor_id = auth.uid()
  ));

CREATE POLICY "Alunos podem ver exames de suas turmas" ON public.exames
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM matriculas WHERE matriculas.turma_id = exames.turma_id AND matriculas.aluno_id = auth.uid()
  ));

CREATE POLICY "Secretaria pode ver exames" ON public.exames
  FOR SELECT USING (has_role(auth.uid(), 'SECRETARIA'::user_role));

-- Políticas para horários
CREATE POLICY "Admins podem gerenciar horários" ON public.horarios
  FOR ALL USING (has_role(auth.uid(), 'ADMIN'::user_role));

CREATE POLICY "Professores podem gerenciar horários de suas turmas" ON public.horarios
  FOR ALL USING (EXISTS (
    SELECT 1 FROM turmas WHERE turmas.id = horarios.turma_id AND turmas.professor_id = auth.uid()
  ));

CREATE POLICY "Alunos podem ver horários de suas turmas" ON public.horarios
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM matriculas WHERE matriculas.turma_id = horarios.turma_id AND matriculas.aluno_id = auth.uid()
  ));

CREATE POLICY "Secretaria pode ver horários" ON public.horarios
  FOR SELECT USING (has_role(auth.uid(), 'SECRETARIA'::user_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_exames_updated_at
  BEFORE UPDATE ON public.exames
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_horarios_updated_at
  BEFORE UPDATE ON public.horarios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();