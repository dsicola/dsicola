-- AlterTable: Adicionar campos condicionais ao plano_ensino (apenas se não existirem)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plano_ensino' AND column_name = 'semestre') THEN
        ALTER TABLE "plano_ensino" ADD COLUMN "semestre" INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plano_ensino' AND column_name = 'classe_ou_ano') THEN
        ALTER TABLE "plano_ensino" ADD COLUMN "classe_ou_ano" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plano_ensino' AND column_name = 'carga_horaria_planejada') THEN
        ALTER TABLE "plano_ensino" ADD COLUMN "carga_horaria_planejada" INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plano_ensino' AND column_name = 'conteudo_programatico') THEN
        ALTER TABLE "plano_ensino" ADD COLUMN "conteudo_programatico" TEXT;
    END IF;
END $$;

-- DropIndex: Remover constraint único antigo (apenas se existir)
DROP INDEX IF EXISTS "plano_ensino_curso_id_classe_id_disciplina_id_professor_id__key";

-- CreateIndex: Adicionar novo constraint único (instituicao_id, disciplina_id, ano_letivo_id) - apenas se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'plano_ensino_instituicao_id_disciplina_id_ano_letivo_id_key'
    ) THEN
        CREATE UNIQUE INDEX "plano_ensino_instituicao_id_disciplina_id_ano_letivo_id_key" 
        ON "plano_ensino"("instituicao_id", "disciplina_id", "ano_letivo_id");
    END IF;
END $$;

-- CreateIndex: Adicionar índices para melhor performance (apenas se não existirem)
CREATE INDEX IF NOT EXISTS "plano_ensino_curso_id_idx" ON "plano_ensino"("curso_id");
CREATE INDEX IF NOT EXISTS "plano_ensino_classe_id_idx" ON "plano_ensino"("classe_id");
CREATE INDEX IF NOT EXISTS "plano_ensino_disciplina_id_idx" ON "plano_ensino"("disciplina_id");
CREATE INDEX IF NOT EXISTS "plano_ensino_professor_id_idx" ON "plano_ensino"("professor_id");
CREATE INDEX IF NOT EXISTS "plano_ensino_instituicao_id_idx" ON "plano_ensino"("instituicao_id");

