-- Add unique constraint on numero_identificacao (BI) to prevent duplicates at database level
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_numero_identificacao_unique 
ON public.profiles (numero_identificacao) 
WHERE numero_identificacao IS NOT NULL;