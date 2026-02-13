# Ajustes Recibo de Matrícula (SIGAE)

## Resumo dos Ajustes

Fluxo corrigido conforme requisitos SIGAE:
- **Recibo** gera pelo módulo FINANCEIRO e apenas **vinculado** à matrícula
- **Matrícula** cria lançamento (débito PENDENTE) → **pagamento confirma** → recibo é emitido
- Multi-tenant: filtro por `req.user.instituicaoId`

---

## Arquivos Alterados

### Backend

| Arquivo | Alteração |
|---------|-----------|
| `backend/prisma/schema.prisma` | Model `Recibo`, enum `StatusRecibo`, `matriculaId` em `Mensalidade` |
| `backend/prisma/migrations/20260211000001_add_recibo_matricula_lancamento/migration.sql` | Nova migration |
| `backend/src/services/recibo.service.ts` | **NOVO** – `gerarNumeroRecibo`, `emitirReciboAoConfirmarPagamento`, `estornarRecibo` |
| `backend/src/controllers/pagamento.controller.ts` | Emitir recibo ao registrar pagamento; estornar recibo ao estornar |
| `backend/src/controllers/mensalidade.controller.ts` | Bloquear `reciboNumero` manual; emitir recibo ao marcar Pago (sem pagamentos) |
| `backend/src/controllers/matricula.controller.ts` | `gerarMensalidadeAutomatica` com `matriculaId`; `getMatriculaById` com resumo financeiro |
| `backend/src/controllers/recibo.controller.ts` | **NOVO** – `getReciboById`, `getRecibos` |
| `backend/src/routes/recibo.routes.ts` | **NOVO** – `GET /recibos`, `GET /recibos/:id` |
| `backend/src/routes/index.ts` | Registro das rotas `/recibos` |
| `backend/src/__tests__/recibo-matricula.test.ts` | **NOVO** – testes P0 |

### Frontend

| Arquivo | Alteração |
|---------|-----------|
| `frontend/src/pages/pos/POSDashboard.tsx` | Usar `response.mensalidade.comprovativo` do backend em vez de gerar no frontend |
| `frontend/src/pages/secretaria/SecretariaDashboard.tsx` | Remover `reciboNumero` do update; usar `response.comprovativo` |
| `frontend/src/services/api.ts` | Novo `recibosApi` |

---

## Fluxo Atual

1. **Matrícula** → `createMatricula` chama `gerarMensalidadeAutomatica` → cria `Mensalidade` (PENDENTE) com `matriculaId`
2. **Registrar pagamento** → `POST /pagamentos/mensalidade/:id/registrar` → cria `Pagamento` → **emite Recibo** (numeroRecibo sequencial)
3. **Update manual** → `PUT /mensalidades/:id` com `status: Pago` sem pagamentos → backend cria `Pagamento` e emite Recibo
4. **Estorno** → `POST /pagamentos/:id/estornar` → marca Recibo como `ESTORNADO` (não deleta)

---

## Regras SIGAE

- **Recibo → lancamentoId** (obrigatório): `mensalidadeId`
- **LancamentoFinanceiro (Mensalidade) → matriculaId** (opcional): preenchido quando criado pela matrícula
- **numeroRecibo** sequencial por `instituicaoId`: formato `RCB-YYYY-NNNN`
- **Recibo imutável**: não deletar; estorno via status `ESTORNADO` + auditoria

---

## APIs

- `GET /matriculas/:id` – retorna `resumoFinanceiro`: `{ pendente, pago, ultimoRecibo }`
- `GET /recibos/:id` – filtra por `instituicaoId` do JWT
- `GET /recibos?matriculaId=...` – filtra por `instituicaoId` do JWT

---

## Mensagem de Erro

Quando o frontend tentar enviar `reciboNumero` manualmente:
```
"Pagamento pendente: recibo só é emitido após confirmação do pagamento. Use o fluxo de registrar pagamento."
```

---

## Como Aplicar

1. **Migração** (com banco rodando):
   ```bash
   cd backend && npx prisma migrate deploy
   # ou: npx prisma migrate dev --name add_recibo_matricula_lancamento
   ```

2. **Testes**:
   ```bash
   cd backend && npm test
   # ou: npx vitest run src/__tests__/recibo-matricula.test.ts
   ```

---

## Checklist P0

- [x] Matrícula cria débito (Mensalidade PENDENTE)
- [x] Pagar débito emite recibo
- [x] Outra instituição não vê recibo/matrícula (filtro `instituicaoId`)
- [x] Estorno não apaga recibo (status ESTORNADO)
