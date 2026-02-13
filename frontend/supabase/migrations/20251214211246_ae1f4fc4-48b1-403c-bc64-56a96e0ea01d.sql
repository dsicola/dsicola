-- Create enum for room types
CREATE TYPE public.tipo_quarto AS ENUM ('Solteiro', 'Duplo', 'Triplo');

-- Create enum for room status
CREATE TYPE public.status_quarto AS ENUM ('Livre', 'Ocupado', 'Em manutenção');

-- Create enum for gender
CREATE TYPE public.genero_quarto AS ENUM ('Masculino', 'Feminino', 'Misto');

-- Create enum for allocation status
CREATE TYPE public.status_alocacao AS ENUM ('Ativo', 'Inativo');

-- Create alojamentos table
CREATE TABLE public.alojamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_bloco TEXT NOT NULL,
  numero_quarto TEXT NOT NULL,
  tipo_quarto tipo_quarto NOT NULL DEFAULT 'Solteiro',
  capacidade INTEGER NOT NULL DEFAULT 1,
  genero genero_quarto NOT NULL DEFAULT 'Misto',
  status status_quarto NOT NULL DEFAULT 'Livre',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(nome_bloco, numero_quarto)
);

-- Create alocacoes_alojamento table
CREATE TABLE public.alocacoes_alojamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  alojamento_id UUID NOT NULL REFERENCES public.alojamentos(id) ON DELETE CASCADE,
  data_entrada DATE NOT NULL DEFAULT CURRENT_DATE,
  data_saida DATE,
  status status_alocacao NOT NULL DEFAULT 'Ativo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(aluno_id, alojamento_id, status)
);

-- Enable RLS
ALTER TABLE public.alojamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alocacoes_alojamento ENABLE ROW LEVEL SECURITY;

-- RLS policies for alojamentos
CREATE POLICY "Admins podem gerenciar alojamentos" 
ON public.alojamentos 
FOR ALL 
USING (has_role(auth.uid(), 'ADMIN'::user_role));

CREATE POLICY "Todos autenticados podem ver alojamentos" 
ON public.alojamentos 
FOR SELECT 
USING (true);

-- RLS policies for alocacoes_alojamento
CREATE POLICY "Admins podem gerenciar alocações" 
ON public.alocacoes_alojamento 
FOR ALL 
USING (has_role(auth.uid(), 'ADMIN'::user_role));

CREATE POLICY "Alunos podem ver suas próprias alocações" 
ON public.alocacoes_alojamento 
FOR SELECT 
USING (aluno_id = auth.uid());

-- Create trigger for updated_at on alojamentos
CREATE TRIGGER update_alojamentos_updated_at
BEFORE UPDATE ON public.alojamentos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on alocacoes_alojamento
CREATE TRIGGER update_alocacoes_alojamento_updated_at
BEFORE UPDATE ON public.alocacoes_alojamento
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to count active allocations for a room
CREATE OR REPLACE FUNCTION public.count_active_allocations(room_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.alocacoes_alojamento
  WHERE alojamento_id = room_id
    AND status = 'Ativo'
$$;

-- Create function to check if room has capacity
CREATE OR REPLACE FUNCTION public.check_room_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  room_capacity INTEGER;
  current_allocations INTEGER;
BEGIN
  -- Only check on INSERT or when activating an allocation
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status = 'Ativo' AND OLD.status != 'Ativo') THEN
    -- Get room capacity
    SELECT capacidade INTO room_capacity
    FROM public.alojamentos
    WHERE id = NEW.alojamento_id;
    
    -- Count current active allocations (excluding this one if updating)
    SELECT COUNT(*) INTO current_allocations
    FROM public.alocacoes_alojamento
    WHERE alojamento_id = NEW.alojamento_id
      AND status = 'Ativo'
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    -- Check capacity
    IF current_allocations >= room_capacity THEN
      RAISE EXCEPTION 'Capacidade máxima do quarto atingida (% de %)', current_allocations, room_capacity;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to enforce capacity
CREATE TRIGGER check_allocation_capacity
BEFORE INSERT OR UPDATE ON public.alocacoes_alojamento
FOR EACH ROW
EXECUTE FUNCTION public.check_room_capacity();

-- Create function to update room status based on allocations
CREATE OR REPLACE FUNCTION public.update_room_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  room_capacity INTEGER;
  current_allocations INTEGER;
  room_id UUID;
BEGIN
  -- Get the room id based on operation
  IF TG_OP = 'DELETE' THEN
    room_id := OLD.alojamento_id;
  ELSE
    room_id := NEW.alojamento_id;
  END IF;
  
  -- Get room capacity
  SELECT capacidade INTO room_capacity
  FROM public.alojamentos
  WHERE id = room_id;
  
  -- Count current active allocations
  SELECT COUNT(*) INTO current_allocations
  FROM public.alocacoes_alojamento
  WHERE alojamento_id = room_id
    AND status = 'Ativo';
  
  -- Update room status
  IF current_allocations >= room_capacity THEN
    UPDATE public.alojamentos SET status = 'Ocupado' WHERE id = room_id;
  ELSIF current_allocations > 0 THEN
    UPDATE public.alojamentos SET status = 'Ocupado' WHERE id = room_id;
  ELSE
    UPDATE public.alojamentos SET status = 'Livre' WHERE id = room_id;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to update room status
CREATE TRIGGER update_room_status_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.alocacoes_alojamento
FOR EACH ROW
EXECUTE FUNCTION public.update_room_status();