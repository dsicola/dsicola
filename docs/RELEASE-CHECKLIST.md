# Checklist de release estavel - DSICOLA

Usar antes de cada deploy para reduzir risco de regressao (ROADMAP-100).

---

## Pre-deploy

| Feito | Item |
|-------|------|
| [ ] | `cd backend && npm run build` (sem erros) |
| [ ] | `cd backend && npm run test` (Vitest - testes unitarios/integracao) |
| [ ] | `cd frontend && npm run build` (sem erros) |
| [ ] | Se ambiente de staging existir: deploy em staging e smoke test |
| [ ] | Backup da base de dados (ou confirmar que backup automatico esta ativo) |

## Pos-deploy (opcional mas recomendado)

| Feito | Item |
|-------|------|
| [ ] | GET /health retorna 200 e `status: ok` |
| [ ] | Login e navegacao basica (admin ou secretaria) |
| [ ] | Verificar logs de erro (Sentry ou servidor) nas primeiras horas |

---

## Em caso de problema

- Reverter para a versao anterior (rollback) se o deploy tiver essa opcao.
- Consultar logs e ROADMAP-100.md para itens de teste e operacao.

---

Documento criado no ambito do ROADMAP-100.md.
