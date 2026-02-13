# Relatório de Validação - Perfil PROFESSOR (DSICOLA ERP)

**Data:** 2025-02-12  
**Objetivo:** Validar o perfil PROFESSOR no ERP educacional multi-tenant DSICOLA.

---

## Resumo Executivo

| Critério | Status | Observações |
|----------|--------|-------------|
| 1. Login com PROFESSOR | ✅ PASS | Login injeta professorId e tipoAcademico |
| 2. JWT contém role, professor_id, instituicao_id, tipoInstituicao | ✅ PASS | Payload padronizado |
| 3. Funcionalidades (dashboard, disciplinas, turmas, etc.) | ✅ PASS | Todas filtradas por instituicao_id |
| 4. Regras por tipoInstituicao (Superior/Secundário) | ✅ PASS | tipoAcademico no token e profile |
| 5. Bloqueio cross-tenant | ✅ PASS | resolveProfessor + requireInstitution |

**Resultado global: PASS**

---

## 1. Login e Criação de Professor

- **Login:** Endpoint `/auth/login` retorna `user.professorId` e `user.tipoAcademico` para PROFESSOR.
- **Criação:** Script `npx tsx scripts/criar-professor.ts <email> [instituicao-id]` vincula usuário à instituição na tabela `professores`.
- **Exigência:** Usuário deve ter role PROFESSOR antes de criar o registro. Se não existir professor, login retorna 200 mas `professorId` vazio; profile faz fallback para buscar do DB.

---

## 2. JWT / Session

**Payload JWT para PROFESSOR:**

```json
{
  "sub": "user-id",
  "email": "prof@email.com",
  "instituicaoId": "uuid-da-instituicao",
  "roles": ["PROFESSOR"],
  "tipoAcademico": "SUPERIOR" | "SECUNDARIO",
  "professorId": "professores.id"
}
```

- `role=PROFESSOR` → presente em `roles[]`
- `professor_id` → `professorId` (professores.id)
- `instituicao_id` → `instituicaoId`
- `tipoInstituicao` → `tipoAcademico` (SUPERIOR | SECUNDARIO)

**Arquivos alterados:**
- `backend/src/services/auth.service.ts` – injeta `professorId` e `tipoAcademico` no login, loginStep2 e refresh
- `backend/src/middlewares/auth.ts` – adiciona `professorId` ao `req.user` a partir do token

---

## 3. Funcionalidades do Perfil

| Endpoint | Filtro instituicao_id | Filtro professor_id |
|----------|------------------------|----------------------|
| GET /auth/profile | ✅ | ✅ professorId no retorno |
| GET /professor-disciplinas/me | ✅ | ✅ resolveProfessor |
| GET /turmas/professor | ✅ | ✅ req.professor.id |
| GET /plano-ensino | ✅ | ✅ resolveProfessorOptional |
| GET /notas | ✅ | ✅ req.professor.id quando PROFESSOR |
| GET /aulas-planejadas | ✅ | ✅ resolveProfessor |
| GET /aulas-lancadas | ✅ | ✅ resolveProfessorOptional |
| GET /frequencias | ✅ | ✅ Controller filtra por instituição |
| GET /avaliacoes | ✅ | ✅ resolveProfessorOptional |
| GET /anos-letivos | ✅ | ✅ requireInstitution |

---

## 4. Regras por tipoInstituicao

- **SUPERIOR:** Curso + ano/semestre – `validateAcademicoFields` aplica campos conforme instituição.
- **SECUNDARIO:** Curso + classe – mesma lógica no middleware `academico.middleware.ts`.
- `tipoAcademico` vem da instituição e é injetado no token no login.
- Filtros por `instituicao_id` em todas as queries via `req.user.instituicaoId` e `requireTenantScope`.

---

## 5. Bloqueio Cross-Tenant

- **requireInstitution:** Garante `instituicaoId` no request (exceto SUPER_ADMIN).
- **resolveProfessor:** Resolve `professores.id` a partir de `userId` + `instituicaoId`; não aceita `professorId` do frontend.
- **Turmas:** Professor que passa `professorId` de outro na query recebe 403.
- **Controllers:** Todos usam `instituicaoId` do JWT nas queries; não há vazamento entre tenants.

---

## Arquivos Alterados

| Arquivo | Alteração |
|---------|-----------|
| `backend/src/middlewares/auth.ts` | `professorId` em JwtPayload e `req.user` |
| `backend/src/routes/auth.routes.ts` | Profile/me retornam `professorId` e `tipoAcademico`; fallback para buscar professor do DB |
| `backend/src/services/auth.service.ts` | Login, loginStep2 e refresh incluem `professorId` no token e na resposta |
| `backend/scripts/test-perfil-professor.ts` | **NOVO** – script de teste automatizado |
| `backend/package.json` | `test:perfil-professor` script |

---

## Como Executar o Teste

```bash
cd backend
npm run test:perfil-professor
```

Ou com variáveis de ambiente:

```bash
TEST_PROFESSOR_EMAIL=prof@email.com TEST_PROFESSOR_PASSWORD=Senha@123 npm run test:perfil-professor
```

**Pré-requisitos:**
- Backend rodando em `http://localhost:3001`
- Professor existente com senha definida
- Professor cadastrado na tabela `professores` (`npx tsx scripts/criar-professor.ts <email>`)

---

## Conclusão

O perfil PROFESSOR está validado com:

- JWT contendo `role`, `professor_id`, `instituicao_id` e `tipoInstituicao`
- Todas as rotas relevantes filtradas por instituição e professor
- Proteção cross-tenant via middlewares e controllers
- Regras por tipo acadêmico (Superior/Secundário) aplicadas corretamente

**Status final: PASS**
