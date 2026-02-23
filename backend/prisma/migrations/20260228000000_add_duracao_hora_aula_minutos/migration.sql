-- AlterTable: ParametrosSistema - duração da hora-aula em minutos (45=Secundário, 60=Superior)
-- Padrão profissional: Secundário = 45 min, Superior = 60 min (hora-relógio)

ALTER TABLE "parametros_sistema" ADD COLUMN IF NOT EXISTS "duracao_hora_aula_minutos" INTEGER;
