# FLUXO DE ATRIBUIÇÃO DE PLANO DE ENSINO AO PROFESSOR

**Data:** 2025-01-XX  
**Projeto:** DSICOLA  
**Padrão:** institucional  
**Status:** ✅ **IMPLEMENTADO**

---

## 📋 OBJETIVO

Garantir que professores só possam atuar em disciplinas e turmas vinculadas a um **Plano de Ensino ATIVO** (APROVADO e não bloqueado).

---

## 🔒 REGRAS ABSOLUTAS

1. **Professor NÃO cria Plano de Ensino**
   - Apenas ADMIN e SUPER_ADMIN podem criar/editar planos
   - Professor só pode visualizar planos APROVADOS ou ENCERRADOS

2. **Professor só atua se houver vínculo:**
   ```
   Plano de Ensino ATIVO → Disciplina → Turma → Professor
   ```

3. **Sem vínculo, ações pedagógicas ficam bloqueadas:**
   - Registrar aulas
   - Marcar presenças
   - Lançar notas
   - Criar avaliações

---

## 🏗️ IMPLEMENTAÇÃO

### 1. Entidade de Associação

A entidade `PlanoEnsino` já existe no schema Prisma e vincula:
- `professorId` (obrigatório)
- `disciplinaId` (obrigatório)
- `turmaId` (opcional, mas recomendado)
- `anoLetivoId` (obrigatório)
- `estado` (RASCUNHO, EM_REVISAO, APROVADO, ENCERRADO)
- `bloqueado` (Boolean)

**Schema:**
```prisma
model PlanoEnsino {
  id            String         @id @default(uuid())
  disciplinaId  String         @map("disciplina_id")
  professorId   String         @map("professor_id")
  turmaId       String?        @map("turma_id")
  anoLetivoId   String         @map("ano_letivo_id")
  estado        EstadoRegistro @default(RASCUNHO)
  bloqueado     Boolean        @default(false)
  // ... outros campos
}
```

### 2. Validações Implementadas

#### 2.1 Validação de Plano de Ensino ATIVO

**Arquivo:** `backend/src/services/validacaoAcademica.service.ts`

```typescript
export async function validarPlanoEnsinoAtivo(
  instituicaoId: string,
  planoEnsinoId: string | null | undefined,
  operacao: string = 'executar operação acadêmica'
): Promise<{ id: string; estado: string; bloqueado: boolean; disciplinaId: string; professorId: string }>
```

**Validações:**
- ✅ Plano existe
- ✅ Pertence à instituição (multi-tenant)
- ✅ Estado = `APROVADO`
- ✅ `bloqueado = false`

#### 2.2 Validação de Vínculo Professor-Disciplina-Turma

**Arquivo:** `backend/src/services/validacaoAcademica.service.ts`

```typescript
export async function validarVinculoProfessorDisciplinaTurma(
  instituicaoId: string,
  professorId: string,
  disciplinaId: string,
  turmaId: string | null | undefined,
  operacao: string = 'executar operação acadêmica'
): Promise<{ planoEnsinoId: string; estado: string; bloqueado: boolean; disciplinaId: string; professorId: string; turmaId: string | null }>
```

**Validações:**
- ✅ Existe Plano de Ensino vinculando professor → disciplina → turma
- ✅ Plano está ATIVO (APROVADO e não bloqueado)
- ✅ Professor do plano corresponde ao professor autenticado
- ✅ Disciplina do plano corresponde à disciplina fornecida
- ✅ Turma do plano corresponde à turma fornecida (se fornecida)

### 3. Aplicação das Validações

#### 3.1 Ações do Professor que Requerem Validação

| Ação | Controller | Validação Aplicada |
|------|-----------|-------------------|
| **Lançar Aula** | `aulasLancadas.controller.ts` | ✅ `validarPlanoEnsinoAtivo` + `validarVinculoProfessorDisciplinaTurma` |
| **Marcar Presenças** | `presenca.controller.ts` | ✅ `validarPlanoEnsinoAtivo` + `validarVinculoProfessorDisciplinaTurma` |
| **Lançamento de notas** (API) | `nota.controller.ts` | ✅ `validarPlanoEnsinoAtivo` + `validarVinculoProfessorDisciplinaTurma` |
| **Criar Avaliação** | `avaliacao.controller.ts` | ✅ `validarPlanoEnsinoAtivo` + `validarVinculoProfessorDisciplinaTurma` |

#### 3.2 Busca de Turmas do Professor

**Arquivo:** `backend/src/controllers/turma.controller.ts`

**Endpoint:** `GET /turmas?professorId=xxx`

**Implementação:**
- ✅ Usa `buscarTurmasProfessorComPlanoAtivo()` 
- ✅ Retorna apenas turmas com Plano de Ensino ATIVO
- ✅ Filtra por `estado = 'APROVADO'` e `bloqueado = false`

**Função:**
```typescript
export async function buscarTurmasProfessorComPlanoAtivo(
  instituicaoId: string,
  professorId: string,
  anoLetivoId?: string | null
): Promise<Array<{ id: string; nome: string; codigo: string; disciplinaId: string; disciplinaNome: string; planoEnsinoId: string; turma: any }>>
```

### 4. Painel do Professor

**Arquivo:** `frontend/src/pages/professor/ProfessorDashboard.tsx`

#### 4.1 Verificação de Plano de Ensino ATIVO

```typescript
// Filtrar apenas planos ATIVOS (APROVADOS e não bloqueados)
const planosAtivos = planosEnsino.filter((plano: any) => {
  const estaAprovado = plano.estado === 'APROVADO';
  const naoEstaBloqueado = !plano.bloqueado;
  return estaAprovado && naoEstaBloqueado;
});

// Verificar se pode executar ações
const podeExecutarAcoes = turmas.length > 0 && (
  hasAnoLetivoAtivo ? temPlanoEnsinoAtivoAnoAtivo : temPlanoEnsinoAtivo
);
```

#### 4.2 Bloqueio de Ações

- ✅ Botões desabilitados quando `!podeExecutarAcoes`
- ✅ Tooltips explicativos
- ✅ Alert amarelo informando pendência administrativa

#### 4.3 Aviso Institucional

Quando não há Plano de Ensino ATIVO:

```tsx
<Alert className="border-yellow-500 bg-yellow-50">
  <AlertTitle>Pendência Administrativa - Plano de Ensino</AlertTitle>
  <AlertDescription>
    <strong>Você possui turmas atribuídas, mas não possui Plano de Ensino ATIVO (APROVADO) vinculado.</strong>
    <br />
    <strong>Regra Institucional (institucional):</strong> Professores só podem executar ações acadêmicas quando vinculados a um Plano de Ensino ATIVO.
    <br />
    <strong>Ações bloqueadas:</strong> Registrar aulas, marcar presenças, lançar notas, criar avaliações.
    <br />
    <strong>Solução:</strong> Contacte a coordenação acadêmica para atribuição e aprovação do Plano de Ensino.
  </AlertDescription>
</Alert>
```

---

## 🔄 FLUXO DE ATRIBUIÇÃO

### Passo 1: Coordenação Cria Plano de Ensino

**Endpoint:** `POST /plano-ensino`

**Permissões:** ADMIN, SUPER_ADMIN

**Payload:**
```json
{
  "professorId": "uuid",
  "disciplinaId": "uuid",
  "turmaId": "uuid",
  "anoLetivoId": "uuid",
  "cursoId": "uuid", // Obrigatório para Ensino Superior
  "classeId": "uuid", // Obrigatório para Ensino Secundário
  "semestre": 1, // Obrigatório para Ensino Superior
  "classeOuAno": "10ª Classe", // Obrigatório para Ensino Secundário
  "metodologia": "...",
  "objetivos": "...",
  "conteudoProgramatico": "...",
  "criteriosAvaliacao": "..."
}
```

**Validações:**
- ✅ Professor pertence à instituição
- ✅ Disciplina pertence à instituição
- ✅ Turma pertence à instituição
- ✅ Ano Letivo está ATIVO
- ✅ Campos obrigatórios conforme tipo de instituição

### Passo 2: Coordenação Planeja Aulas

**Endpoint:** `POST /plano-ensino/:id/aulas`

**Permissões:** ADMIN, SUPER_ADMIN

**Payload:**
```json
{
  "titulo": "Introdução à Disciplina",
  "descricao": "...",
  "tipo": "TEORICA",
  "trimestre": 1,
  "quantidadeAulas": 2
}
```

### Passo 3: Coordenação Aprova Plano

**Endpoint:** `PUT /plano-ensino/:id` (com `estado: "APROVADO"`)

**Permissões:** ADMIN, SUPER_ADMIN

**Resultado:**
- ✅ Plano fica com `estado = 'APROVADO'`
- ✅ Professor pode executar ações acadêmicas

### Passo 4: Professor Executa Ações

Após aprovação, o professor pode:
- ✅ Registrar aulas (`POST /aulas-lancadas`)
- ✅ Marcar presenças (`POST /presencas`)
- ✅ Lançar notas (`POST /notas`)
- ✅ Criar avaliações (`POST /avaliacoes`)

**Todas as ações validam:**
- ✅ Plano de Ensino está ATIVO
- ✅ Vínculo professor-disciplina-turma existe

---

## 📊 ENDPOINTS RELEVANTES

### Para Coordenação (ADMIN/SUPER_ADMIN)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/plano-ensino` | Criar/atribuir plano de ensino |
| `GET` | `/plano-ensino/contexto` | Buscar contexto (cursos, disciplinas, professores) |
| `GET` | `/plano-ensino` | Buscar planos de ensino |
| `PUT` | `/plano-ensino/:id` | Atualizar plano (incluindo aprovação) |
| `POST` | `/plano-ensino/:id/aulas` | Criar aula planejada |
| `PUT` | `/plano-ensino/:id/bloquear` | Bloquear plano |
| `PUT` | `/plano-ensino/:id/desbloquear` | Desbloquear plano |

### Para Professor

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/turmas?professorId=xxx` | Buscar turmas (filtra apenas com plano ativo) |
| `GET` | `/plano-ensino?professorId=xxx` | Buscar planos de ensino (apenas APROVADOS/ENCERRADOS) |
| `POST` | `/aulas-lancadas` | Registrar aula (valida plano ativo) |
| `POST` | `/presencas` | Marcar presenças (valida plano ativo) |
| `POST` | `/notas` | Lançar notas (valida plano ativo) |
| `POST` | `/avaliacoes` | Criar avaliação (valida plano ativo) |

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Backend

- [x] Validação `validarPlanoEnsinoAtivo` implementada
- [x] Validação `validarVinculoProfessorDisciplinaTurma` implementada
- [x] Função `buscarTurmasProfessorComPlanoAtivo` implementada
- [x] Validações aplicadas em `aulasLancadas.controller.ts`
- [x] Validações aplicadas em `presenca.controller.ts`
- [x] Validações aplicadas em `nota.controller.ts`
- [x] Validações aplicadas em `avaliacao.controller.ts`
- [x] Endpoint `GET /turmas?professorId=xxx` filtra por plano ativo
- [x] Endpoint `GET /turmas/professor` filtra por plano ativo
- [x] Endpoint `POST /plano-ensino` restrito a ADMIN/SUPER_ADMIN

### Frontend

- [x] Painel do professor verifica planos ativos
- [x] Ações bloqueadas quando não há plano ativo
- [x] Aviso institucional exibido quando necessário
- [x] Tooltips explicativos nos botões desabilitados

---

## 🎯 RESULTADO

✅ **Controle pedagógico institucional completo**
- Nenhuma ação acadêmica pode ser executada sem Plano de Ensino ATIVO
- Professor não pode criar planos (apenas coordenação)
- Validações aplicadas em todas as ações críticas

✅ **Comportamento idêntico ao institucional**
- Fluxo de aprovação institucional
- Bloqueio automático sem vínculo
- Mensagens claras para o professor

---

## 📝 NOTAS TÉCNICAS

### Multi-Tenant

Todas as validações garantem:
- ✅ `instituicaoId` sempre do token (nunca do request)
- ✅ Recursos pertencem à instituição do usuário
- ✅ Isolamento completo entre instituições

### Performance

- ✅ Índices no banco para `professorId`, `disciplinaId`, `turmaId`, `estado`
- ✅ Queries otimizadas com `findFirst` e filtros específicos
- ✅ Cache de planos ativos no frontend (React Query)

### Auditoria

Todas as ações são auditadas:
- ✅ Criação de plano de ensino
- ✅ Aprovação de plano de ensino
- ✅ Bloqueio/desbloqueio de plano
- ✅ Ações acadêmicas do professor

---

## 🔗 ARQUIVOS RELACIONADOS

### Backend

- `backend/src/services/validacaoAcademica.service.ts` - Validações principais
- `backend/src/controllers/planoEnsino.controller.ts` - CRUD de planos
- `backend/src/controllers/turma.controller.ts` - Busca de turmas
- `backend/src/controllers/aulasLancadas.controller.ts` - Lançamento de aulas
- `backend/src/controllers/presenca.controller.ts` - Presenças
- `backend/src/controllers/nota.controller.ts` - Notas
- `backend/src/controllers/avaliacao.controller.ts` - Avaliações

### Frontend

- `frontend/src/pages/professor/ProfessorDashboard.tsx` - Painel do professor
- `frontend/src/pages/admin/PlanoEnsino.tsx` - Gestão de planos (coordenação)

---

**Status Final:** ✅ **IMPLEMENTAÇÃO COMPLETA E VALIDADA**

