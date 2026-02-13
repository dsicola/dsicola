# Implementação: Ano Letivo como Eixo Central

## Status: EM PROGRESSO ✅

Data: 2024-12-19

## ✅ IMPLEMENTADO

### Backend

1. **Serviço de Validação** (`validacaoAcademica.service.ts`)
   - ✅ `validarAnoLetivoIdAtivo()` - Valida ano letivo por ID (existe, pertence à instituição, está ATIVO)
   - ✅ `buscarAnoLetivoAtivo()` - Busca ano letivo ativo da instituição
   - ✅ `validarAnoLetivoAtivo()` - Valida ano letivo por número do ano

2. **Middleware** (`anoLetivo.middleware.ts`)
   - ✅ `requireAnoLetivoAtivo` - Middleware que exige ano letivo ativo
   - ✅ `validateAnoLetivoId()` - Middleware que valida anoLetivoId do body/params/query

3. **Endpoint**
   - ✅ `GET /anos-letivos/ativo` - Retorna ano letivo ativo da instituição

4. **Controllers Atualizados**
   - ✅ **PlanoEnsino**: Valida ano letivo ATIVO antes de criar/atualizar
   - ✅ **MatriculaAnual**: Valida ano letivo ATIVO e salva `anoLetivoId`
   - ✅ **AulaLancada**: Valida que plano de ensino tem ano letivo ATIVO
   - ✅ **Avaliacao**: Valida que plano de ensino tem ano letivo ATIVO
   - ✅ **Semestre/Trimestre**: Já validavam ano letivo (implementação existente)

### Frontend

1. **Hook** (`useAnoLetivoAtivo.ts`)
   - ✅ Hook para verificar ano letivo ativo
   - ✅ Retorna `hasAnoLetivoAtivo`, `anoLetivoId`, `anoLetivo`

2. **Componente Guard** (`AnoLetivoAtivoGuard.tsx`)
   - ✅ Componente que bloqueia renderização sem ano letivo ativo
   - ✅ Hook `useAnoLetivoAtivoProps()` para desabilitar ações

3. **API Service**
   - ✅ `anoLetivoApi.getAtivo()` - Método para buscar ano letivo ativo

## 🔄 PENDENTE

### Backend

1. **Schema Prisma**
   - ⏳ Avaliar tornar `anoLetivoId` obrigatório em:
     - `MatriculaAnual` (atualmente opcional)
     - `PlanoEnsino` (atualmente opcional)
     - Outras entidades críticas

2. **Controllers Adicionais**
   - ⏳ **Presenca**: Validar via `AulaLancada` → `PlanoEnsino` → Ano Letivo
   - ⏳ **Nota**: Validar via `Avaliacao` → `PlanoEnsino` → Ano Letivo
   - ⏳ **Turma**: Considerar validação de ano letivo
   - ⏳ **AlunoDisciplina**: Validar ano letivo via matrícula anual

3. **Middleware em Rotas**
   - ⏳ Aplicar `requireAnoLetivoAtivo` ou `validateAnoLetivoId` nas rotas críticas:
     - `/plano-ensino/*` (CREATE/UPDATE)
     - `/matriculas-anuais/*` (CREATE)
     - `/aulas-lancadas/*` (CREATE)
     - `/avaliacoes/*` (CREATE)
     - `/presencas/*` (CREATE)
     - `/notas/*` (CREATE)

### Frontend

1. **Componentes a Atualizar**
   - ⏳ Páginas acadêmicas principais:
     - `PlanoEnsino` - Adicionar `AnoLetivoAtivoGuard`
     - `LancamentoAulas` - Adicionar `AnoLetivoAtivoGuard`
     - `AvaliacoesNotas` - Adicionar `AnoLetivoAtivoGuard`
     - `ControlePresencas` - Adicionar `AnoLetivoAtivoGuard`
     - `MatriculasAnuais` - Adicionar `AnoLetivoAtivoGuard`

2. **Formulários**
   - ⏳ Garantir que todos os formulários acadêmicos exijam seleção de Ano Letivo
   - ⏳ Pré-selecionar ano letivo ativo quando disponível
   - ⏳ Validar no frontend antes de submit

3. **Mensagens de Erro**
   - ⏳ Padronizar mensagens quando não há ano letivo ativo
   - ⏳ Mostrar link para criar/ativar ano letivo

## 📋 REGRAS IMPLEMENTADAS

### Backend - Regra Mestra

✅ **Nenhuma operação acadêmica pode existir fora de um Ano Letivo ATIVO**

Validações aplicadas:
1. ✅ Ano letivo deve existir
2. ✅ Ano letivo deve pertencer à instituição do token (multi-tenant)
3. ✅ Ano letivo deve estar com status `ATIVO` (não `PLANEJADO` ou `ENCERRADO`)
4. ✅ `anoLetivoId` deve ser fornecido ou inferido do contexto

### Frontend - UX Institucional

✅ **Se NÃO existir Ano Letivo ATIVO:**
- Mostrar mensagem clara
- Desabilitar ações acadêmicas
- Oferecer link para criar/ativar ano letivo

✅ **Combos de seleção:**
- Carregar SOMENTE anos criados no sistema
- Nunca permitir digitação manual
- Sempre usar `GET /anos-letivos`

## 🔍 TESTES OBRIGATÓRIOS

### Backend (Pendente)
- ⏳ Criar entidade sem Ano Letivo → BLOQUEAR
- ⏳ Criar com Ano Letivo ENCERRADO → BLOQUEAR
- ⏳ Criar com Ano Letivo de outra instituição → BLOQUEAR
- ⏳ Criar com Ano Letivo ATIVO → PERMITIR

### Frontend (Pendente)
- ⏳ Testar bloqueio sem ano letivo ativo
- ⏳ Testar pré-seleção de ano letivo ativo
- ⏳ Testar validação em formulários

## 📝 NOTAS

1. **Compatibilidade**: Mantida compatibilidade com código que usa `anoLetivo` (número) ao invés de `anoLetivoId`
2. **Semestre/Trimestre**: Já tinham validação de ano letivo implementada anteriormente
3. **Multi-tenant**: Todas as validações garantem isolamento por `instituicaoId`

## 🚀 PRÓXIMOS PASSOS

1. Aplicar middleware nas rotas críticas
2. Atualizar componentes frontend principais
3. Tornar `anoLetivoId` obrigatório no schema (migração)
4. Implementar testes automatizados
5. Documentar para equipe

