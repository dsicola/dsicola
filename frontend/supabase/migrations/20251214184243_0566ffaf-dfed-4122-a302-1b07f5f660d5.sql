-- Enum para tipos de usuário
CREATE TYPE public.user_role AS ENUM ('admin', 'professor', 'aluno');

-- Tabela de perfis de usuário
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nome_completo TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de roles (separada por segurança)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'aluno',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Tabela de cursos
CREATE TABLE public.cursos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  codigo TEXT NOT NULL UNIQUE,
  descricao TEXT,
  carga_horaria INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de turmas
CREATE TABLE public.turmas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id UUID NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  professor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  semestre TEXT NOT NULL,
  ano INTEGER NOT NULL,
  horario TEXT,
  sala TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de matrículas (alunos em turmas)
CREATE TABLE public.matriculas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  turma_id UUID NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'ativa',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(aluno_id, turma_id)
);

-- Tabela de aulas
CREATE TABLE public.aulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id UUID NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  conteudo TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de frequência
CREATE TABLE public.frequencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aula_id UUID NOT NULL REFERENCES public.aulas(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  presente BOOLEAN NOT NULL DEFAULT true,
  justificativa TEXT,
  UNIQUE(aula_id, aluno_id)
);

-- Tabela de notas
CREATE TABLE public.notas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matricula_id UUID NOT NULL REFERENCES public.matriculas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  valor DECIMAL(4,2) NOT NULL CHECK (valor >= 0 AND valor <= 10),
  peso DECIMAL(3,2) NOT NULL DEFAULT 1.0,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matriculas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frequencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;

-- Função para verificar role (SECURITY DEFINER para evitar recursão)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Função para obter role do usuário
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- RLS Policies para profiles
CREATE POLICY "Usuários podem ver seu próprio perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins podem ver todos os perfis"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Professores podem ver perfis de alunos em suas turmas"
  ON public.profiles FOR SELECT
  USING (
    public.has_role(auth.uid(), 'professor') AND
    EXISTS (
      SELECT 1 FROM public.turmas t
      JOIN public.matriculas m ON m.turma_id = t.id
      WHERE t.professor_id = auth.uid() AND m.aluno_id = profiles.id
    )
  );

CREATE POLICY "Usuários podem atualizar seu próprio perfil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins podem inserir perfis"
  ON public.profiles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = id);

-- RLS Policies para user_roles
CREATE POLICY "Usuários podem ver suas próprias roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins podem gerenciar roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies para cursos
CREATE POLICY "Todos autenticados podem ver cursos"
  ON public.cursos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins podem gerenciar cursos"
  ON public.cursos FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies para turmas
CREATE POLICY "Alunos podem ver suas turmas"
  ON public.turmas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matriculas
      WHERE matriculas.turma_id = turmas.id
      AND matriculas.aluno_id = auth.uid()
    )
  );

CREATE POLICY "Professores podem ver suas turmas"
  ON public.turmas FOR SELECT
  USING (professor_id = auth.uid());

CREATE POLICY "Admins podem gerenciar turmas"
  ON public.turmas FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies para matriculas
CREATE POLICY "Alunos podem ver suas matrículas"
  ON public.matriculas FOR SELECT
  USING (aluno_id = auth.uid());

CREATE POLICY "Professores podem ver matrículas de suas turmas"
  ON public.matriculas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.turmas
      WHERE turmas.id = matriculas.turma_id
      AND turmas.professor_id = auth.uid()
    )
  );

CREATE POLICY "Admins podem gerenciar matrículas"
  ON public.matriculas FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies para aulas
CREATE POLICY "Alunos podem ver aulas de suas turmas"
  ON public.aulas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matriculas
      WHERE matriculas.turma_id = aulas.turma_id
      AND matriculas.aluno_id = auth.uid()
    )
  );

CREATE POLICY "Professores podem gerenciar aulas de suas turmas"
  ON public.aulas FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.turmas
      WHERE turmas.id = aulas.turma_id
      AND turmas.professor_id = auth.uid()
    )
  );

CREATE POLICY "Admins podem gerenciar aulas"
  ON public.aulas FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies para frequencias
CREATE POLICY "Alunos podem ver suas frequências"
  ON public.frequencias FOR SELECT
  USING (aluno_id = auth.uid());

CREATE POLICY "Professores podem gerenciar frequências de suas turmas"
  ON public.frequencias FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.aulas a
      JOIN public.turmas t ON t.id = a.turma_id
      WHERE a.id = frequencias.aula_id
      AND t.professor_id = auth.uid()
    )
  );

CREATE POLICY "Admins podem gerenciar frequências"
  ON public.frequencias FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies para notas
CREATE POLICY "Alunos podem ver suas notas"
  ON public.notas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matriculas
      WHERE matriculas.id = notas.matricula_id
      AND matriculas.aluno_id = auth.uid()
    )
  );

CREATE POLICY "Professores podem gerenciar notas de suas turmas"
  ON public.notas FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.matriculas m
      JOIN public.turmas t ON t.id = m.turma_id
      WHERE m.id = notas.matricula_id
      AND t.professor_id = auth.uid()
    )
  );

CREATE POLICY "Admins podem gerenciar notas"
  ON public.notas FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger para criar perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome_completo)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'nome_completo', NEW.email)
  );
  
  -- Por padrão, novos usuários são alunos
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'aluno');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();