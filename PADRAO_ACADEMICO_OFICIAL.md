# 📚 PADRÃO ACADÊMICO OFICIAL - DSICOLA

## ✅ Status da Implementação

**Data**: 2025-01-27  
**Status**: Implementação em andamento

---

## 🎯 Objetivo

Consolidar como **PADRÃO OFICIAL** do sistema DSICOLA o fluxo acadêmico completo de:
- **Ano Letivo**
- **Semestre** (Universidade)
- **Trimestre** (Ensino Secundário)

Com regras claras, profissionais e adaptadas a ambos os tipos de instituição.

---

## 📋 Estados Oficiais

### Ano Letivo
- `PLANEJADO` - Ano criado, aguardando ativação
- `ATIVO` - Ano em execução
- `ENCERRADO` - Ano finalizado

### Semestre / Trimestre
- `PLANEJADO` - Período criado, aguardando ativação
- `ATIVO` - Período em execução (aulas, presenças, notas habilitadas)
- `ENCERRADO` - Período finalizado (bloqueia edições)
- `CANCELADO` - Período cancelado

---

## 🔄 Fluxo Acadêmico

### 1. Planejamento (Independente de Execução)

**ADMIN ACADÊMICO PODE:**
- ✅ Criar Ano Letivo (mesmo sem professores)
- ✅ Criar Semestres / Trimestres
- ✅ Definir datas oficiais
- ✅ Criar Plano de Ensino
- ✅ Configurar datas de notas

**NUNCA BLOQUEAR:**
- ❌ Criação por ausência de professor
- ❌ Criação por ausência de turma
- ❌ Criação por ausência de disciplina

### 2. Ativação (Início do Período)

**Um período só pode ser ATIVADO se:**
- ✅ Estiver dentro do Ano Letivo
- ✅ Datas forem válidas
- ✅ Ano Letivo estiver ATIVO

**Ao ATIVAR:**
- ✅ Alunos "Matriculados" → "Cursando"
- ✅ Professores podem lançar aulas
- ✅ Presenças e notas ficam habilitadas

### 3. Execução (Operações Acadêmicas)

**LANÇAMENTO DE AULAS:**
- ✅ Somente se período = `ATIVO`
- ✅ Somente professor atribuído
- ✅ Data da aula deve estar dentro do período

**CONTROLE DE PRESENÇAS:**
- ✅ Somente após aula lançada
- ✅ Somente alunos com status "Cursando"

**AVALIAÇÕES E NOTAS:**
- ✅ Somente dentro do período `ATIVO`
- ✅ Datas de avaliação devem respeitar o calendário
- ✅ Respeitar `dataInicioNotas` e `dataFimNotas`

### 4. Encerramento

**ENCERRAMENTO DE PERÍODO:**
- ✅ Calcula médias finais
- ✅ Bloqueia edição de aulas, presenças e notas
- ✅ Registra encerramento em auditoria

**ENCERRAMENTO DE ANO LETIVO:**
- ✅ Só permitido se TODOS os períodos estiverem ENCERRADOS
- ✅ Consolida histórico acadêmico

---

## 🚫 Bloqueios Obrigatórios

### Backend (Sempre Bloqueia)

1. **Lançar aula fora do período ATIVO**
   - Mensagem: "Período acadêmico ainda não está ativo. Status atual: PLANEJADO."

2. **Lançar nota fora do intervalo permitido**
   - Mensagem: "Período ainda não iniciado para lançamento de notas."
   - Mensagem: "Prazo de lançamento de notas encerrado."

3. **Editar após encerramento**
   - Mensagem: "Período encerrado. A ação 'X' não é permitida após o encerramento."

4. **Data da aula fora do período**
   - Mensagem: "A data da aula está antes/depois do período."

### Frontend (UX)

- Ocultar ou desabilitar ações conforme status
- Exibir mensagens claras e profissionais
- Feedback visual de bloqueios

---

## 📊 Modelo de Dados

### Schema Prisma

```prisma
model AnoLetivo {
  id            String          @id
  ano           Int             @unique
  dataInicio    DateTime
  dataFim       DateTime?
  status        StatusAnoLetivo @default(PLANEJADO)
  instituicaoId String?
  ativadoPor    String?
  ativadoEm     DateTime?
  encerradoPor  String?
  encerradoEm   DateTime?
  // ...
}

model Semestre {
  id                String         @id
  anoLetivoId       String?
  anoLetivo         Int
  numero            Int            // 1 ou 2
  dataInicio        DateTime
  dataFim           DateTime?
  dataInicioNotas   DateTime?      // NOVO
  dataFimNotas      DateTime?      // NOVO
  status            StatusSemestre @default(PLANEJADO)
  ativadoPor        String?        // Renomeado de iniciadoPor
  ativadoEm         DateTime?     // Renomeado de iniciadoEm
  // ...
}

model Trimestre {
  id                String         @id
  anoLetivoId       String?
  anoLetivo         Int
  numero            Int            // 1, 2 ou 3
  dataInicio        DateTime
  dataFim           DateTime?
  dataInicioNotas   DateTime?
  dataFimNotas      DateTime?
  status            StatusSemestre @default(PLANEJADO)
  ativadoPor        String?
  ativadoEm         DateTime?
  // ...
}
```

---

## 🔧 Implementação Técnica

### Serviços Criados

1. **`validacaoAcademica.service.ts`**
   - `buscarPeriodoAcademico()` - Busca semestre ou trimestre
   - `validarPeriodoAtivoParaAulas()` - Valida status e datas
   - `validarPeriodoAtivoParaNotas()` - Valida prazo de notas
   - `validarPeriodoNaoEncerrado()` - Bloqueia edições
   - `validarAnoLetivoAtivo()` - Valida ano letivo

### Controllers Criados

1. **`anoLetivo.controller.ts`**
   - `listAnosLetivos()`
   - `getAnoLetivo()`
   - `createAnoLetivo()`
   - `updateAnoLetivo()`
   - `ativarAnoLetivo()`
   - `encerrarAnoLetivo()`

2. **`trimestre.controller.ts`**
   - `listTrimestres()`
   - `getTrimestre()`
   - `getTrimestreAtual()`
   - `createTrimestre()`
   - `updateTrimestre()`
   - `ativarTrimestre()`

3. **`semestre.controller.ts`** (Atualizado)
   - Renomeado: `iniciarSemestre()` → `ativarSemestre()`
   - Status: `INICIADO` → `ATIVO`
   - Campos: `iniciadoPor/iniciadoEm` → `ativadoPor/ativadoEm`
   - Adicionado: `dataInicioNotas`, `dataFimNotas`

### Rotas Criadas

- `GET /anos-letivos` - Listar anos letivos
- `POST /anos-letivos` - Criar ano letivo
- `POST /anos-letivos/ativar` - Ativar ano letivo
- `POST /anos-letivos/encerrar` - Encerrar ano letivo
- `GET /trimestres` - Listar trimestres
- `POST /trimestres` - Criar trimestre
- `POST /trimestres/ativar` - Ativar trimestre
- `POST /semestres/ativar` - Ativar semestre (renomeado)

---

## ⚠️ Migration Necessária

**IMPORTANTE**: Execute a migration antes de continuar:

```bash
cd backend
npx prisma migrate dev --name padrao_academico_oficial
npx prisma generate
```

### Mudanças na Migration

1. Enum `StatusSemestre`: `INICIADO` → `ATIVO`
2. Novo enum `StatusAnoLetivo`
3. Novo modelo `AnoLetivo`
4. Novo modelo `Trimestre`
5. Campos renomeados em `Semestre`:
   - `iniciadoPor` → `ativadoPor`
   - `iniciadoEm` → `ativadoEm`
6. Novos campos em `Semestre` e `Trimestre`:
   - `dataInicioNotas`
   - `dataFimNotas`
   - `anoLetivoId`

---

## 📝 Próximos Passos

1. ✅ Schema atualizado
2. ✅ Controllers criados
3. ✅ Rotas configuradas
4. ✅ Serviço de validação criado
5. ⏳ **PENDENTE**: Executar migration
6. ⏳ **PENDENTE**: Adicionar validações em presenças
7. ⏳ **PENDENTE**: Adicionar validações em notas
8. ⏳ **PENDENTE**: Atualizar frontend
9. ⏳ **PENDENTE**: Atualizar scheduler automático

---

## 🎯 Critérios de Sucesso

- [x] Planejamento independente de execução
- [x] Regras claras por tipo de instituição
- [x] Datas respeitadas rigorosamente
- [x] Bloqueios corretos e institucionais
- [x] Backend como fonte da verdade
- [ ] UX clara e profissional (pendente frontend)
- [ ] Padrão consolidado para todo o sistema

---

**Última atualização**: 2025-01-27

