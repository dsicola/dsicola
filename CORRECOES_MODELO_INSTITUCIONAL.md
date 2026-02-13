# Correções do Modelo Institucional - DSICOLA

## Status das Correções

### ✅ Concluídas

1. **TurmasTab.tsx**:
   - ✅ Removido campo duplicado "classe" (string) - agora usa apenas `classe_id` (Select de classes cadastradas)
   - ✅ Schema de validação condicional baseado em `tipoInstituicao` (`createTurmaSchema`)
   - ✅ Validação condicional: semestre obrigatório apenas para Ensino Superior
   - ✅ Campo semestre só aparece no Ensino Superior (`{!isSecundario && ...}`)
   - ✅ Campo classe só aparece no Ensino Secundário (`{isSecundario && ...}`)
   - ✅ Payload condicional: semestre = null para Ensino Secundário

2. **Backend - planoEnsino.controller.ts**:
   - ✅ `getContextoPlanoEnsino` retorna apenas semestres para ENSINO_SUPERIOR
   - ✅ `getContextoPlanoEnsino` retorna apenas trimestres para ENSINO_SECUNDARIO
   - ✅ Validações condicionais já implementadas

3. **Frontend - Componentes de Plano de Ensino**:
   - ✅ GerenciarTab, PlanejarTab, ExecutarTab, FinalizarTab já corrigidos
   - ✅ Exibem apenas o período correto baseado em `tipoInstituicao`

4. **MatriculasAnuaisTab.tsx**:
   - ✅ Verificado: "Ano do Curso" aparece apenas para Ensino Superior (correto)
   - ✅ "Classe" aparece apenas para Ensino Secundário (correto)

### 🔄 Em Progresso

1. **Substituição de "Aluno" por "Estudante"**:
   - ~1042 ocorrências no frontend
   - ~791 ocorrências no backend
   - **Nota**: Esta é uma mudança grande que requer cuidado para não quebrar funcionalidades
   - **Recomendação**: Fazer em etapas, começando pelos componentes mais visíveis (UI)

### 📋 Pendentes

1. Verificar validações backend em todos os controllers (já parcialmente implementado)
2. Verificar formulários que podem bloquear por campos inválidos
3. Testar fluxo completo para ambos os tipos de instituição

## Regras Implementadas

### ENSINO SUPERIOR
- ✅ NUNCA exibe Classe
- ✅ NUNCA exibe Trimestre
- ✅ SEMPRE usa Semestre
- ✅ SEMPRE usa Ano Letivo
- ✅ "Ano do Curso" pode aparecer (correto)

### ENSINO SECUNDÁRIO
- ✅ NUNCA exibe Semestre
- ✅ NUNCA exibe "Ano do Curso" (verificado em MatriculasAnuaisTab)
- ✅ SEMPRE usa Classe
- ✅ SEMPRE usa Trimestre

## Arquivos Modificados

1. `frontend/src/components/admin/TurmasTab.tsx`
   - Schema condicional
   - Validação condicional
   - Remoção de campo duplicado "classe" (string)

2. `backend/src/controllers/planoEnsino.controller.ts`
   - Filtro condicional de semestres/trimestres em `getContextoPlanoEnsino`

## Próximos Passos

1. ✅ **Concluído**: Correção estrutural de TurmasTab
2. 🔄 **Em Progresso**: Substituição de "Aluno" por "Estudante" (requer planejamento)
3. 📋 **Pendente**: Testes end-to-end para ambos os tipos de instituição
4. 📋 **Pendente**: Verificação de outros componentes críticos (Avaliações, Relatórios)
