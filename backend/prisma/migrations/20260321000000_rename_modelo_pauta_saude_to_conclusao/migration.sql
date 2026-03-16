-- Renomear SAUDE para CONCLUSAO no modelo de pauta dos cursos
UPDATE "cursos" SET "modelo_pauta" = 'CONCLUSAO' WHERE "modelo_pauta" = 'SAUDE';
