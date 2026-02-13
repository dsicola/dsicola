/*
  Warnings:

  - Made the column `instituicao_id` on table `plano_ensino` required. This step will fail if there are existing NULL values in that column.
  - Made the column `instituicao_id` on table `turmas` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "avaliacoes" DROP CONSTRAINT "avaliacoes_professor_id_fkey";

-- DropForeignKey
ALTER TABLE "plano_ensino" DROP CONSTRAINT "plano_ensino_instituicao_id_fkey";

-- DropForeignKey
ALTER TABLE "plano_ensino" DROP CONSTRAINT "plano_ensino_professor_id_fkey";

-- DropForeignKey
ALTER TABLE "turmas" DROP CONSTRAINT "turmas_instituicao_id_fkey";

-- AlterTable
ALTER TABLE "instituicoes" ADD COLUMN     "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "plano_ensino" ALTER COLUMN "instituicao_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "turmas" ALTER COLUMN "instituicao_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "password_updated_at" TIMESTAMP(3),
ADD COLUMN     "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "two_factor_secret" TEXT,
ADD COLUMN     "two_factor_verified_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_token_idx" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "funcionarios_user_id_idx" ON "funcionarios"("user_id");

-- CreateIndex
CREATE INDEX "funcionarios_user_id_instituicao_id_idx" ON "funcionarios"("user_id", "instituicao_id");

-- CreateIndex
CREATE INDEX "login_attempts_email_idx" ON "login_attempts"("email");

-- CreateIndex
CREATE INDEX "notificacoes_instituicao_id_user_id_idx" ON "notificacoes"("instituicao_id", "user_id");

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plano_ensino" ADD CONSTRAINT "plano_ensino_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "professores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plano_ensino" ADD CONSTRAINT "plano_ensino_instituicao_id_fkey" FOREIGN KEY ("instituicao_id") REFERENCES "instituicoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "professores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
