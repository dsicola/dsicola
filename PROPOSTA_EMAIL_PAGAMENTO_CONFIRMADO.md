# Proposta: Integração PAGAMENTO_CONFIRMADO (Recibo por E-mail)

## Contexto

O template `PAGAMENTO_CONFIRMADO` existe no `EmailService` mas não está ligado a nenhum fluxo de pagamento. Esta proposta conecta o envio de e-mail ao confirmar pagamentos (mensalidade e licença).

## Fluxos de Pagamento Identificados

### 1. Pagamento de Mensalidade (propina) — `pagamento.controller.ts`
- **Endpoint:** `POST /mensalidades/:mensalidadeId/pagamentos`
- **Serviço:** `emitirReciboAoConfirmarPagamento()` cria recibo SIGAE (RCB-YYYY-NNNN)
- **Destinatário:** Aluno (email do User vinculado à mensalidade)
- **Momento:** Após registar pagamento e emitir recibo

### 2. Pagamento de Licença — `pagamentoLicenca.controller.ts`
- **Endpoint:** `POST /pagamentos-licenca/:pagamentoId/confirmar`
- **Serviço:** `criarDocumentoFiscalAutomatico()` cria DocumentoFiscal (RECIBO)
- **Já envia:** ASSINATURA_ATIVADA ao admin da instituição
- **Momento:** Após confirmar pagamento e criar documento fiscal

## Proposta de Implementação

### A) Mensalidade (Prioridade alta)
Enviar `PAGAMENTO_CONFIRMADO` quando um pagamento de mensalidade é registado e o recibo é emitido.

**Local:** `pagamento.controller.ts` → `registrarPagamento`, após `emitirReciboAoConfirmarPagamento`.

**Dados do template:**
- `nomeDestinatario` → aluno.nomeCompleto
- `valor` → pagamento.valor formatado
- `dataPagamento` → pagamento.dataPagamento
- `referencia` → numeroRecibo (ex: RCB-2025-0001)

**Destinatário:** `mensalidade.aluno.email` (User do aluno)

**RBAC:** Permitir que ALUNO receba PAGAMENTO_CONFIRMADO (é o titular do recibo).

### B) Licença (Prioridade média)
O fluxo de licença já envia ASSINATURA_ATIVADA. Podemos **opcionalmente** enviar PAGAMENTO_CONFIRMADO com dados do recibo fiscal (DocumentoFiscal) para o mesmo destinatário (admin da instituição), como comprovativo adicional. Não é obrigatório, pois ASSINATURA_ATIVADA já confirma o pagamento.

**Decisão:** Não implementar para licença por ora (evitar duplicar e-mails). ASSINATURA_ATIVADA cobre o caso.

### C) Ajuste RBAC
Alterar `PAGAMENTO_CONFIRMADO` para permitir ALUNO:
```ts
PAGAMENTO_CONFIRMADO: {
  permitidos: ['SUPER_ADMIN', 'ADMIN', 'SECRETARIA', 'ALUNO'],
  bloqueados: []
}
```

## Resumo das Alterações (Implementado)

| Ficheiro | Alteração |
|----------|-----------|
| `pagamento.controller.ts` | Enviar PAGAMENTO_CONFIRMADO após emitir recibo (se aluno tem email) |
| `mensalidade.controller.ts` | Enviar PAGAMENTO_CONFIRMADO quando status muda para Pago e recibo é emitido |
| `email.service.ts` | Ajustar RBAC: ALUNO pode receber PAGAMENTO_CONFIRMADO |
