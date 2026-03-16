-- CreateTable
CREATE TABLE "modelos_documento" (
    "id" TEXT NOT NULL,
    "instituicao_id" TEXT,
    "tipo" TEXT NOT NULL,
    "tipo_academico" TEXT,
    "curso_id" TEXT,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "html_template" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modelos_documento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "modelos_documento_instituicao_id_tipo_tipo_academico_idx" ON "modelos_documento"("instituicao_id", "tipo", "tipo_academico");

-- CreateIndex
CREATE INDEX "modelos_documento_curso_id_idx" ON "modelos_documento"("curso_id");

-- AddForeignKey
ALTER TABLE "modelos_documento" ADD CONSTRAINT "modelos_documento_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modelos_documento" ADD CONSTRAINT "modelos_documento_curso_id_fkey" FOREIGN KEY ("curso_id") REFERENCES "cursos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
