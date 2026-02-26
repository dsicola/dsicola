# Performance — Sistema rápido e estável (100%)

Objetivo: sistema que carrega em **menos de 2–3 segundos** por página, com listagens paginadas, índices adequados e cache onde faz sentido.

---

## 1. Métrica clara

| Meta | Descrição |
|------|-----------|
| **&lt; 2–3 s** | Cada página/listagem deve responder em menos de 2–3 segundos (p95 recomendado). |

**Como validar:** Medir em staging ou produção o tempo de resposta dos endpoints críticos (listagens de alunos, utilizadores, mensalidades, dashboard). Usar logs de acesso (morgan), APM ou ferramentas como Artillery/k6 para cargas realistas. Ajustar paginação, índices e cache se p95 ultrapassar 3 s.

---

## 2. Paginação nas listagens

**Regra:** Nunca carregar milhares de registos de uma vez (ex.: 5.000 alunos). Todas as listagens que podem crescer devem aceitar `page` e `pageSize` e devolver `meta: { total, totalPages }`.

### Endpoints com paginação

| Endpoint | Parâmetros | Tamanho máximo por página |
|----------|------------|----------------------------|
| `GET /estudantes` | `page`, `pageSize`, `search`, `sortBy`, `sortOrder`, filtros | 100 (MAX_PAGE_SIZE) |
| `GET /users` | `page`, `pageSize`, `search`, `sortBy`, `sortOrder`, `role` | 100 |
| `GET /mensalidades` | `page`, `pageSize`, `alunoId`, `status`, etc. | 100 |
| `GET /matriculas` | `page`, `pageSize`, `turmaId`, `alunoId`, `status` | 100 |

Helper: `parseListQuery()` em `backend/src/utils/parseListQuery.ts` — `page`, `pageSize` (default 20, max 100), `skip`, `take`, `search`, `sortBy`, `sortOrder`, filtros. Resposta paginada: `{ data: [...], meta: { page, pageSize, total, totalPages } }`.

**Compatibilidade frontend:** Os endpoints paginados (`GET /users`, `GET /mensalidades`, `GET /matriculas`) passam a devolver `{ data, meta }`. O frontend deve usar `response.data` para a lista e `response.meta` para total e navegação. Estudantes (`GET /estudantes`) já seguiam este formato.

---

## 3. Índices no banco de dados

Índices relevantes para listagens e buscas rápidas (multi-tenant + NIF, email, matrícula, instituição):

### Já presentes (exemplos no schema Prisma)

- **User:** `@@unique([instituicaoId, email])`, `@@index([instituicaoId])`
- **Matricula:** `@@index([alunoId])`, `@@index([turmaId])`, `@@index([anoLetivoId])`, `@@index([instituicaoId])` (via relação)
- **Mensalidade:** índices por instituição/aluno conforme schema
- **Login / segurança:** `@@index([email])`, `@@index([instituicaoId])` em `login_attempts`

### Índices adicionados para performance (User)

- `@@index([email])` — buscas por email (ex.: listagens, login)
- `@@index([numeroIdentificacao])` — NIF / documento
- `@@index([numeroIdentificacaoPublica])` — número de matrícula (identidade imutável)

Assim, listagens e filtros por **NIF, email, número de matrícula e instituição** beneficiam dos índices. Migração: `20260226110000_add_user_search_indexes` (users_email_idx, users_numero_identificacao_idx, users_numero_identificacao_publica_idx). Aplicar com `npx prisma migrate deploy` em produção.

---

## 4. Cache onde necessário

| Recurso | Estratégia |
|---------|------------|
| **Dashboard (contagens)** | Cache em memória com TTL curto (ex.: 60 s) para `GET /stats/admin` (alunos, professores, cursos, turmas). Reduz carga no BD em acessos repetidos. |
| **Configuração da instituição** | Já existe `Cache-Control: public, max-age=86400` onde aplicável. Manter para dados que mudam pouco. |
| **Relatórios frequentes** | Cache opcional por parâmetros (ex.: relatório X para instituição Y e período Z) com TTL de 5–15 minutos, ou gerar em background e servir ficheiro. |

Implementação sugerida para dashboard: ver `backend/src/routes/stats.routes.ts` e serviço de cache em memória (ex.: TTL 60 s por `instituicaoId`).

---

## Resumo

- **Métrica:** p95 &lt; 2–3 s por página/listagem.
- **Paginação:** Todas as listagens grandes usam `page`/`pageSize` e `meta` (total, totalPages); máximo 100 itens por página.
- **Índices:** User com índice em email, numeroIdentificacao (NIF), numeroIdentificacaoPublica (matrícula); instituicaoId já indexado.
- **Cache:** Dashboard e, se necessário, relatórios frequentes com TTL curto.

*Documento no âmbito do [ROADMAP-100.md](./ROADMAP-100.md) (secção 2. Performance).*
