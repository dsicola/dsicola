-- Permitir SECRETARIA gerenciar matrículas de aluno_disciplinas
CREATE POLICY "Secretaria pode gerenciar matrículas de alunos" 
ON public.aluno_disciplinas 
FOR ALL 
USING (has_role(auth.uid(), 'SECRETARIA'::user_role))
WITH CHECK (has_role(auth.uid(), 'SECRETARIA'::user_role));

-- Permitir SECRETARIA gerenciar matriculas (tabela matriculas)
CREATE POLICY "Secretaria pode gerenciar matriculas" 
ON public.matriculas 
FOR ALL 
USING (has_role(auth.uid(), 'SECRETARIA'::user_role))
WITH CHECK (has_role(auth.uid(), 'SECRETARIA'::user_role));

-- Permitir SECRETARIA ver turmas (já existe SELECT, adicionar INSERT/UPDATE/DELETE não é necessário)

-- Permitir SECRETARIA ver disciplinas (já tem policy de SELECT)

-- Permitir SECRETARIA ver user_roles para buscar alunos (já existe)
