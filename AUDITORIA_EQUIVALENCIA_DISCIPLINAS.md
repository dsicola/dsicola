# AUDITORIA: EQUIVALÊNCIA DE DISCIPLINAS

**Data:** 2025-01-XX
**Status:** Auditoria completa - Implementação iniciada

---

## 📋 RESUMO EXECUTIVO

### ❌ NÃO EXISTE MÓDULO DE EQUIVALÊNCIA

**Verificação Completa:**
- ❌ NÃO existe modelo `EquivalenciaDisciplina` no schema.prisma
- ❌ NÃO existe controller de equivalência
- ❌ NÃO existe routes de equivalência
- ❌ NÃO existe frontend de equivalência
- ✅ Histórico Acadêmico existe e é imutável (correto)
- ⚠️ `situacaoAcademica` não tem status de EQUIVALENCIA/DISPENSA

### ✅ O QUE JÁ ESTÁ CORRETO

1. ✅ **Histórico Acadêmico Imutável**
   - Modelo `HistoricoAcademico` sem `updatedAt`
   - Snapshot gerado apenas em encerramento
   - Não pode ser recalculado

2. ✅ **Estrutura Base**
   - Disciplina vinculada a Curso
   - Aluno vinculado a Instituição
   - Multi-tenant seguro

---

## 🎯 IMPLEMENTAÇÃO NECESSÁRIA

### 1️⃣ BACKEND - MODELO (schema.prisma)

**Criar modelo `EquivalenciaDisciplina`:**
- id
- instituicao_id (obrigatório - multi-tenant)
- aluno_id (obrigatório)
- curso_origem_id (opcional - pode ser de outra instituição)
- disciplina_origem_id (obrigatório)
- carga_horaria_origem (obrigatório)
- nota_origem (nullable)
- curso_destino_id (obrigatório)
- disciplina_destino_id (obrigatório)
- carga_horaria_equivalente (obrigatório)
- criterio (EQUIVALENCIA | DISPENSA)
- observacao
- deferido (boolean, default: false)
- deferido_por (nullable)
- deferido_em (nullable)
- created_at
- updated_at (permitir apenas antes de deferimento)

**Constraints:**
- @@unique([instituicaoId, alunoId, disciplinaDestinoId]) - Uma equivalência por disciplina destino
- Bloquear UPDATE/DELETE após deferimento

---

### 2️⃣ BACKEND - CONTROLLER

**Endpoints necessários:**
- POST /equivalencias - Criar solicitação (ADMIN, SECRETARIA)
- GET /equivalencias - Listar (filtrado por instituição)
- GET /equivalencias/aluno/:alunoId - Listar do aluno
- GET /equivalencias/:id - Obter por ID
- PUT /equivalencias/:id - Atualizar (apenas se não deferido)
- POST /equivalencias/:id/deferir - Deferir (ADMIN)
- POST /equivalencias/:id/indeferir - Indeferir (ADMIN)
- DELETE /equivalencias/:id - Deletar (apenas se não deferido)

**Validações:**
- Carga horária compatível (origem >= destino * 0.8)
- Disciplina destino existe na instituição
- Aluno pertence à instituição
- Não permitir UPDATE/DELETE após deferimento

---

### 3️⃣ BACKEND - SERVIÇO

**Funções necessárias:**
- `validarEquivalencia()` - Valida carga horária e compatibilidade
- `aplicarEquivalencia()` - Ao deferir, atualiza histórico destino
- `buscarEquivalenciasAluno()` - Busca todas as equivalências do aluno

**Regras:**
- Ao deferir: Criar registro no histórico destino com status "DISPENSA_EQUIVALENCIA"
- NÃO alterar histórico origem
- Registrar log de auditoria

---

### 4️⃣ FRONTEND - UX

**Tela de Equivalências:**
- Listagem de equivalências (ADMIN/SECRETARIA)
- Formulário de solicitação
- Visualização de equivalências do aluno (ALUNO)

**Integração com Histórico:**
- Badge "Equivalência" no histórico
- Tooltip com detalhes da equivalência

---

## 📊 PRÓXIMOS PASSOS

1. ✅ Criar modelo no schema.prisma
2. ✅ Criar controller e routes
3. ✅ Criar serviço de validação
4. ✅ Criar frontend
5. ✅ Integrar com histórico acadêmico
6. ✅ Implementar auditoria

---

**Status:** Implementação iniciada

