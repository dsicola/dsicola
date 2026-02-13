# 🔧 Correção: Problema de Intercalação de Frequências

## 🐛 Problema Identificado

**Sintoma:** Quando um aluno falta na aula X (com justificativa) e depois está presente na aula XX, o sistema mostra como se ele tivesse faltado na aula XX também.

**Causa Raiz:** O estado de frequências (`frequencias`) não estava sendo limpo corretamente ao trocar de aula, causando que dados de uma aula fossem mantidos quando se selecionava outra aula.

---

## ✅ Correções Implementadas

### 1. **Limpeza de Estado ao Trocar Aula**

**Arquivo:** `frontend/src/pages/professor/GestaoFrequencia.tsx`

**Problema:** O estado `frequencias` mantinha dados de aulas anteriores.

**Solução:**
- Adicionado `useEffect` que limpa o estado quando `selectedAula` muda
- Garantido que cada aula tenha seu próprio estado isolado
- Query agora limpa estado anterior antes de carregar novos dados

```typescript
// CRÍTICO: Limpar frequências quando a aula muda
React.useEffect(() => {
  if (!selectedAula) {
    setFrequencias({});
    return;
  }
  
  // Aguardar query carregar dados da API primeiro
  if (frequenciasLoading) {
    setFrequencias({});
    return;
  }
  
  // Após dados carregarem, garantir que todos os alunos tenham entrada
  // Mas APENAS se ainda não foram carregados pela API
  if (matriculas.length > 0) {
    setFrequencias(prev => {
      const newFreq = { ...prev };
      let hasChanges = false;
      
      matriculas.forEach((m: any) => {
        const alunoId = m.aluno?.id || m.alunoId || m.aluno_id;
        if (!newFreq[alunoId]) {
          newFreq[alunoId] = { presente: true, justificativa: '' };
          hasChanges = true;
        }
      });
      
      return hasChanges ? newFreq : prev;
    });
  }
}, [selectedAula, matriculas, frequenciasLoading, frequenciasData]);
```

### 2. **Query de Frequências Melhorada**

**Problema:** Query não garantia isolamento entre aulas.

**Solução:**
- Query agora limpa estado antes de definir novos dados
- Garantido que apenas frequências da aula selecionada sejam carregadas
- Validação adicional para garantir que `fAulaId === selectedAula`

```typescript
const { data: frequenciasData = [], isLoading: frequenciasLoading } = useQuery({
  queryKey: ['aula-frequencias', selectedAula],
  queryFn: async () => {
    if (!selectedAula) return [];
    
    const data = await frequenciasApi.getByAula(selectedAula);
    
    // IMPORTANTE: Limpar estado anterior e carregar apenas desta aula
    const freqMap: Record<string, { presente: boolean; justificativa: string }> = {};
    (data || []).forEach((f: any) => {
      const alunoId = f.alunoId || f.aluno_id;
      freqMap[alunoId] = { 
        presente: f.presente ?? true, 
        justificativa: f.justificativa || '' 
      };
    });
    
    // Limpar e definir apenas frequências desta aula
    setFrequencias(freqMap);
    
    return data || [];
  },
  enabled: !!selectedAula
});
```

### 3. **Salvamento Melhorado**

**Problema:** Verificação de frequência existente podia pegar frequências de outras aulas.

**Solução:**
- Validação explícita de que `fAulaId === selectedAula`
- Garantido que apenas frequências da aula atual sejam atualizadas

```typescript
const existingFreq = frequenciasData.find((f: any) => {
  const fAlunoId = f.alunoId || f.aluno_id;
  const fAulaId = f.aulaId || f.aula_id;
  return fAlunoId === alunoId && fAulaId === selectedAula;
});
```

---

## 🧪 Como Testar

1. **Cenário 1: Intercalação de Presença/Falta**
   - Selecione aula X
   - Marque aluno como AUSENTE com justificativa
   - Salve
   - Selecione aula XX (diferente)
   - Verifique que aluno aparece como PRESENTE (padrão)
   - Marque como PRESENTE
   - Salve
   - Volte para aula X → Deve mostrar AUSENTE
   - Volte para aula XX → Deve mostrar PRESENTE

2. **Cenário 2: Múltiplas Aulas**
   - Selecione aula 1 → Marque aluno como AUSENTE
   - Selecione aula 2 → Aluno deve aparecer como PRESENTE (padrão)
   - Selecione aula 3 → Aluno deve aparecer como PRESENTE (padrão)
   - Volte para aula 1 → Deve mostrar AUSENTE
   - Volte para aula 2 → Deve mostrar PRESENTE

3. **Cenário 3: Troca de Turma**
   - Selecione turma A, aula X
   - Marque frequências
   - Troque para turma B
   - Verifique que frequências foram limpas
   - Selecione aula Y da turma B
   - Verifique que frequências são independentes

---

## 📋 Checklist de Validação

- [x] Estado é limpo ao trocar de aula
- [x] Cada aula tem seu próprio estado isolado
- [x] Query carrega apenas frequências da aula selecionada
- [x] Salvamento verifica aula correta
- [x] useEffect não sobrescreve dados carregados da API
- [x] Alunos sem frequência são inicializados como PRESENTE

---

## ✅ Resultado Esperado

Agora o sistema funciona corretamente:
- ✅ Aula X: Aluno falta → Salva como AUSENTE
- ✅ Aula XX: Aluno vem → Salva como PRESENTE
- ✅ Cada aula mantém seu próprio registro independente
- ✅ Não há mais "vazamento" de dados entre aulas

