
-- SECRETARIA pode gerenciar cursos da sua instituição
CREATE POLICY "Secretaria pode gerenciar cursos da sua instituição" 
ON public.cursos 
FOR ALL 
USING (
  has_role(auth.uid(), 'SECRETARIA'::user_role) 
  AND instituicao_id = get_user_instituicao(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'SECRETARIA'::user_role) 
  AND (instituicao_id IS NULL OR instituicao_id = get_user_instituicao(auth.uid()))
);

-- SECRETARIA pode gerenciar disciplinas da sua instituição
CREATE POLICY "Secretaria pode gerenciar disciplinas da sua instituição" 
ON public.disciplinas 
FOR ALL 
USING (
  has_role(auth.uid(), 'SECRETARIA'::user_role) 
  AND instituicao_id = get_user_instituicao(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'SECRETARIA'::user_role) 
  AND (instituicao_id IS NULL OR instituicao_id = get_user_instituicao(auth.uid()))
);

-- SECRETARIA pode gerenciar turmas da sua instituição
CREATE POLICY "Secretaria pode gerenciar turmas da sua instituição" 
ON public.turmas 
FOR ALL 
USING (
  has_role(auth.uid(), 'SECRETARIA'::user_role) 
  AND instituicao_id = get_user_instituicao(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'SECRETARIA'::user_role) 
  AND (instituicao_id IS NULL OR instituicao_id = get_user_instituicao(auth.uid()))
);

-- SECRETARIA pode gerenciar horários
CREATE POLICY "Secretaria pode gerenciar horários da sua instituição" 
ON public.horarios 
FOR ALL 
USING (
  has_role(auth.uid(), 'SECRETARIA'::user_role) 
  AND EXISTS (
    SELECT 1 FROM turmas t 
    WHERE t.id = horarios.turma_id 
    AND t.instituicao_id = get_user_instituicao(auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'SECRETARIA'::user_role)
);

-- SECRETARIA pode gerenciar exames
CREATE POLICY "Secretaria pode gerenciar exames da sua instituição" 
ON public.exames 
FOR ALL 
USING (
  has_role(auth.uid(), 'SECRETARIA'::user_role) 
  AND EXISTS (
    SELECT 1 FROM turmas t 
    WHERE t.id = exames.turma_id 
    AND t.instituicao_id = get_user_instituicao(auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'SECRETARIA'::user_role)
);

-- SECRETARIA pode gerenciar aulas
CREATE POLICY "Secretaria pode gerenciar aulas da sua instituição" 
ON public.aulas 
FOR ALL 
USING (
  has_role(auth.uid(), 'SECRETARIA'::user_role) 
  AND EXISTS (
    SELECT 1 FROM turmas t 
    WHERE t.id = aulas.turma_id 
    AND t.instituicao_id = get_user_instituicao(auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'SECRETARIA'::user_role)
);

-- SECRETARIA pode gerenciar frequências
CREATE POLICY "Secretaria pode gerenciar frequências da sua instituição" 
ON public.frequencias 
FOR ALL 
USING (
  has_role(auth.uid(), 'SECRETARIA'::user_role) 
  AND EXISTS (
    SELECT 1 FROM aulas a
    JOIN turmas t ON t.id = a.turma_id
    WHERE a.id = frequencias.aula_id 
    AND t.instituicao_id = get_user_instituicao(auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'SECRETARIA'::user_role)
);

-- SECRETARIA pode gerenciar notas
CREATE POLICY "Secretaria pode gerenciar notas" 
ON public.notas 
FOR ALL 
USING (has_role(auth.uid(), 'SECRETARIA'::user_role))
WITH CHECK (has_role(auth.uid(), 'SECRETARIA'::user_role));

-- SECRETARIA pode gerenciar mensalidades completamente
CREATE POLICY "Secretaria pode deletar mensalidades" 
ON public.mensalidades 
FOR DELETE 
USING (has_role(auth.uid(), 'SECRETARIA'::user_role));

-- SECRETARIA pode ver alojamentos
CREATE POLICY "Secretaria pode ver alojamentos da sua instituição" 
ON public.alojamentos 
FOR SELECT 
USING (
  has_role(auth.uid(), 'SECRETARIA'::user_role) 
  AND instituicao_id = get_user_instituicao(auth.uid())
);

-- SECRETARIA pode ver alocações de alojamento
CREATE POLICY "Secretaria pode ver alocações de alojamento" 
ON public.alocacoes_alojamento 
FOR SELECT 
USING (has_role(auth.uid(), 'SECRETARIA'::user_role));

-- SECRETARIA pode gerenciar candidaturas completamente
CREATE POLICY "Secretaria pode gerenciar candidaturas da instituição" 
ON public.candidaturas 
FOR ALL 
USING (
  has_role(auth.uid(), 'SECRETARIA'::user_role) 
  AND instituicao_id = get_user_instituicao(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'SECRETARIA'::user_role) 
  AND (instituicao_id IS NULL OR instituicao_id = get_user_instituicao(auth.uid()))
);

-- SECRETARIA pode inserir roles para novos usuários da sua instituição
CREATE POLICY "Secretaria pode inserir roles" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'SECRETARIA'::user_role) 
  AND instituicao_id = get_user_instituicao(auth.uid())
  AND role IN ('ALUNO'::user_role, 'RESPONSAVEL'::user_role)
);

-- SECRETARIA pode gerenciar tipos de documento
CREATE POLICY "Secretaria pode gerenciar tipos de documento" 
ON public.tipos_documento 
FOR ALL 
USING (has_role(auth.uid(), 'SECRETARIA'::user_role))
WITH CHECK (has_role(auth.uid(), 'SECRETARIA'::user_role));

-- SECRETARIA pode gerenciar metas financeiras
CREATE POLICY "Secretaria pode gerenciar metas financeiras" 
ON public.metas_financeiras 
FOR ALL 
USING (has_role(auth.uid(), 'SECRETARIA'::user_role))
WITH CHECK (has_role(auth.uid(), 'SECRETARIA'::user_role));

-- SECRETARIA pode ver histórico de notas completamente
CREATE POLICY "Secretaria pode gerenciar histórico de notas" 
ON public.notas_historico 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'SECRETARIA'::user_role));

-- SECRETARIA pode ver logs de auditoria da sua instituição
CREATE POLICY "Secretaria pode ver logs de auditoria" 
ON public.logs_auditoria 
FOR SELECT 
USING (
  has_role(auth.uid(), 'SECRETARIA'::user_role) 
  AND instituicao_id = get_user_instituicao(auth.uid())
);

-- SECRETARIA pode inserir logs de auditoria
CREATE POLICY "Secretaria pode inserir logs de auditoria" 
ON public.logs_auditoria 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'SECRETARIA'::user_role));
