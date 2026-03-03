# RESUMO: RELATÓRIOS OFICIAIS (institucional)

**Data:** 2025-01-XX
**Status:** ✅ CONFORME

---

## ✅ VERIFICAÇÃO COMPLETA

### BACKEND - Endpoints Read-Only

#### 1️⃣ PAUTA - ✅ CONFORME
- **Endpoint:** `GET /relatorios/pauta/:planoEnsinoId`
- ✅ Read-only (não altera dados)
- ✅ Valida `instituicao_id` (multi-tenant)
- ✅ Valida permissões:
  - PROFESSOR: só vê seus planos de ensino
  - ADMIN/SECRETARIA: vê todos
  - ALUNO: **NÃO pode ver** (retorna 403)
- ✅ Usa `consolidarPlanoEnsino` (cálculos no backend)
- ✅ Retorna `tipoInstituicao` para frontend
- ✅ Retorna notas por avaliação
- ✅ Retorna frequência calculada
- ✅ Retorna média parcial (Superior) e média trimestral (Secundário)

**Arquivo:** `backend/src/controllers/relatorios.controller.ts` (linhas 217-276)
**Serviço:** `backend/src/services/frequencia.service.ts` - `consolidarPlanoEnsino`

---

#### 2️⃣ BOLETIM - ✅ CONFORME
- **Endpoint:** `GET /relatorios/boletim/:alunoId`
- ✅ Read-only (não altera dados)
- ✅ Valida `instituicao_id` (multi-tenant)
- ✅ Valida permissões:
  - ALUNO: só vê próprio boletim
  - ADMIN/SECRETARIA/PROFESSOR: vê todos
- ✅ Usa `calcularFrequenciaAluno` e `calcularMedia` (cálculos no backend)
- ✅ Retorna disciplinas com frequência e notas
- ✅ Retorna situação acadêmica

**Arquivo:** `backend/src/controllers/relatorios.controller.ts` (linhas 286-442)

---

#### 3️⃣ HISTÓRICO ACADÊMICO - ✅ CONFORME
- **Endpoint:** `GET /relatorios/historico/:alunoId`
- ✅ Read-only (não altera dados)
- ✅ Valida `instituicao_id` (multi-tenant)
- ✅ Valida permissões:
  - ALUNO: só vê próprio histórico
  - ADMIN/SECRETARIA/PROFESSOR: vê todos
- ✅ Usa `calcularFrequenciaAluno` e `calcularMedia` (cálculos no backend)
- ✅ Retorna histórico consolidado por ano letivo
- ✅ Retorna todas as disciplinas cursadas
- ✅ **IMUTÁVEL** (histórico não pode ser alterado)

**Arquivo:** `backend/src/controllers/relatorios.controller.ts` (linhas 453-636)

---

### FRONTEND - Componentes Read-Only

#### 1️⃣ PAUTA - ✅ CONFORME
- **Componente:** `frontend/src/components/relatorios/PautaVisualizacao.tsx`
- ✅ Read-only (sem ações de edição)
- ✅ Exibe notas por avaliação (P1, P2, P3, Trabalho, Recurso para Superior; Trimestres para Secundário)
- ✅ Exibe frequência (percentual e presenças/faltas)
- ✅ Exibe média parcial (apenas Superior)
- ✅ Exibe média final
- ✅ Exibe situação acadêmica
- ✅ Respeita tipo de instituição (Superior/Secundário)
- ✅ Ordena avaliações corretamente
- ✅ Botão de impressão (read-only)

---

#### 2️⃣ BOLETIM - ✅ CONFORME
- **Componente:** `frontend/src/components/relatorios/BoletimVisualizacao.tsx`
- ✅ Read-only (sem ações de edição)
- ✅ Exibe disciplinas com frequência e notas
- ✅ Exibe situação acadêmica
- ✅ Estatísticas gerais (Total, Aprovadas, Reprovadas, Em Curso)
- ✅ Botão de impressão (read-only)

---

#### 3️⃣ HISTÓRICO ACADÊMICO - ✅ CONFORME
- **Componente:** `frontend/src/components/relatorios/HistoricoEscolarVisualizacao.tsx`
- ✅ Read-only (sem ações de edição)
- ✅ Exibe histórico consolidado por ano letivo
- ✅ Exibe todas as disciplinas cursadas
- ✅ Exibe carga horária, frequência, média final
- ✅ Exibe situação acadêmica
- ✅ Botão de impressão (read-only)
- ✅ **IMUTÁVEL** (não permite edição)

---

## 📊 CÁLCULOS NO BACKEND

### ✅ Ensino Superior
- **Média Parcial (MP):**
  - Com Trabalho: `MP = (Média das Provas × 0.8) + (Trabalho × 0.2)`
  - Sem Trabalho: `MP = Média das Provas`
- **Média Final (MF):**
  - Com Recurso: `MF = (MP + Recurso) / 2`
  - Sem Recurso: `MF = MP`
- **Status:**
  - MP ≥ 10: APROVADO
  - 7 ≤ MP < 10: EXAME_RECURSO
  - MP < 7: REPROVADO

**Arquivo:** `backend/src/services/calculoNota.service.ts` - `calcularSuperior`

---

### ✅ Ensino Secundário
- **Média Trimestral (MT):**
  - `MT = (Avaliação Contínua + Prova Trimestral) / 2`
- **Média Anual (MA):**
  - `MA = (MT1 + MT2 + MT3) / 3`
- **Status:**
  - MA ≥ 10: APROVADO
  - MA < 10: REPROVADO

**Arquivo:** `backend/src/services/calculoNota.service.ts` - `calcularSecundario`

---

## 🔒 SEGURANÇA E PERMISSÕES

### ✅ Multi-Tenant
- Todos os endpoints validam `instituicao_id` do token
- Nunca aceita `instituicao_id` do frontend
- Filtros automáticos por instituição

### ✅ RBAC (Role-Based Access Control)
- **SUPER_ADMIN:** Pode ver todos os relatórios
- **ADMIN:** Pode ver todos os relatórios da instituição
- **SECRETARIA:** Pode ver todos os relatórios da instituição
- **PROFESSOR:** Pode ver pauta apenas dos seus planos de ensino
- **ALUNO:** Pode ver apenas próprio boletim e histórico

---

## 📋 CONFORMIDADE institucional

### ✅ Regras Atendidas
1. ✅ Relatórios são SOMENTE leitura
2. ✅ Relatórios NÃO alteram dados
3. ✅ Relatórios SEMPRE respeitam instituicao_id
4. ✅ Relatórios dependem de Plano de Ensino
5. ✅ Relatórios respeitam tipoInstituicao
6. ✅ Relatórios são auditáveis
7. ✅ Cálculos feitos no backend
8. ✅ Histórico é IMUTÁVEL

---

## 🎯 RESULTADO FINAL

### ✅ CONFORME institucional
- ✅ Relatórios oficiais confiáveis
- ✅ Compatível com institucional
- ✅ Auditável
- ✅ Seguro (multi-tenant + RBAC)
- ✅ Sem quebrar fluxos existentes
- ✅ Cálculos no backend
- ✅ Read-only (sem edição)
- ✅ UX profissional (Horizon Design System)

---

## 📝 NOTAS TÉCNICAS

### Ajustes Realizados
1. ✅ Adicionado `instituicao` no include de `consolidarPlanoEnsino` para garantir `tipoInstituicao`
2. ✅ Verificado que todos os endpoints são read-only
3. ✅ Verificado que todos os componentes frontend são read-only
4. ✅ Verificado que cálculos são feitos no backend
5. ✅ Verificado que permissões estão corretas

### Arquivos Modificados
- `backend/src/services/frequencia.service.ts` (adicionado `instituicao` no include)

### Arquivos Verificados (sem alterações necessárias)
- `backend/src/controllers/relatorios.controller.ts` ✅
- `backend/src/routes/relatorios.routes.ts` ✅
- `frontend/src/components/relatorios/PautaVisualizacao.tsx` ✅
- `frontend/src/components/relatorios/BoletimVisualizacao.tsx` ✅
- `frontend/src/components/relatorios/HistoricoEscolarVisualizacao.tsx` ✅
- `frontend/src/components/configuracaoEnsino/RelatoriosOficiaisTab.tsx` ✅

---

**Status Final:** ✅ **TOTALMENTE CONFORME COM institucional**

