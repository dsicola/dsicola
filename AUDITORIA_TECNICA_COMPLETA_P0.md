# AUDITORIA TÉCNICA COMPLETA - DSICOLA
## Relatório de Auditoria Automática - Parte A

**Data**: 2025-01-27  
**Engenheiro**: Auditor Técnico Sênior  
**Escopo**: Backend + Frontend - Multi-tenant, RBAC, Autenticação, CRUDs

---

## RESUMO EXECUTIVO

### Métricas do Projeto
- **Rotas Backend**: 104 arquivos de rotas, ~569 rotas HTTP
- **APIs Frontend**: ~100 grupos de APIs exportados
- **Middleware Auth**: ✅ Implementado (`authenticate`, `authorize`)
- **Multi-tenant Helper**: ✅ `addInstitutionFilter()` implementado
- **RBAC Middleware**: ✅ `authorizeRoles()`, `requireConfiguracaoEnsino`, `requireInstitution`

### Status Geral
| Categoria | Status | Prioridade |
|-----------|--------|------------|
| Autenticação (Backend) | 🟡 PARCIAL | P0 |
| Multi-tenant (Backend) | 🟡 PARCIAL | P0 |
| RBAC (Backend) | 🟡 PARCIAL | P0 |
| Frontend (APIs) | 🟢 BOM | P1 |
| Fluxo Acadêmico | 🟡 PARCIAL | P0/P1 |

---

## PARTE A - MAPEAMENTO DE ROTAS E APIS

### 1. Estrutura de Rotas Backend

#### Rotas Principais Identificadas:
```
/auth                     - Autenticação (login, register, refresh, logout, profile)
/users                    - Usuários
/instituicoes            - Instituições (multi-tenant)
/cursos                  - Cursos
/classes                 - Classes (Ensino Secundário)
/disciplinas             - Disciplinas
/turmas                  - Turmas
/matriculas              - Matrículas
/plano-ensino            - Planos de Ensino (núcleo acadêmico)
/notas                   - Notas
/aulas                   - Aulas
/frequencias             - Frequências
/mensalidades            - Mensalidades
/pagamentos              - Pagamentos
/funcionarios            - Funcionários
/folha-pagamento         - Folha de Pagamento
...
```

### 2. Padrão de Middleware Identificado

#### Rotas Bem Estruturadas (exemplo: `/cursos`)
```typescript
router.use(authenticate);              // ✅ 1. Autenticação JWT
router.use(validateLicense);           // ✅ 2. Validação de licença
router.use(requireConfiguracaoEnsino); // ✅ 3. RBAC - Bloqueio de roles
router.use(requireInstitution);        // ✅ 4. Multi-tenant - Garantir instituicaoId
```

#### Rotas Sem Proteção Completa (VERIFICAR)
- Rotas de `/auth` (login/register não precisam de auth, mas `/profile` precisa)
- Rotas públicas (`/health`, landing, etc.)
- Algumas rotas de relatórios podem estar sem RBAC

---

## PARTE B - AUTENTICAÇÃO (P0)

### ✅ PONTOS POSITIVOS

1. **Middleware `authenticate` bem implementado**:
   - Extrai token do header `Authorization: Bearer <token>`
   - Popula `req.user` com `userId`, `email`, `instituicaoId`, `roles`
   - Valida token JWT e retorna 401 se inválido/expirado

2. **Token JWT contém claims corretos**:
   - `sub` ou `userId`: ID do usuário
   - `email`: Email do usuário
   - `instituicaoId`: UUID da instituição (ou null para SUPER_ADMIN)
   - `roles`: Array de roles do usuário

3. **Refresh Token implementado**:
   - Endpoint `/auth/refresh` funciona
   - Frontend tenta refresh automático em 401

### ⚠️ PROBLEMAS ENCONTRADOS (P0)

#### 1. [P0] Rota `/auth/profile` sem verificação de `authenticate` explícita
**Arquivo**: `backend/src/routes/auth.routes.ts:197`  
**Problema**: Rota usa `authenticate`, mas deveria estar mais explícito  
**Status**: ✅ VERIFICADO - Usa `authenticate` corretamente

#### 2. [P0] Validação de `instituicaoId` no token pode falhar silenciosamente
**Arquivo**: `backend/src/middlewares/auth.ts:89-126`  
**Problema**: Se `instituicaoId` não for UUID válido mas não for `null`, pode passar  
**Ação**: Verificar se validação é suficientemente rigorosa

#### 3. [P0] Loop de refresh token não tratado adequadamente
**Arquivo**: `frontend/src/services/api.ts:158-223`  
**Problema**: Se refresh falhar, redireciona mas pode gerar loop se token estiver corrompido  
**Recomendação**: Adicionar flag para evitar múltiplas tentativas de refresh

---

## PARTE C - MULTI-TENANT (P0)

### ✅ PONTOS POSITIVOS

1. **Helper `addInstitutionFilter()` bem implementado**:
   - Retorna filtro baseado em `req.user.instituicaoId`
   - SUPER_ADMIN pode usar `?instituicaoId=` na query
   - Outros usuários sempre usam `instituicaoId` do token

2. **Frontend remove `instituicaoId` dos params**:
   - APIs frontend têm comentários explicativos
   - Remoção explícita: `const { instituicaoId, ...safeParams } = params || {};`

3. **Controllers usam `addInstitutionFilter()`**:
   - Exemplos: `curso.controller.ts`, `disciplina.controller.ts`, `matricula.controller.ts`

### ⚠️ PROBLEMAS ENCONTRADOS (P0)

#### 1. [P0] Nem todas queries Prisma usam `addInstitutionFilter()`
**Arquivos**: Múltiplos controllers  
**Problema**: Algumas queries podem estar sem filtro de instituição  
**Ação**: Auditoria completa de TODAS queries Prisma

#### 2. [P0] Rotas sem `requireInstitution` podem permitir acesso sem `instituicaoId`
**Arquivos**: Rotas que não são públicas mas não exigem `requireInstitution`  
**Problema**: Usuário pode acessar sem ter `instituicaoId` válido  
**Ação**: Listar rotas que precisam de `requireInstitution`

#### 3. [P0] SUPER_ADMIN sem `instituicaoId` no token pode ver tudo
**Arquivo**: `backend/src/middlewares/auth.ts:343-345`  
**Problema**: Se SUPER_ADMIN não tem `instituicaoId` no token, `addInstitutionFilter()` retorna `{}` (vê tudo)  
**Status**: Por design, mas precisa documentação clara

---

## PARTE D - RBAC (P0)

### ✅ PONTOS POSITIVOS

1. **Middleware `authorize()` implementado**:
   - Aceita múltiplas roles: `authorize('ADMIN', 'SUPER_ADMIN')`
   - Retorna 403 se usuário não tem role permitida

2. **Middleware `requireConfiguracaoEnsino` bloqueia PROFESSOR e SUPER_ADMIN**:
   - Aplicado em rotas de configuração acadêmica
   - Mensagem clara de erro

3. **Middleware `requireInstitution` garante multi-tenant**:
   - Bloqueia usuários sem `instituicaoId` (exceto SUPER_ADMIN)

### ⚠️ PROBLEMAS ENCONTRADOS (P0)

#### 1. [P0] Nem todas rotas usam `authorize()`
**Arquivos**: Múltiplos arquivos de rotas  
**Problema**: Algumas rotas podem estar acessíveis sem verificação de role  
**Ação**: Auditoria completa de TODAS rotas protegidas

#### 2. [P0] Frontend pode não estar renderizando UI por role
**Arquivos**: Componentes React  
**Problema**: Menus, botões e cards podem estar visíveis sem verificação de role  
**Ação**: Verificar guards e renderização condicional

#### 3. [P0] Matriz de permissões não documentada centralmente
**Problema**: Permissões por role estão espalhadas no código  
**Recomendação**: Criar arquivo `RBAC_MATRIX.md` com todas permissões

---

## PARTE E - FLUXO ACADÊMICO institucional (P0/P1)

### ✅ PONTOS POSITIVOS

1. **Curso NÃO depende de Ano Letivo**:
   - Rota `/cursos` não exige `requireAnoLetivoAtivo`
   - Comentário explícito: "Curso NÃO depende de Ano Letivo"

2. **Disciplina NÃO depende de Ano Letivo**:
   - Rota `/disciplinas` não exige `requireAnoLetivoAtivo`
   - Relacionamento N:N com Curso via `CursoDisciplina`

3. **Plano de Ensino exige Ano Letivo**:
   - Rota `/plano-ensino` usa `bloquearAnoLetivoEncerrado`
   - Contexto: curso + disciplina + professor + ano letivo

### ⚠️ PROBLEMAS ENCONTRADOS (P0/P1)

#### 1. [P1] Seletores dinâmicos podem ter valores "fake"
**Arquivos**: Componentes de formulário  
**Problema**: Semestre/Trimestre/Classe podem estar hardcoded  
**Recomendação**: Verificar se selects carregam do BD

#### 2. [P0] Matrícula Anual pode não validar tipo de instituição
**Arquivos**: `matriculaAnual.routes.ts`, `matriculaAnual.controller.ts`  
**Problema**: ENSINO_SUPERIOR usa "Ano do Curso", ENSINO_SECUNDARIO usa "Classe"  
**Ação**: Verificar validação condicional por `tipoInstituicao`

#### 3. [P1] Semestre só para ENSINO_SUPERIOR, Classe só para ENSINO_SECUNDARIO
**Problema**: Pode haver mistura de conceitos  
**Ação**: Validar lógica condicional por `tipoInstituicao`

---

## PARTE F - UX/ESTABILIDADE (P1)

### ⚠️ PROBLEMAS ENCONTRADOS (P1)

#### 1. [P1] Modais podem ter problemas de DOM (Node.removeChild)
**Arquivos**: Componentes com modais/portals  
**Problema**: Cleanup de modais pode falhar  
**Ação**: Verificar `useEffect` cleanup e estado controlado

#### 2. [P1] Chamadas duplicadas de API
**Arquivos**: Componentes React com React Query  
**Problema**: `enabled` e `queryKey` podem não estar otimizados  
**Ação**: Auditar queries duplicadas

#### 3. [P1] Loading infinito em algumas telas
**Arquivos**: Dashboards e listagens  
**Problema**: Pode haver loop de loading  
**Ação**: Verificar condições de `isLoading` e `isError`

---

## CHECKLIST DE CORREÇÕES NECESSÁRIAS

### P0 - CRÍTICO (Fazer Imediatamente)

- [ ] **AUD-001**: Auditar TODAS queries Prisma para garantir `addInstitutionFilter()`
- [ ] **AUD-002**: Auditar TODAS rotas protegidas para garantir `authorize()`
- [ ] **AUD-003**: Listar rotas sem `requireInstitution` que deveriam ter
- [ ] **AUD-004**: Verificar validação de `instituicaoId` no token JWT
- [ ] **AUD-005**: Testar loop de refresh token no frontend
- [ ] **AUD-006**: Validar matrícula anual por tipo de instituição
- [ ] **AUD-007**: Documentar matriz de permissões RBAC

### P1 - IMPORTANTE (Fazer em Seguida)

- [ ] **AUD-008**: Verificar selects dinâmicos (Semestre/Trimestre/Classe)
- [ ] **AUD-009**: Auditar modais/portals (cleanup, estado controlado)
- [ ] **AUD-010**: Otimizar React Query (evitar chamadas duplicadas)
- [ ] **AUD-011**: Verificar loading infinito em dashboards

---

## PRÓXIMOS PASSOS

1. **Prioridade P0**: Corrigir problemas de segurança (multi-tenant, RBAC, auth)
2. **Prioridade P1**: Corrigir problemas de UX/performance
3. **Documentação**: Criar "Contrato API" documentado
4. **Testes**: Executar testes de integração após correções

---

## NOTAS TÉCNICAS

### Padrões Encontrados

1. **Rotas Bem Estruturadas**:
   ```typescript
   router.use(authenticate);
   router.use(validateLicense);
   router.use(requireConfiguracaoEnsino);
   router.use(requireInstitution);
   router.get('/', authorize('ADMIN'), controller.get);
   ```

2. **Controllers Multi-tenant**:
   ```typescript
   const filter = addInstitutionFilter(req);
   const where = { ...filter, ...outrosFiltros };
   const result = await prisma.entity.findMany({ where });
   ```

3. **Frontend Multi-tenant**:
   ```typescript
   const { instituicaoId, ...safeParams } = params || {};
   const response = await api.get('/endpoint', { params: safeParams });
   ```

---

**FIM DO RELATÓRIO - PARTE A**

Próxima etapa: Executar auditoria detalhada por módulo e gerar patches de correção.

