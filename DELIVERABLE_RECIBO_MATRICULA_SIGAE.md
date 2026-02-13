# Deliverable: Ajustes Recibo de Matrícula (SIGAE)

## Resumo do mapeamento e fluxo atual

### Fluxo implementado (já conforme SIGAE)

1. **Matrícula** → `createMatricula` chama `gerarMensalidadeAutomatica` → cria `Mensalidade` (PENDENTE) com `matriculaId` → **não emite recibo**
2. **Registrar pagamento** → `POST /pagamentos/mensalidade/:id/registrar` → cria `Pagamento` → **emite Recibo** via `emitirReciboAoConfirmarPagamento`
3. **Update manual** → `PUT /mensalidades/:id` com `status: Pago` sem pagamentos → backend cria `Pagamento` e emite Recibo
4. **Estorno** → `POST /pagamentos/:id/estornar` → marca Recibo como `ESTORNADO` (não deleta)

### Vínculos

- **Recibo → mensalidadeId** (lancamentoId obrigatório) ✓
- **Mensalidade → matriculaId** (opcional; preenchido quando criada pela matrícula) ✓
- **Recibo → matriculaId** (opcional; preenchido via mensalidade) ✓

### Numeração SIGAE

- `numeroRecibo` sequencial por `instituicaoId`: formato `RCB-YYYY-NNNN`
- Recibo imutável: estorno via status `ESTORNADO`, nunca deletar

---

## Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `backend/src/controllers/matricula.controller.ts` | Remover `instituicaoId` da resposta de `getMatriculaById` (aluno e turma) — não vazar no frontend |
| `backend/src/controllers/recibo.controller.ts` | Ajustar `getRecibos` com filtro `matriculaId`: incluir recibos via `matriculaId` direto OU via `mensalidade.matriculaId` |

---

## Verificações realizadas (sem alteração)

- **mensalidade.controller.ts**: Bloqueia `reciboNumero` manual; emite recibo apenas ao confirmar pagamento (registrar ou marcar Pago)
- **pagamento.controller.ts**: Emite recibo ao registrar pagamento; estorna recibo ao estornar pagamento
- **recibo.service.ts**: `gerarNumeroRecibo`, `emitirReciboAoConfirmarPagamento`, `estornarRecibo` — multi-tenant via `instituicaoId`
- **recibo.controller.ts**: `getReciboById` e `getRecibos` filtram por `instituicaoId` do JWT; stripping de `instituicaoId` na resposta
- **recibo.routes.ts**: `authenticate` + `authorize` para ADMIN, SECRETARIA, POS, SUPER_ADMIN

---

## APIs

- `GET /matriculas/:id` — retorna `resumoFinanceiro`: `{ pendente, pago, ultimoRecibo }`; sem `instituicaoId` em aluno/turma
- `GET /recibos/:id` — filtrado por `instituicaoId` do JWT
- `GET /recibos?matriculaId=...` — filtrado por `instituicaoId` e matrícula (direto ou via mensalidade)

---

## Mensagem de erro

- `"Pagamento pendente: recibo só é emitido após confirmação do pagamento. Use o fluxo de registrar pagamento."` — ao tentar enviar `reciboNumero` em `PUT /mensalidades/:id`

---

## Testes P0

Arquivo: `backend/src/__tests__/recibo-matricula.test.ts`

- `gerarNumeroRecibo` produz formato RCB-YYYY-NNNN
- Mensagem de erro ao tentar recibo manual
- StatusRecibo enum: EMITIDO, ESTORNADO
- Migration SQL existe e contém recibos, mensalidade_id, pagamento_id
- Migration adiciona matricula_id em mensalidades
- `estornarRecibo` existe e não deleta recibo

**Nota:** O ambiente pode ter um problema de compatibilidade entre vitest 4 e vite 7 (`ERR_MODULE_NOT_FOUND` para `vite/dist/node/index.js`). Se os testes falharem, tente:

```bash
cd backend && npm install vite@5.4.11 --save-dev && npm run test
```

---

## Regras aplicadas

- Nunca aceitar `instituicaoId` do frontend
- Sempre usar `req.user.instituicaoId` (via `requireTenantScope`)
- Multi-tenant absoluto: tudo filtra por `instituicaoId` do JWT
- Shape das respostas mantido; apenas remoção de `instituicaoId` na resposta de matrícula
