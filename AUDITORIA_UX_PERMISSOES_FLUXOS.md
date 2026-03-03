# AUDITORIA: UX, PERMISSÕES E FLUXOS

**Data:** 2025-01-XX
**Objetivo:** Verificar e ajustar UX, permissões e fluxos conforme padrão institucional

---

## 📋 ÁREAS DE AUDITORIA

1. **Campos Condicionais (UX)**
2. **Permissões Backend (RBAC)**
3. **Regras Financeiras (Fluxos)**

---

## 1️⃣ CAMPOS CONDICIONAIS (UX)

### ✅ Turma - Status: CONFORME

**Verificação:**
- ✅ Ensino Superior: Exibe campo "Semestre" (1 ou 2)
- ✅ Ensino Secundário: Exibe campo "Classe" (string) e "Classe (Ano)" (select)
- ✅ Validação condicional implementada
- ✅ Payload condicional correto

**Arquivo:** `frontend/src/components/admin/TurmasTab.tsx`
- Linhas 416-430: Validação condicional
- Linhas 443-444: Payload condicional
- Linhas 738-800: Renderização condicional no formulário

**Ação:** ✅ Nenhuma ação necessária

---

### ✅ Avaliação - Status: CONFORME

**Verificação:**
- ✅ Ensino Superior: Exige `semestreId`, não envia `trimestre`
- ✅ Ensino Secundário: Exige `trimestreId`, não envia `semestre`
- ✅ Validação condicional implementada
- ✅ Payload condicional correto

**Arquivos:**
- `frontend/src/components/configuracaoEnsino/AvaliacoesNotasTab.tsx`
  - Linhas 261-279: Lógica condicional no payload
  - Linhas 217-242: Busca condicional de semestres/trimestres
- `frontend/src/components/admin/AvaliacoesTab.tsx`
  - Linhas 370-390: Lógica condicional no payload

**Ação:** ✅ Nenhuma ação necessária

---

## 2️⃣ PERMISSÕES BACKEND (RBAC)

### ⚠️ Rotas Críticas - Status: PARCIALMENTE CONFORME

#### ✅ Rotas Acadêmicas - Status: CONFORME

**Curso (`/cursos`):**
- ✅ GET `/` - Público (consulta)
- ✅ GET `/:id` - Público (consulta)
- ✅ POST `/` - `authorize('ADMIN')` ✅
- ✅ PUT `/:id` - `authorize('ADMIN')` ✅
- ✅ DELETE `/:id` - `authorize('ADMIN')` ✅

**Disciplina (`/disciplinas`):**
- ✅ GET `/` - Público (consulta)
- ✅ GET `/:id` - Público (consulta)
- ✅ POST `/` - `authorize('ADMIN')` ✅
- ✅ PUT `/:id` - `authorize('ADMIN')` ✅
- ✅ DELETE `/:id` - `authorize('ADMIN')` ✅

**Turma (`/turmas`):**
- ✅ GET `/professor` - `authorize('PROFESSOR')` ✅
- ✅ GET `/` - Público (consulta)
- ✅ GET `/:id` - Público (consulta)
- ✅ POST `/` - `authorize('ADMIN')` ✅
- ✅ PUT `/:id` - `authorize('ADMIN')` ✅
- ✅ DELETE `/:id` - `authorize('ADMIN')` ✅

**Avaliação (`/avaliacoes`):**
- ✅ POST `/` - `authorize('ADMIN', 'PROFESSOR', 'SUPER_ADMIN')` ✅
- ✅ GET `/` - `authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'SUPER_ADMIN')` ✅
- ✅ GET `/:id` - `authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'SUPER_ADMIN')` ✅
- ✅ PUT `/:id` - `authorize('ADMIN', 'PROFESSOR', 'SUPER_ADMIN')` ✅
- ✅ POST `/:id/fechar` - `authorize('ADMIN', 'SUPER_ADMIN')` ✅
- ✅ DELETE `/:id` - `authorize('ADMIN', 'SUPER_ADMIN')` ✅

**Matrícula (`/matriculas`):**
- ✅ GET `/` - `authorize('ADMIN', 'SECRETARIA', 'PROFESSOR', 'SUPER_ADMIN')` ✅
- ✅ GET `/aluno` - `authorize('ALUNO')` ✅
- ✅ GET `/professor/turma/:turmaId/alunos` - `authorize('PROFESSOR')` ✅
- ✅ POST `/` - `authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN')` ✅
- ✅ PUT `/:id` - `authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN')` ✅
- ✅ DELETE `/:id` - `authorize('ADMIN', 'SUPER_ADMIN')` ✅

---

#### ⚠️ Rotas Financeiras - Status: PRECISA VERIFICAÇÃO

**Mensalidade (`/mensalidades`):**
- ✅ GET `/` - `authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN', 'POS')` ✅
- ✅ GET `/aluno` - `authorize('ALUNO')` ✅
- ✅ POST `/` - `authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN')` ✅
- ✅ POST `/lote` - `authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN')` ✅
- ✅ POST `/gerar` - `authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN')` ✅
- ✅ POST `/aplicar-multas` - `authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN')` ✅
- ⚠️ PUT `/:id` - `authorize('ADMIN', 'SUPER_ADMIN', 'POS')` - **SECRETARIA removida? Verificar se é intencional**
- ⚠️ POST `/:id/pagamento` - `authorize('ADMIN', 'SUPER_ADMIN', 'POS')` - **SECRETARIA removida? Verificar se é intencional**
- ✅ DELETE `/:id` - `authorize('ADMIN', 'SUPER_ADMIN')` ✅

**Pagamento (`/pagamentos`):**
- ✅ GET `/` - `authorize('ADMIN', 'SECRETARIA', 'POS', 'SUPER_ADMIN')` ✅
- ✅ GET `/:id` - `authorize('ADMIN', 'SECRETARIA', 'POS', 'SUPER_ADMIN')` ✅
- ✅ GET `/mensalidade/:mensalidadeId` - `authorize('ADMIN', 'SECRETARIA', 'POS', 'SUPER_ADMIN', 'ALUNO')` ✅
- ✅ POST `/mensalidade/:mensalidadeId/registrar` - `authorize('ADMIN', 'POS', 'SUPER_ADMIN')` - **SECRETARIA não pode registrar? Verificar**
- ⚠️ DELETE `/:id` - `authorize('ADMIN', 'SUPER_ADMIN')` - **Verificar: Pagamentos devem ser imutáveis (apenas estorno)**

**Bolsa (`/bolsas`):**
- ⚠️ GET `/` - `authenticate` apenas - **Precisa verificar se todos podem consultar**
- ⚠️ GET `/:id` - `authenticate` apenas - **Precisa verificar se todos podem consultar**
- ✅ POST `/` - `authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN')` ✅
- ✅ PUT `/:id` - `authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN')` ✅
- ✅ DELETE `/:id` - `authorize('ADMIN', 'SUPER_ADMIN')` ✅

**Configuração Multa (`/configuracao-multa`):**
- ⚠️ GET `/` - `authenticate` apenas - **Precisa verificar se todos podem consultar**
- ⚠️ PUT `/` - Sem `authorize` explícito - **Precisa verificar se apenas ADMIN pode configurar**

---

## 3️⃣ REGRAS FINANCEIRAS (FLUXOS)

### ⚠️ Bolsas - Status: PRECISA VERIFICAÇÃO

**Regras Esperadas:**
- ✅ Percentual ou valor fixo
- ✅ Aplicadas sobre propinas
- ✅ Regras claras de elegibilidade
- ⚠️ **Verificar:** Regras de elegibilidade implementadas?
- ⚠️ **Verificar:** Validação de aplicação de bolsas?

**Ação Necessária:**
- Verificar controller de bolsas
- Verificar regras de elegibilidade
- Verificar validação de aplicação

---

### ⚠️ Multas - Status: PRECISA VERIFICAÇÃO

**Regras Esperadas:**
- ✅ Atraso configurável
- ✅ Juros configuráveis
- ✅ **NUNCA automáticas sem regra explícita**
- ⚠️ **Verificar:** Multas são aplicadas automaticamente?
- ⚠️ **Verificar:** Existe confirmação antes de aplicar multas?

**Ação Necessária:**
- Verificar controller de multas
- Verificar se multas são aplicadas automaticamente ou manualmente
- Verificar se existe confirmação antes de aplicar

---

### ⚠️ Pagamentos - Status: PRECISA VERIFICAÇÃO

**Regras Esperadas:**
- ✅ Associados à matrícula
- ✅ Histórico imutável
- ✅ **NUNCA deletar, apenas estornar**
- ⚠️ **Verificar:** DELETE `/pagamentos/:id` existe - **PROBLEMA POTENCIAL**
- ⚠️ **Verificar:** Existe endpoint de estorno?

**Ação Necessária:**
- Verificar se DELETE está bloqueado ou se deve ser removido
- Verificar se existe endpoint de estorno
- Verificar se histórico é realmente imutável

---

## 📊 RESUMO DA AUDITORIA

### ✅ CONFORME
1. ✅ Campos condicionais (Turma e Avaliação)
2. ✅ Rotas acadêmicas (proteções corretas)

### ⚠️ PRECISA AJUSTE
1. ⚠️ Rotas financeiras (algumas inconsistências)
2. ⚠️ Regras de bolsas (verificar elegibilidade)
3. ⚠️ Regras de multas (verificar se nunca automáticas)
4. ⚠️ Regras de pagamentos (verificar imutabilidade e estorno)

---

## 🎯 AÇÕES PRIORITÁRIAS

### P0 - CRÍTICO
1. ⚠️ Verificar DELETE de pagamentos (deve ser estorno, não delete)
2. ⚠️ Verificar permissões de SECRETARIA em rotas financeiras

### P1 - ALTO
1. ⚠️ Verificar regras de elegibilidade de bolsas
2. ⚠️ Verificar se multas são aplicadas automaticamente
3. ⚠️ Verificar endpoint de estorno de pagamentos

---

**Próximos Passos:**
1. Verificar controllers financeiros
2. Ajustar permissões se necessário
3. Implementar/verificar regras de negócio

