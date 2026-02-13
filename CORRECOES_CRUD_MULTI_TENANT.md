# Correções CRUD Multi-Tenant - DSICOLA

## Data: 2025-01-XX
## Status: EM CORREÇÃO

## Problema Identificado

Listagens retornam vazias mesmo com dados no banco. O diagnóstico mostrou que:
- ✅ Dados EXISTEM no banco
- ✅ Dados TÊM `instituicao_id` preenchido (exceto 1 usuário)
- ❌ Listagens retornam vazio

## Causa Raiz Provável

Os controllers podem estar:
1. Usando filtros muito restritivos
2. Não aplicando filtros corretamente
3. Usando filtros aninhados de forma incorreta

## Correções Necessárias

### 1. MIDDLEWARE `addInstitutionFilter`

**Problema identificado:**
- Quando usuário não tem `instituicaoId`, retorna `{ instituicaoId: null }` que não retorna nada
- Isso está CORRETO para segurança, mas pode estar escondendo dados legítimos

**Status:** ✅ CORRETO - não alterar

### 2. CONTROLLERS COM FILTROS ANINHADOS

**Controllers que filtram através de relações:**
- `mensalidade.controller.ts` - filtra através de `aluno.instituicaoId` ✅
- `matricula.controller.ts` - filtra através de `aluno.instituicaoId` ✅

**Problema potencial:** Se o filtro aninhado está correto mas o Prisma não está aplicando corretamente.

### 3. CONTROLLERS COM FILTROS DE TIPO ACADÊMICO

**Problema identificado:**
- `disciplina.controller.ts` - adiciona filtros adicionais baseados em `tipoAcademico`
- `turma.controller.ts` - adiciona filtros adicionais baseados em `tipoAcademico`
- `classe.controller.ts` - retorna array vazio para Ensino Superior

**Risco:** Filtros muito restritivos podem estar excluindo dados válidos.

---

## Plano de Ação

### FASE 1: Verificar se o problema está no token

**Ação:** Criar endpoint de debug para verificar o que está no token

### FASE 2: Corrigir controllers problemáticos

**Ação:** Verificar cada controller e garantir que os filtros estão corretos

### FASE 3: Adicionar logs temporários

**Ação:** Adicionar logs nos controllers principais para ver o que está acontecendo

---

## Controllers a Verificar

1. ✅ `user.controller.ts` - usa `addInstitutionFilter` corretamente
2. ✅ `curso.controller.ts` - usa `addInstitutionFilter` corretamente
3. ⚠️ `disciplina.controller.ts` - adiciona filtros adicionais (verificar)
4. ⚠️ `turma.controller.ts` - adiciona filtros adicionais (verificar)
5. ✅ `classe.controller.ts` - retorna vazio para Superior (correto)
6. ⚠️ `mensalidade.controller.ts` - filtro aninhado (verificar)
7. ⚠️ `matricula.controller.ts` - filtro aninhado (verificar)

---

## Próximos Passos

1. Adicionar logs de debug nos controllers principais
2. Testar listagens com token válido
3. Verificar se o problema está nos filtros ou nos dados

