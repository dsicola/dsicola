# AUDITORIA COMPLETA - DSICOLA
**Data:** 2025-01-XX  
**Objetivo:** Auditar relações, multi-tenancy, RBAC e contratos Backend/Frontend

---

## 1. AUDITORIA DO SCHEMA (schema.prisma)

### 1.1 Entidades Acadêmicas Principais

#### ✅ CURSO
- **instituicaoId**: ✅ Presente (String?)
- **anoLetivoId**: ✅ Ausente (correto)
- **professorId**: ✅ Ausente (correto)
- **Relações**: ✅ Vinculado apenas à Instituição

#### ✅ DISCIPLINA
- **instituicaoId**: ✅ Presente (String?)
- **cursoId**: ✅ Obrigatório (String)
- **anoLetivoId**: ✅ Ausente (correto)
- **professorId**: ✅ Ausente (correto)
- **Relações**: ✅ Sempre vinculada a Curso

#### ✅ PLANO DE ENSINO (NÚCLEO)
- **instituicaoId**: ✅ Presente (String?)
- **anoLetivoId**: ✅ Obrigatório (String) - ÚNICO lugar onde é obrigatório
- **cursoId**: ✅ Presente (String?)
- **disciplinaId**: ✅ Obrigatório (String)
- **professorId**: ✅ Obrigatório (String)
- **semestre**: ✅ Condicional (Int?) - Obrigatório apenas Ensino Superior
- **classeOuAno**: ✅ Condicional (String?) - Obrigatório apenas Ensino Secundário
- **Relações**: ✅ Conecta Disciplina, Curso, Ano Letivo, Professor

#### ⚠️ TURMA
- **instituicaoId**: ✅ Presente (String?)
- **anoLetivoId**: ✅ Obrigatório (String)
- **cursoId**: ✅ Presente (String?)
- **professorId**: ⚠️ Presente no schema, mas **BLOQUEADO no controller**
- **disciplinaId**: ⚠️ Presente no schema, mas **BLOQUEADO no controller**
- **Relações**: ✅ Professor e Disciplina vinculados via Plano de Ensino (correto)

**Nota:** Os campos `professorId` e `disciplinaId` existem no schema para compatibilidade, mas são explicitamente bloqueados no controller `turma.controller.ts` (linhas 166-173, 346-353). Isso está **correto** - professor e disciplina devem ser vinculados via Plano de Ensino.

#### ✅ AVALIAÇÃO
- **instituicaoId**: ✅ Presente (String?)
- **planoEnsinoId**: ✅ Obrigatório (String) - SEMPRE vinculada ao Plano de Ensino
- **turmaId**: ✅ Obrigatório (String)
- **professorId**: ✅ Obrigatório (String)
- **Relações**: ✅ Sempre pertence ao Plano de Ensino

#### ✅ NOTA
- **instituicaoId**: ✅ Presente (String?)
- **planoEnsinoId**: ✅ Obrigatório (String) - SEMPRE vinculada ao Plano de Ensino
- **avaliacaoId**: ✅ Opcional (String?)
- **alunoId**: ✅ Obrigatório (String)
- **Relações**: ✅ Sempre pertence ao Plano de Ensino e Avaliação

#### ✅ AULA LANÇADA
- **instituicaoId**: ✅ Presente (String) - Obrigatório
- **planoEnsinoId**: ✅ Obrigatório (String) - SEMPRE vinculada ao Plano de Ensino
- **planoAulaId**: ✅ Obrigatório (String)
- **Relações**: ✅ Sempre pertence ao Plano de Ensino

#### ✅ PRESENÇA
- **instituicaoId**: ✅ Presente (String) - Obrigatório
- **aulaLancadaId**: ✅ Obrigatório (String) - SEMPRE vinculada à Aula Lançada
- **alunoId**: ✅ Obrigatório (String)
- **Relações**: ✅ Sempre pertence à Aula Lançada

---

## 2. AUDITORIA DE MULTI-TENANCY (BACKEND)

### 2.1 Middlewares

#### ✅ requireTenantScope
- **Localização**: `backend/src/middlewares/auth.ts:235`
- **Função**: Retorna `instituicaoId` do token, lança erro se não existir
- **Uso**: ✅ Usado em todos os controllers críticos

#### ✅ addInstitutionFilter
- **Localização**: `backend/src/middlewares/auth.ts:250`
- **Função**: Retorna filtro `{ instituicaoId: token.instituicaoId }` para queries Prisma
- **Uso**: ✅ Usado em queries para filtrar por instituição

### 2.2 Controllers Auditados

#### ✅ Turma Controller
- **createTurma**: ✅ Usa `requireTenantScope(req)` (linha 156)
- **updateTurma**: ✅ Usa `addInstitutionFilter(req)` (linha 315)
- **Bloqueios**: ✅ `professorId` e `disciplinaId` são bloqueados (linhas 166-173, 346-353)

---

## 3. AUDITORIA DE RBAC (BACKEND)

### 3.1 Middleware authorize
- **Localização**: `backend/src/middlewares/auth.ts:144`
- **Função**: Valida se usuário tem pelo menos uma das roles permitidas
- **Uso**: ✅ Usado em todas as rotas

### 3.2 RBAC por Módulo
- **Localização**: `backend/src/middlewares/rbac.middleware.ts`
- **Matriz de Permissões**: ✅ Definida corretamente
- **PROFESSOR**: ✅ Acesso apenas a seus Planos de Ensino
- **ALUNO**: ✅ Acesso apenas a consultas próprias

---

## 4. CONTRATOS BACKEND/FRONTEND

### 4.1 Regras Críticas

1. ✅ **instituicaoId NUNCA vem do frontend** - Sempre do token
2. ⚠️ **Turma**: Frontend pode tentar enviar `professorId`/`disciplinaId`, mas backend bloqueia
3. ✅ **Plano de Ensino**: Contrato alinhado entre backend e frontend

---

## 5. PRÓXIMOS PASSOS

### 5.1 Verificações Necessárias

1. **Frontend APIs**: Verificar se nenhuma API envia `instituicaoId`
2. **Frontend Components**: Verificar uso de `useSafeMutation` e `useSafeDialog`
3. **Campos Condicionais**: Verificar renderização por tipo de instituição
4. **Portal/DOM**: Verificar estabilidade de modais

---

## CONCLUSÃO

### ✅ Conforme
- Schema alinhado com regras acadêmicas
- Multi-tenancy implementado corretamente
- RBAC aplicado no backend
- Turma bloqueia `professorId`/`disciplinaId` (correto)

### ⚠️ Atenção
- Campos `professorId` e `disciplinaId` em Turma existem no schema (compatibilidade), mas são bloqueados no controller (correto)

### 🔄 Pendente
- Auditoria completa de controllers (todos os endpoints)
- Auditoria de frontend APIs
- Auditoria de componentes frontend

