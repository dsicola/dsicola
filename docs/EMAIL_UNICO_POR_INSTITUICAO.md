# Unicidade de email por instituição (multi-tenant)

## Objetivo

- **Permitir** que o mesmo email exista em instituições diferentes.
- **Garantir** que o email continue único dentro da mesma instituição.

## Situação anterior

- Constraint `UNIQUE(email)` global na tabela `users` impedia o mesmo email em mais de uma instituição.

## Implementação

### 1. Migration (segura, incremental)

**Arquivo:** `backend/prisma/migrations/20260228100000_email_unique_per_instituicao/migration.sql`

- **Verificação prévia:** Antes de alterar índices, a migration verifica se existem duplicatas `(instituicao_id, email)` na mesma instituição. Se existir, **aborta** e exibe relatório (sem alterar o banco).
- **Nova constraint:** `UNIQUE (instituicao_id, email)` com `NULLS NOT DISTINCT` (PostgreSQL 15+), para que usuários sem instituição (ex.: SUPER_ADMIN) também tenham email único.
- **Remoção:** Remove o índice `users_email_key` (unicidade global de email).
- **Rollback:** Comentado no final do arquivo; só é possível se ainda não houver dois usuários com o mesmo email em instituições diferentes.

**Requisito:** PostgreSQL 15+ (para `NULLS NOT DISTINCT`).

### 2. Schema Prisma

**Arquivo:** `backend/prisma/schema.prisma`

- Removido `@unique` do campo `email` do model `User`.
- Adicionado `@@unique([instituicaoId, email], map: "users_instituicao_id_email_key")`.

### 3. Lógica de login

**Arquivo:** `backend/src/services/auth.service.ts`

- **Subdomínio** (ex.: `escolaA.dsicola.com`): usuário buscado por `(email, instituicao_id)` usando `req.tenantDomainInstituicaoId`. Login só encontra o usuário da instituição do hostname.
- **Domínio central / localhost:** busca por email. Se existir mais de um usuário com o mesmo email (em instituições diferentes), retorna erro: *"Vários perfis encontrados com este email. Acesse pelo endereço da sua instituição para fazer login."*
- **resetPassword:** Em subdomínio, envia reset apenas para o usuário da instituição (filtro por `instituicao_id`).
- **loginWithOidc:** Mesma regra: em subdomínio busca por `(email, instituicao_id)`; no central, um único por email ou erro de múltiplos perfis.
- **register:** Verifica se o email já existe **na mesma instituição** (`instituicaoId_email`).
- **changePasswordRequiredWithCredentials:** Se houver vários usuários com o mesmo email, exige acesso pelo subdomínio.

### 4. Criação de usuário

- **backend/src/controllers/user.controller.ts** (`createUser`): Verifica duplicata por `(email, instituicaoId)` da instituição (ou `null` para COMERCIAL).
- **backend/src/controllers/onboarding.controller.ts**:
  - Criação de **nova instituição** (primeiro admin): não verifica email global; o par `(novo_instituicao_id, email)` é sempre novo.
  - **Adicionar admin** a instituição existente: verifica se o email já existe **nessa instituição**.
- **backend/src/controllers/candidatura.controller.ts** (`aprovar`): Verifica se já existe usuário com o mesmo email ou número de identificação **na instituição da candidatura**.

### 5. Outros ajustes

- **auditLoginEvent / recordFailedLogin:** Uso de `findFirst` por email onde antes era `findUnique` (tabela `User`).
- **Scripts de seed/teste:** `findUnique` por email trocado por `findFirst` em:
  - `backend/scripts/seed-performance-test.ts`
  - `backend/scripts/seed-relatorios-100plus.ts`
  - `backend/scripts/test-financas-propina.ts`

## O que não foi alterado

- Estrutura de dados além da constraint (nenhuma nova coluna).
- JWT (payload e claims inalterados).
- Validação de subdomínio (`validateTenantDomain`, `parseTenantDomain`).
- Tabela `login_attempts` (continua com `UNIQUE(email)`; rate limit por email global).

## Lista de arquivos alterados

| Arquivo | Alteração |
|--------|-----------|
| `backend/prisma/schema.prisma` | `email` sem `@unique`; `@@unique([instituicaoId, email])` |
| `backend/prisma/migrations/20260228100000_email_unique_per_instituicao/migration.sql` | **Nova** migration |
| `backend/src/services/auth.service.ts` | Login/reset/register/OIDC/audit por (email, instituicao_id) ou múltiplos perfis |
| `backend/src/controllers/user.controller.ts` | createUser: checagem por (email, instituicaoId) |
| `backend/src/controllers/onboarding.controller.ts` | Remoção de checagem global na criação de instituição; checagem por instituição ao adicionar admin |
| `backend/src/controllers/candidatura.controller.ts` | aprovar: checagem de email/BI na instituição da candidatura |
| `backend/scripts/seed-performance-test.ts` | findUnique → findFirst por email |
| `backend/scripts/seed-relatorios-100plus.ts` | findUnique → findFirst por email |
| `backend/scripts/test-financas-propina.ts` | findUnique → findFirst por email |
| `docs/EMAIL_UNICO_POR_INSTITUICAO.md` | **Este** documento |

## Aplicar em produção

1. **Backup** do banco antes da migration.
2. **Conflitos:** Se a migration abortar com "MIGRATION ABORT: Existem emails duplicados dentro da mesma instituição", corrigir os dados (deduplicar `(instituicao_id, email)` na mesma instituição) e rodar novamente.
3. **Deploy:**  
   - Publicar o código (schema + serviços/controllers).  
   - Rodar: `npx prisma migrate deploy` (ou o fluxo de migrations do projeto).  
   - Não é necessário downtime: a migration é só criação de índice e drop de índice.

## Compatibilidade

- Dados existentes: preservados.
- Usuários que hoje têm email único por instituição continuam válidos.
- Após a migration, o mesmo email pode ser cadastrado em outra instituição; o login no subdomínio continua identificando o usuário por `(email, instituicao_id)`.
