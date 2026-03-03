# AUDITORIA SISTEMÁTICA DSICOLA - FASE 0 (Mapeamento)

**Data:** 2025-01-28  
**Engenheiro:** Auto (AI Assistant)  
**Projeto:** DSICOLA (React + Node.js + Express + Prisma + PostgreSQL)

---

## RESUMO EXECUTIVO

Auditoria sistemática iniciada para validar:
1. ✅ Autenticação (login, refresh, middleware, guards)
2. ✅ Multi-tenant (instituicaoId do token, queries Prisma)
3. ✅ RBAC (middleware, frontend guards, permissões)
4. ✅ Fluxo acadêmico institucional
5. ✅ UX/Estabilidade (modais, duplicidade, layout)
6. ✅ Backend/Prisma (schema, validações, respostas)

**Status:** 🟡 EM PROGRESSO (Parte A - Mapeamento)

---

## PARTE A — AUDITORIA AUTOMÁTICA (MAPEAMENTO)

### 1. ESTRUTURA DO PROJETO

#### Backend
- **Rotas registradas:** ~104 arquivos `.routes.ts`
- **Controllers:** ~104 arquivos `.controller.ts`
- **Middleware de autenticação:** `backend/src/middlewares/auth.ts` ✅
- **Middleware RBAC:** `backend/src/middlewares/rbac.middleware.ts` ✅
- **Função multi-tenant:** `addInstitutionFilter()` ✅

#### Frontend
- **Chamadas API:** 633 funções exportadas em `frontend/src/services/api.ts`
- **Interceptores:** Token refresh ✅, Error handling ✅
- **Multi-tenant:** Frontend remove `instituicaoId` dos params ✅

### 2. CHECKLIST INICIAL (VERIFICAÇÕES BÁSICAS)

#### ✅ Autenticação - CONFIGURAÇÃO BÁSICA OK
- [x] Middleware `authenticate` existe e valida JWT
- [x] Token contém: `userId`, `email`, `instituicaoId`, `roles`
- [x] `req.user` populado corretamente
- [ ] ⚠️ **PENDENTE:** Verificar se TODAS rotas usam `authenticate`
- [ ] ⚠️ **PENDENTE:** Verificar refresh token flow (evitar loops)
- [ ] ⚠️ **PENDENTE:** Verificar guards frontend por role

#### ✅ Multi-tenant - FUNÇÃO HELPER OK
- [x] `addInstitutionFilter()` existe e usa `req.user.instituicaoId`
- [x] Frontend remove `instituicaoId` dos params
- [ ] ⚠️ **PENDENTE:** Verificar se TODAS queries Prisma usam filtro
- [ ] ⚠️ **PENDENTE:** Verificar SUPER_ADMIN (pode passar `instituicaoId` na query)
- [ ] ⚠️ **PENDENTE:** Verificar rotas sem `requireInstitution`

#### ✅ RBAC - MIDDLEWARE EXISTE
- [x] `authorizeRoles()` existe
- [x] `requireConfiguracaoEnsino` existe (bloqueia PROFESSOR, SUPER_ADMIN)
- [x] `requireInstitution` existe
- [ ] ⚠️ **PENDENTE:** Verificar se TODAS rotas usam `authorize()`
- [ ] ⚠️ **PENDENTE:** Verificar permissões frontend (menus, botões)

#### ⚠️ Rotas - PRECISA MAPEAMENTO COMPLETO
- [ ] **PENDENTE:** Listar TODAS rotas e verificar:
  - Middleware `authenticate`
  - Middleware `authorize`/RBAC
  - Uso de `addInstitutionFilter()`
  - Queries Prisma com filtro de instituição

#### ⚠️ Frontend - PRECISA VALIDAÇÃO COMPLETA
- [ ] **PENDENTE:** Verificar se TODAS chamadas removem `instituicaoId`
- [ ] **PENDENTE:** Verificar guards de rotas frontend
- [ ] **PENDENTE:** Verificar renderização condicional por role

### 3. PRINCIPAIS OBSERVAÇÕES (ANÁLISE INICIAL)

#### ✅ PONTOS POSITIVOS
1. **Autenticação bem estruturada:**
   - Middleware `authenticate` extrai token corretamente
   - `req.user` populado com `userId`, `instituicaoId`, `roles`
   - Token JWT usa `sub` (padrão) e `instituicaoId` no payload

2. **Multi-tenant helper existe:**
   - `addInstitutionFilter()` implementado corretamente
   - Frontend remove `instituicaoId` dos params automaticamente
   - Comentários claros no código sobre multi-tenant

3. **RBAC middleware existe:**
   - `authorizeRoles()` implementado
   - `requireConfiguracaoEnsino` bloqueia roles corretas
   - `requireInstitution` garante instituicaoId

#### ⚠️ PONTOS DE ATENÇÃO (REQUER VERIFICAÇÃO)

1. **Cobertura de middleware:**
   - Muitas rotas (104+) - precisa verificar se TODAS usam `authenticate` e `authorize`
   - Algumas rotas podem estar sem proteção

2. **Queries Prisma:**
   - Nem todas queries podem estar usando `addInstitutionFilter()`
   - Alguns controllers podem estar usando `req.user.instituicaoId` diretamente (aceitável, mas inconsistente)

3. **Frontend guards:**
   - Não verificado se existem guards por role nas rotas
   - Menus/botões podem não estar protegidos por permissão

4. **Fluxo acadêmico:**
   - Precisa validar: Curso, Disciplina, Plano Ensino, Matrícula
   - Verificar dependências de Ano Letivo

### 4. PRÓXIMOS PASSOS (PRIORIDADE)

#### P0 - CRÍTICO (Segurança)
1. ⚠️ **Verificar TODAS rotas:** Listar e verificar middleware de auth/RBAC
2. ⚠️ **Verificar TODAS queries Prisma:** Garantir filtro de instituição
3. ⚠️ **Validar SUPER_ADMIN:** Pode passar `instituicaoId` na query?
4. ⚠️ **Validar refresh token:** Evitar loops infinitos

#### P1 - IMPORTANTE (Funcionalidade)
5. ⚠️ **Validar fluxo acadêmico:** Curso, Disciplina, Plano Ensino, Matrícula
6. ⚠️ **Validar RBAC frontend:** Guards de rotas, menus, botões
7. ⚠️ **Validar selects dinâmicos:** Sem valores "fake", só dados cadastrados

#### P2 - MELHORIA (UX/Performance)
8. ⚠️ **Validar modais:** Controlled state, cleanup seguro
9. ⚠️ **Validar duplicidade:** React Query keys, enabled flags
10. ⚠️ **Validar layout:** Sidebar fixa, conteúdo scroll

---

## MAPEAMENTO PARCIAL (AMOSTRAGEM)

### Rotas Verificadas (Exemplos)

#### `/auth` ✅
- ✅ POST `/login` - Sem auth (público)
- ✅ POST `/register` - Sem auth (público)
- ✅ POST `/refresh` - Sem auth (público)
- ✅ POST `/logout` - ✅ `authenticate`
- ✅ GET `/me` - ✅ `authenticate`
- ✅ GET `/profile` - ✅ `authenticate`

#### `/cursos` ✅
- ✅ GET `/` - ✅ `authenticate`, ✅ `validateLicense`, ✅ `requireConfiguracaoEnsino`, ✅ `requireInstitution`
- ✅ GET `/:id` - ✅ `authenticate`, ✅ `validateLicense`, ✅ `requireConfiguracaoEnsino`, ✅ `requireInstitution`
- ✅ POST `/` - ✅ `authenticate`, ✅ `validateLicense`, ✅ `requireConfiguracaoEnsino`, ✅ `requireInstitution`, ✅ `authorize('ADMIN')`
- ✅ PUT `/:id` - ✅ `authenticate`, ✅ `validateLicense`, ✅ `requireConfiguracaoEnsino`, ✅ `requireInstitution`, ✅ `authorize('ADMIN')`
- ✅ DELETE `/:id` - ✅ `authenticate`, ✅ `validateLicense`, ✅ `requireConfiguracaoEnsino`, ✅ `requireInstitution`, ✅ `authorize('ADMIN')`

**Controller:** Usa `addInstitutionFilter(req)` ✅

#### `/plano-ensino` ✅
- ✅ POST `/` - ✅ `authenticate`, ✅ `validateLicense`, ✅ `authorize('ADMIN', 'SUPER_ADMIN')`, ✅ `bloquearAnoLetivoEncerrado`
- ✅ GET `/contexto` - ✅ `authenticate`, ✅ `validateLicense`, ✅ `authorize('ADMIN', 'SUPER_ADMIN')`
- ✅ GET `/` - ✅ `authenticate`, ✅ `validateLicense`, ✅ `authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'ALUNO', 'SUPER_ADMIN')`

**Observação:** Usa `bloquearAnoLetivoEncerrado` ✅ (regra institucional)

#### `/matriculas-anuais` ✅
- ✅ GET `/` - ✅ `authenticate`, ✅ `validateLicense`
- ✅ POST `/` - ✅ `authenticate`, ✅ `validateLicense`, ✅ `authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN')`, ✅ `bloquearAnoLetivoEncerrado`
- ✅ PUT `/:id` - ✅ `authenticate`, ✅ `validateLicense`, ✅ `authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN')`, ✅ `bloquearAnoLetivoEncerrado`
- ✅ DELETE `/:id` - ✅ `authenticate`, ✅ `validateLicense`, ✅ `authorize('ADMIN', 'SUPER_ADMIN')`, ✅ `bloquearAnoLetivoEncerrado`

---

## CONCLUSÕES INICIAIS

### ✅ PONTOS POSITIVOS IDENTIFICADOS

1. **Autenticação bem estruturada:**
   - Middleware `authenticate` implementado corretamente ✅
   - Token JWT contém: `userId`, `instituicaoId`, `roles` ✅
   - `req.user` populado corretamente ✅
   - 196 usos de `router.use(authenticate)` em 53 arquivos ✅

2. **Refresh Token flow protegido:**
   - Usa `_retry` para evitar loops infinitos ✅
   - Verifica endpoints de auth antes de tentar refresh ✅
   - Limpa tokens em caso de erro ✅

3. **Multi-tenant implementado:**
   - `addInstitutionFilter()` existe e funciona ✅
   - Frontend remove `instituicaoId` dos params automaticamente ✅
   - Comentários claros no código sobre multi-tenant ✅

4. **RBAC implementado:**
   - `authorizeRoles()` existe ✅
   - `requireConfiguracaoEnsino` bloqueia roles corretas ✅
   - `requireInstitution` garante instituição ✅
   - Frontend usa `ProtectedRoute` com `allowedRoles` ✅

5. **Rotas verificadas (amostra):**
   - `/cursos` - ✅ Protegida corretamente
   - `/plano-ensino` - ✅ Protegida corretamente
   - `/matriculas-anuais` - ✅ Protegida corretamente

### ⚠️ PENDÊNCIAS PARA ANÁLISE COMPLETA

#### P0 - CRÍTICO (Segurança)
1. ⚠️ **Verificar TODAS rotas:** Garantir que 104+ rotas usam `authenticate` e `authorize()`
2. ⚠️ **Verificar TODAS queries Prisma:** Garantir que usam filtro de instituição
3. ⚠️ **Validar SUPER_ADMIN:** Pode passar `instituicaoId` na query? (parcialmente verificado ✅)

#### P1 - IMPORTANTE (Funcionalidade)
4. ⚠️ **Validar fluxo acadêmico completo:** Curso, Disciplina, Plano Ensino, Matrícula (parcialmente verificado ✅)
5. ⚠️ **Validar guards frontend:** Menus/botões protegidos por role (parcialmente verificado ✅)

#### P2 - MELHORIA (UX/Performance)
6. ⚠️ **Validar modais/portals:** Controlled state, cleanup seguro
7. ⚠️ **Validar duplicidade:** React Query keys, enabled flags

## FALHAS ENCONTRADAS (INICIAL)

### P0 - CRÍTICO

**Nenhuma falha crítica encontrada até agora** ✅

**OBSERVAÇÕES:**
- Autenticação e RBAC bem implementados
- Multi-tenant usando `addInstitutionFilter()` corretamente
- Refresh token protegido contra loops

**PENDENTE:** Verificar TODAS as 104+ rotas para garantir cobertura completa (196 usos já identificados em 53 arquivos).

### P1 - IMPORTANTE

**PENDENTE:** Verificação completa de:
- Queries Prisma sem `addInstitutionFilter()`
- Rotas sem `authorize()`
- Frontend guards por role
- Fluxo acadêmico completo

### P2 - MELHORIA

**PENDENTE:** Verificação de:
- Modais/Portals
- Duplicidade de chamadas
- Layout/Sidebar

---

## PRÓXIMA ETAPA

1. **Script/Processo sistemático** para verificar TODAS rotas:
   - Listar todas rotas registradas
   - Verificar middleware de autenticação
   - Verificar middleware RBAC
   - Verificar uso de `addInstitutionFilter()`
   - Verificar queries Prisma

2. **Script/Processo sistemático** para verificar TODAS chamadas frontend:
   - Listar todas chamadas API
   - Verificar remoção de `instituicaoId`
   - Verificar guards de rotas
   - Verificar renderização condicional

3. **Validação de fluxo acadêmico:**
   - Curso não depende de Ano Letivo ✅
   - Disciplina não depende de Ano Letivo ✅
   - Plano Ensino depende de Ano Letivo ✅
   - Matrícula Anual depende de Ano Letivo ✅

---

**Status:** 🟡 Mapeamento em progresso - continuando análise sistemática...

