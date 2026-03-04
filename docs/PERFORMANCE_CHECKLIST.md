# Checklist de Performance - DSICOLA

Validação de performance para carga institucional (ROADMAP-100).

---

## 1. Paginação

Listagens que suportam paginação (já implementado):

| Endpoint | Paginação | Params |
|----------|-----------|--------|
| GET /users | ✅ | page, pageSize |
| GET /estudantes | ✅ | page, pageSize |
| GET /professores | ✅ | page, pageSize |
| GET /funcionarios | ✅ | page, pageSize |
| GET /mensalidades | ✅ | page, pageSize |
| GET /matriculas | ✅ | page, pageSize |
| GET /horarios | ✅ | page, pageSize |
| GET /email-enviados | ✅ | page, limit |

**Frontend:** Garantir que listagens grandes usam `page` e `pageSize` (ex.: 20–50 por página).

---

## 2. Índices de Base de Dados

Índices críticos (Prisma/PostgreSQL) — verificar em `prisma/schema.prisma`:

- `instituicao_id` em tabelas multi-tenant
- `user_id`, `professor_id`, `aluno_id` em tabelas de relacionamento
- `created_at` em logs e auditoria
- `status` em mensalidades, matrículas

Para adicionar índice: criar migration e aplicar.

---

## 3. Métricas de Tempo de Resposta (ROADMAP-100)

**Objetivo:** p95 &lt; 2–3s para operações críticas; p99 &lt; 5s.

| Operação | Endpoint | Meta p95 | Meta p99 |
|----------|----------|----------|----------|
| Listagem alunos | GET /estudantes | &lt; 2s | &lt; 5s |
| Listagem mensalidades | GET /mensalidades | &lt; 2s | &lt; 5s |
| Dashboard stats | GET /stats/admin | &lt; 2s | &lt; 5s |
| Lançamento de notas | POST /notas | &lt; 3s | &lt; 5s |
| Configuração instituição | GET /configuracoes-instituicao | &lt; 500ms | &lt; 1s |
| Login | POST /auth/login | &lt; 2s | &lt; 4s |

**Como medir:** Logs (morgan), APM (ex.: Sentry Performance), ou ferramentas como Artillery/k6.

---

## 4. Cache (Opcional)

- **Configuração da instituição:** Cache em memória (TTL 5–15 min) para reduzir leituras no banco.
- **Listas estáticas:** Turnos, tipos de documento — cache no frontend ou API.

---

## 5. Política de Uploads

| Tipo | Limite | Config |
|------|--------|--------|
| Logo/capa/favicon | 1MB | configuracaoInstituicao.routes |
| Upload geral | 10MB | storage.routes |
| Backup | 500MB | upload.middleware |

---

## 6. Validação em Produção

1. Executar carga com Artillery/k6 (ex.: 50 utilizadores simultâneos).
2. Verificar p95 e p99 nos logs ou APM.
3. Se p95 &gt; 3s: revisar queries (N+1), índices, paginação.

---

*Documento no âmbito do [ROADMAP-100.md](./ROADMAP-100.md).*
