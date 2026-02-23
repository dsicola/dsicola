# Arquitetura Multi-Tenant - DSICOLA Backend

## 📋 Visão Geral

O backend DSICOLA é uma aplicação **SaaS multi-tenant** que atende múltiplas instituições educacionais em um único banco de dados, com isolamento total de dados por `instituicao_id`.

## 🔒 Princípios Fundamentais

### 1. Isolamento Multi-Tenant

- **TODAS** as tabelas funcionais devem conter `instituicao_id`
- **TODAS** as queries Prisma devem filtrar por `instituicao_id`
- O `instituicao_id` vem **EXCLUSIVAMENTE** do token JWT validado
- **PROIBIDO** confiar em `instituicao_id` do body ou query

### 2. Tipos de Instituição

- **SUPERIOR**: Universidade / Instituto Superior
- **SECUNDARIO**: Ensino Médio
- Regras acadêmicas e fluxos variam conforme o tipo
- Services devem aplicar regras condicionais

### 3. Fluxos Base (Desacoplados)

- **Criação de Instituição**: Independente de módulos avançados
- **Login**: Apenas autenticação e emissão de token
- **Assinatura**: Independente de videoaulas e onboarding

### 4. Módulos Avançados (Desacoplados)

- **Onboarding**: Executa APÓS login, usa `instituicao_id` do token
- **Videoaulas**: Globais (SUPER_ADMIN), progresso por usuário
- **Trilhas**: Globais, usadas pelo onboarding

## 🏗️ Estrutura Atual

### Middlewares de Autenticação

**`backend/src/middlewares/auth.ts`**

```typescript
// Extrai instituicao_id do token JWT
export const authenticate = async (req, res, next) => {
  // Decodifica token
  // Extrai: userId, email, instituicaoId, roles
  req.user = { userId, email, instituicaoId, roles }
}

// Retorna filtro para queries Prisma
export const addInstitutionFilter = (req: Request) => {
  // SUPER_ADMIN: pode filtrar por query param ou usar do token
  // Outros: SEMPRE usa instituicaoId do token
  return { instituicaoId: req.user.instituicaoId }
}

// Garante isolamento multi-tenant
export const enforceTenant = (req, res, next) => {
  // Verifica se usuário não tenta acessar outra instituição
}
```

### Fluxos Base

#### 1. Criação de Instituição

**Endpoints:**
- `POST /instituicoes` - `instituicao.controller.ts::createInstituicao`
- `POST /onboarding/instituicao` - `onboarding.controller.ts::criarInstituicao`

**O que faz:**
- Cria registro na tabela `instituicoes`
- Cria usuário admin (opcional no onboarding)
- Cria assinatura (opcional)
- **NÃO cria**: videoaulas, trilhas, progresso

**Validação:**
- ✅ Não depende de módulos avançados
- ✅ Apenas cria dados essenciais
- ✅ Transações garantem atomicidade

#### 2. Login

**Endpoint:** `POST /auth/login`

**O que faz:**
- Valida credenciais
- Emite token JWT com `instituicao_id`
- **NÃO cria**: dados acadêmicos, videoaulas, progresso

**Validação:**
- ✅ Apenas autenticação
- ✅ Token contém `instituicao_id` do usuário

#### 3. Assinatura

**Endpoint:** `POST /assinaturas`

**O que faz:**
- Cria/atualiza assinatura da instituição
- **NÃO cria**: videoaulas, trilhas, onboarding

**Validação:**
- ✅ Independente de módulos avançados
- ✅ Filtra por `instituicao_id` do token

### Módulos Avançados

#### 1. Onboarding

**Endpoints:**
- `GET /onboarding/status` - Status do onboarding do usuário
- `POST /onboarding/finalizar` - Finaliza onboarding (requer 90% das aulas)

**Dependências:**
- Trilhas (globais, criadas por SUPER_ADMIN)
- Progresso de videoaulas (por usuário)
- Usuário já logado (usa `instituicao_id` do token)

**Validação:**
- ✅ Executa APÓS login
- ✅ Usa `instituicao_id` do token
- ✅ Não cria dados durante criação de instituição

#### 2. Videoaulas

**Endpoints:**
- `GET /video-aulas` - Lista videoaulas (filtradas por perfil e tipo)
- `POST /video-aulas` - Cria videoaula (SUPER_ADMIN only)
- `POST /video-aulas/:id/progresso` - Atualiza progresso

**Características:**
- Videoaulas são **globais** (não têm `instituicao_id`)
- Progresso é **por usuário** (tabela `videoAulaProgresso`)
- Filtradas por tipo acadêmico da instituição do usuário

**Validação:**
- ✅ Não requer criação durante criação de instituição
- ✅ Progresso é por usuário, não por instituição

#### 3. Trilhas

**Endpoints:**
- `GET /treinamento/trilha-atual` - Trilha ativa para perfil do usuário

**Características:**
- Trilhas são **globais** (não têm `instituicao_id`)
- Relacionadas a perfis (ADMIN, PROFESSOR, etc.)
- Usadas pelo onboarding

**Validação:**
- ✅ Não requer criação durante criação de instituição

## ✅ Checklist de Conformidade

### Criação de Instituição
- [x] Não cria videoaulas
- [x] Não cria trilhas
- [x] Não cria progresso
- [x] Não cria dados de onboarding
- [x] Apenas cria: instituição, admin (opcional), assinatura (opcional)

### Login
- [x] Apenas autenticação
- [x] Token contém `instituicao_id`
- [x] Não cria dados acadêmicos

### Assinatura
- [x] Independente de videoaulas
- [x] Independente de onboarding
- [x] Filtra por `instituicao_id` do token

### Módulos Avançados
- [x] Executam APÓS login
- [x] Usam `instituicao_id` do token
- [x] Não criados durante criação de instituição

## 🔍 Pontos de Atenção

### Controllers que DEVEM usar `addInstitutionFilter`

- `curso.controller.ts` ✅
- `disciplina.controller.ts` ✅
- `turma.controller.ts` ✅
- `matricula.controller.ts` ✅
- `assinatura.controller.ts` ✅
- Todos os controllers que acessam dados por instituição

### Controllers que NÃO devem usar `addInstitutionFilter`

- `videoAula.controller.ts` - Videoaulas são globais
- `treinamento.controller.ts` - Trilhas são globais
- `instituicao.controller.ts` - Endpoint público ou SUPER_ADMIN

## 🧪 Testes Multi-tenant e Tipo de Instituição

- **Seed**: `npm run seed:multi-tenant` — cria Inst A (SECUNDARIO) e Inst B (SUPERIOR) com admins.
- **Segurança**: `npm run test:multi-tenant` — isolamento (Admin A não vê dados B, query forjada ignorada).
- **Tipos + alinhamento FE/BE**: `npm run test:multitenant-tipo-instituicao` — garante:
  - Duas instituições com `tipoAcademico` distinto (SECUNDARIO e SUPERIOR).
  - Login e GET `/auth/me` retornam `user.instituicaoId` e `user.tipoAcademico`.
  - JWT contém `instituicaoId` e `tipoAcademico` (frontend usa `decodeJWT()` em `utils/jwt.ts`).
  - Isolamento por tenant (rotas filtram por token).
- **Full**: `npm run test:multitenant-tipo-instituicao:full` — roda seed e depois o teste acima.

Requisitos: backend rodando (`API_URL`), banco com migrações. Variáveis opcionais: `TEST_USER_INST_A_EMAIL`, `TEST_USER_INST_B_EMAIL`, `TEST_MULTITENANT_PASSWORD`.

## 📝 Notas de Implementação

1. **Isolamento por Token**: Sempre usar `req.user.instituicaoId` do token JWT
2. **SUPER_ADMIN**: Pode filtrar por `instituicaoId` via query param (opcional)
3. **Transações**: Usar para operações atômicas (criação de instituição)
4. **Validação**: Validar inputs antes do Prisma
5. **Erros**: Tratar explicitamente, nunca deixar estourar sem catch
6. **Frontend/Backend**: Login e `/auth/me` devem expor `instituicaoId` e `tipoAcademico`; o JWT deve incluir os mesmos campos para o frontend (InstituicaoContext, menus por tipo)

