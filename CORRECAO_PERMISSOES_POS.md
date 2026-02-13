# CORREÇÃO DE PERMISSÕES POS

**Data:** 2025-01-XX
**Status:** ✅ Implementado

---

## 📋 AJUSTE DE PERMISSÕES

### Problema Identificado

**Permissões atuais de POS:**
- ❌ POS podia registrar pagamentos
- ❌ POS não podia estornar pagamentos

### Regra Esperada (SIGA/SIGAE)

**POS deve poder:**
- ✅ Visualizar pagamentos (consultar)
- ✅ Estornar pagamentos (criar registro de estorno)
- ❌ **NÃO** registrar novos pagamentos
- ❌ **NÃO** atualizar mensalidades

---

## ✅ CORREÇÕES IMPLEMENTADAS

### Backend - Rotas de Pagamento

**Antes:**
- `POST /pagamentos/mensalidade/:mensalidadeId/registrar` - POS incluído
- `POST /pagamentos/:id/estornar` - POS não incluído

**Depois:**
- `POST /pagamentos/mensalidade/:mensalidadeId/registrar` - POS **REMOVIDO** (apenas ADMIN, SECRETARIA, SUPER_ADMIN)
- `POST /pagamentos/:id/estornar` - POS **ADICIONADO** (ADMIN, SECRETARIA, POS, SUPER_ADMIN)

**Arquivo:** `backend/src/routes/pagamento.routes.ts`

---

### Backend - Rotas de Mensalidade

**Antes:**
- `PUT /mensalidades/:id` - POS incluído
- `POST /mensalidades/:id/pagamento` - POS incluído

**Depois:**
- `PUT /mensalidades/:id` - POS **REMOVIDO** (apenas ADMIN, SECRETARIA, SUPER_ADMIN)
- `POST /mensalidades/:id/pagamento` - POS **REMOVIDO** (apenas ADMIN, SECRETARIA, SUPER_ADMIN)

**Arquivo:** `backend/src/routes/mensalidade.routes.ts`

---

## 📊 RESUMO DE PERMISSÕES FINAIS

### POS - Permissões Finais

**Pode:**
- ✅ `GET /pagamentos` - Listar pagamentos
- ✅ `GET /pagamentos/:id` - Ver pagamento
- ✅ `GET /pagamentos/mensalidade/:mensalidadeId` - Listar pagamentos de mensalidade
- ✅ `GET /mensalidades` - Listar mensalidades (visualizar)
- ✅ `POST /pagamentos/:id/estornar` - **Estornar pagamentos** (NOVO)

**NÃO pode:**
- ❌ `POST /pagamentos/mensalidade/:mensalidadeId/registrar` - Registrar pagamentos
- ❌ `PUT /mensalidades/:id` - Atualizar mensalidades
- ❌ `POST /mensalidades/:id/pagamento` - Registrar pagamentos
- ❌ `DELETE /pagamentos/:id` - Deletar pagamentos (bloqueado para todos)

---

## ✅ VALIDAÇÃO

**Testes Recomendados:**
1. ✅ POS tentar registrar pagamento → Deve retornar 403 (Forbidden)
2. ✅ POS estornar pagamento → Deve funcionar
3. ✅ SECRETARIA registrar pagamento → Deve funcionar
4. ✅ SECRETARIA estornar pagamento → Deve funcionar
5. ✅ ADMIN registrar/estornar → Deve funcionar

---

## 📝 NOTAS TÉCNICAS

### Fluxo Correto de POS

1. **POS visualiza mensalidades pendentes**
   - `GET /mensalidades` - Lista mensalidades
   - `GET /pagamentos/mensalidade/:mensalidadeId` - Lista pagamentos

2. **POS estorna pagamentos (se necessário)**
   - `POST /pagamentos/:id/estornar` - Cria registro de estorno
   - Histórico preservado (valor negativo)

3. **POS NÃO registra novos pagamentos**
   - `POST /pagamentos/mensalidade/:mensalidadeId/registrar` - Bloqueado para POS
   - `POST /mensalidades/:id/pagamento` - Bloqueado para POS

**Observação:** POS deve apenas processar estornos, não criar novos registros de pagamento. Registro de pagamentos é responsabilidade de SECRETARIA/ADMIN.

---

**Status:** ✅ Permissões de POS ajustadas conforme padrão SIGA/SIGAE

