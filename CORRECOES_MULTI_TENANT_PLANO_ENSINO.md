# Correções Multi-Tenant e Filtros de Tipo de Instituição - Plano de Ensino

## Problemas Corrigidos

### ✅ Backend - Multi-Tenant 100%

1. **Função `recalcularCargaHorariaPlanejada`**
   - ✅ Adicionada validação multi-tenant explícita
   - ✅ Valida que plano pertence à instituição antes de buscar aulas
   - ✅ Todas as chamadas atualizadas para incluir `instituicaoId`

2. **Função `getCargaHorariaExigida`**
   - ✅ Adicionada validação multi-tenant explícita
   - ✅ Valida que plano pertence à instituição antes de buscar disciplina

3. **Função `createAula`**
   - ✅ Validação multi-tenant já estava presente (valida plano antes)
   - ✅ Mantida validação existente

4. **Função `updateAula`**
   - ✅ Reordenada validação: multi-tenant ANTES de permissão
   - ✅ Mensagem de erro mais clara: "Aula não encontrada ou não pertence à sua instituição"

5. **Função `deleteAula`**
   - ✅ Reordenada validação: multi-tenant ANTES de permissão
   - ✅ Mensagem de erro mais clara: "Aula não encontrada ou não pertence à sua instituição"

6. **Função `reordenarAulas`**
   - ✅ Adicionada validação explícita: verifica que todas as aulas pertencem ao plano
   - ✅ Previne atualização de aulas de outras instituições

7. **Função `marcarAulaMinistrada`**
   - ✅ Adicionada validação multi-tenant explícita
   - ✅ Mensagem de erro mais clara

8. **Função `desmarcarAulaMinistrada`**
   - ✅ Adicionada validação multi-tenant explícita
   - ✅ Mensagem de erro mais clara

9. **Função `removeBibliografia`**
   - ✅ Adicionada validação multi-tenant explícita
   - ✅ Mensagem de erro mais clara: "Bibliografia não encontrada ou não pertence à sua instituição"

10. **Função `ajustarCargaHorariaAutomatico`**
    - ✅ Adicionada chamada a `recalcularCargaHorariaPlanejada` com `instituicaoId`
    - ✅ Garante sincronização após ajustes

### ✅ Backend - Filtro de Tipo de Instituição

1. **Endpoint `getContextoPlanoEnsino`**
   - ✅ Filtra cursos apenas para ENSINO_SUPERIOR
   - ✅ Filtra classes apenas para ENSINO_SECUNDARIO
   - ✅ Filtra semestres apenas para ENSINO_SUPERIOR
   - ✅ Filtra trimestres apenas para ENSINO_SECUNDARIO
   - ✅ Retorna `tipoInstituicao` no response

2. **Validações Condicionais**
   - ✅ Semestre obrigatório apenas para ENSINO_SUPERIOR
   - ✅ Classe obrigatória apenas para ENSINO_SECUNDARIO
   - ✅ Validação de período acadêmico conforme tipo de instituição

### ✅ Frontend - Botões Desabilitados

1. **Botão "Criar Plano de Ensino"**
   - ✅ Desabilitado apenas quando contexto inválido OU mutation em progresso
   - ✅ Mostra mensagens claras sobre o que falta

2. **Botão "Copiar Plano"**
   - ✅ Desabilitado quando: bloqueado OU sem plano OU sem anos letivos
   - ✅ Mensagens de tooltip claras

3. **Botão "Ajustar Automaticamente"**
   - ✅ Corrigido: não desabilita indevidamente
   - ✅ Desabilitado apenas quando mutation em progresso
   - ✅ Só aparece quando há plano e status não é "ok"

4. **Botão "Planejar Aula"**
   - ✅ SEMPRE habilitado (regra SIGA/SIGAE)
   - ✅ Permite planejamento temporário mesmo com carga horária incompleta

5. **Botão "Adicionar Bibliografia"**
   - ✅ Desabilitado apenas quando: bloqueado OU sem plano
   - ✅ Mensagens de tooltip claras

6. **Botão "Criar" no Modal de Aula**
   - ✅ Desabilitado apenas quando: campos obrigatórios vazios OU mutation em progresso
   - ✅ Validação simplificada e estável
   - ✅ NÃO desabilita por falta de ano letivo (já está no contexto do plano)

## Arquivos Modificados

### Backend
- `backend/src/controllers/planoEnsino.controller.ts`
  - Função `recalcularCargaHorariaPlanejada`: Adicionada validação multi-tenant
  - Função `getCargaHorariaExigida`: Adicionada validação multi-tenant
  - Função `updateAula`: Reordenada validação multi-tenant
  - Função `deleteAula`: Reordenada validação multi-tenant
  - Função `reordenarAulas`: Adicionada validação de aulas pertencentes ao plano
  - Função `marcarAulaMinistrada`: Adicionada validação multi-tenant explícita
  - Função `desmarcarAulaMinistrada`: Adicionada validação multi-tenant explícita
  - Função `removeBibliografia`: Adicionada validação multi-tenant explícita
  - Função `ajustarCargaHorariaAutomatico`: Adicionada chamada a recalcular com instituicaoId

### Frontend
- `frontend/src/pages/admin/planoEnsino/PlanejarTab.tsx`
  - Botão "Ajustar Automaticamente": Corrigida condição de desabilitação
  - Botão "Copiar Plano": Adicionada validação de anos letivos disponíveis
  - Validações de contexto melhoradas com mensagens claras

## Validações Multi-Tenant Implementadas

Todas as operações agora validam explicitamente:

1. **Antes de buscar dados**: Verifica que o plano/aula/bibliografia pertence à instituição
2. **Antes de atualizar**: Valida multi-tenant ANTES de validar permissões
3. **Antes de deletar**: Valida multi-tenant ANTES de validar permissões
4. **Mensagens de erro**: Clarificadas para indicar problema de multi-tenant

## Filtros de Tipo de Instituição

Todas as queries agora respeitam:

1. **ENSINO_SUPERIOR**: Retorna apenas cursos e semestres
2. **ENSINO_SECUNDARIO**: Retorna apenas classes e trimestres
3. **Validações condicionais**: Semestre/classe obrigatórios conforme tipo

## Testes Recomendados

1. ✅ Tentar acessar plano de outra instituição → 404
2. ✅ Tentar atualizar aula de outra instituição → 404
3. ✅ Tentar deletar aula de outra instituição → 404
4. ✅ Verificar que botões não desabilitam indevidamente
5. ✅ Verificar que selects mostram apenas dados reais do banco
6. ✅ Verificar que campos condicionais aparecem/ocultam corretamente

