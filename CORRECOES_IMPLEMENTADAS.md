# CORREÇÕES IMPLEMENTADAS - DSICOLA

**Data**: 2025-01-XX  
**Status**: Em Progresso

## ✅ CORREÇÕES CONCLUÍDAS

### 1. Ambiguidade user.id vs professor.id

#### ✅ `mensagemResponsavel.controller.ts` - CORRIGIDO
- **Problema**: Usava `req.user.userId` diretamente como `professorId`
- **Correção**: 
  - Adicionado import de `resolveProfessorId`
  - Corrigido `getAll()` para resolver `professorId` quando usuário é PROFESSOR
  - Corrigido `getById()` para resolver `professorId` na validação
  - Corrigido `create()` para normalizar `professorId` do body (pode ser users.id ou professores.id)
  - Corrigido `responder()` para resolver `professorId` na validação
  - Corrigido `marcarLida()` para resolver `professorId` na validação
  - Corrigido validação de `professorDisciplina` para usar `finalProfessorId`

#### ✅ `comunicado.controller.ts` - CORRIGIDO
- **Problema**: Usava `userId` diretamente como `professorId` em `getComunicadosPublicos()`
- **Correção**:
  - Adicionado import de `resolveProfessorId` e `requireTenantScope`
  - Corrigido busca de turmas como professor para resolver `professorId` corretamente
  - Adicionado suporte a ambos `professores.id` e `users.id` (legacy/compatibilidade) na query

## 🔄 CORREÇÕES EM ANDAMENTO

### 2. Código Legacy Ativo

**Status**: Identificado, precisa remoção

**Arquivos afetados**:
- `validacaoAcademica.service.ts` - Suporte a planos com `instituicaoId null` (legacy)
- Funções `@deprecated`:
  - `resolveProfessorIdFromRequest()` em `professorResolver.ts`
  - `aprovar()` em `folhaPagamento.controller.ts`
  - `registrarPagamento()` em `mensalidade.controller.ts`

**Ação necessária**:
- Remover suporte a planos com `instituicaoId null`
- Remover ou marcar funções `@deprecated` como obsoletas
- Remover endpoints legados ou marcar como obsoletos

### 3. Multi-Tenant Rigoroso

**Status**: Maioria das rotas já usa filtros, mas há suporte a legacy

**Ação necessária**:
- Remover suporte a `instituicaoId null` (legacy)
- Garantir que todas as queries usam `addInstitutionFilter` ou `requireTenantScope`
- Validar que SUPER_ADMIN só pode acessar outras instituições via query param explícito

### 4. Tipo Acadêmico (SUPERIOR/SECUNDARIO)

**Status**: Verificar uso correto

**Ação necessária**:
- Garantir que `tipoAcademico` vem do JWT (req.user.tipoAcademico)
- Validar regras específicas para SUPERIOR vs SECUNDARIO em todos os serviços

## 📋 PRÓXIMOS PASSOS

1. **Remover código legacy**:
   - Remover suporte a planos com `instituicaoId null` em `validacaoAcademica.service.ts`
   - Remover funções `@deprecated` não usadas
   - Marcar endpoints legados como obsoletos

2. **Garantir multi-tenant rigoroso**:
   - Auditar todas as queries Prisma
   - Remover suporte a legacy
   - Validar SUPER_ADMIN

3. **Validar tipo acadêmico**:
   - Verificar uso de `tipoAcademico` em todos os serviços
   - Garantir regras específicas

4. **Outros controllers**:
   - Verificar outros controllers que podem ter ambiguidade `user.id` vs `professor.id`
   - Aplicar `resolveProfessorMiddleware` onde necessário

## 📝 NOTAS TÉCNICAS

### MensagemResponsavel.professorId
- **Schema**: Campo `String` sem relação explícita
- **Decisão**: Armazenar `professores.id` (consistente com PlanoEnsino)
- **Correção**: Normalizar `professorId` do body para `professores.id` antes de salvar

### Turma.professorId
- **Schema**: Campo `String?` sem relação explícita
- **Decisão**: Pode armazenar `users.id` ou `professores.id` (legacy/compatibilidade)
- **Correção**: Buscar por ambos na query (OR) para compatibilidade
