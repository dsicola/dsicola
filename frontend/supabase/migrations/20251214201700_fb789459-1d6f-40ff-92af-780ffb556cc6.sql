-- Add unique constraint to numero_identificacao (BI) in profiles table
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_numero_identificacao_unique UNIQUE (numero_identificacao);