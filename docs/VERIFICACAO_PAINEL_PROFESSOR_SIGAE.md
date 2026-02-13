# Verificação: Painel do Professor (Padrão SIGAE)

**Data:** 2025-02-11  
**Status:** ✅ Implementado conforme padrão SIGAE

---

## O que o professor pode fazer no painel

### 1. Registrar aulas (conteúdo + frequência)

| Campo SIGAE | Implementação | Status |
|-------------|---------------|--------|
| **Data da aula** | Campo obrigatório no formulário | ✅ |
| **Tema/conteúdo lecionado** (diário de classe) | Campo `conteudoMinistrado` | ✅ |
| **Tipo** (teórica/prática/lab) | Herdado da aula planejada; exibido no select | ✅ |
| **Observações/ocorrências** | Campo `observacoes` no formulário | ✅ |
| **Presenças/Faltas** dos alunos | Lista de chamada com PRESENTE/AUSENTE/JUSTIFICADO | ✅ |
| **Hora início/fim** | Campos opcionais no formulário | ✅ |

### 2. Regra de bloqueio

| Regra SIGAE | Implementação | Status |
|-------------|---------------|--------|
| Só registra aula para plano **APROVADO** e ativo | Validação no frontend e backend | ✅ |
| RASCUNHO/EM_REVISAO: **aparece** mas **bloqueado** para lançar | Turma/disciplina visíveis; botão desabilitado; alerta exibido | ✅ |
| ENCERRADO: aparece, apenas visualização | Mesmo bloqueio de ações | ✅ |

---

## Fluxo implementado

1. **Professor acede** a Gestão de Frequência (Registro de Aulas e Frequência)

2. **Seleciona** Turma → Disciplina (vinculadas ao Plano de Ensino)

3. **Se plano NÃO está APROVADO** (RASCUNHO, EM_REVISAO, ENCERRADO):
   - Disciplina aparece no select
   - Alerta: "Registro bloqueado: Plano em RASCUNHO - aguardando aprovação"
   - Botão "Registrar Nova Aula" **desabilitado**
   - Tooltip explica o motivo

4. **Se plano está APROVADO** e não bloqueado:
   - Botão "Registrar Nova Aula" habilitado
   - Ao clicar, abre formulário com:
     - Aula planejada (com tipo Teórica/Prática)
     - Data da aula
     - Hora início/fim
     - Conteúdo ministrado (diário de classe)
     - Observações/ocorrências

5. **Após registrar** a aula:
   - Lista de chamada para marcar presenças (PRESENTE/AUSENTE/JUSTIFICADO)
   - Observações por aluno (opcional)

---

## Validações no backend

- `validarPlanoEnsinoAtivo`: plano deve estar APROVADO e não bloqueado
- `validarVinculoProfessorDisciplinaTurma`: professor deve estar vinculado ao plano
- `validarPeriodoAtivoParaAulas`: data dentro do período acadêmico
- `validarPeriodoNaoEncerrado`: período não pode estar encerrado

---

## Ficheiros principais

| Ficheiro | Função |
|----------|--------|
| `frontend/src/pages/professor/GestaoFrequencia.tsx` | Formulário de registro + lista de chamada |
| `frontend/src/pages/professor/ProfessorDashboard.tsx` | Painel com ações rápidas (bloqueadas sem plano ativo) |
| `frontend/src/hooks/usePlanoPermissoes.ts` | Hook para `podeVer` / `podeAgir` |
| `backend/src/controllers/aulasLancadas.controller.ts` | Criação de `AulaLancada` |
| `backend/src/services/validacaoAcademica.service.ts` | `validarPlanoEnsinoAtivo` |
