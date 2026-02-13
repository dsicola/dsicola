-- CreateTable: Mural da disciplina
CREATE TABLE "disciplina_avisos" (
    "id" TEXT NOT NULL,
    "disciplina_id" TEXT NOT NULL,
    "professor_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "anexo_url" TEXT,
    "instituicao_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disciplina_avisos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "disciplina_avisos_disciplina_id_idx" ON "disciplina_avisos"("disciplina_id");
CREATE INDEX "disciplina_avisos_instituicao_id_idx" ON "disciplina_avisos"("instituicao_id");
CREATE INDEX "disciplina_avisos_professor_id_idx" ON "disciplina_avisos"("professor_id");

-- AddForeignKey
ALTER TABLE "disciplina_avisos" ADD CONSTRAINT "disciplina_avisos_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplinas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "disciplina_avisos" ADD CONSTRAINT "disciplina_avisos_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "professores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "disciplina_avisos" ADD CONSTRAINT "disciplina_avisos_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Feedback do professor em avaliações
ALTER TABLE "notas" ADD COLUMN IF NOT EXISTS "comentario_professor" TEXT;
