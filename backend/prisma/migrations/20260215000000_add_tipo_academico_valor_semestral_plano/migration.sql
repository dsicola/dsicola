-- AlterEnum: Adicionar SEMESTRAL ao período de pagamento
ALTER TYPE "PeriodoPagamentoLicenca" ADD VALUE 'SEMESTRAL';

-- AlterTable: Campos para diferenciação Secundário vs Superior e preço semestral
ALTER TABLE "planos" ADD COLUMN IF NOT EXISTS "valor_semestral" DECIMAL(10,2);
ALTER TABLE "planos" ADD COLUMN IF NOT EXISTS "tipo_academico" "TipoAcademico";
