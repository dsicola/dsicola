# ✅ Correção: Ano Letivo Ativo não sendo detectado

**Data**: Janeiro 2025  
**Problema**: Dashboard continua mostrando mensagem "Não existe Ano Letivo ativo" mesmo após criar ano letivo

---

## 🔍 DIAGNÓSTICO

### Problema Identificado

1. **Ano Letivo criado com status `PLANEJADO` por padrão**
   - Quando um ano letivo é criado, ele vem com status `PLANEJADO`
   - Precisa ser **ATIVADO manualmente** para ficar com status `ATIVO`

2. **Query não sendo invalidada após ativação**
   - Quando um ano letivo é ativado, a mutation `ativarMutation` invalidava apenas `["anos-letivos"]`
   - **Não invalidava** `["ano-letivo-ativo"]` usado pelo hook `useAnoLetivoAtivo`
   - Resultado: O hook continuava usando cache antigo (sem ano letivo ativo)

3. **Hook não tratando adequadamente retorno null**
   - API retorna `null` quando não há ano letivo ativo (não é erro)
   - Hook não estava tratando explicitamente esse caso

---

## ✅ CORREÇÕES APLICADAS

### 1. **AnosLetivosTab.tsx** - Invalidação de Query

**Problema**: Query `["ano-letivo-ativo"]` não era invalidada após ativar ano letivo

**Solução**: Adicionar invalidação da query `["ano-letivo-ativo"]` no `onSuccess` da mutation `ativarMutation`

**Código corrigido**:
```tsx
const ativarMutation = useMutation({
  mutationFn: async (data: { anoLetivoId: string }) => {
    return await anoLetivoApi.ativar(data);
  },
  onSuccess: () => {
    toast({
      title: "Sucesso!",
      description: "Ano letivo ativado com sucesso.",
    });
    // CRÍTICO: Invalidar ambas as queries para atualizar o cache
    queryClient.invalidateQueries({ queryKey: ["anos-letivos"] });
    queryClient.invalidateQueries({ queryKey: ["ano-letivo-ativo"] }); // ✅ ADICIONADO
    setAtivarDialogOpen(false);
    setSelectedAnoLetivo(null);
  },
  // ...
});
```

**Também melhorado**:
- Toast de criação agora menciona que é necessário ativar o ano letivo

---

### 2. **useAnoLetivoAtivo.ts** - Melhor tratamento de erros

**Problema**: Hook não tratava adequadamente quando API retorna `null` (não é erro, é ausência)

**Solução**: 
- Adicionar try/catch para tratar 404/400 como `null` (não erro)
- Reduzir `staleTime` de 5 minutos para 1 minuto (atualização mais rápida)

**Código corrigido**:
```tsx
queryFn: async () => {
  if (!instituicaoId) return null;
  try {
    const response = await anoLetivoApi.getAtivo();
    // API retorna null quando não há ano letivo ativo (não é erro)
    return response || null;
  } catch (error: any) {
    // Se for 404 ou erro similar, retornar null (não é erro crítico)
    if (error?.response?.status === 404 || error?.response?.status === 400) {
      return null;
    }
    // Para outros erros, relançar
    throw error;
  }
},
enabled: !!instituicaoId,
staleTime: 1 * 60 * 1000, // 1 minuto (reduzido para atualização mais rápida)
retry: 1,
```

---

## 📋 FLUXO CORRETO

### 1. **Criar Ano Letivo**
```
Status: PLANEJADO (padrão)
→ Toast: "Ano letivo criado com sucesso. Lembre-se de ativá-lo para começar a usar."
```

### 2. **Ativar Ano Letivo**
```
Status: PLANEJADO → ATIVO
→ Query "anos-letivos" invalidada ✅
→ Query "ano-letivo-ativo" invalidada ✅ (NOVO)
→ Hook useAnoLetivoAtivo atualiza automaticamente ✅
→ Dashboard mostra ano letivo ativo ✅
```

---

## 🧪 COMO TESTAR

1. **Criar ano letivo**:
   - Ir para `/admin/configuracao-ensino?tab=anos-letivos`
   - Criar novo ano letivo
   - Verificar que status é `PLANEJADO`
   - Dashboard ainda mostra mensagem "Não existe Ano Letivo ativo" ✅ (correto)

2. **Ativar ano letivo**:
   - Clicar em "Ativar" no ano letivo criado
   - Verificar que status muda para `ATIVO`
   - Dashboard deve atualizar automaticamente ✅
   - Mensagem "Não existe Ano Letivo ativo" deve desaparecer ✅
   - Componentes acadêmicos devem ficar habilitados ✅

---

## ⚠️ IMPORTANTE

**Ano Letivo precisa ser ATIVADO manualmente** após ser criado!

- ✅ Criar ano letivo → Status `PLANEJADO`
- ✅ Ativar ano letivo → Status `ATIVO`
- ✅ Dashboard detecta ano letivo ativo automaticamente

---

## ✅ STATUS

| Item | Status |
|------|--------|
| Invalidação de Query | ✅ **CORRIGIDO** |
| Tratamento de Erros | ✅ **MELHORADO** |
| StaleTime reduzido | ✅ **OTIMIZADO** |
| Toast informativo | ✅ **ADICIONADO** |

**Status Final**: ✅ **CORRIGIDO**

O sistema agora atualiza automaticamente quando um ano letivo é ativado!

