# AUDITORIA COMPLETA: CICLO DE NOTAS

**Data:** 2025-01-XX
**Objetivo:** Garantir rastreabilidade completa, conformidade institucional e imutabilidade do histórico

---

## 📋 STATUS ATUAL

### ✅ CONFORME

1. **Modelo de Dados**
   - ✅ `Nota` com campo `valor` (valor atual)
   - ✅ `NotaHistorico` implementado (imutável)
   - ✅ Relação `Nota.historico` → `NotaHistorico[]`
   - ✅ Campos obrigatórios: `valorAnterior`, `valorNovo`, `motivo`, `corrigidoPor`

2. **Backend - Proteções**
   - ✅ DELETE bloqueado (retorna 403)
   - ✅ `updateNota` bloqueia mudança de valor (força usar corrigir)
   - ✅ `corrigirNota` cria histórico obrigatório
   - ✅ `getHistoricoNota` implementado
   - ✅ Auditoria via `AuditService`

3. **Permissões**
   - ✅ PROFESSOR: pode corrigir apenas notas de seus planos
   - ✅ ADMIN: pode corrigir com justificativa obrigatória
   - ✅ SECRETARIA: NÃO pode corrigir (apenas consulta)
   - ✅ ALUNO: apenas visualiza

4. **Frontend - API**
   - ✅ `notasApi.corrigir()` implementado
   - ✅ `notasApi.getHistorico()` implementado
   - ✅ `notasApi.update()` documentado (não permite valor)

---

### ⚠️ PROBLEMAS IDENTIFICADOS

1. **Frontend - Uso incorreto de `update`**
   - ❌ `GestaoNotas.tsx` linha 342: usa `notasApi.update` com `valor`
   - ❌ Isso vai falhar no backend (update bloqueia mudança de valor)
   - ⚠️ Precisa usar `corrigir()` com motivo obrigatório

2. **Frontend - UI de Histórico**
   - ⚠️ Não há componente visual para exibir histórico de correções
   - ⚠️ Não há UI para correção com motivo obrigatório

---

## 🔧 CORREÇÕES NECESSÁRIAS

### P0 - CRÍTICO

1. **Corrigir `GestaoNotas.tsx`**
   - Substituir `notasApi.update` por `notasApi.corrigir`
   - Adicionar dialog para solicitar motivo
   - Validar motivo obrigatório

2. **Criar componente de Histórico de Notas**
   - Exibir linha do tempo de correções
   - Mostrar: valor anterior → valor novo, motivo, quem, quando

3. **Criar componente de Correção de Nota**
   - Dialog com campo de motivo obrigatório
   - Validação de motivo (mínimo de caracteres)
   - Feedback visual claro

---

## 📊 ANÁLISE DETALHADA

### Backend - Endpoints

| Endpoint | Método | Permissões | Comportamento | Status |
|----------|--------|------------|---------------|--------|
| `/notas` | GET | ADMIN, SECRETARIA, PROFESSOR, SUPER_ADMIN | Lista notas | ✅ |
| `/notas/:id` | GET | Todos autenticados | Busca nota | ✅ |
| `/notas` | POST | ADMIN, PROFESSOR, SUPER_ADMIN | Cria nota | ✅ |
| `/notas/:id` | PUT | ADMIN, PROFESSOR, SUPER_ADMIN | Atualiza apenas observações (bloqueia valor) | ✅ |
| `/notas/:id/corrigir` | PUT | ADMIN, PROFESSOR, SUPER_ADMIN | Corrige nota (cria histórico) | ✅ |
| `/notas/:id/historico` | GET | ADMIN, SECRETARIA, PROFESSOR, ALUNO, SUPER_ADMIN | Busca histórico | ✅ |
| `/notas/:id` | DELETE | ADMIN, SUPER_ADMIN | Bloqueado (403) | ✅ |

### Validações Implementadas

1. ✅ Mudança de valor via `update` → Bloqueado
2. ✅ Correção sem motivo → Bloqueado
3. ✅ Professor corrigindo nota de outro plano → Bloqueado
4. ✅ Correção de período encerrado (sem ADMIN) → Bloqueado
5. ✅ Correção de período encerrado (ADMIN) → Exige justificativa detalhada (20+ caracteres)

---

## 🎯 PLANO DE CORREÇÃO

### 1. Corrigir Frontend - GestaoNotas.tsx

**Problema:** Usa `update` com valor (vai falhar)

**Solução:**
- Detectar mudança de valor
- Abrir dialog de correção
- Solicitar motivo obrigatório
- Usar `corrigir()` em vez de `update()`

### 2. Criar Componente de Histórico

**Arquivo:** `frontend/src/components/notas/HistoricoNotaDialog.tsx`

**Funcionalidades:**
- Exibir linha do tempo
- Mostrar valor anterior → valor novo
- Exibir motivo, usuário, data/hora
- Design profissional (institucional)

### 3. Criar Componente de Correção

**Arquivo:** `frontend/src/components/notas/CorrigirNotaDialog.tsx`

**Funcionalidades:**
- Campo de valor (editável)
- Campo de motivo (obrigatório, validação)
- Campo de observações (opcional)
- Validação de motivo (mínimo caracteres)
- Feedback visual

---

## ✅ RESULTADO ESPERADO

- ✅ Zero perda de histórico
- ✅ Correções totalmente rastreáveis
- ✅ Conformidade institucional
- ✅ Segurança jurídica
- ✅ UI profissional e clara

---

**Próximos Passos:**
1. Corrigir `GestaoNotas.tsx`
2. Criar componentes de histórico e correção
3. Integrar em todos os lugares que editam notas
