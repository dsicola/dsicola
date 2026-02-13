
-- SECRETARIA precisa de acesso a turmas para gerenciar matrículas
CREATE POLICY "Secretaria pode ver turmas da sua instituição" 
ON public.turmas 
FOR SELECT 
USING (
  has_role(auth.uid(), 'SECRETARIA'::user_role) 
  AND instituicao_id = get_user_instituicao(auth.uid())
);

-- SECRETARIA precisa de acesso a disciplinas
CREATE POLICY "Secretaria pode ver disciplinas da sua instituição" 
ON public.disciplinas 
FOR SELECT 
USING (
  has_role(auth.uid(), 'SECRETARIA'::user_role) 
  AND instituicao_id = get_user_instituicao(auth.uid())
);

-- SECRETARIA precisa de acesso a cursos
CREATE POLICY "Secretaria pode ver cursos da sua instituição" 
ON public.cursos 
FOR SELECT 
USING (
  has_role(auth.uid(), 'SECRETARIA'::user_role) 
  AND instituicao_id = get_user_instituicao(auth.uid())
);

-- SECRETARIA precisa ver configurações da instituição
CREATE POLICY "Secretaria pode ver configurações da sua instituição" 
ON public.configuracoes_instituicao 
FOR SELECT 
USING (
  has_role(auth.uid(), 'SECRETARIA'::user_role) 
  AND instituicao_id = get_user_instituicao(auth.uid())
);

-- SECRETARIA precisa de acesso a tipos de documento
CREATE POLICY "Secretaria pode ver tipos de documento" 
ON public.tipos_documento 
FOR SELECT 
USING (has_role(auth.uid(), 'SECRETARIA'::user_role));

-- SECRETARIA precisa de acesso a aulas para ver frequências
CREATE POLICY "Secretaria pode ver aulas da sua instituição" 
ON public.aulas 
FOR SELECT 
USING (
  has_role(auth.uid(), 'SECRETARIA'::user_role) 
  AND EXISTS (
    SELECT 1 FROM turmas t 
    WHERE t.id = aulas.turma_id 
    AND t.instituicao_id = get_user_instituicao(auth.uid())
  )
);

-- SECRETARIA precisa ver frequências para relatórios
CREATE POLICY "Secretaria pode ver frequências da sua instituição" 
ON public.frequencias 
FOR SELECT 
USING (
  has_role(auth.uid(), 'SECRETARIA'::user_role) 
  AND EXISTS (
    SELECT 1 FROM aulas a
    JOIN turmas t ON t.id = a.turma_id
    WHERE a.id = frequencias.aula_id 
    AND t.instituicao_id = get_user_instituicao(auth.uid())
  )
);

-- SECRETARIA pode ver histórico de notas
CREATE POLICY "Secretaria pode ver histórico de notas" 
ON public.notas_historico 
FOR SELECT 
USING (has_role(auth.uid(), 'SECRETARIA'::user_role));

-- SECRETARIA pode gerenciar notificações
CREATE POLICY "Secretaria pode gerenciar notificações" 
ON public.notificacoes 
FOR ALL 
USING (
  has_role(auth.uid(), 'SECRETARIA'::user_role) 
  AND user_id = auth.uid()
);

-- SECRETARIA pode ver logs de emails enviados da sua instituição (já existe, mas reforçando insert)
-- SECRETARIA pode inserir emails enviados
CREATE POLICY "Secretaria pode inserir emails" 
ON public.emails_enviados 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'SECRETARIA'::user_role) 
  AND instituicao_id = get_user_instituicao(auth.uid())
);

-- SECRETARIA pode gerenciar preferências de notificação do próprio usuário
CREATE POLICY "Secretaria pode gerenciar preferências de notificação" 
ON public.preferencias_notificacao 
FOR ALL 
USING (
  has_role(auth.uid(), 'SECRETARIA'::user_role) 
  AND user_id = auth.uid()
);
