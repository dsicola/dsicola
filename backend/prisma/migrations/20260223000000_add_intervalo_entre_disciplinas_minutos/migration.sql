-- AlterTable: ParametrosSistema - intervalo entre disciplinas em minutos (0-30, padrão 15)
-- Usado na sugestão de horários: se aula termina 08:45, próxima começa 09:00 (intervalo 15 min)

ALTER TABLE "parametros_sistema" ADD COLUMN IF NOT EXISTS "intervalo_entre_disciplinas_minutos" INTEGER DEFAULT 15;

COMMENT ON COLUMN "parametros_sistema"."intervalo_entre_disciplinas_minutos" IS 'Minutos de intervalo entre uma disciplina e outra na grade. Ex: 15 = aula 08:00-08:45, próxima 09:00-09:45';
