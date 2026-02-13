# 🎓 CONSOLIDAÇÃO FINAL: Ano Letivo como Eixo Central Absoluto

**Data**: Janeiro 2025  
**Status**: 🔄 **EM CONSOLIDAÇÃO**  
**Objetivo**: Garantir que TODAS as operações acadêmicas dependem de um Ano Letivo ATIVO

---

## 📊 ANÁLISE COMPLETA DO SCHEMA

### ✅ ENTIDADES COM `anoLetivoId` OBRIGATÓRIO (CORRETAS)

1. ✅ **MatriculaAnual** - `anoLetivoId String` (obrigatório)
2. ✅ **PlanoEnsino** - `anoLetivoId String` (obrigatório)
3. ✅ **Semestre** - `anoLetivoId String` (obrigatório)
4. ✅ **Trimestre** - `anoLetivoId String` (obrigatório)

### ❌ ENTIDADES CRÍTICAS SEM `anoLetivoId` OBRIGATÓRIO

1. ❌ **Turma** - **CRÍTICO**: Não tem `anoLetivoId`
   - **Problema**: Turmas são contextuais a um ano letivo específico
   - **Impacto**: Turma pode ser criada sem contexto de ano letivo
   - **Solução**: Adicionar `anoLetivoId String` obrigatório

2. ❌ **Matricula** (simples, não MatriculaAnual) - **MÉDIO**
   - **Status**: Tem apenas `anoLetivo Int?` (opcional, número)
   - **Problema**: Não tem FK para AnoLetivo
   - **Análise**: MatriculaAnual já cobre a necessidade principal, mas Matricula simples pode ser usada em alguns fluxos
   - **Solução**: Adicionar `anoLetivoId String?` (opcional, mas validar se usado)

### ⚠️ ENTIDADES COM RELAÇÃO INDIRETA (ACEITÁVEL)

1. ⚠️ **AlunoDisciplina** - Conecta através de `semestreId`/`trimestreId` → Semestre/Trimestre → AnoLetivo
   - **Status**: OK (relação indireta válida)

2. ⚠️ **AulaLancada** - Conecta através de `semestreId`/`trimestreId` → Semestre/Trimestre → AnoLetivo
   - **Status**: OK (relação indireta válida)
   - **Validação**: Controller já valida ano letivo ativo através do PlanoEnsino

3. ⚠️ **Avaliacao** - Conecta através de `semestreId`/`trimestreId` → Semestre/Trimestre → AnoLetivo
   - **Status**: OK (relação indireta válida)
   - **Validação**: Controller já valida ano letivo ativo através do PlanoEnsino

4. ⚠️ **Nota** - Conecta através de Avaliacao → PlanoEnsino → AnoLetivo
   - **Status**: OK (relação indireta válida)
   - **Validação**: Controller já valida ano letivo ativo

5. ⚠️ **Presenca** - Conecta através de AulaLancada → PlanoAula → PlanoEnsino → AnoLetivo
   - **Status**: OK (relação indireta válida)
   - **Validação**: Controller já valida ano letivo ativo

### ✅ ENTIDADES NÃO-ACADÊMICAS (CORRETAS)

1. ✅ **BibliotecaItem** - Não precisa de `anoLetivoId` (recurso institucional)
2. ✅ **EmprestimoBiblioteca** - Não precisa de `anoLetivoId` (não contextual a ano letivo)

---

## 🔴 PROBLEMAS CRÍTICOS IDENTIFICADOS

### 1. TURMA SEM `anoLetivoId` OBRIGATÓRIO

**Arquivo**: `backend/prisma/schema.prisma` (linha 549)

**Problema**:
```prisma
model Turma {
  id            String   @id @default(uuid())
  nome          String
  ano           Int  // ❌ Apenas número, não FK
  // ❌ FALTA: anoLetivoId String @map("ano_letivo_id")
  // ...
}
```

**Impacto**:
- Turmas podem ser criadas sem vínculo com Ano Letivo
- Não há garantia de integridade referencial
- Filtros por ano letivo são menos eficientes

**Solução**:
```prisma
model Turma {
  id            String   @id @default(uuid())
  nome          String
  ano           Int  // Mantido para compatibilidade
  anoLetivoId   String   @map("ano_letivo_id") // ✅ OBRIGATÓRIO: FK para AnoLetivo
  // ...
  anoLetivoRef  AnoLetivo @relation(fields: [anoLetivoId], references: [id], onDelete: Cascade)
  
  @@index([anoLetivoId])
}
```

**Mudanças necessárias**:
1. Schema Prisma
2. Controller `turma.controller.ts` - validar ano letivo ativo
3. Rotas - adicionar `requireActiveAnoLetivo` middleware
4. Frontend `TurmasTab.tsx` - adicionar Select de Ano Letivo

---

## ✅ VALIDAÇÕES BACKEND JÁ IMPLEMENTADAS

### Controllers com Validação de Ano Letivo Ativo:

1. ✅ **MatriculaAnual** - `validarAnoLetivoIdAtivo`
2. ✅ **PlanoEnsino** - `validarAnoLetivoIdAtivo`
3. ✅ **Semestre** - Busca e valida ano letivo (mas precisa melhorar para usar anoLetivoId quando fornecido)
4. ✅ **Trimestre** - Busca e valida ano letivo (mas precisa melhorar para usar anoLetivoId quando fornecido)
5. ✅ **AulasLancadas** - Valida através do PlanoEnsino
6. ✅ **Presenca** - Valida através do PlanoEnsino
7. ✅ **Avaliacao** - Valida através do PlanoEnsino
8. ✅ **Nota** - Valida através do PlanoEnsino

### Middlewares Aplicados:

✅ `requireActiveAnoLetivo` aplicado em:
- `/plano-ensino` (POST, PUT)
- `/matriculas-anuais` (POST)
- `/aulas-lancadas` (POST)
- `/avaliacoes` (POST, PUT)
- `/presencas` (POST)
- `/notas` (POST, PUT)

---

## ⚠️ PROBLEMAS FRONTEND IDENTIFICADOS

### Componentes com Input manual de ano letivo (PRECISAM SER CORRIGIDOS):

1. ❌ **AvaliacoesTab** - Input type="number" (linha 403)
2. ❌ **AvaliacoesNotasTab** - Input type="number" (linha 457)
3. ❌ **LancamentoNotasTab** - Input type="number" (linha 326)
4. ❌ **EncerramentosAcademicosTab** - Input type="number" (linha 235)
5. ⚠️ **TurmasTab** - Verificar se tem Select ou Input

### Componentes Corrigidos:

1. ✅ **MatriculasAnuaisTab** - Select com API
2. ✅ **RelatoriosOficiaisTab** - Select com API
3. ✅ **DistribuicaoAulasTab** - Select com API
4. ✅ **ControlePresencasTab** - Select com API
5. ✅ **SemestresTab** - Select com API
6. ✅ **TrimestresTab** - Select com API
7. ✅ **PlanoEnsino** - Select com API

### Guards Aplicados:

1. ✅ **PlanoEnsino** - `AnoLetivoAtivoGuard`
2. ✅ **MatriculasAnuaisTab** - `AnoLetivoAtivoGuard`
3. ✅ **RelatoriosOficiaisTab** - `AnoLetivoAtivoGuard`
4. ⚠️ **ControlePresencasTab** - Query adicionada, mas guard ainda não aplicado no return
5. ❌ **TurmasTab** - Não tem guard
6. ❌ **AvaliacoesTab** - Não tem guard
7. ❌ **AvaliacoesNotasTab** - Não tem guard
8. ❌ **LancamentoNotasTab** - Não tem guard

---

## 🎯 PLANO DE AÇÃO PRIORITÁRIO

### FASE 1: SCHEMA E BACKEND (CRÍTICO)

1. ✅ Adicionar `anoLetivoId` obrigatório ao model `Turma`
2. ✅ Atualizar controller de Turma para validar ano letivo ativo
3. ✅ Aplicar middleware `requireActiveAnoLetivo` nas rotas de Turma
4. ✅ Criar migration para adicionar coluna `ano_letivo_id` em `turmas`

### FASE 2: FRONTEND - CORREÇÕES CRÍTICAS

1. ✅ Corrigir **AvaliacoesTab** - Substituir Input por Select com API
2. ✅ Corrigir **AvaliacoesNotasTab** - Substituir Input por Select com API
3. ✅ Corrigir **LancamentoNotasTab** - Substituir Input por Select com API
4. ✅ Adicionar `AnoLetivoAtivoGuard` em todos os componentes acima
5. ✅ Corrigir **TurmasTab** - Adicionar Select de Ano Letivo da API

### FASE 3: VALIDAÇÕES E TESTES

1. ✅ Testar criação de Turma sem ano letivo → DEVE BLOQUEAR
2. ✅ Testar criação com ano letivo ENCERRADO → DEVE BLOQUEAR
3. ✅ Testar criação com ano letivo ATIVO → DEVE PERMITIR
4. ✅ Validar que todas as queries filtram por `instituicaoId`

---

## 📝 OBSERVAÇÕES IMPORTANTES

### Matricula (simples) vs MatriculaAnual

- **MatriculaAnual**: Já tem `anoLetivoId` obrigatório ✅
- **Matricula**: Usada para vínculo Aluno ↔ Turma específica
- **Decisão**: `Matricula` pode ficar sem `anoLetivoId` obrigatório, mas deve derivar do `Turma.anoLetivoId` ou `MatriculaAnual.anoLetivoId`
- **Validação**: Controller de Matricula deve validar que a Turma pertence a um ano letivo ativo

### Biblioteca

- **BibliotecaItem**: Não precisa de `anoLetivoId` (recurso institucional, não contextual)
- **EmprestimoBiblioteca**: Não precisa de `anoLetivoId` (não contextual a ano letivo)
- **Status**: ✅ CORRETO como está

---

## ✅ CHECKLIST DE CONCLUSÃO

### Backend
- [ ] Turma tem `anoLetivoId` obrigatório no schema
- [ ] Controller de Turma valida ano letivo ativo
- [ ] Rotas de Turma têm middleware `requireActiveAnoLetivo`
- [ ] Migration criada e aplicada
- [ ] Todos os controllers validam ano letivo ativo
- [ ] Queries sempre filtram por `instituicaoId`

### Frontend
- [ ] Todos os componentes usam Select (não Input) para ano letivo
- [ ] Todos os Selects carregam da API (`anoLetivoApi.getAll()`)
- [ ] Todos mostram status do ano letivo (🟢 Ativo, 🔴 Encerrado, 🟡 Planejado)
- [ ] `AnoLetivoAtivoGuard` aplicado em todas as telas acadêmicas
- [ ] Mensagens claras quando não há ano letivo ativo
- [ ] Botões desabilitados quando necessário

### Testes
- [ ] Criar sem ano letivo → BLOQUEAR ✅
- [ ] Criar com ano ENCERRADO → BLOQUEAR ✅
- [ ] Criar com ano ATIVO → PERMITIR ✅
- [ ] Encerrar ano letivo → BLOQUEAR operações ✅

---

**Última atualização**: Janeiro 2025

