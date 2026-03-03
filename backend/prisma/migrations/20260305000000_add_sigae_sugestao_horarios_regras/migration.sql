-- Regras SIGAE para sugestão de horários: restrições professor, prioridade disciplinas, limite aulas seguidas

-- Professor: dias em que não leciona (ex: não trabalha sexta)
ALTER TABLE "professores" ADD COLUMN IF NOT EXISTS "dias_indisponiveis" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- Disciplina: prioridade na atribuição (maior = nucleares primeiro)
ALTER TABLE "disciplinas" ADD COLUMN IF NOT EXISTS "prioridade_horario" INTEGER DEFAULT 0;

-- ParametrosSistema: limite de aulas consecutivas por professor por dia
ALTER TABLE "parametros_sistema" ADD COLUMN IF NOT EXISTS "limite_aulas_seguidas_professor" INTEGER DEFAULT 4;
