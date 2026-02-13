# 🔍 ANÁLISE DETALHADA DAS RELAÇÕES NO SCHEMA

## ❌ PROBLEMAS IDENTIFICADOS

### 1. **MatriculaAnual → AnoLetivo**

**Status**: ❌ **FALTA FK**

**Schema Atual**:
```prisma
model MatriculaAnual {
  anoLetivo Int @map("ano_letivo") // Apenas número, SEM FK
  // ...
}
```

**Problema**:
- ❌ Usa apenas `anoLetivo` (número) sem foreign key
- ❌ Não há garantia de integridade referencial
- ❌ Se `AnoLetivo` for deletado, `MatriculaAnual` pode ficar órfã

**Solução Recomendada**:
```prisma
model MatriculaAnual {
  anoLetivo     Int     @map("ano_letivo") // Mantido para compatibilidade
  anoLetivoId   String? @map("ano_letivo_id") // NOVA FK
  anoLetivoRef  AnoLetivo? @relation(fields: [anoLetivoId], references: [id])
  // ...
}
```

---

### 2. **PlanoEnsino → AnoLetivo**

**Status**: ❌ **FALTA FK**

**Schema Atual**:
```prisma
model PlanoEnsino {
  anoLetivo Int @map("ano_letivo") // Apenas número, SEM FK
  // ...
}
```

**Problema**:
- ❌ Usa apenas `anoLetivo` (número) sem foreign key
- ❌ Não há garantia de integridade referencial

**Solução Recomendada**:
```prisma
model PlanoEnsino {
  anoLetivo     Int     @map("ano_letivo") // Mantido para compatibilidade
  anoLetivoId   String? @map("ano_letivo_id") // NOVA FK
  anoLetivoRef  AnoLetivo? @relation(fields: [anoLetivoId], references: [id])
  // ...
}
```

---

### 3. **AlunoDisciplina → Semestre/Trimestre**

**Status**: ❌ **FALTA FK**

**Schema Atual**:
```prisma
model AlunoDisciplina {
  ano      Int
  semestre String // "1", "2", "3" ou "1", "2"
  // NÃO há semestreId ou trimestreId
}
```

**Problema**:
- ❌ Usa apenas `ano` + `semestre` (string) sem foreign key
- ❌ Não há garantia de integridade referencial
- ❌ Depende de lógica de negócio para validar período

**Solução Recomendada**:
```prisma
model AlunoDisciplina {
  ano          Int
  semestre     String // Mantido para compatibilidade
  semestreId   String? @map("semestre_id") // NOVA FK (para SUPERIOR)
  trimestreId  String? @map("trimestre_id") // NOVA FK (para SECUNDARIO)
  semestreRef  Semestre? @relation(fields: [semestreId], references: [id])
  trimestreRef Trimestre? @relation(fields: [trimestreId], references: [id])
  // ...
}
```

---

### 4. **AulaLancada → Semestre/Trimestre**

**Status**: ❌ **FALTA FK**

**Schema Atual**:
```prisma
model AulaLancada {
  planoAulaId String
  data        DateTime
  // NÃO há semestreId ou trimestreId
}
```

**Problema**:
- ❌ Relação indireta: `AulaLancada` → `PlanoAula` → `PlanoEnsino` → `anoLetivo` (número)
- ❌ Validação de período feita via lógica (`buscarPeriodoAcademico`)
- ❌ Não há garantia de integridade referencial

**Solução Recomendada**:
```prisma
model AulaLancada {
  planoAulaId  String
  semestreId   String? @map("semestre_id") // NOVA FK (para SUPERIOR)
  trimestreId  String? @map("trimestre_id") // NOVA FK (para SECUNDARIO)
  semestreRef  Semestre? @relation(fields: [semestreId], references: [id])
  trimestreRef Trimestre? @relation(fields: [trimestreId], references: [id])
  // ...
}
```

---

### 5. **Avaliacao → Semestre/Trimestre**

**Status**: ❌ **FALTA FK**

**Schema Atual**:
```prisma
model Avaliacao {
  planoEnsinoId String
  trimestre     Int // 1, 2 ou 3
  // NÃO há semestreId ou trimestreId
}
```

**Problema**:
- ❌ Usa apenas `trimestre` (número) sem foreign key
- ❌ Relação indireta: `Avaliacao` → `PlanoEnsino` → `anoLetivo` (número)
- ❌ Não há garantia de integridade referencial

**Solução Recomendada**:
```prisma
model Avaliacao {
  planoEnsinoId String
  trimestre     Int // Mantido para compatibilidade
  semestreId    String? @map("semestre_id") // NOVA FK (para SUPERIOR)
  trimestreId   String? @map("trimestre_id") // NOVA FK (para SECUNDARIO)
  semestreRef   Semestre? @relation(fields: [semestreId], references: [id])
  trimestreRef  Trimestre? @relation(fields: [trimestreId], references: [id])
  // ...
}
```

---

## ✅ RELAÇÕES CORRETAS

### 1. **Instituicao → AnoLetivo**
- ✅ `AnoLetivo.instituicaoId` com FK

### 2. **AnoLetivo → Semestre/Trimestre**
- ✅ `Semestre.anoLetivoId` com FK obrigatória
- ✅ `Trimestre.anoLetivoId` com FK obrigatória

### 3. **MatriculaAnual → Aluno**
- ✅ `MatriculaAnual.alunoId` com FK

### 4. **AlunoDisciplina → Aluno, Disciplina, MatriculaAnual, Turma**
- ✅ Todas as FKs presentes

### 5. **AulaLancada → PlanoAula**
- ✅ `AulaLancada.planoAulaId` com FK

### 6. **Presenca → AulaLancada, Aluno**
- ✅ Todas as FKs presentes

### 7. **Nota → Aluno, Avaliacao, Exame**
- ✅ Todas as FKs presentes

---

## 📊 RESUMO

### ❌ Relações FALTANDO (5):

1. ❌ `MatriculaAnual.anoLetivoId` → `AnoLetivo.id`
2. ❌ `PlanoEnsino.anoLetivoId` → `AnoLetivo.id`
3. ❌ `AlunoDisciplina.semestreId/trimestreId` → `Semestre.id`/`Trimestre.id`
4. ❌ `AulaLancada.semestreId/trimestreId` → `Semestre.id`/`Trimestre.id`
5. ❌ `Avaliacao.semestreId/trimestreId` → `Semestre.id`/`Trimestre.id`

### ✅ Relações CORRETAS (10+):

1. ✅ `AnoLetivo.instituicaoId` → `Instituicao.id`
2. ✅ `Semestre.anoLetivoId` → `AnoLetivo.id`
3. ✅ `Trimestre.anoLetivoId` → `AnoLetivo.id`
4. ✅ `MatriculaAnual.alunoId` → `User.id`
5. ✅ `MatriculaAnual.instituicaoId` → `Instituicao.id`
6. ✅ `AlunoDisciplina.alunoId` → `User.id`
7. ✅ `AlunoDisciplina.disciplinaId` → `Disciplina.id`
8. ✅ `AlunoDisciplina.matriculaAnualId` → `MatriculaAnual.id`
9. ✅ `AlunoDisciplina.turmaId` → `Turma.id`
10. ✅ `AulaLancada.planoAulaId` → `PlanoAula.id`
11. ✅ `Presenca.aulaLancadaId` → `AulaLancada.id`
12. ✅ `Presenca.alunoId` → `User.id`
13. ✅ `Avaliacao.planoEnsinoId` → `PlanoEnsino.id`
14. ✅ `Nota.avaliacaoId` → `Avaliacao.id`
15. ✅ `Nota.alunoId` → `User.id`

---

## 🎯 CONCLUSÃO

**Status**: ⚠️ **RELAÇÕES PARCIAIS**

- ✅ **Relações básicas**: Corretas (Aluno, Disciplina, Turma, etc.)
- ✅ **Relações AnoLetivo → Semestre/Trimestre**: Corretas
- ❌ **Relações para AnoLetivo**: Faltam FKs em `MatriculaAnual` e `PlanoEnsino`
- ❌ **Relações para Semestre/Trimestre**: Faltam FKs em `AlunoDisciplina`, `AulaLancada` e `Avaliacao`

**Impacto**:
- ⚠️ Sistema funciona, mas depende de lógica de negócio para validar períodos
- ⚠️ Não há garantia de integridade referencial em nível de banco
- ⚠️ Pode haver inconsistências se dados forem manipulados diretamente

**Recomendação**: 
- 🔴 **ALTA PRIORIDADE**: Adicionar FKs faltantes para garantir integridade referencial completa

