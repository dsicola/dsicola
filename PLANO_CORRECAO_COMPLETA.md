# PLANO DE CORREÇÃO COMPLETA - DSICOLA

**Data**: 2025-01-XX  
**Objetivo**: Corrigir TODO o projeto para produção

## 📋 PROBLEMAS IDENTIFICADOS

### 1. AMBIGUIDADE user.id vs professor.id

**Problema**: Vários controllers usam `req.user.userId` diretamente como `professorId`, mas deveriam usar `req.professor.id` (professores.id).

**Arquivos afetados**:
- `mensagemResponsavel.controller.ts` - Linhas 30, 79, 247, 304
- `comunicado.controller.ts` - Linha 254
- Outros controllers que usam `userId` como `professorId`

**Solução**: 
- Aplicar `resolveProfessorMiddleware` nas rotas que requerem professor
- Usar `req.professor.id` ao invés de `req.user.userId` para professorId

### 2. CÓDIGO LEGACY ATIVO

**Problema**: Há suporte a "legacy" (planos com instituicaoId null) que viola multi-tenant.

**Arquivos afetados**:
- `validacaoAcademica.service.ts` - Múltiplas referências a "legacy"
- Funções `@deprecated` ainda em uso
- Endpoints legados ainda ativos

**Solução**:
- Remover suporte a planos com `instituicaoId null`
- Remover funções `@deprecated` ou garantir que não são usadas
- Remover endpoints legados ou marcar como obsoletos

### 3. MULTI-TENANT NÃO RIGOROSO

**Problema**: Algumas queries podem não estar usando filtro multi-tenant corretamente.

**Solução**:
- Garantir que TODAS as queries usam `addInstitutionFilter` ou `requireTenantScope`
- Remover suporte a `instituicaoId null` (legacy)
- Validar que SUPER_ADMIN só pode acessar outras instituições via query param explícito

### 4. TIPO ACADÊMICO (SUPERIOR/SECUNDARIO)

**Problema**: Verificar se tipoAcademico está sendo usado corretamente em todos os serviços.

**Solução**:
- Garantir que `tipoAcademico` vem do JWT (req.user.tipoAcademico)
- Validar regras específicas para SUPERIOR vs SECUNDARIO

## 🔧 CORREÇÕES PRIORITÁRIAS

### Prioridade 1: Ambiguidade professor.id
1. Corrigir `mensagemResponsavel.controller.ts`
2. Corrigir `comunicado.controller.ts`
3. Verificar outros controllers

### Prioridade 2: Remover código legacy
1. Remover suporte a planos com `instituicaoId null`
2. Remover funções `@deprecated` não usadas
3. Marcar endpoints legados como obsoletos

### Prioridade 3: Multi-tenant rigoroso
1. Garantir que todas as queries usam filtro
2. Remover suporte a legacy
3. Validar SUPER_ADMIN

### Prioridade 4: Tipo acadêmico
1. Validar uso de tipoAcademico
2. Garantir regras específicas

