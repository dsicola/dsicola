-- Create turnos table
CREATE TABLE public.turnos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  hora_inicio TIME,
  hora_fim TIME,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.turnos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins podem gerenciar turnos" 
ON public.turnos 
FOR ALL 
USING (has_role(auth.uid(), 'ADMIN'::user_role));

CREATE POLICY "Todos autenticados podem ver turnos" 
ON public.turnos 
FOR SELECT 
USING (ativo = true);

-- Insert default turnos
INSERT INTO public.turnos (nome, hora_inicio, hora_fim) VALUES
  ('Manhã', '07:00', '12:00'),
  ('Tarde', '13:00', '18:00'),
  ('Noite', '18:00', '22:00');

-- Create trigger for updated_at
CREATE TRIGGER update_turnos_updated_at
BEFORE UPDATE ON public.turnos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();