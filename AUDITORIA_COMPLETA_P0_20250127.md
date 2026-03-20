# AUDITORIA COMPLETA DSICOLA - PARTE A: MAPEAMENTO E ANÁLISE
**Data:** 2025-01-27  
**Objetivo:** Mapear rotas backend, chamadas frontend, identificar inconsistências e gerar checklist de falhas (P0/P1/P2)

---

## PARTE A — AUDITORIA AUTOMÁTICA (MAPEAMENTO)

### 1. ROTAS BACKEND (Mapeamento Inicial)

#### 1.1 Rotas Públicas (Sem Autenticação)
- `GET /health` - Health check
- `POST /auth/login` - Login
- `POST /auth/register` - Registro
- `POST /auth/refresh` - Refresh token
- `POST /auth/reset-password` - Solicitar reset senha
- `POST /auth/confirm-reset-password` - Confirmar reset senha
- `POST /auth/check-lockout` - Verificar bloqueio de conta

#### 1.2 Rotas Protegidas (Com Autenticação)

**Middleware Padrão Aplicado:**
- `authenticate` - Verifica token JWT, popula `req.user`
- `validateLicense` - Valida licença (SUPER_ADMIN isento)
- `requireConfiguracaoEnsino` - Bloqueia SUPER_ADMIN e PROFESSOR de Configuração de Ensinos
- `requireInstitution` - Garante que usuário tem instituição (exceto SUPER_ADMIN)
- `authorize(...roles)` - RBAC por role
- `enforceTenant` - Multi-tenant isolation
- `bloquearAnoLetivoEncerrado` - Bloqueia operações em ano letivo encerrado

**Módulos Principais Identificados:**
1. **Auth** (`/auth`)
2. **Users** (`/users`)
3. **Instituições** (`/instituicoes`)
4. **Cursos** (`/cursos`)
5. **Classes** (`/classes`)
6. **Disciplinas** (`/disciplinas`)
7. **Turmas** (`/turmas`)
8. **Matrículas** (`/matriculas`)
9. **Plano de Ensino** (`/plano-ensino`)
10. **Notas** (`/notas`)
11. **Aulas** (`/aulas`)
12. **Frequências** (`/frequencias`)
13. **Mensalidades** (`/mensalidades`)
14. **Pagamentos** (`/pagamentos`)
15. **Avaliações** (`/avaliacoes` — API; no produto: **Avaliações e notas (disciplina)**)
16. **Presenças** (`/presenca`)
17. **Aulas Lançadas** (`/aulas-lancadas`)
18. **Ano Letivo** (`/anos-letivos`)
19. **Semestres** (`/semestres`)
20. **Trimestres** (`/trimestres`)

### 2. CHAMADAS FRONTEND (Análise Inicial)

**Arquivo:** `frontend/src/services/api.ts` (4788 linhas)

**Padrões Identificados:**
- Usa `axios` com interceptors para autenticação
- Token management: `accessToken` e `refreshToken` no localStorage
- Auto-refresh de token em caso de 401
- Remoção proativa de `instituicaoId` de params/body (multi-tenant)

**APIs Mapeadas:**
- `authApi` - Autenticação
- `usersApi` - Usuários
- `instituicoesApi` - Instituições
- `cursosApi` - Cursos
- `classesApi` - Classes
- `disciplinasApi` - Disciplinas
- `turmasApi` - Turmas
- `matriculasApi` - Matrículas
- `notasApi` - Notas
- `aulasApi` - Aulas
- `frequenciasApi` - Frequências
- `mensalidadesApi` - Mensalidades
- `pagamentosApi` - Pagamentos
- `planoEnsinoApi` - Plano de Ensino
- `avaliacoesApi` - Avaliações (disciplina)
- E mais...

### 3. CHECKLIST DE FALHAS (Priorização)

#### P0 - CRÍTICO (Segurança e Funcionalidade Básica)

**AUTENTICAÇÃO:**
- [ ] Verificar se todas as rotas protegidas usam `authenticate`
- [ ] Verificar se token retorna `userId`, `role`, `instituicaoId`, `tipoInstituicao`
- [ ] Verificar refresh token (evitar loop infinito)
- [ ] Verificar tratamento de 401 global no frontend

**MULTI-TENANT:**
- [ ] Verificar se TODAS as queries Prisma usam `addInstitutionFilter(req)`
- [ ] Verificar se NENHUM controller lê `instituicaoId` de `req.body` ou `req.params`
- [ ] Verificar SUPER_ADMIN (pode usar query param, outros não)
- [ ] Verificar se queries sem `instituicaoId` retornam vazio para não-SUPER_ADMIN

**RBAC:**
- [ ] Verificar se TODAS as rotas usam `authorize(...roles)` ou `authorizeModule(...)`
- [ ] Verificar se rotas críticas têm proteção RBAC adequada
- [ ] Verificar se frontend protege rotas por role (Guards)

**FLUXO ACADÊMICO:**
- [ ] Verificar se Curso/Disciplina NÃO dependem de Ano Letivo
- [ ] Verificar se Plano de Ensino exige Ano Letivo ativo
- [ ] Verificar se Matrícula Anual usa Ano Letivo corretamente
- [ ] Verificar se selects (Semestre/Classe/Trimestre) só mostram dados cadastrados

#### P1 - ALTA PRIORIDADE (UX e Estabilidade)

**MODAIS/PORTALS:**
- [ ] Verificar se modais usam PortalRoot corretamente
- [ ] Verificar cleanup de modais (useEffect cleanup)
- [ ] Verificar se não há Node.removeChild ou commitDeletionEffects

**PERFORMANCE:**
- [ ] Verificar chamadas duplicadas (React Query keys)
- [ ] Verificar loops infinitos (loading states)
- [ ] Verificar dependências de useEffect

**LAYOUT:**
- [ ] Verificar sidebar fixa e conteúdo scroll
- [ ] Verificar se não há barra horizontal indesejada

#### P2 - MÉDIA PRIORIDADE (Melhorias)

- [ ] Validar schemas Zod/DTO em todas as rotas
- [ ] Padronizar respostas `{ ok, data, message, errors? }`
- [ ] Melhorar logs de auditoria

---

---

## FALHAS IDENTIFICADAS (PRIORIZAÇÃO)

### ✅ PONTOS POSITIVOS (Boas Práticas Encontradas)

1. **Multi-tenant (Proteção):**
   - ✅ Muitos controllers REJEITAM explicitamente `req.body.instituicaoId` (curso, matrícula, turma)
   - ✅ Uso correto de `addInstitutionFilter(req)` na maioria dos controllers
   - ✅ Middleware `authenticate` popula `req.user.instituicaoId` corretamente

2. **Autenticação:**
   - ✅ Token JWT inclui `userId`, `email`, `instituicaoId`, `roles`
   - ✅ Refresh token implementado
   - ✅ Interceptor frontend trata refresh automático

3. **RBAC:**
   - ✅ Middleware `authorize(...roles)` implementado
   - ✅ Middleware `authorizeModule` para matriz de permissões

### 🔴 P0 - CRÍTICO (Corrigir Imediatamente)

#### 1. TOKEN JWT - FALTA `tipoInstituicao`
**Arquivo:** `backend/src/services/auth.service.ts:412-417`
**Problema:** Token não inclui `tipoInstituicao` (ENSINO_SUPERIOR | ENSINO_SECUNDARIO)
**Impacto:** Frontend precisa fazer requisição extra para saber tipo de instituição
**Solução:** Adicionar `tipoInstituicao` ao payload do token (buscar de `Instituicao` no login)

#### 2. REFRESH TOKEN - RISCO DE LOOP INFINITO
**Arquivo:** `frontend/src/services/api.ts:158-205`
**Problema:** Se refresh falhar continuamente, pode causar loop de redirect
**Impacto:** Loop infinito de requisições/redirects
**Solução:** Adicionar contador de tentativas e prevenir múltiplos refreshs simultâneos

#### 3. VERIFICAR TODAS AS QUERIES PRISMA
**Status:** Em análise - 25 controllers podem ter violações multi-tenant
**Necessário:** Auditoria completa de cada controller para garantir uso de `addInstitutionFilter`

### 🟡 P1 - ALTA PRIORIDADE (Corrigir Breve)

#### 1. VALIDAÇÕES ZOD/DTO
**Status:** Algumas rotas não têm validação Zod completa
**Solução:** Adicionar schemas Zod em todas as rotas de criação/atualização

#### 2. PADRONIZAÇÃO DE RESPOSTAS
**Status:** Respostas não seguem padrão `{ ok, data, message, errors? }`
**Solução:** Criar middleware para padronizar respostas

#### 3. LOGS DE AUDITORIA
**Status:** Algumas operações críticas não registram logs
**Solução:** Adicionar logs de auditoria em CREATE/UPDATE/DELETE

### 🟢 P2 - MÉDIA PRIORIDADE (Melhorias)

1. Documentar contrato API completo (OpenAPI/Swagger)
2. Melhorar tratamento de erros (mensagens mais claras)
3. Adicionar testes automatizados

---

## PRÓXIMOS PASSOS

1. **CORREÇÃO P0 - Autenticação:**
   - [ ] Adicionar `tipoInstituicao` ao token JWT
   - [ ] Corrigir refresh token (prevenir loop infinito)
   - [ ] Auditar todas as queries Prisma para multi-tenant

2. **CORREÇÃO P0 - Multi-tenant:**
   - [ ] Verificar 25 controllers identificados
   - [ ] Garantir que NENHUM usa `req.body.instituicaoId` diretamente
   - [ ] Garantir que TODAS as queries usam `addInstitutionFilter`

3. **CORREÇÃO P0 - RBAC:**
   - [ ] Verificar se todas as rotas críticas têm `authorize`
   - [ ] Verificar guards no frontend

4. **CORREÇÃO P1:**
   - [ ] Adicionar validações Zod em todas as rotas
   - [ ] Padronizar respostas
   - [ ] Melhorar logs

5. **AUDITORIA FLUXO ACADÊMICO:**
   - [ ] Verificar dependências de Ano Letivo
   - [ ] Verificar selects dinâmicos (Semestre/Classe/Trimestre)
   - [ ] Verificar relações N:N

---

## NOTAS IMPORTANTES

1. **Multi-tenant:** `instituicaoId` SEMPRE vem do token (`req.user.instituicaoId`). Frontend NUNCA envia `instituicaoId`.

2. **SUPER_ADMIN:** Pode usar `?instituicaoId=xxx` na query para filtrar, mas o valor ainda deve ser validado.

3. **RBAC:** Middleware `authorize` verifica roles. `authorizeModule` usa matriz de permissões.

4. **Ano Letivo:** Curso/Disciplina são estruturais (não dependem). Plano de Ensino/Turma/Matrícula Anual dependem.

5. **Tipo Instituição:** ENSINO_SUPERIOR usa Semestre, ENSINO_SECUNDARIO usa Classe.

