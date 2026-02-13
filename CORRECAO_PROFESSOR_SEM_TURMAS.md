# 🔧 CORREÇÃO - Professor Sem Turmas no Painel

**Data:** 2025-01-27  
**Problema:** Professor "Jose" tem disciplina e turma atribuídas, mas nada aparece no painel

---

## 🔍 ANÁLISE DO PROBLEMA

### Possíveis Causas:

1. **Mapeamento do professorId**
   - `PlanoEnsino.professorId` → `User.id` (userId)
   - Frontend envia `user?.id` (correto)
   - Backend busca por `professorId` (correto)

2. **Estado do Plano**
   - Se plano está em RASCUNHO/EM_REVISAO com turma → Turma não aparece (regra SIGA/SIGAE)
   - Mas deve aparecer como disciplina sem turma (ajustado)

3. **Filtro de Ano Letivo**
   - Se `anoLetivoId` está sendo passado e não corresponde → Nenhum plano retornado

4. **Multi-tenant**
   - Se `instituicaoId` não corresponde → Nenhum plano retornado

---

## ✅ CORREÇÕES IMPLEMENTADAS

### 1. Backend - Exposição de Disciplinas Sem Turma

**Problema:** Planos em RASCUNHO/EM_REVISAO com turma não apareciam de forma alguma.

**Solução:** Expor como disciplina sem turma para informação.

**Código:**
```typescript
// Se plano está em RASCUNHO/EM_REVISAO e tem turma
// Não expor a turma (regra SIGA/SIGAE)
// Mas expor como disciplina sem turma para informação
if (!podeExporTurma && plano.turmaId && plano.turma) {
  turmasMap.set(chaveVirtual, {
    id: chaveVirtual,
    nome: plano.disciplina.nome,
    disciplinaId: plano.disciplinaId,
    disciplinaNome: plano.disciplina.nome,
    planoEnsinoId: plano.id,
    planoEstado: plano.estado,
    planoBloqueado: plano.bloqueado,
    turma: null, // Não expor turma
    semTurma: true
  });
}
```

### 2. Logs de Debug Adicionados

**Backend:**
- Loga parâmetros da busca
- Loga quantidade de planos encontrados
- Loga detalhes de cada plano
- Avisa quando nenhum plano é encontrado

**Frontend:**
- Loga parâmetros enviados
- Loga dados retornados
- Loga detalhes das atribuições
- Avisa quando nenhuma atribuição é retornada

---

## 🔍 VERIFICAÇÕES NECESSÁRIAS

### 1. Verificar no Banco de Dados

```sql
-- 1. Encontrar o userId do Jose
SELECT id, email, nome_completo, instituicao_id 
FROM users 
WHERE nome_completo ILIKE '%jose%' 
   OR email ILIKE '%jose%';

-- 2. Verificar planos de ensino do Jose
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
  t.nome as turma_nome
FROM plano_ensino pe
LEFT JOIN disciplinas d ON d.id = pe.disciplina_id
LEFT JOIN turmas t ON t.id = pe.turma_id
WHERE pe.professor_id = '<userId_do_jose>'
ORDER BY pe.created_at DESC;
```

### 2. Verificar Logs do Backend

Procurar por:
```
[getTurmas] Buscando turmas para professor <id>
[buscarTurmasProfessorComPlanos] Encontrados X planos de ensino
[buscarTurmasProfessorComPlanos] ⚠️ NENHUM PLANO ENCONTRADO
```

### 3. Verificar Logs do Frontend

No console do navegador, procurar por:
```
[ProfessorDashboard] Buscando turmas com params
[ProfessorDashboard] Atribuições retornadas: X
[ProfessorDashboard] ⚠️ NENHUMA ATRIBUIÇÃO RETORNADA
```

---

## 🎯 PRÓXIMOS PASSOS

1. **Verificar logs** do backend e frontend
2. **Executar queries SQL** para verificar dados no banco
3. **Verificar estado dos planos** (RASCUNHO, EM_REVISAO, APROVADO, ENCERRADO)
4. **Verificar mapeamento** do professorId
5. **Verificar instituição** e ano letivo

---

**Status:** ✅ **CORREÇÕES IMPLEMENTADAS - AGUARDANDO DIAGNÓSTICO**

