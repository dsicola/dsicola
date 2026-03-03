# AUDITORIA DE NOTAS - IMPLEMENTAÇÃO COMPLETA

**Data:** 2025-01-XX
**Status:** ✅ Implementado

---

## 📋 RESUMO DA IMPLEMENTAÇÃO

### ✅ MODELO DE DADOS

**Modelo `NotaHistorico` criado:**
- `id` - UUID
- `notaId` - FK para Nota (obrigatório)
- `valorAnterior` - Decimal (valor antes da correção)
- `valorNovo` - Decimal (valor após a correção)
- `motivo` - String (OBRIGATÓRIO - motivo da correção)
- `observacoes` - String? (opcional)
- `corrigidoPor` - FK para User (quem fez a correção)
- `instituicaoId` - FK para Instituicao (multi-tenant)
- `createdAt` - DateTime (data/hora da correção)

**Relações:**
- `Nota.historico` - Array de `NotaHistorico[]`
- `NotaHistorico.nota` - FK para `Nota`
- `NotaHistorico.usuario` - FK para `User` (via `NotaHistoricoCorrigidoPor`)
- `NotaHistorico.instituicao` - FK para `Instituicao`

**Índices:**
- `@@index([notaId])`
- `@@index([corrigidoPor])`
- `@@index([instituicaoId])`
- `@@index([createdAt])`

---

### ✅ ENDPOINTS IMPLEMENTADOS

#### 1. `PUT /notas/:id/corrigir` - Corrigir Nota (Método Oficial)

**Permissões:** `ADMIN`, `PROFESSOR`, `SUPER_ADMIN`

**Body:**
```json
{
  "valor": 15.5,
  "motivo": "Erro de digitação identificado",
  "observacoes": "Correção após revisão"
}
```

**Validações:**
- ✅ `valor` obrigatório
- ✅ `motivo` obrigatório (não pode ser vazio)
- ✅ `valor` entre 0 e 20
- ✅ Valor deve ser diferente do atual
- ✅ PROFESSOR só pode corrigir notas de seus planos de ensino
- ✅ ADMIN pode corrigir qualquer nota
- ✅ SECRETARIA NÃO pode corrigir

**Comportamento:**
1. Valida permissões
2. Cria registro em `NotaHistorico` ANTES de atualizar
3. Atualiza `Nota.valor` (valor atual)
4. Gera log de auditoria
5. Retorna nota atualizada + histórico criado

---

#### 2. `GET /notas/:id/historico` - Obter Histórico de Correções

**Permissões:** `ADMIN`, `SECRETARIA`, `PROFESSOR`, `ALUNO`, `SUPER_ADMIN`

**Resposta:**
```json
{
  "nota": {
    "id": "...",
    "valorAtual": 15.5,
    "aluno": { ... },
    "disciplina": "..."
  },
  "historico": [
    {
      "id": "...",
      "valorAnterior": 12.0,
      "valorNovo": 15.5,
      "motivo": "Erro de digitação",
      "observacoes": "...",
      "corrigidoPor": "...",
      "usuario": {
        "id": "...",
        "nomeCompleto": "...",
        "email": "..."
      },
      "createdAt": "2025-01-XX..."
    }
  ],
  "totalCorrecoes": 1
}
```

---

#### 3. `PUT /notas/:id` - Atualizar Nota (DEPRECATED)

**Status:** Mantido para compatibilidade

**Comportamento:**
- ✅ Se valor mudou, cria histórico automaticamente
- ✅ Motivo padrão: "Correção via atualização (método legado)"
- ⚠️ **Recomendação:** Usar `PUT /:id/corrigir` para correções

---

#### 4. `DELETE /notas/:id` - Bloqueado

**Status:** ✅ BLOQUEADO

**Comportamento:**
- Retorna erro 403
- Mensagem: "Notas não podem ser deletadas. O histórico acadêmico é imutável conforme padrão institucional. Use o endpoint de correção."

---

### ✅ PERMISSÕES AJUSTADAS

**PROFESSOR:**
- ✅ Pode corrigir notas de seus planos de ensino
- ✅ Pode ver histórico de suas notas
- ❌ NÃO pode deletar notas
- ❌ NÃO pode corrigir notas de outros professores

**ADMIN:**
- ✅ Pode corrigir qualquer nota (com motivo obrigatório)
- ✅ Pode ver histórico de todas as notas
- ❌ NÃO pode deletar notas (bloqueado)

**SECRETARIA:**
- ✅ Pode ver notas (consulta)
- ✅ Pode ver histórico de notas
- ❌ NÃO pode corrigir notas
- ❌ NÃO pode deletar notas

**ALUNO:**
- ✅ Pode ver suas próprias notas
- ✅ Pode ver histórico de suas notas
- ❌ NÃO pode corrigir notas
- ❌ NÃO pode deletar notas

---

### ✅ AUDITORIA AUTOMÁTICA

**Todas as correções geram:**
1. ✅ Registro em `NotaHistorico` (imutável)
2. ✅ Log em `LogAuditoria` (via `AuditService`)
3. ✅ Rastreabilidade completa (quem, quando, motivo)

---

## 📊 FLUXO DE CORREÇÃO

```
1. Usuário solicita correção
   ↓
2. Valida permissões (PROFESSOR/ADMIN)
   ↓
3. Valida motivo obrigatório
   ↓
4. Cria NotaHistorico (ANTES de atualizar)
   ↓
5. Atualiza Nota.valor
   ↓
6. Gera log de auditoria
   ↓
7. Retorna nota + histórico
```

---

## 🔒 GARANTIAS DE SEGURANÇA

1. ✅ **Histórico imutável** - Nunca deletado
2. ✅ **Multi-tenant** - `instituicaoId` sempre validado
3. ✅ **Permissões** - PROFESSOR só corrige suas notas
4. ✅ **Motivo obrigatório** - Sempre rastreável
5. ✅ **Auditoria completa** - Todas as ações logadas

---

## 📝 PRÓXIMOS PASSOS (FRONTEND)

1. ⚠️ Atualizar UI para usar `PUT /:id/corrigir` em vez de `PUT /:id`
2. ⚠️ Adicionar campo "Motivo" obrigatório no formulário de correção
3. ⚠️ Exibir histórico de correções na UI
4. ⚠️ Remover botão de deletar nota
5. ⚠️ Adicionar visualização de linha do tempo de correções

---

## ✅ STATUS FINAL

**Backend:**
- ✅ Modelo `NotaHistorico` criado
- ✅ Endpoint `PUT /:id/corrigir` implementado
- ✅ Endpoint `GET /:id/historico` implementado
- ✅ DELETE bloqueado
- ✅ Permissões ajustadas
- ✅ Auditoria automática
- ✅ Multi-tenant seguro

**Frontend:**
- ⚠️ Pendente atualização da UI

---

**Sistema pronto para conformidade institucional!** 🎉

