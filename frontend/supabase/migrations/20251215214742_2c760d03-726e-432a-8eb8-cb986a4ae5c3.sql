-- Drop existing policies on notas table
DROP POLICY IF EXISTS "Admins podem gerenciar notas" ON public.notas;
DROP POLICY IF EXISTS "Professores podem gerenciar notas de suas turmas" ON public.notas;
DROP POLICY IF EXISTS "Alunos podem ver suas notas" ON public.notas;
DROP POLICY IF EXISTS "Responsáveis podem ver notas de seus alunos" ON public.notas;

-- Recreate policies with proper WITH CHECK for INSERT/UPDATE

-- Admin full access
CREATE POLICY "Admins podem gerenciar notas" 
ON public.notas 
FOR ALL 
USING (has_role(auth.uid(), 'ADMIN'::user_role))
WITH CHECK (has_role(auth.uid(), 'ADMIN'::user_role));

-- Professors can manage notes for their turmas
CREATE POLICY "Professores podem gerenciar notas de suas turmas" 
ON public.notas 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM matriculas m
    JOIN turmas t ON t.id = m.turma_id
    WHERE m.id = notas.matricula_id 
    AND t.professor_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM matriculas m
    JOIN turmas t ON t.id = m.turma_id
    WHERE m.id = matricula_id 
    AND t.professor_id = auth.uid()
  )
);

-- Students can view their own notes
CREATE POLICY "Alunos podem ver suas notas" 
ON public.notas 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM matriculas
    WHERE matriculas.id = notas.matricula_id 
    AND matriculas.aluno_id = auth.uid()
  )
);

-- Responsaveis can view notes of their students
CREATE POLICY "Responsáveis podem ver notas de seus alunos" 
ON public.notas 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM matriculas m
    JOIN responsavel_alunos ra ON ra.aluno_id = m.aluno_id
    WHERE m.id = notas.matricula_id 
    AND ra.responsavel_id = auth.uid()
  )
);

-- Secretaria can view notes
CREATE POLICY "Secretaria pode ver notas"
ON public.notas
FOR SELECT
USING (has_role(auth.uid(), 'SECRETARIA'::user_role));