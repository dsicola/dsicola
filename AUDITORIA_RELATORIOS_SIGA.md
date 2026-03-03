# AUDITORIA: RELATÓRIOS OFICIAIS (institucional)

**Data:** 2025-01-XX
**Objetivo:** Verificar e ajustar relatórios oficiais conforme padrão institucional

---

## 📋 VERIFICAÇÃO SISTEMÁTICA

### ✅ BACKEND - Endpoints

#### 1️⃣ PAUTA - Status: ✅ CONFORME

**Endpoint:** `GET /relatorios/pauta/:planoEnsinoId`

**Verificação:**
- ✅ Read-only (não altera dados)
- ✅ Valida `instituicao_id` (multi-tenant)
- ✅ Valida permissões (PROFESSOR só vê seus planos, ALUNO não pode ver)
- ✅ Usa `consolidarPlanoEnsino` (cálculos no backend)
- ✅ Retorna `tipoInstituicao` para frontend
- ✅ Retorna notas por avaliação
- ✅ Retorna frequência calculada

**Arquivo:** `backend/src/controllers/relatorios.controller.ts` (linhas 217-276)

**Serviço:** `backend/src/services/frequencia.service.ts` - `consolidarPlanoEnsino`

**Status:** ✅ CONFORME - Apenas ajustes de UX necessários

---

#### 2️⃣ BOLETIM - Status: ✅ CONFORME

**Endpoint:** `GET /relatorios/boletim/:alunoId`

**Verificação:**
- ✅ Read-only (não altera dados)
- ✅ Valida `instituicao_id` (multi-tenant)
- ✅ Valida permissões (ALUNO só vê próprio, ADMIN/SECRETARIA vê todos)
- ✅ Usa `calcularFrequenciaAluno` e `calcularMedia` (cálculos no backend)
- ✅ Retorna disciplinas com frequência e notas
- ✅ Retorna situação acadêmica

**Arquivo:** `backend/src/controllers/relatorios.controller.ts` (linhas 286-442)

**Status:** ✅ CONFORME - Apenas ajustes de UX necessários

---

#### 3️⃣ HISTÓRICO ACADÊMICO - Status: ✅ CONFORME

**Endpoint:** `GET /relatorios/historico/:alunoId`

**Verificação:**
- ✅ Read-only (não altera dados)
- ✅ Valida `instituicao_id` (multi-tenant)
- ✅ Valida permissões (ALUNO só vê próprio, ADMIN/SECRETARIA vê todos)
- ✅ Usa `calcularFrequenciaAluno` e `calcularMedia` (cálculos no backend)
- ✅ Retorna histórico consolidado por ano letivo
- ✅ Retorna todas as disciplinas cursadas

**Arquivo:** `backend/src/controllers/relatorios.controller.ts` (linhas 453-636)

**Status:** ✅ CONFORME - Apenas ajustes de UX necessários

---

### ⚠️ FRONTEND - Componentes

#### 1️⃣ PAUTA - Status: ⚠️ PRECISA AJUSTES

**Componente:** `frontend/src/components/relatorios/PautaVisualizacao.tsx`

**Pontos Positivos:**
- ✅ Read-only (sem ações de edição)
- ✅ Exibe notas por avaliação
- ✅ Exibe frequência
- ✅ Exibe média final
- ✅ Respeita tipo de instituição (Superior/Secundário)
- ✅ Ordena avaliações corretamente

**Pontos que Precisam Ajuste:**
- ⚠️ Média Parcial: Exibida apenas para Superior (correto), mas precisa verificar se cálculo está correto
- ⚠️ Trimestre: Exibido para Secundário (correto), mas precisa verificar ordenação
- ⚠️ UX: Pode melhorar organização visual (institucional padrão)

**Status:** ⚠️ PARCIALMENTE CONFORME - Ajustes de UX necessários

---

#### 2️⃣ BOLETIM - Status: ✅ CONFORME

**Componente:** `frontend/src/components/relatorios/BoletimVisualizacao.tsx`

**Pontos Positivos:**
- ✅ Read-only (sem ações de edição)
- ✅ Exibe disciplinas com frequência e notas
- ✅ Exibe situação acadêmica
- ✅ Estatísticas gerais
- ✅ Botão de impressão

**Status:** ✅ CONFORME - Apenas melhorias de UX opcionais

---

#### 3️⃣ HISTÓRICO ACADÊMICO - Status: ✅ CONFORME

**Componente:** `frontend/src/components/relatorios/HistoricoEscolarVisualizacao.tsx`

**Pontos Positivos:**
- ✅ Read-only (sem ações de edição)
- ✅ Exibe histórico consolidado por ano letivo
- ✅ Exibe todas as disciplinas cursadas
- ✅ Exibe carga horária, frequência, média final
- ✅ Botão de impressão

**Status:** ✅ CONFORME - Apenas melhorias de UX opcionais

---

## 🎯 AJUSTES NECESSÁRIOS

### P0 - CRÍTICO

1. **Verificar cálculos de média parcial (Superior)**
   - Verificar se `media_parcial` está sendo calculada corretamente
   - Verificar se está sendo exibida na pauta

2. **Verificar ordenação de avaliações (Secundário)**
   - Verificar se trimestres estão ordenados corretamente
   - Verificar se avaliações dentro do trimestre estão ordenadas

### P1 - ALTO

1. **Melhorar UX da Pauta (padrão institucional)**
   - Organizar visualmente (colunas mais claras)
   - Melhorar legibilidade
   - Adicionar informações contextuais (turma, professor, etc.)

2. **Garantir que todos os relatórios são read-only**
   - Verificar se não há ações de edição visíveis
   - Verificar se não há botões de edição

---

## 📊 RESUMO

### ✅ CONFORME
1. ✅ Backend - Todos os endpoints read-only
2. ✅ Backend - Validações multi-tenant corretas
3. ✅ Backend - Permissões corretas
4. ✅ Backend - Cálculos no backend
5. ✅ Frontend - Boletim e Histórico read-only

### ⚠️ PRECISA AJUSTE
1. ⚠️ Frontend - Pauta (melhorias de UX)
2. ⚠️ Verificar cálculos de média parcial (Superior)

---

**Próximos Passos:**
1. Verificar cálculos de média parcial
2. Melhorar UX da Pauta
3. Garantir que todos os relatórios são read-only

