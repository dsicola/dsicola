# Ajustes do Modelo Institucional - DSICOLA

## Status: Em Progresso

### Objetivo
Ajustar TODO o sistema DSICOLA para respeitar rigorosamente o modelo institucional SIGA/SIGAE, garantindo:
- Zero campos errados por tipo de instituição
- Terminologia institucional correta (Estudante)
- Multi-tenant seguro e consistente
- Frontend e Backend totalmente alinhados

---

## REGRAS ABSOLUTAS (NÃO VIOLAR)

### 1. ENSINO SUPERIOR:
- ✅ NUNCA exibir ou validar: Classe, Trimestre
- ✅ SEMPRE usar: Ano Letivo, Semestre

### 2. ENSINO SECUNDÁRIO:
- ✅ NUNCA exibir ou validar: Semestre, Ano do Curso
- ✅ SEMPRE usar: Classe, Trimestre

### 3. Terminologia:
- 🔄 "Aluno" → "Estudante" (em progresso)
  - UI: ~1042 ocorrências
  - Backend: ~791 ocorrências
  - Schema: UserRole.ALUNO → ESTUDANTE (requer migration)

### 4. Campos acadêmicos:
- ✅ Exibir SOMENTE se existirem cadastros reais
- ✅ Nunca mostrar opções fictícias

### 5. MULTI-TENANT:
- ✅ instituicao_id SEMPRE vem do token
- ✅ Nunca confiar em dados do frontend
- ✅ TODAS as queries filtram por instituicao_id e tipoInstituicao

---

## CORREÇÕES IMPLEMENTADAS

### ✅ Backend - Validações Condicionais
- `planoEnsino.controller.ts`: Validações condicionais por tipoInstituicao
- `avaliacao.controller.ts`: Validações condicionais por tipoInstituicao
- `classe.controller.ts`: Bloqueia criação de classes no Ensino Superior
- `semestre.controller.ts`: Bloqueia criação de semestres no Ensino Secundário
- `trimestre.controller.ts`: Bloqueia criação de trimestres no Ensino Superior

### ✅ Frontend - Campos Condicionais
- `ConfiguracaoEnsino.tsx`: Tabs de Semestres/Trimestres condicionais
- `PlanoEnsinoTab.tsx`: Campos condicionais corretos
- `GerenciarTab.tsx`: Exibe apenas período correto
- `PlanejarTab.tsx`: Exibe apenas período correto
- `ExecutarTab.tsx`: Exibe apenas período correto
- `FinalizarTab.tsx`: Exibe apenas período correto
- `PeriodoAcademicoSelect.tsx`: Filtra por tipoInstituicao

### ✅ Multi-Tenant
- Todas as queries backend filtram por `instituicaoId`
- `getContextoPlanoEnsino` retorna apenas dados corretos por tipoInstituicao

---

## CORREÇÕES EM PROGRESSO

### 🔄 Substituição "Aluno" → "Estudante"
**Prioridade**: Alta
**Status**: Em Progresso (Textos visíveis ao usuário)

**Arquivos atualizados (textos visíveis)**:
- ✅ `frontend/src/components/admin/AlunosTab.tsx` - Mensagens e labels
- ✅ `frontend/src/pages/admin/AdminDashboard.tsx` - Mensagens
- ✅ `frontend/src/components/admin/MatriculasAnuaisTab.tsx` - Mensagens
- ✅ `frontend/src/components/configuracaoEnsino/LancamentoNotasTab.tsx` - Mensagens
- ✅ `frontend/src/components/relatorios/PautaVisualizacao.tsx` - Mensagens
- ✅ `frontend/src/components/admin/PautasTab.tsx` - Mensagens
- ✅ `frontend/src/components/configuracaoEnsino/AvaliacoesNotasTab.tsx` - Mensagens

**Pendentes (nomes de variáveis/APIs)**:
- 🔄 `frontend/src/services/api.ts` (alunosApi → estudantesApi) - Manter compatibilidade
- 🔄 `backend/src/controllers/*` (aluno → estudante) - Manter compatibilidade
- 🔄 `backend/prisma/schema.prisma` (UserRole.ALUNO → ESTUDANTE) - Requer migration

**Estratégia**:
1. ✅ Atualizar textos visíveis ao usuário (concluído)
2. 🔄 Criar aliases/renames para não quebrar funcionalidades
3. 🔄 Atualizar backend mantendo compatibilidade
4. 🔄 Migration do schema por último

---

## PENDENTES

### 📋 Verificações Necessárias
1. ✅ Validações backend em todos os controllers (parcialmente implementado)
2. 🔄 Formulários que podem bloquear por campos inválidos
3. 🔄 Testar fluxo completo para ambos os tipos de instituição
4. 🔄 Verificar relatórios e PDFs
5. 🔄 Verificar mensagens de erro e validação

---

## CHECKLIST FINAL

- [ ] Zero campos de Classe no Ensino Superior
- [ ] Zero campos de Semestre no Ensino Secundário
- [ ] Zero campos de Trimestre no Ensino Superior
- [ ] Zero referências a "Aluno" na UI
- [ ] Zero referências a "Aluno" no backend (exceto migrations)
- [ ] Todas as queries multi-tenant
- [ ] Todos os dropdowns só mostram dados reais
- [ ] Validações backend condicionais por tipoInstituicao
- [ ] Formulários não bloqueiam por campos inválidos

---

## NOTAS IMPORTANTES

1. **Schema Prisma**: Mudança de `UserRole.ALUNO` para `ESTUDANTE` requer migration cuidadosa
2. **API Routes**: Manter compatibilidade durante transição
3. **Database**: Considerar migration script para atualizar dados existentes
4. **Testes**: Testar ambos os tipos de instituição após cada mudança

