# Relatório: Ajustes Módulo RECIBOS para Padrão SIGAE

**Data:** 11/02/2025  
**Status:** Concluído

---

## 1. AUDITORIA DO CÓDIGO REALIZADA

### Onde o recibo é criado
- **pagamento.controller.ts** → `registrarPagamento` chama `emitirReciboAoConfirmarPagamento` após criar o pagamento
- **mensalidade.controller.ts** → `updateMensalidade` chama `emitirReciboAoConfirmarPagamento` quando status muda para Pago sem pagamentos registrados

### Matrícula emite recibo diretamente?
**Não.** A matrícula cria apenas `Mensalidade` (PENDENTE) via `gerarMensalidadeAutomatica`. O recibo só é emitido ao confirmar pagamento.

### Numeração de recibo
**Correta.** O `gerarNumeroRecibo` usa `where: { instituicaoId }` e `@@unique([instituicaoId, numeroRecibo])` — sequencial por instituição, formato `RCB-YYYY-NNNN`.

---

## 2. ARQUIVOS AJUSTADOS

| Arquivo | Alterações |
|---------|------------|
| `backend/prisma/schema.prisma` | Model Recibo: adicionados `estudanteId`, `formaPagamento`, `operadorId`, `valorDesconto` |
| `backend/prisma/migrations/20260211000002_add_recibo_sigae_fields/migration.sql` | Nova migration: colunas SIGAE + backfill |
| `backend/src/services/recibo.service.ts` | Popula novos campos ao criar; `estornarRecibo` retorna id para auditoria |
| `backend/src/controllers/recibo.controller.ts` | `getReciboById` retorna `pdfData` completo (instituição, estudante, financeiro) |
| `backend/src/controllers/pagamento.controller.ts` | Log de auditoria ao estornar recibo |
| `backend/src/services/audit.service.ts` | Entidade `RECIBO` adicionada |
| `backend/src/routes/recibo.routes.ts` | Rota DELETE bloqueada (403) |

---

## 3. NOVO FLUXO (SIGAE)

```
Matrícula → cria Mensalidade (PENDENTE) — NÃO emite recibo
     ↓
Registrar pagamento (POST /pagamentos/mensalidade/:id/registrar)
     ↓
Mensalidade status = PAGO
     ↓
emitirReciboAoConfirmarPagamento → cria Recibo (EMITIDO)
     ↓
Estorno (POST /pagamentos/:id/estornar) → recibo.status = ESTORNADO (não deleta)
```

---

## 4. ESTRUTURA DO RECIBO (SIGAE)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| numeroRecibo | string | Sequencial por instituicaoId (RCB-YYYY-NNNN) |
| instituicaoId | string | Multi-tenant |
| mensalidadeId | string | lancamentoFinanceiroId (obrigatório) |
| pagamentoId | string | Pagamento que gerou o recibo |
| matriculaId | string? | Quando aplicável |
| estudanteId | string? | Snapshot (alunoId) |
| valor | Decimal | valorPago |
| valorDesconto | Decimal? | Snapshot mensalidade |
| formaPagamento | string? | Snapshot pagamento |
| operadorId | string? | Quem registrou |
| status | StatusRecibo | EMITIDO \| ESTORNADO |
| dataEmissao | DateTime | createdAt |

---

## 5. INFORMAÇÕES NO PDF (SIGAE)

`GET /recibos/:id` retorna `pdfData` com:

**Instituição:** nome, logoUrl, email, telefone, endereco, nif  
**Estudante:** nome, numeroId, bi, email, curso, turma, anoLetivo  
**Financeiro:** valor, valorDesconto, valorMulta, valorJuros, totalPago, mesReferencia, anoReferencia, dataPagamento, formaPagamento, reciboNumero, operadorId  

---

## 6. MULTI-TENANT

- Todas as queries usam `instituicaoId` do JWT (`requireTenantScope(req)`)
- `instituicaoId` nunca aceito do frontend
- `getReciboById` e `getRecibos` filtram por `instituicaoId`

---

## 7. IMUTABILIDADE

- Recibo **não pode ser deletado** — rota DELETE retorna 403
- Estorno altera apenas `status = ESTORNADO`
- Log de auditoria em cada estorno

---

## 8. COMPATIBILIDADE

- **Secretaria:** mantida (usa `comprovativo`/`recibo_numero` da resposta)
- **POS:** mantida (usa `response.mensalidade.comprovativo` ou `response.recibo_numero`)

---

## 9. APLICAR MIGRAÇÃO

```bash
cd backend
npx prisma migrate deploy
# ou em dev:
npx prisma migrate dev --name add_recibo_sigae_fields
```

---

## 10. TESTES P0

Execute:
```bash
npx vitest run src/__tests__/recibo-matricula.test.ts
```

Cenários cobertos:
- Numeração RCB-YYYY-NNNN
- Mensagem ao tentar recibo manual
- StatusRecibo EMITIDO/ESTORNADO
- Migration existe
- Estorno não deleta recibo
