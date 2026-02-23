# Melhorias Implementadas - Nível Alto

## 1. Sentry - Monitoramento de Erros

### Backend
- Inicialização apenas em produção com `SENTRY_DSN` configurado
- Request tracing e captura de erros
- Variável: `SENTRY_DSN`

### Frontend
- Inicialização apenas em produção com `VITE_SENTRY_DSN`
- Replay de sessão (mascarando dados sensíveis)
- Variável: `VITE_SENTRY_DSN` no `.env`

---

## 2. OpenAPI / Swagger

- Documentação em `/api-docs` (dev ou quando `DOCS_ENABLED=true`)
- JSDoc nas rotas para expandir documentação
- Exemplo: `@openapi` no `/health`

---

## 3. Rate Limit da API

- 200 requisições/minuto por IP na API geral
- Rotas `/health` e `/api-docs` excluídas
- Auth mantém limites próprios (mais restritos)

---

## 4. Validação Zod (padrão pronto)

- Middleware `validateBody(schema)` em `backend/src/middlewares/validateBody.ts`
- Uso: `router.post('/rota', validateBody(MeuSchema), controller.criar)`
- Erros Zod retornam 400 com mensagens amigáveis

---

## 5. CI/CD - GitHub Actions

- Workflow em `.github/workflows/ci.yml`
- Build backend e frontend em push/PR para main/develop
- Prisma generate + npm build em ambos

---

## 6. i18n - Internacionalização

- Estrutura em `frontend/src/i18n/index.ts`
- pt-BR como padrão, dicionário base (common, auth, menu)
- Uso: `import { useTranslation } from 'react-i18next'; const { t } = useTranslation();`
- Exemplo: `t('common.save')` → "Salvar"

---

## Variáveis de Ambiente

| Variável           | Descrição                     |
|--------------------|-------------------------------|
| `SENTRY_DSN`       | DSN Sentry (backend)          |
| `VITE_SENTRY_DSN`  | DSN Sentry (frontend)         |
| `DOCS_ENABLED`     | `true` para Swagger em prod   |
