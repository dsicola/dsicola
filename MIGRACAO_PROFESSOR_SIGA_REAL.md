# MIGRAÇÃO: Modelo Acadêmico para Padrão institucional REAL

## Data: 2025-01-XX
## Sistema: DSICOLA
## Objetivo: Migrar modelo acadêmico para padrão institucional onde Professor é entidade própria

---

## ✅ ETAPAS CONCLUÍDAS

### 1. Scripts de Migração de Dados

#### 1.1. Popular Tabela Professores
**Arquivo:** `backend/prisma/migrations/migrate_populate_professores.sql`

- Cria registros em `professores` para todos os usuários com role PROFESSOR
- Garante um professor por usuário
- Sem duplicações
- Com índices e constraints corretos

#### 1.2. Migrar Plano de Ensino
**Arquivo:** `backend/prisma/migrations/migrate_plano_ensino_professor_id.sql`

- Atualiza `plano_ensino.professor_id` de `users.id` para `professores.id`
- Preserva todos os planos existentes
- Mantém histórico
- Idempotente (pode ser executado múltiplas vezes)
- Executa em transação

### 2. Atualização do Schema Prisma

**Arquivo:** `backend/prisma/schema.prisma`

**Mudanças:**
- `PlanoEnsino.professorId` agora referencia `Professor.id` (não `User.id`)
- Removida relação `User.planosEnsino` (legacy)
- Adicionada relação `Professor.planosEnsino`

**Antes:**
```prisma
model PlanoEnsino {
  professor User @relation("ProfessorPlanos", fields: [professorId], references: [id])
}

model User {
  planosEnsino PlanoEnsino[] @relation("ProfessorPlanos")
}
```

**Depois:**
```prisma
model PlanoEnsino {
  professor Professor @relation(fields: [professorId], references: [id])
}

model Professor {
  planosEnsino PlanoEnsino[]
}
```

### 3. Função Helper para Resolução de Professor

**Arquivo:** `backend/src/utils/professorResolver.ts`

**Funções criadas:**
- `resolveProfessorId(userId, instituicaoId)`: Resolve `professores.id` a partir de `users.id`
- `resolveProfessor(userId, instituicaoId)`: Resolve objeto professor completo
- `validateProfessorId(professorId, instituicaoId)`: Valida se professorId existe
- `isProfessorOfPlanoEnsino(userId, professorId, instituicaoId)`: Verifica se userId corresponde ao professorId do plano

### 4. Atualização dos Controllers

#### 4.1. Controller Turma (`turma.controller.ts`)
- `getTurmasByProfessor`: Agora resolve `professores.id` a partir de `users.id` do JWT
- Busca planos via `professores.id` (não `users.id`)

#### 4.2. Controller ProfessorDisciplina (`professorDisciplina.controller.ts`)
- `create`: Normaliza `professorId` para `professores.id`
- `getByProfessor`: Busca planos via `professores.id`
- `getById`: Inclui relação `professor.user` para buscar nome completo
- Ajustado para usar `professor.user.nomeCompleto` ao invés de `professor.nomeCompleto`

#### 4.3. Controller PlanoEnsino (`planoEnsino.controller.ts`)
- `createOrGetPlanoEnsino`: Normaliza `professorId` para `professores.id`
- Validação atualizada para usar `professores.id`

#### 4.4. Controller Presenca (`presenca.controller.ts`)
- Atualizado para usar `isProfessorOfPlanoEnsino` ao invés de comparação direta

#### 4.5. Controller Relatorios (`relatorios.controller.ts`)
- Atualizado para usar `isProfessorOfPlanoEnsino` ao invés de comparação direta

#### 4.6. Controller ProfessorVinculo (`professorVinculo.controller.ts`)
- Corrigido para usar `professor.id` ao invés de `professor.userId` ao criar planos

### 5. Atualização dos Services

#### 5.1. Service ValidacaoAcademica (`validacaoAcademica.service.ts`)
- `buscarTurmasEDisciplinasProfessorComPlanoAtivo`: Atualizado para usar `professores.id`
- Comentários atualizados para refletir a mudança

### 6. Atualização dos Middlewares

#### 6.1. Middleware Role-Permissions (`role-permissions.middleware.ts`)
- `validarPermissaoAula`: Usa `isProfessorOfPlanoEnsino` para validar permissão
- `validarPermissaoPresenca`: Usa `isProfessorOfPlanoEnsino` para validar permissão
- `validarPermissaoAvaliacao`: Usa `isProfessorOfPlanoEnsino` para validar permissão
- `validarPermissaoNota`: Usa `isProfessorOfPlanoEnsino` para validar permissão

---

## 🔄 ARQUITETURA FINAL

### Fluxo de Autenticação e Resolução

1. **JWT** continua trazendo `users.id` (não muda)
2. **Backend** resolve: `users.id` → `professores.id` usando `resolveProfessorId()`
3. **PlanoEnsino.professorId** referencia `professores.id` (não `users.id`)
4. **Frontend** não precisa mudar - continua usando o mesmo login

### Modelo de Dados

```
User (autenticação)
  ↓
Professor (entidade institucional)
  ↓
PlanoEnsino (fonte da verdade pedagógica)
```

### Regras de Negócio

- **Professor** é uma entidade própria e institucional
- **Plano de Ensino** é a única fonte de verdade pedagógica
- **Multi-tenant** rigoroso preservado
- **Dois tipos de instituição**: Ensino Superior e Ensino Secundário

---

## 📋 PRÓXIMOS PASSOS

### 1. Executar Migrações de Dados

```bash
# 1. Popular tabela professores
psql -d dsicola -f backend/prisma/migrations/migrate_populate_professores.sql

# 2. Migrar plano_ensino.professor_id
psql -d dsicola -f backend/prisma/migrations/migrate_plano_ensino_professor_id.sql
```

### 2. Gerar e Aplicar Migração do Prisma

```bash
cd backend
npx prisma migrate dev --name migrate_plano_ensino_professor_relation
```

### 3. Validar com Dados Reais

- Verificar se todos os professores foram criados
- Verificar se todos os planos foram migrados
- Testar painel do professor
- Testar criação de planos pelo admin
- Testar validações de permissão

---

## ⚠️ OBSERVAÇÕES IMPORTANTES

1. **Migração Segura**: Os scripts de migração são idempotentes e podem ser executados múltiplas vezes
2. **Backwards Compatibility**: O helper `resolveProfessorId` cria automaticamente registros de professor se não existirem
3. **Validação Multi-tenant**: Todas as validações preservam o multi-tenant rigoroso
4. **Frontend**: Não precisa mudar - continua usando o mesmo login e JWT

---

## ✅ VALIDAÇÕES OBRIGATÓRIAS

- [ ] Professor com plano COM turma aparece no painel
- [ ] Professor com plano SEM turma aparece no painel
- [ ] Professor sem plano vê estado vazio válido
- [ ] Nenhuma atribuição gera erro HTTP
- [ ] Multi-tenant preservado
- [ ] Admin e Professor veem a mesma verdade
- [ ] Criação de planos pelo admin funciona corretamente
- [ ] Validações de permissão funcionam corretamente

---

## 📝 NOTAS TÉCNICAS

- O sistema agora está alinhado ao padrão institucional REAL
- Professor é uma entidade institucional separada de User
- Plano de Ensino é o contrato pedagógico único
- Arquitetura limpa e auditável
- Base pronta para certificações e escalabilidade

