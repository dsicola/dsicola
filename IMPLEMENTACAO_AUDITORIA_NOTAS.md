# IMPLEMENTAÇÃO: AUDITORIA COMPLETA DE NOTAS

**Data:** 2025-01-XX
**Status:** ✅ Implementado conforme padrão SIGA/SIGAE

---

## 📋 RESUMO DA IMPLEMENTAÇÃO

### ✅ CORREÇÕES CRÍTICAS IMPLEMENTADAS

1. **Bloqueio de mudança de valor em `updateNota`**
   - ✅ `updateNota` agora BLOQUEIA mudança de valor
   - ✅ Força uso de `corrigirNota` para mudanças de valor
   - ✅ `updateNota` apenas para atualizar `observacoes` (sem mudança de valor)
   - ✅ Arquivo: `backend/src/controllers/nota.controller.ts`

2. **API Frontend atualizada**
   - ✅ Método `corrigir()` adicionado
   - ✅ Método `getHistorico()` adicionado
   - ✅ Método `update()` atualizado (não aceita `valor`)
   - ✅ Método `delete()` mantido (deprecated - retorna 403)
   - ✅ Arquivo: `frontend/src/services/api.ts`

---

## ✅ SISTEMA JÁ CONFORME

### Modelo de Dados
- ✅ `Nota` com campo `valor` (valor atual)
- ✅ `NotaHistorico` completo:
  - `valorAnterior`
  - `valorNovo`
  - `motivo` (obrigatório)
  - `corrigidoPor`
  - `createdAt`
- ✅ Relação `Nota.historico` → `NotaHistorico[]`

### Backend
- ✅ DELETE bloqueado (`deleteNota` retorna 403)
- ✅ Função `corrigirNota` implementada:
  - Exige motivo obrigatório
  - Cria histórico antes de atualizar
  - Valida permissões (PROFESSOR só do próprio plano)
  - Log de auditoria completo
- ✅ Função `getHistoricoNota` implementada:
  - Retorna histórico completo ordenado
  - Inclui dados do usuário que corrigiu
- ✅ Rotas configuradas:
  - `PUT /notas/:id/corrigir` - Correção oficial
  - `GET /notas/:id/historico` - Histórico completo
  - `PUT /notas/:id` - Apenas observações (valor bloqueado)
  - `DELETE /notas/:id` - Bloqueado (403)

### Permissões
- ✅ PROFESSOR: Pode corrigir notas do próprio plano de ensino
- ✅ ADMIN: Pode corrigir qualquer nota
- ✅ SECRETARIA: NÃO pode corrigir (apenas consulta)
- ✅ ALUNO: Apenas visualiza

---

## 🔄 MUDANÇAS DE COMPORTAMENTO

### Antes
- ❌ `updateNota` permitia mudança de valor sem motivo obrigatório
- ❌ Histórico criado com motivo opcional ("método legado")
- ❌ Frontend não tinha métodos de correção e histórico

### Depois
- ✅ `updateNota` BLOQUEIA mudança de valor
- ✅ Mudança de valor DEVE usar `corrigirNota` (motivo obrigatório)
- ✅ Frontend tem métodos `corrigir()` e `getHistorico()`
- ✅ Histórico sempre com motivo obrigatório

---

## 📊 CONFORMIDADE SIGA/SIGAE

### ✅ CONFORME
1. ✅ Nota NUNCA é apagada (DELETE bloqueado)
2. ✅ Correção gera NOVO REGISTRO (NotaHistorico)
3. ✅ Histórico é IMUTÁVEL (nunca deletado)
4. ✅ Auditoria é obrigatória (AuditService.logUpdate)
5. ✅ Professor não pode apagar correções (DELETE bloqueado)
6. ✅ Tudo é rastreável (quem, quando, motivo, valor antes/depois)
7. ✅ Motivo obrigatório para correções
8. ✅ Permissões corretas (PROFESSOR, ADMIN, SECRETARIA)

---

## 📝 ENDPOINTS DISPONÍVEIS

### Backend

1. **POST /notas** - Criar nota
   - Permissões: ADMIN, PROFESSOR, SUPER_ADMIN
   - Valida: instituicaoId, permissões

2. **PUT /notas/:id** - Atualizar observações (SEM mudança de valor)
   - Permissões: ADMIN, PROFESSOR, SUPER_ADMIN
   - **BLOQUEADO:** Mudança de valor (retorna 400)

3. **PUT /notas/:id/corrigir** - Corrigir nota (método oficial)
   - Permissões: ADMIN, PROFESSOR, SUPER_ADMIN
   - Body: `{ valor, motivo, observacoes? }`
   - **Obrigatório:** `motivo`
   - Cria histórico imutável

4. **GET /notas/:id/historico** - Obter histórico de correções
   - Permissões: ADMIN, SECRETARIA, PROFESSOR, ALUNO, SUPER_ADMIN
   - Retorna: Lista completa de correções ordenada por data

5. **DELETE /notas/:id** - Bloqueado
   - Retorna: 403 (histórico imutável)

---

## 🎯 PRÓXIMOS PASSOS (FRONTEND)

### P1 - ALTO (Recomendado)

1. **Criar UI de correção**
   - Modal de correção com campo de motivo obrigatório
   - Validação de motivo antes de enviar
   - Feedback visual após correção

2. **Criar UI de histórico**
   - Componente de histórico de correções
   - Linha do tempo visual
   - Informações: quem, quando, valor antes/depois, motivo

3. **Atualizar componentes existentes**
   - Substituir uso de `notasApi.update` com valor por `notasApi.corrigir`
   - Adicionar botão "Corrigir" em vez de "Editar" quando for mudança de valor
   - Exibir histórico de correções

---

## ✅ VALIDAÇÃO

**Testes Recomendados:**
1. ✅ Tentar DELETE de nota → Deve retornar 403
2. ✅ Tentar mudar valor via `updateNota` → Deve retornar 400
3. ✅ Corrigir nota via `corrigirNota` → Deve criar histórico
4. ✅ Verificar histórico → Deve retornar todas as correções
5. ✅ PROFESSOR corrigir nota do próprio plano → Deve funcionar
6. ✅ PROFESSOR corrigir nota de outro plano → Deve retornar 403
7. ✅ SECRETARIA tentar corrigir → Deve retornar 403

---

## 📊 ARQUIVOS MODIFICADOS

### Backend
1. `backend/src/controllers/nota.controller.ts`
   - `updateNota`: Bloqueia mudança de valor
   - `corrigirNota`: Já implementado (sem mudanças)
   - `getHistoricoNota`: Já implementado (sem mudanças)
   - `deleteNota`: Já bloqueado (sem mudanças)

### Frontend
1. `frontend/src/services/api.ts`
   - `notasApi.corrigir()`: Novo método
   - `notasApi.getHistorico()`: Novo método
   - `notasApi.update()`: Atualizado (não aceita `valor`)

---

## ✅ STATUS FINAL

**Todas as correções críticas implementadas!**

- ✅ DELETE bloqueado
- ✅ Mudança de valor bloqueada em `updateNota`
- ✅ Correção oficial com motivo obrigatório
- ✅ Histórico imutável e rastreável
- ✅ Permissões corretas
- ✅ API frontend atualizada
- ✅ Conformidade SIGA/SIGAE

---

**Sistema pronto para auditoria acadêmica!** 🎉

**Próximo Passo:** Criar UI de correção e histórico no frontend (P1)

