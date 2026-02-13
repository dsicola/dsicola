# CORREÇÕES: UX, PERMISSÕES E FLUXOS

**Data:** 2025-01-XX
**Status:** Problemas identificados, ações definidas

---

## 📋 RESUMO EXECUTIVO

### ✅ CONFORME
1. ✅ Campos condicionais (Turma e Avaliação) - Implementados corretamente
2. ✅ Rotas acadêmicas - Proteções corretas
3. ✅ Multas - Aplicação manual via endpoint (correto)

### ⚠️ PRECISA CORREÇÃO
1. ⚠️ **CRÍTICO:** DELETE de pagamentos existe - viola regra de imutabilidade
2. ⚠️ **ALTO:** Verificar permissões de SECRETARIA em rotas financeiras
3. ⚠️ **MÉDIO:** Verificar regras de elegibilidade de bolsas

---

## 🔴 PROBLEMA CRÍTICO: DELETE DE PAGAMENTOS

### Problema Identificado

**Arquivo:** `backend/src/controllers/pagamento.controller.ts`
- Função `deletePagamento` existe (linha 252)
- Rota `DELETE /pagamentos/:id` existe
- **VIOLA REGRA:** Pagamentos devem ser imutáveis (apenas estorno)

### Regra Esperada (SIGA/SIGAE)
- ✅ Histórico de pagamentos é imutável
- ✅ Pagamentos nunca devem ser deletados
- ✅ Apenas estorno permitido (cria novo registro de estorno)

### Ação Necessária

1. **Remover ou bloquear DELETE de pagamentos**
   - Opção 1: Remover rota `DELETE /pagamentos/:id`
   - Opção 2: Manter rota mas bloquear (retornar erro 403)

2. **Implementar endpoint de estorno**
   - Criar `POST /pagamentos/:id/estornar`
   - Criar novo registro de estorno (não deletar)
   - Atualizar status da mensalidade

3. **Atualizar frontend**
   - Remover botão de deletar pagamento
   - Adicionar botão de estornar pagamento

---

## ⚠️ PROBLEMA ALTO: PERMISSÕES SECRETARIA

### Problema Identificado

**Rotas Financeiras:**
- `PUT /mensalidades/:id` - SECRETARIA removida (apenas ADMIN, SUPER_ADMIN, POS)
- `POST /mensalidades/:id/pagamento` - SECRETARIA removida (apenas ADMIN, SUPER_ADMIN, POS)
- `POST /pagamentos/mensalidade/:mensalidadeId/registrar` - SECRETARIA não pode registrar

### Regra Esperada (SIGA/SIGAE)
- ✅ SECRETARIA deve poder registrar pagamentos
- ✅ SECRETARIA deve poder atualizar mensalidades (para registrar pagamentos)
- ⚠️ SECRETARIA não deve poder deletar pagamentos (apenas ADMIN)

### Ação Necessária

1. **Verificar se remoção de SECRETARIA foi intencional**
   - Se foi intencional: Documentar razão
   - Se não foi intencional: Adicionar SECRETARIA de volta

2. **Ajustar permissões:**
   ```typescript
   // PUT /mensalidades/:id
   authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN', 'POS')
   
   // POST /mensalidades/:id/pagamento
   authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN', 'POS')
   
   // POST /pagamentos/mensalidade/:mensalidadeId/registrar
   authorize('ADMIN', 'SECRETARIA', 'POS', 'SUPER_ADMIN')
   ```

---

## ⚠️ PROBLEMA MÉDIO: REGRAS DE ELEGIBILIDADE DE BOLSAS

### Status Atual

**Arquivo:** `backend/src/controllers/bolsa.controller.ts`
- ✅ Bolsas podem ser criadas (ADMIN, SECRETARIA, SUPER_ADMIN)
- ✅ Bolsas podem ser aplicadas a alunos (via `alunoBolsa`)
- ⚠️ **Não há validação de elegibilidade** (critérios, regras)

### Regra Esperada (SIGA/SIGAE)
- ✅ Bolsas devem ter regras claras de elegibilidade
- ✅ Validação antes de aplicar bolsa a aluno
- ✅ Critérios: renda, desempenho acadêmico, etc.

### Ação Necessária

1. **Verificar se há regras de elegibilidade no schema**
   - Verificar `schema.prisma` - modelo `BolsaDesconto`
   - Verificar se há campos para critérios

2. **Implementar validação de elegibilidade (se necessário)**
   - Criar função `validarElegibilidadeAluno(bolsaId, alunoId)`
   - Validar antes de aplicar bolsa

3. **Documentar regras de elegibilidade**
   - Adicionar documentação sobre critérios
   - Adicionar validação no frontend (UX)

---

## ✅ CONFORME: MULTAS

### Status Verificado

**Arquivo:** `backend/src/controllers/mensalidade.controller.ts`
- ✅ Multas são aplicadas **MANUALMENTE** via endpoint `POST /mensalidades/aplicar-multas`
- ✅ Não há aplicação automática em background
- ✅ Configuração de multas é explícita (via `ConfiguracaoMulta`)
- ✅ Função `calcularMultaJuros` existe mas é chamada manualmente

### Conclusão
✅ **CONFORME** - Multas nunca são automáticas sem regra explícita

---

## 📊 PLANO DE AÇÃO

### P0 - CRÍTICO (Esta Sprint)

1. **Remover/Bloquear DELETE de pagamentos**
   - Arquivo: `backend/src/routes/pagamento.routes.ts`
   - Arquivo: `backend/src/controllers/pagamento.controller.ts`
   - Ação: Remover rota ou bloquear com erro 403

2. **Implementar endpoint de estorno**
   - Arquivo: `backend/src/controllers/pagamento.controller.ts`
   - Criar função `estornarPagamento`
   - Criar rota `POST /pagamentos/:id/estornar`

### P1 - ALTO (Próxima Sprint)

1. **Ajustar permissões de SECRETARIA**
   - Verificar se remoção foi intencional
   - Adicionar SECRETARIA de volta se necessário

2. **Atualizar frontend (estorno de pagamentos)**
   - Remover botão de deletar
   - Adicionar botão de estornar

### P2 - MÉDIO (Futuro)

1. **Implementar validação de elegibilidade de bolsas**
   - Verificar schema
   - Implementar validação se necessário

---

## 📝 NOTAS TÉCNICAS

### DELETE de Pagamentos

**Código atual:**
```typescript
// backend/src/controllers/pagamento.controller.ts
export const deletePagamento = async (req: Request, res: Response, next: NextFunction) => {
  // ... deleta pagamento e recalcula mensalidade
}
```

**Ação recomendada:**
```typescript
// Opção 1: Remover completamente
// Opção 2: Bloquear com erro
export const deletePagamento = async (req: Request, res: Response, next: NextFunction) => {
  throw new AppError('Pagamentos não podem ser deletados. Use estorno.', 403);
}
```

### Estorno de Pagamentos

**Implementação sugerida:**
```typescript
export const estornarPagamento = async (req: Request, res: Response, next: NextFunction) => {
  // 1. Buscar pagamento
  // 2. Criar novo registro de estorno (tipo: 'ESTORNO')
  // 3. Atualizar status da mensalidade
  // 4. Retornar registro de estorno
}
```

---

**Próximos Passos:**
1. Implementar correções P0
2. Verificar permissões de SECRETARIA
3. Implementar estorno de pagamentos

