-- AlterTable
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "iban" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "nib" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "banco" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "numero_conta" TEXT;
ALTER TABLE "funcionarios" ADD COLUMN IF NOT EXISTS "titular_conta" TEXT;
