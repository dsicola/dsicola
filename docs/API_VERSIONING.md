# Versionamento da API — DSICOLA

Documentação e versionamento da API para integradores (ROADMAP-100).

---

## 1. Versão Atual

- **Versão:** 1.0.0
- **Base URL:** `/api` (ex.: `https://api.example.com/api`)
- **Documentação:** Swagger/OpenAPI em `/api-docs` (dev ou quando `DOCS_ENABLED=true`)
- **Spec JSON:** `GET /api-docs.json`

---

## 2. Autenticação

- **JWT Bearer:** Token obtido via `POST /auth/login`
- **Refresh:** `POST /auth/refresh` com refresh token
- **Multi-tenant:** `instituicaoId` no token; SUPER_ADMIN pode usar `?instituicaoId=` em query

---

## 3. Códigos de Erro

Respostas de erro incluem `code` para tratamento programático:

| code | HTTP | Descrição |
|------|------|------------|
| VALIDATION_ERROR | 400 | Dados inválidos (Zod/Prisma) |
| NOT_FOUND | 404 | Registro não encontrado |
| DUPLICATE_RECORD | 409 | Registo duplicado |
| FOREIGN_KEY_ERROR | 400 | Referência inválida |
| INTERNAL_ERROR | 500 | Erro interno |

---

## 4. Changelog

Ver [CHANGELOG.md](./CHANGELOG.md) para alterações relevantes.

---

## 5. Compatibilidade

- **Breaking changes:** Serão comunicados com antecedência; nova versão major (ex.: v2) quando necessário
- **Depreciação:** Endpoints deprecados serão avisados com header `X-Deprecated: true` e data de remoção

---

*Documento no âmbito do [ROADMAP-100.md](./ROADMAP-100.md).*
