-- Adicionar novos campos à tabela disciplinas para ensino médio
ALTER TABLE public.disciplinas 
ADD COLUMN IF NOT EXISTS tipo_disciplina text DEFAULT 'teórica' CHECK (tipo_disciplina IN ('teórica', 'prática', 'mista')),
ADD COLUMN IF NOT EXISTS trimestres_oferecidos integer[] DEFAULT ARRAY[1, 2, 3],
ADD COLUMN IF NOT EXISTS obrigatoria boolean DEFAULT true;

-- Comentários explicativos
COMMENT ON COLUMN public.disciplinas.tipo_disciplina IS 'Tipo da disciplina: teórica, prática ou mista';
COMMENT ON COLUMN public.disciplinas.trimestres_oferecidos IS 'Array com os trimestres em que a disciplina é oferecida (1, 2, 3)';
COMMENT ON COLUMN public.disciplinas.obrigatoria IS 'Se a disciplina é obrigatória ou opcional';

-- Adicionar campo trimestres à tabela professor_disciplinas
ALTER TABLE public.professor_disciplinas 
ADD COLUMN IF NOT EXISTS trimestres integer[] DEFAULT ARRAY[1, 2, 3];

COMMENT ON COLUMN public.professor_disciplinas.trimestres IS 'Array com os trimestres em que o professor leciona (para ensino médio)';