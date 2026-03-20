# Verificação: Fluxo Acadêmico — Guia PDF vs Implementação

**Data:** 2026-03-13  
**Documento verificado:** fluxo_academico_dsicola_guia.pdf

---

## Resumo

Foi encontrada **1 discrepância** entre o guia PDF e a implementação. A documentação foi corrigida.

---

## Verificação por passo

| Passo | Guia PDF | Implementação | Status |
|-------|----------|---------------|--------|
| **1. Atribuição de Disciplinas** | Gestão Acadêmica → Atribuição de Disciplinas | **Gestão de Professores** → Atribuição de Disciplinas | ❌ Corrigido |
| **2. Plano de Ensino** | Configuração de Ensinos → Plano de Ensino | Configuração de Ensinos → Plano de Ensino | ✅ |
| **3. Horários** | Gestão Acadêmica → Horários | Gestão Acadêmica → Horários | ✅ |
| **4. Distribuição de Aulas** | Configuração de Ensinos → Distribuição de Aulas | Configuração de Ensinos → Distribuição de Aulas | ✅ |
| **5. Lançamento de Aulas** | Configuração de Ensinos → Lançamento de Aulas | Configuração de Ensinos → Lançamento de Aulas | ✅ |
| **6. Presenças** | Configuração de Ensinos → Controle de Presenças | Configuração de Ensinos → Controle de Presenças | ✅ |
| **7. Avaliações e notas (disciplina)** | Configuração de Ensinos → Avaliações e notas (disciplina) | Configuração de Ensinos → Avaliações e notas (disciplina) | ✅ |

---

## Discrepância encontrada e correção

**Problema:** O guia indicava "Gestão Acadêmica → Atribuição de Disciplinas", mas na implementação a Atribuição de Disciplinas está em **Gestão de Professores** (aba "Atribuição de Disciplinas").

**Caminho correto:** Menu lateral → **Gestão de Professores** → aba **Atribuição de Disciplinas**

**Ficheiros corrigidos:**
- `docs/FLUXO_ACADEMICO_COMPLETO_PASSO_A_PASSO.md`
- `frontend/src/utils/systemManualGenerator.ts` (manual PDF)

---

## Rotas e componentes verificados

| Funcionalidade | Rota | Componente |
|----------------|------|------------|
| Gestão de Professores (com Atribuição) | `/admin-dashboard/gestao-professores` | GestaoProfessores.tsx → AtribuicaoDisciplinasTab |
| Gestão Acadêmica (com Horários) | `/admin-dashboard/gestao-academica?tab=horarios` | GestaoAcademica.tsx → HorariosTab |
| Configuração de Ensinos | `/admin-dashboard/configuracao-ensino` | ConfiguracaoEnsino.tsx (…, **Avaliações e notas (disciplina)**, …) |

---

## Conclusão

Após a correção, o guia está **100% alinhado** com a implementação. O PDF deve ser regenerado a partir do manual do sistema ou do documento `FLUXO_ACADEMICO_COMPLETO_PASSO_A_PASSO.md` atualizado para refletir a localização correta da Atribuição de Disciplinas.
