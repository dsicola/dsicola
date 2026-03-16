-- Add bloquearPautaNotasPorFinanceiro and mensagemBloqueioPautaNotas to ConfiguracaoInstituicao
-- Students with pending/overdue payments cannot view pauta or notas when this is enabled
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "bloquear_pauta_notas_por_financeiro" BOOLEAN DEFAULT true;
ALTER TABLE "configuracoes_instituicao" ADD COLUMN IF NOT EXISTS "mensagem_bloqueio_pauta_notas" TEXT;
