-- AlterTable
-- Verificar e adicionar colunas apenas se não existirem
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fornecedores' AND column_name = 'provincia') THEN
        ALTER TABLE "fornecedores" ADD COLUMN "provincia" TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fornecedores' AND column_name = 'municipio') THEN
        ALTER TABLE "fornecedores" ADD COLUMN "municipio" TEXT;
    END IF;
END $$;

