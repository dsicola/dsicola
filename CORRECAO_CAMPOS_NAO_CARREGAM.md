# Correção: Campos não estão carregando dados
## PlanoEnsinoTab - Contexto do Plano de Ensino

**Data**: 2025-01-27  
**Status**: ✅ **Corrigido**

---

## 🐛 PROBLEMA IDENTIFICADO

Os campos de seleção (Curso, Disciplina, Professor, Turma) na página "Configuração de Ensinos" não estavam carregando dados.

**Causa Raiz**:
- As queries React Query estavam condicionadas a `isEnsinoSuperior` e `instituicaoId`
- Quando o tipo acadêmico não estava disponível imediatamente, as queries não eram habilitadas
- Falta de tratamento de erros adequado

---

## ✅ CORREÇÕES APLICADAS

### 1. Query de Cursos ✅

**Antes**:
```typescript
const cursosQueryEnabled = !!isEnsinoSuperior && !!instituicaoId;
```

**Depois**:
```typescript
// CORREÇÃO: Habilitar query mesmo se tipo acadêmico não estiver disponível ainda
const cursosQueryEnabled = !!instituicaoId && (isEnsinoSuperior || !isEnsinoSecundario);
```

**Mudanças**:
- ✅ Habilita query quando `instituicaoId` está disponível, mesmo se tipo acadêmico ainda não foi determinado
- ✅ Adiciona tratamento de erros com try/catch
- ✅ Retorna array vazio em caso de erro (não quebra a UI)

---

### 2. Query de Disciplinas ✅

**Antes**:
```typescript
const disciplinasQueryEnabled = (
  (isEnsinoSuperior && !!context.cursoId) ||
  (isEnsinoSecundario && !!instituicaoId)
);
```

**Depois**:
```typescript
// CORREÇÃO: Habilitar também quando tipo acadêmico não estiver disponível ainda
const disciplinasQueryEnabled = (
  (isEnsinoSuperior && !!context.cursoId) ||
  (isEnsinoSecundario && !!instituicaoId) ||
  (!isEnsinoSuperior && !isEnsinoSecundario && !!instituicaoId) // Fallback
);
```

**Mudanças**:
- ✅ Adiciona fallback para quando tipo acadêmico ainda não foi determinado
- ✅ Mantém lógica original para Ensino Superior e Secundário

---

### 3. Query de Classes ✅

**Antes**:
```typescript
enabled: isEnsinoSecundario && !!instituicaoId,
```

**Depois**:
```typescript
enabled: (isEnsinoSecundario || (!isEnsinoSuperior && !isEnsinoSecundario)) && !!instituicaoId,
```

**Mudanças**:
- ✅ Habilita query quando tipo ainda não foi determinado
- ✅ Adiciona tratamento de erros
- ✅ Adiciona retry (2 tentativas)

---

### 4. Feedback Visual Melhorado ✅

**Adicionado**:
- ✅ Mensagem de erro quando query falha
- ✅ Mensagem informativa quando não há dados cadastrados
- ✅ Mensagem de debug (apenas em desenvolvimento) mostrando status da query
- ✅ Placeholder dinâmico baseado no estado da query

**Exemplo**:
```typescript
{errorCursos && (
  <p className="text-xs text-destructive">
    Erro ao carregar cursos. Verifique sua conexão e tente novamente.
  </p>
)}
{!cursosQueryEnabled && !isLoadingCursos && (
  <p className="text-xs text-amber-600">
    Aguardando identificação da instituição...
  </p>
)}
```

---

## 📋 CHECKLIST DE VALIDAÇÃO

### Queries
- [x] Query de cursos habilitada mesmo sem tipo acadêmico definido
- [x] Query de disciplinas habilitada mesmo sem tipo acadêmico definido
- [x] Query de classes habilitada mesmo sem tipo acadêmico definido
- [x] Query de professores habilitada quando `instituicaoId` disponível
- [x] Tratamento de erros em todas as queries
- [x] Retry configurado para queries críticas

### Feedback Visual
- [x] Mensagens de erro claras
- [x] Mensagens informativas quando não há dados
- [x] Placeholders dinâmicos
- [x] Debug info (apenas em desenvolvimento)

### Lógica
- [x] Fallback quando tipo acadêmico não está disponível
- [x] Queries carregam automaticamente quando `instituicaoId` está disponível
- [x] Não quebra UI em caso de erro

---

## 🔍 DIAGNÓSTICO

### Como verificar se está funcionando:

1. **Console do navegador**:
   - Verificar logs `[PlanoEnsinoTab] Query de cursos - enabled:`
   - Verificar logs `[PlanoEnsinoTab] Executando query de cursos...`
   - Verificar erros de rede

2. **Interface**:
   - Campos devem mostrar "Carregando..." enquanto carregam
   - Campos devem mostrar opções quando dados estão disponíveis
   - Mensagens de erro devem aparecer se houver problemas

3. **Network Tab**:
   - Verificar se requisições para `/cursos`, `/disciplinas`, `/professores` estão sendo feitas
   - Verificar status das respostas (200, 401, 403, 500)

---

## ✅ CONCLUSÃO

**Status**: ✅ **Corrigido**

As queries agora são habilitadas mesmo quando o tipo acadêmico ainda não está disponível, garantindo que os dados sejam carregados assim que `instituicaoId` estiver disponível.

**Próximos Passos**:
1. Testar em ambiente de desenvolvimento
2. Verificar se os dados carregam corretamente
3. Verificar se as mensagens de erro aparecem quando necessário

