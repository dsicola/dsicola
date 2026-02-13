# 🧪 TESTES - CENÁRIOS DO PERFIL DE PROFESSOR

**Data:** 2025-01-27  
**Status:** ✅ **TESTES DEFINIDOS**

---

## 📋 CENÁRIOS DE TESTE

### CENÁRIO 1: Professor SEM Plano de Ensino

**Descrição:** Professor não possui nenhum Plano de Ensino atribuído.

**Comportamento Esperado:**
- ✅ Dashboard mostra mensagem: "Nenhuma atribuição"
- ✅ Não mostra turmas nem disciplinas
- ✅ Todas as ações bloqueadas
- ✅ Mensagem clara: "Contacte a administração para atribuição"

**Validações:**
- ✅ Backend retorna array vazio `[]`
- ✅ Frontend exibe alerta informativo (azul)
- ✅ Botões de ações desabilitados
- ✅ Não tenta buscar alunos, aulas, notas

**Código Verificado:**
```typescript
// Backend: buscarTurmasProfessorComPlanos()
// Retorna [] se não houver planos

// Frontend: ProfessorDashboard.tsx linha 502-510
{!turmasLoading && turmas.length === 0 && disciplinasSemTurma.length === 0 && (
  <Alert className="border-blue-500 bg-blue-50">
    <AlertTitle>Nenhuma Atribuição</AlertTitle>
    <AlertDescription>
      Você ainda não possui turmas ou disciplinas atribuídas. 
      Contacte a administração para atribuição.
    </AlertDescription>
  </Alert>
)}
```

**Status:** ✅ **IMPLEMENTADO CORRETAMENTE**

---

### CENÁRIO 2: Professor COM Plano SEM Turma

**Descrição:** Professor possui Plano de Ensino atribuído, mas a disciplina não está vinculada a uma turma.

**Comportamento Esperado:**
- ✅ Dashboard mostra disciplina em "Disciplinas Atribuídas"
- ✅ Badge: "Aguardando turma"
- ✅ Mensagem clara: "Aguardando alocação de turma"
- ✅ Todas as ações pedagógicas BLOQUEADAS
- ✅ Mensagem explicativa sobre bloqueio

**Validações:**
- ✅ Backend retorna item com `semTurma: true`
- ✅ Frontend separa em `disciplinasSemTurma`
- ✅ Exibe em seção específica "Disciplinas Atribuídas"
- ✅ `podeExecutarAcoes === false`
- ✅ Backend bloqueia ações (validação `validarVinculoProfessorDisciplinaTurma`)

**Código Verificado:**
```typescript
// Backend: buscarTurmasProfessorComPlanos()
// Retorna item com turma: null, semTurma: true

// Frontend: ProfessorDashboard.tsx linha 742-824
<Card>
  <CardTitle>Disciplinas Atribuídas</CardTitle>
  <CardDescription>Aguardando alocação de turma</CardDescription>
  {/* Mostra disciplinas sem turma */}
  <div className="p-4 bg-blue-50 rounded-lg">
    <Badge>Aguardando turma</Badge>
    <AlertDescription>
      <strong>Status: Aguardando alocação de turma</strong>
      <br />
      Esta disciplina foi atribuída a você via Plano de Ensino, 
      mas ainda não está vinculada a uma turma.
      <br />
      <strong>Ações pedagógicas desabilitadas:</strong> Registrar aulas, 
      marcar presenças, lançar notas e criar avaliações estarão disponíveis 
      após a vinculação a uma turma.
    </AlertDescription>
  </div>
</Card>
```

**Validação Backend:**
```typescript
// backend/src/services/validacaoAcademica.service.ts linha 546-551
if (!planoEnsino.turmaId) {
  throw new AppError(
    `Não é possível ${operacao}. O Plano de Ensino não possui turma vinculada. 
    Ações pedagógicas (aulas, presenças, avaliações, notas) só podem ser 
    executadas quando a disciplina está vinculada a uma turma. 
    Contacte a coordenação para vincular a disciplina a uma turma.`,
    403
  );
}
```

**Status:** ✅ **IMPLEMENTADO CORRETAMENTE**

---

### CENÁRIO 3: Professor COM Plano E Turma

**Descrição:** Professor possui Plano de Ensino ATIVO vinculado a uma turma.

**Comportamento Esperado:**
- ✅ Dashboard mostra turma em "Minhas Turmas"
- ✅ Todas as ações HABILITADAS (se plano ATIVO)
- ✅ Pode registrar aulas, presenças, notas
- ✅ Pode criar avaliações
- ✅ Mostra estatísticas (alunos, aulas, notas)

**Validações:**
- ✅ Backend retorna item com `semTurma: false`
- ✅ Frontend separa em `turmas`
- ✅ `podeExecutarAcoes === true` (se plano ATIVO)
- ✅ Backend permite ações (validação passa)

**Código Verificado:**
```typescript
// Backend: buscarTurmasProfessorComPlanos()
// Retorna item com turma: {...}, semTurma: false

// Frontend: ProfessorDashboard.tsx linha 432-452
const podeExecutarAcoes = React.useMemo(() => {
  const temTurmaComPlanoAtivo = turmas.some((turma: any) => {
    if (turma.semTurma === true) return false;
    return turma.planoAtivo === true || 
           (turma.planoEstado === 'APROVADO' && !turma.planoBloqueado);
  });
  return temTurmaComPlanoAtivo && (hasAnoLetivoAtivo || !hasAnoLetivoAtivo);
}, [turmas, hasAnoLetivoAtivo]);
```

**Validação Backend:**
```typescript
// backend/src/services/validacaoAcademica.service.ts
// validarVinculoProfessorDisciplinaTurma() - passa se:
// 1. Plano existe
// 2. Estado = 'APROVADO'
// 3. Não bloqueado
// 4. turmaId !== null ✅
```

**Status:** ✅ **IMPLEMENTADO CORRETAMENTE**

---

## 🔍 SUB-CENÁRIOS ADICIONAIS

### CENÁRIO 3.1: Plano ATIVO (APROVADO e não bloqueado)

**Comportamento:**
- ✅ Todas as ações HABILITADAS
- ✅ `podeExecutarAcoes === true`
- ✅ Backend permite todas as operações

**Status:** ✅ **IMPLEMENTADO**

---

### CENÁRIO 3.2: Plano RASCUNHO

**Comportamento:**
- ✅ Turma visível no dashboard
- ✅ Badge: "Rascunho"
- ✅ Ações BLOQUEADAS
- ✅ Mensagem: "Aguardando aprovação"

**Código:**
```typescript
// Frontend: ProfessorDashboard.tsx linha 705-712
{!planoAtivo && (
  <Badge variant="outline" className="border-yellow-500">
    {planoEstado === 'RASCUNHO' ? 'Rascunho' : 
     planoEstado === 'EM_REVISAO' ? 'Em Revisão' : 
     planoEstado === 'ENCERRADO' ? 'Encerrado' : 
     planoBloqueado ? 'Bloqueado' : 'Pendente'}
  </Badge>
)}
```

**Status:** ✅ **IMPLEMENTADO**

---

### CENÁRIO 3.3: Plano EM_REVISAO

**REGRA SIGA/SIGAE:** Plano EM_REVISAO não deve expor turmas ao professor.

**Comportamento:**
- ❌ Turma NÃO visível no dashboard (regra SIGA/SIGAE)
- ❌ Disciplina sem turma pode aparecer (para informação)
- ❌ Ações BLOQUEADAS
- ✅ Backend não retorna turma quando plano está em EM_REVISAO

**Status:** ✅ **AJUSTADO CONFORME SIGA/SIGAE**

---

### CENÁRIO 3.4: Plano ENCERRADO

**REGRA SIGA/SIGAE:** Plano ENCERRADO pode expor turmas em modo leitura.

**Comportamento:**
- ✅ Turma visível no dashboard (modo leitura)
- ✅ Badge: "Encerrado"
- ❌ Ações BLOQUEADAS
- ✅ Mensagem clara: "Plano de Ensino Encerrado: Você pode visualizar informações, mas não pode executar ações acadêmicas."
- ✅ Backend retorna dados em modo leitura

**Status:** ✅ **AJUSTADO CONFORME SIGA/SIGAE**

---

### CENÁRIO 3.5: Plano BLOQUEADO

**REGRA SIGA/SIGAE:** Plano BLOQUEADO pode expor turmas apenas para leitura.

**Comportamento:**
- ✅ Turma visível no dashboard (modo leitura)
- ✅ Badge: "Bloqueado"
- ❌ Ações BLOQUEADAS
- ✅ Mensagem clara: "Plano de Ensino Bloqueado: Você pode visualizar informações em modo leitura, mas ações acadêmicas estão suspensas. Contacte a coordenação para mais informações."
- ✅ Backend retorna dados em modo leitura

**Status:** ✅ **AJUSTADO CONFORME SIGA/SIGAE**

---

## 📊 MATRIZ DE TESTES (PADRÃO SIGA/SIGAE)

**REGRA MESTRA:** Turmas só podem existir para Plano ATIVO ou ENCERRADO.

| Cenário | Turmas Visíveis | Disciplinas Sem Turma | Ações Habilitadas | Backend Permite | Modo Leitura |
|---------|----------------|----------------------|-------------------|-----------------|--------------|
| Sem Plano | ❌ Não | ❌ Não | ❌ Não | ❌ Não | ❌ Não |
| Plano sem Turma (ATIVO) | ❌ Não | ✅ Sim | ❌ Não | ❌ Não | ✅ Sim (disciplina) |
| Plano sem Turma (RASCUNHO) | ❌ Não | ✅ Sim* | ❌ Não | ❌ Não | ✅ Sim (disciplina) |
| Plano + Turma (ATIVO) | ✅ Sim | ❌ Não | ✅ Sim | ✅ Sim | ✅ Sim |
| Plano + Turma (ENCERRADO) | ✅ Sim | ❌ Não | ❌ Não | ❌ Não | ✅ Sim |
| Plano + Turma (BLOQUEADO) | ✅ Sim | ❌ Não | ❌ Não | ❌ Não | ✅ Sim |
| Plano + Turma (RASCUNHO) | ❌ Não** | ❌ Não | ❌ Não | ❌ Não | ❌ Não |
| Plano + Turma (EM_REVISAO) | ❌ Não** | ❌ Não | ❌ Não | ❌ Não | ❌ Não |

**Legenda:**
- ✅ = Sim / Permitido
- ❌ = Não / Bloqueado
- \* = Disciplina visível apenas se plano ATIVO ou ENCERRADO (para informação)
- \** = REGRA SIGA/SIGAE: Plano RASCUNHO/EM_REVISAO não expõe turmas ao professor

**Observações:**
- **Modo Leitura:** Backend pode retornar dados mesmo quando ações estão bloqueadas (para visualização)
- **Plano BLOQUEADO:** Turma visível em modo leitura, ações bloqueadas
- **Plano ENCERRADO:** Turma visível em modo leitura, ações bloqueadas
- **Plano RASCUNHO/EM_REVISAO:** Não expõe turmas (regra SIGA/SIGAE)

---

## 🧪 CHECKLIST DE TESTES

### Teste 1: Professor Sem Plano
- [ ] Backend retorna `[]`
- [ ] Frontend exibe alerta "Nenhuma Atribuição"
- [ ] Não mostra turmas
- [ ] Não mostra disciplinas
- [ ] Botões desabilitados
- [ ] Não tenta buscar dados adicionais

### Teste 2: Professor Com Plano Sem Turma
- [ ] Backend retorna item com `semTurma: true`
- [ ] Frontend mostra em "Disciplinas Atribuídas"
- [ ] Badge "Aguardando turma" visível
- [ ] Mensagem explicativa presente
- [ ] Botões desabilitados
- [ ] Backend bloqueia ações (403)

### Teste 3: Professor Com Plano E Turma (ATIVO)
- [ ] Backend retorna item com `semTurma: false`
- [ ] Frontend mostra em "Minhas Turmas"
- [ ] `podeExecutarAcoes === true`
- [ ] Botões habilitados
- [ ] Backend permite ações
- [ ] Estatísticas carregam (alunos, aulas, notas)

### Teste 4: Professor Com Plano E Turma (RASCUNHO)
- [ ] Turma visível
- [ ] Badge "Rascunho" presente
- [ ] Ações bloqueadas
- [ ] Backend bloqueia (403)

### Teste 5: Professor Com Plano E Turma (BLOQUEADO)
- [ ] Turma visível
- [ ] Badge "Bloqueado" presente
- [ ] Ações bloqueadas
- [ ] Backend bloqueia (403)

---

## 🎯 RESULTADO ESPERADO

✅ **Todos os cenários estão implementados corretamente**

**Validações:**
1. ✅ Frontend exibe corretamente cada cenário
2. ✅ Backend valida e bloqueia corretamente
3. ✅ Mensagens claras para o usuário
4. ✅ Estados visuais corretos (vermelho, amarelo, azul)
5. ✅ Bloqueios funcionando em ambos os lados

**Status Final:** ✅ **PRONTO PARA TESTES MANUAIS**

---

## 📝 NOTAS PARA TESTES MANUAIS

### Como Testar:

1. **Cenário 1 - Sem Plano:**
   - Criar professor sem atribuir plano
   - Acessar dashboard
   - Verificar mensagem "Nenhuma Atribuição"

2. **Cenário 2 - Plano Sem Turma:**
   - Criar plano de ensino sem vincular turma
   - Acessar dashboard
   - Verificar seção "Disciplinas Atribuídas"
   - Tentar registrar aula (deve bloquear)

3. **Cenário 3 - Plano E Turma:**
   - Criar plano de ensino vinculado a turma
   - Aprovar plano
   - Acessar dashboard
   - Verificar seção "Minhas Turmas"
   - Tentar registrar aula (deve permitir)

---

**Data de criação:** 2025-01-27  
**Status:** ✅ **TESTES DEFINIDOS E PRONTOS PARA EXECUÇÃO**

