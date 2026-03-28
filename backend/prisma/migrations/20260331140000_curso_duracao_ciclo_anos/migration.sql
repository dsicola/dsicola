-- Ensino secundário: duração do ciclo em número de classes/anos (validação e relatórios; progressão continua por ordem na escada)
ALTER TABLE "cursos" ADD COLUMN IF NOT EXISTS "duracao_ciclo_anos" INTEGER;
