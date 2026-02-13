# Verificação: CLASSE e DISCIPLINA

## ✅ 5 — CLASSE (ENSINO SECUNDÁRIO)

### Verificações Realizadas

#### 1. Classe só existe no Secundário ✅

**Validações encontradas:**

- **`classe.controller.ts` (linha 106-108):**
  ```typescript
  if (tipoAcademico === 'SUPERIOR') {
    throw new AppError('Classes não são permitidas no Ensino Superior. Use Cursos.', 400);
  }
  ```

- **`planoEnsino.controller.ts` (linha 246-248):**
  ```typescript
  if (classeId) {
    throw new AppError('Planos de Ensino do Ensino Superior não podem estar vinculados a Classe. Use Curso ao invés de Classe.', 400);
  }
  ```

- **`turma.controller.ts` (linha 521-523):**
  ```typescript
  if (classeId) {
    throw new AppError('Turmas do Ensino Superior não podem estar vinculadas a Classe. Use apenas Curso.', 400);
  }
  ```

- **`conclusaoCurso.controller.ts` (linhas 51, 115):**
  ```typescript
  if (classeId) {
    throw new AppError('Campo "classeId" não é válido para Ensino Superior. Use "cursoId".', 400);
  }
  ```

**STATUS:** ✅ **CORRETO** - Classe é bloqueada em todos os pontos de entrada para Ensino Superior.

---

#### 2. Classe é obrigatória para matrícula ✅

**Validações encontradas:**

- **`matriculaAnual.controller.ts` (linha 674-691):**
  ```typescript
  if (tipoAcademicoInstituicao === 'SECUNDARIO') {
    const classeParaMatricula = await prisma.classe.findFirst({...});
    if (!classeParaMatricula) {
      throw new AppError('Classe não encontrada. Classe é obrigatória para Ensino Secundário.', 400);
    }
    classeIdFinal = classeParaMatricula.id;
  }
  ```

- **`matricula.controller.ts` (linha 289-296):**
  ```typescript
  if (tipoAcademico === 'SECUNDARIO' && !matriculaAnual.classeId) {
    throw new AppError(
      'Não é possível matricular o estudante em turma. A matrícula anual não possui classe definida. ' +
      'No Ensino Secundário, é obrigatório definir uma classe na matrícula anual antes de matricular em turmas.',
      400
    );
  }
  ```

- **`conclusaoCurso.service.ts` (linha 96-98):**
  ```typescript
  if (tipoAcademicoFinal === 'SECUNDARIO') {
    if (!classeId) {
      throw new AppError('classeId é obrigatório para Ensino Secundário', 400);
    }
  }
  ```

**STATUS:** ✅ **CORRETO** - Classe é obrigatória para matrícula em Ensino Secundário em todos os pontos.

---

#### 3. Classe substitui "ano do curso" ✅

**Implementação encontrada:**

- **`planoEnsino.controller.ts` (linha 312-314):**
  ```typescript
  if (!classeOuAno || classeOuAno.trim() === '') {
    throw new AppError('Classe/Ano é obrigatório para Ensino Secundário (ex: "10ª Classe", "1º Ano").', 400);
  }
  ```

- **Schema `PlanoEnsino`:**
  ```prisma
  classeOuAno String? @map("classe_ou_ano") // OBRIGATÓRIO apenas se tipoInstituicao = Ensino Secundário
  ```

- **`turma.controller.ts` (linha 506-509):**
  ```typescript
  // Ensino Secundário: classeId é obrigatório (representa o ano)
  // cursoId é opcional mas recomendado (representa a área/opção de estudo)
  if (!classeId) {
    throw new AppError('Classe é obrigatória no Ensino Secundário', 400);
  }
  ```

**STATUS:** ✅ **CORRETO** - Classe substitui "ano do curso" no Ensino Secundário. O campo `classeOuAno` armazena a representação textual (ex: "10ª Classe"), enquanto `classeId` é a FK.

---

## ✅ 6 — DISCIPLINA

### Verificações Realizadas

#### 1. Disciplinas vinculadas a curso ou classe ✅

**Modelo encontrado:**

- **`CursoDisciplina` (schema.prisma linha 646-664):**
  ```prisma
  model CursoDisciplina {
    cursoId      String
    disciplinaId String
    semestre     Int? // Semestre em que a disciplina é oferecida no curso
    trimestre    Int? // Trimestre (para Ensino Secundário)
    // ...
  }
  ```

- **Vínculo via PlanoEnsino:**
  - Disciplinas são vinculadas a **cursos** via `CursoDisciplina`
  - Disciplinas são vinculadas a **classes** via `PlanoEnsino.classeId` (Ensino Secundário)
  - `PlanoEnsino` é a entidade que conecta: `Disciplina → Curso/Classe → Turma`

**Observação:** Não existe modelo `ClasseDisciplina` explícito. O vínculo Disciplina-Classe é feito indiretamente via `PlanoEnsino.classeId`, o que está correto pois:
- No Ensino Secundário, a disciplina é oferecida em uma classe específica através do Plano de Ensino
- O Plano de Ensino já contém `classeId`, `disciplinaId`, `cursoId` (opcional)

**STATUS:** ✅ **CORRETO** - Disciplinas são vinculadas a cursos via `CursoDisciplina` e a classes via `PlanoEnsino.classeId`.

---

#### 2. Carga horária definida na disciplina ✅

**Schema encontrado:**

- **`Disciplina` (schema.prisma linha 595):**
  ```prisma
  cargaHoraria Int @default(0) @map("carga_horaria")
  ```

- **Sincronização com PlanoEnsino:**
  - `PlanoEnsino.cargaHorariaTotal` vem da `Disciplina.cargaHoraria` (linha 543 do controller)
  - `PlanoEnsino.cargaHorariaPlanejada` é calculada automaticamente (soma das aulas)

**STATUS:** ✅ **CORRETO** - Carga horária é definida na Disciplina e sincronizada com PlanoEnsino.

---

#### 3. Semestre NÃO pertence à disciplina ✅

**Verificação:**

- **`Disciplina` (schema.prisma):** ❌ **NÃO possui campo `semestre`**
- **`CursoDisciplina` (schema.prisma linha 650):** ✅ Possui `semestre Int?` - semestre em que a disciplina é oferecida no curso
- **`PlanoEnsino` (schema.prisma linha 2675):** ✅ Possui `semestre Int?` - semestre do plano (Ensino Superior)

**Validação encontrada:**

- **`planoEnsino.controller.ts` (linha 316-319):**
  ```typescript
  // Semestre não deve ser enviado para Ensino Secundário
  if (semestre) {
    throw new AppError('Campo "Semestre" não é válido para Ensino Secundário. Use o campo "Classe/Ano" ao invés de Semestre.', 400);
  }
  ```

**STATUS:** ✅ **CORRETO** - Semestre NÃO pertence à Disciplina. Semestre existe apenas em:
- `CursoDisciplina.semestre` (quando a disciplina é oferecida em um curso)
- `PlanoEnsino.semestre` (quando o plano é de Ensino Superior)

---

#### 4. Nenhuma disciplina sem contexto institucional ✅

**Schema encontrado:**

- **`Disciplina` (schema.prisma linha 602):**
  ```prisma
  instituicaoId String @map("instituicao_id") // OBRIGATÓRIO: disciplina é institucional
  ```

- **Relação:**
  ```prisma
  instituicao Instituicao @relation(fields: [instituicaoId], references: [id]) // OBRIGATÓRIO
  ```

- **Índice multi-tenant:**
  ```prisma
  @@index([instituicaoId]) // Índice para multi-tenant
  ```

**Validações encontradas:**

- Todos os controllers que criam/buscam disciplinas usam `addInstitutionFilter(req)` ou `requireTenantScope(req)`
- `instituicaoId` é sempre obtido do JWT, nunca do body

**STATUS:** ✅ **CORRETO** - `instituicaoId` é obrigatório e todas as operações são filtradas por multi-tenant.

---

## 📋 Resumo Final

### CLASSE (ENSINO SECUNDÁRIO)
- ✅ Classe só existe no Secundário (bloqueada em Superior)
- ✅ Classe é obrigatória para matrícula
- ✅ Classe substitui "ano do curso" (via `classeOuAno` e `classeId`)

### DISCIPLINA
- ✅ Disciplinas vinculadas a curso (via `CursoDisciplina`) ou classe (via `PlanoEnsino.classeId`)
- ✅ Carga horária definida na disciplina (`cargaHoraria`)
- ✅ Semestre NÃO pertence à disciplina (existe apenas em `CursoDisciplina` e `PlanoEnsino`)
- ✅ Nenhuma disciplina sem contexto institucional (`instituicaoId` obrigatório)

**STATUS GERAL:** ✅ **TODAS AS REGRAS ESTÃO CORRETAS E IMPLEMENTADAS**

