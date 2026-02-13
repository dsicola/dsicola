# 🔧 SOLUÇÃO - Professor Sem Turmas no Painel

**Data:** 2025-01-27  
**Problema:** Professor "Jose" tem disciplina e turma atribuídas, mas nada aparece no painel

---

## ✅ CORREÇÕES IMPLEMENTADAS

### 1. Ajuste na Lógica de Exposição

**Problema:** Planos em RASCUNHO/EM_REVISAO com turma não apareciam de forma alguma.

**Solução:** Agora expõem como disciplina sem turma para informação.

**Código Ajustado:**
```typescript
// Se plano está em RASCUNHO/EM_REVISAO e tem turma
// Não expor a turma (regra SIGA/SIGAE)
// Mas expor como disciplina sem turma para informação
if (!podeExporTurma && plano.turmaId && plano.turma) {
  // Criar entrada como disciplina sem turma
  turmasMap.set(chaveVirtual, {
    ...,
    turma: null,
    semTurma: true
  });
}
```

### 2. Logs de Debug Adicionados

**Backend:**
- ✅ Loga parâmetros da busca (instituicaoId, professorId, anoLetivoId)
- ✅ Loga quantidade de planos encontrados
- ✅ Loga detalhes de cada plano (estado, turmaId, disciplina)
- ✅ Avisa quando nenhum plano é encontrado

**Frontend:**
- ✅ Loga parâmetros enviados (user?.id, anoLetivoId)
- ✅ Loga dados retornados
- ✅ Loga detalhes das atribuições
- ✅ Avisa quando nenhuma atribuição é retornada

---

## 🔍 DIAGNÓSTICO NECESSÁRIO

### Passo 1: Verificar Logs do Backend

Procurar no console/logs do backend por:
```
[getTurmas] Buscando turmas para professor <id>
[buscarTurmasProfessorComPlanos] Parâmetros: instituicaoId=..., professorId=..., anoLetivoId=...
[buscarTurmasProfessorComPlanos] Encontrados X planos de ensino
```

**Se aparecer "NENHUM PLANO ENCONTRADO":**
- Verificar se `professorId` está correto (deve ser `User.id`)
- Verificar se `instituicaoId` está correto
- Verificar se há planos no banco para esse professor

### Passo 2: Verificar Logs do Frontend

No console do navegador (F12), procurar por:
```
[ProfessorDashboard] Buscando turmas com params
[ProfessorDashboard] user?.id: <id>
[ProfessorDashboard] Atribuições retornadas: X
```

**Se retornar 0 atribuições:**
- Verificar se `user?.id` está correto
- Verificar se há planos no banco para esse `user.id`

### Passo 3: Verificar no Banco de Dados

```sql
-- 1. Encontrar o userId do Jose
SELECT id, email, nome_completo, instituicao_id 
FROM users 
WHERE nome_completo ILIKE '%jose%' 
   OR email ILIKE '%jose%';

-- 2. Verificar planos de ensino do Jose (substituir <userId> pelo id encontrado)
SELECT 
  pe.id,
  pe.professor_id,
  pe.estado,
  pe.bloqueado,
  pe.turma_id,
  pe.disciplina_id,
  pe.ano_letivo_id,
  pe.instituicao_id,
  d.nome as disciplina_nome,
  t.nome as turma_nome,
  CASE 
    WHEN pe.estado = 'APROVADO' AND pe.bloqueado = false THEN 'ATIVO'
    WHEN pe.estado = 'ENCERRADO' THEN 'ENCERRADO'
    WHEN pe.bloqueado = true THEN 'BLOQUEADO'
    ELSE pe.estado
  END as status_visualizacao
FROM plano_ensino pe
LEFT JOIN disciplinas d ON d.id = pe.disciplina_id
LEFT JOIN turmas t ON t.id = pe.turma_id
WHERE pe.professor_id = '<userId_do_jose>'
ORDER BY pe.created_at DESC;
```

### Passo 4: Verificar Mapeamento

**IMPORTANTE:** `PlanoEnsino.professorId` = `User.id` (userId), NÃO `Professor.id`

Verificar se:
- ✅ O `user?.id` do frontend corresponde ao `professor_id` no banco
- ✅ O `instituicaoId` do token corresponde ao `instituicao_id` dos planos

---

## 🎯 POSSÍVEIS CAUSAS

### Causa 1: Plano em RASCUNHO/EM_REVISAO com Turma
**Sintoma:** Nada aparece no painel  
**Solução:** ✅ Já corrigido - agora aparece como disciplina sem turma

### Causa 2: professorId Incorreto
**Sintoma:** Backend retorna 0 planos  
**Solução:** Verificar se `user?.id` = `PlanoEnsino.professor_id`

### Causa 3: Instituição Diferente
**Sintoma:** Backend retorna 0 planos  
**Solução:** Verificar se `User.instituicaoId` = `PlanoEnsino.instituicao_id`

### Causa 4: Ano Letivo Diferente
**Sintoma:** Backend retorna 0 planos (se anoLetivoId for passado)  
**Solução:** Verificar se os planos estão no ano letivo correto

---

## 📋 CHECKLIST DE VERIFICAÇÃO

- [ ] Verificar logs do backend
- [ ] Verificar logs do frontend
- [ ] Executar query SQL para verificar planos
- [ ] Verificar se `user?.id` = `professor_id` no banco
- [ ] Verificar se `instituicaoId` está correto
- [ ] Verificar estado dos planos (RASCUNHO, EM_REVISAO, APROVADO, ENCERRADO)
- [ ] Verificar se planos têm turma vinculada

---

**Status:** ✅ **CORREÇÕES IMPLEMENTADAS - AGUARDANDO DIAGNÓSTICO DOS LOGS**

