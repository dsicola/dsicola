# PLANO DE CORREÇÃO P0 - MODAIS SEM useSafeDialog

**Prioridade:** CRÍTICA (P0)
**Risco:** Node.removeChild errors, instabilidade UI
**Impacto:** Todos os usuários
**Esforço:** Médio (migração sistemática)

---

## 📋 ARQUIVOS IDENTIFICADOS (11 arquivos)

### Ordem de Correção Sugerida (por criticidade operacional):

1. **POSDashboard.tsx** ⚠️ CRÍTICO FINANCEIRO
   - Dialogs: `showPagamentoDialog`, `showPrintDialog`
   - Impacto: Operação financeira diária

2. **SecretariaDashboard.tsx** ⚠️ CRÍTICO OPERACIONAL
   - Dialogs: `showPagamentoDialog`, `showHistoricoDialog`, `showGerarDialog`, `showPrintDialog`
   - Impacto: Operação secretaria diária

3. **AdminDashboard.tsx**
   - Dialogs: `showPermissoesDialog`
   - Impacto: Configuração administrativa

4. **BolsasDescontos.tsx**
   - Dialogs: `showBolsaDialog`, `showAplicarDialog`, `showDeleteDialog`
   - Impacto: Gestão financeira

5. **AvaliacoesNotas.tsx**
   - Dialogs: `showAvaliacaoDialog`, `showLancarNotasDialog`, `showDeleteDialog`
   - Impacto: Gestão acadêmica

6. **GestaoFinanceira.tsx**
   - Dialogs: `showGerarDialog`, `showPagarDialog`
   - Impacto: Gestão financeira

7. **Biblioteca.tsx**
   - Dialogs: `showCadastroDialog`, `showEdicaoDialog`, `showPreviewDialog`, `showEmprestimoDialog`
   - Impacto: Gestão biblioteca

8. **PlanejarTab.tsx** (PlanoEnsino)
   - Dialogs: `showAulaDialog`, `showCopiarDialog`, `showBibliografiaDialog`, `showAjustarCargaDialog`
   - Impacto: Gestão acadêmica

9. **FinalizarTab.tsx** (PlanoEnsino)
   - Dialogs: `showBloquearDialog`, `showDesbloquearDialog`
   - Impacto: Gestão acadêmica

10. **GerenciarTab.tsx** (PlanoEnsino)
    - Dialogs: `showEditDialog`
    - Impacto: Gestão acadêmica

11. **MinhasMensalidades.tsx** (Aluno)
    - Dialogs: `showPrintDialog`
    - Impacto: UX aluno

---

## 🔧 PADRÃO DE CORREÇÃO

### Antes:
```typescript
const [showDialog, setShowDialog] = useState(false);
```

### Depois:
```typescript
const [showDialog, setShowDialog] = useSafeDialog(false);
```

### Exemplo Completo:

#### ANTES:
```typescript
const [showPagamentoDialog, setShowPagamentoDialog] = useState(false);

// ... no JSX:
<Dialog open={showPagamentoDialog} onOpenChange={setShowPagamentoDialog}>
```

#### DEPOIS:
```typescript
const [showPagamentoDialog, setShowPagamentoDialog] = useSafeDialog(false);

// ... no JSX:
<Dialog open={showPagamentoDialog} onOpenChange={setShowPagamentoDialog}>
```

**NOTA:** O `useSafeDialog` é retrocompatível - pode substituir `useState` diretamente sem alterar lógica.

---

## ✅ CHECKLIST DE CORREÇÃO

Para cada arquivo:

- [ ] Importar `useSafeDialog` de `@/hooks/useSafeDialog`
- [ ] Substituir `useState(false)` por `useSafeDialog(false)`
- [ ] Verificar se `onOpenChange` usa o setter do hook (deve funcionar igual)
- [ ] Testar abertura/fechamento do modal
- [ ] Testar navegação durante modal aberto (deve fechar automaticamente)
- [ ] Verificar console por erros Node.removeChild
- [ ] Testar fechamento após mutation bem-sucedida

---

## 📝 NOTAS IMPORTANTES

1. **Retrocompatibilidade:** `useSafeDialog` retorna `[open, setOpen, openDialog, closeDialog, toggleDialog]`
   - Os dois primeiros valores são compatíveis com `useState`
   - `setOpen` funciona igual ao `setState` de `useState`

2. **Cleanup Automático:** O hook fecha o dialog automaticamente na mudança de rota

3. **Prevenção de Erros:** O hook previne:
   - Node.removeChild errors
   - State updates em componentes desmontados
   - Double unmounting

4. **Não quebra código existente:** Substituição é direta, sem alterações de lógica

---

## 🎯 RESULTADO ESPERADO

- ✅ Zero erros Node.removeChild no console
- ✅ Modais fecham corretamente na navegação
- ✅ Modais fecham corretamente após mutations
- ✅ UI estável e previsível
- ✅ Nenhum erro de Portal/DOM

