# Auditoria: Painel do Professor - Padrão SIGAE

**Data:** 2026-02-11  
**Objetivo:** Verificar se as capacidades do professor no painel estão implementadas conforme o padrão SIGAE.

---

## 1. Capacidades do Professor (Padrão SIGAE)

### 1.1 Lançar Avaliações e Notas ✅

| Item | Status | Localização |
|------|--------|-------------|
| Criar instrumentos de avaliação | ✅ | `avaliacao.controller.ts` - tipos: PROVA, TESTE, TRABALHO, PROVA_FINAL, RECUPERACAO |
| Lançar notas por aluno | ✅ | `nota.controller.ts` - createNota, createNotaLote |
| Ver médias/calculadoras | ✅ | `GestaoNotas.tsx` - calcularMediaFinalUniversidade, calcularMediaFinalEnsinoMedio |
| Corrigir/retificar notas | ✅ | `nota.controller.ts` - corrigirNota com notaHistorico (auditoria) |

### 1.2 Tipos de Avaliação Implementados ✅

| Tipo | Descrição | Schema |
|------|-----------|--------|
| PROVA | Prova escrita | ✅ |
| TESTE | Teste rápido | ✅ |
| TRABALHO | Trabalho prático | ✅ |
| PROVA_FINAL | Exame final | ✅ (exige permitirExameRecurso) |
| RECUPERACAO | Recuperação | ✅ (exige permitirExameRecurso) |

---

## 2. Bloqueios SIGAE Implementados

### 2.1 Plano não aprovado/ativo ✅

| Validação | Status | Localização |
|-----------|--------|-------------|
| Plano APROVADO | ✅ | `validarPlanoEnsinoAtivo()` em avaliacao, nota, presenca, aulasLancadas |
| Plano não bloqueado | ✅ | `validarPlanoEnsinoAtivo()` - verifica bloqueado=false |
| Professor vinculado ao plano | ✅ | `validarVinculoProfessorDisciplinaTurma()` |

**Arquivos:** `validacaoAcademica.service.ts`, `avaliacao.controller.ts`, `nota.controller.ts`, `presenca.controller.ts`, `aulasLancadas.controller.ts`

### 2.2 Período fechado ✅

| Validação | Status | Localização |
|-----------|--------|-------------|
| Trimestre encerrado - lançar nota | ✅ | `nota.controller.ts:481` - verificarTrimestreEncerrado |
| Trimestre encerrado - corrigir nota | ✅ | `nota.controller.ts:1027` - ADMIN pode com justificativa ≥20 chars |
| Ano letivo encerrado | ✅ | `bloquearAnoLetivoEncerrado` middleware em rotas de avaliação/nota |

### 2.3 Bloqueio financeiro do aluno ✅

| Configuração | Status | Observação |
|--------------|--------|------------|
| `permitirAvaliacoesComBloqueioFinanceiro` | ✅ | Existe em ConfiguracaoInstituicao (default: true) |
| Validação no lançamento de notas | ✅ | `nota.controller.ts` - createNota, corrigirNota, createNotaLote (exame), createNotasAvaliacaoEmLote |
| Bloqueio matrícula/documentos/certificados | ✅ | Implementado em bloqueioAcademico.service |

**Regra:** Quando `permitirAvaliacoesComBloqueioFinanceiro=false`, o sistema bloqueia lançamento/correção de notas para alunos com mensalidades pendentes. Aplicado em todos os endpoints de criação e correção de notas.

---

## 3. Auditoria de Correção de Notas ✅

| Item | Status | Localização |
|------|--------|-------------|
| Histórico de alterações | ✅ | `notaHistorico` - valorAnterior, valorNovo, motivo, corrigidoPor |
| Justificativa obrigatória (período encerrado) | ✅ | ADMIN deve fornecer motivo ≥20 caracteres |
| Log de auditoria | ✅ | AuditService.logUpdate |

---

## 4. Interface do Professor

### 4.1 Ações Rápidas no Dashboard ✅

| Ação | Rota | Bloqueio |
|------|------|----------|
| Registrar Aula | /painel-professor/frequencia | podeExecutarAcoes (plano ativo) |
| Marcar Presenças | /painel-professor/frequencia | podeExecutarAcoes |
| Lançar Notas | /painel-professor/notas | podeExecutarAcoes |
| Criar Avaliação | /admin-dashboard/avaliacoes-notas | podeExecutarAcoes |

### 4.2 Gestão de Notas (Professor) ✅

- **GestaoNotas.tsx:** Professor seleciona disciplina/turma, vê avaliações, lança notas por aluno
- **Cálculo de médias:** Regras para Ensino Superior e Ensino Médio implementadas
- **Correção:** Via API com motivo e histórico

---

## 5. MATERIAIS E COMUNICAÇÃO (SIGAE)

### 5.1 Enviar materiais/arquivos/links
- ❌ **NÃO IMPLEMENTADO** – Não existe módulo de material por turma/disciplina. Biblioteca é acervo físico.

### 5.2 Publicar avisos para turma/disciplina
- ✅ **IMPLEMENTADO** – Professor pode criar comunicados via `POST /comunicados` e `MuralComunicados.tsx`, restrito a turmas/cursos em que leciona.

### 5.3 Mensagens internas
- ✅ Professor ↔ Responsável: `mensagemResponsavel` – responde pais
- ❌ Professor ↔ Aluno: não existe
- ❌ Professor ↔ Coordenação: não existe

## 6. PEDIDOS E WORKFLOW (SIGAE)

### 6.1 Solicitar revisão de plano
- ⚠️ Workflow existe (`POST /workflow/submeter` aceita PROFESSOR) mas professor não pode criar/editar planos – só ADMIN. Professor nunca tem plano em RASCUNHO para submeter.

### 6.2 Solicitar correção turma/aluno
- ❌ **NÃO IMPLEMENTADO**

### 6.3 Solicitar reabertura pauta/período
- ❌ Apenas ADMIN/DIRECAO podem reabrir. Professor não pode solicitar.

### 6.4 Registrar justificativas (aulas repostas)
- ❌ `JustificativaFalta` é para RH (funcionários). Não existe justificativa de aula reposta/reposição acadêmica.

## 7. Resumo de Gaps

| # | Gap | Prioridade |
|---|-----|------------|
| 1 | Material de disciplina (arquivos/links por turma) | Alta |
| 2 | Mensagens professor↔aluno, professor↔coordenação | Média |
| 3 | Justificativa de aula reposta/reposição | Alta |
| 4 | Solicitar reabertura (professor solicita, admin aprova) | Média |
| 5 | Botão "Criar Avaliação" em /painel-professor/avaliacoes | Baixa |

---

## 8. Conclusão

O sistema está **bem implementado** no padrão SIGAE para:
- ✅ Criação de instrumentos de avaliação (teste, trabalho, exame, recurso)
- ✅ Lançamento de notas por aluno
- ✅ Cálculo de médias conforme regra institucional
- ✅ Correção/retificação com auditoria
- ✅ Bloqueio por plano não aprovado
- ✅ Bloqueio por período (trimestre) fechado
- ✅ Bloqueio financeiro opcional no lançamento e correção de notas (conforme configuração institucional)
