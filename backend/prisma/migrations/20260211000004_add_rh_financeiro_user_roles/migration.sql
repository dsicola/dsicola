-- AlterEnum
-- Add RH and FINANCEIRO to UserRole enum (SIGAE padrão)
ALTER TYPE "UserRole" ADD VALUE 'RH';
ALTER TYPE "UserRole" ADD VALUE 'FINANCEIRO';
