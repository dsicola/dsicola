# 🎓 Checklist: Diferenciação Secundário vs Superior

> **Regra de ouro:** Se os dois tipos usam exatamente o mesmo fluxo → ainda não está profissional.

## Backend — Verificações automáticas

Execute o teste:

```bash
cd backend
npx tsx scripts/seed-multi-tenant-test.ts   # se ainda não rodou
npx tsx scripts/test-diferenciacao-secundario-superior.ts
```

### Pontos validados pelo script

| Área | Secundário | Superior |
|------|------------|----------|
| JWT | `tipoAcademico: SECUNDARIO` | `tipoAcademico: SUPERIOR` |
| Semestres | Array vazio (não usa) | Disponível (2 por ano) |
| Trimestres | Disponível (3 por ano) | Array vazio (não usa) |
| Classes | `/classes` disponível | Bloqueado ou vazio |
| Parâmetros | `quantidadeSemestresPorAno: null` | `quantidadeSemestresPorAno: 2` |
| Conclusão de curso | `classeId` obrigatório | `cursoId` obrigatório, `classeId` proibido |
| Turmas | `classeId` + opcional `cursoId` | `cursoId` + `semestre`, sem `classeId` |
| Cálculo de notas | `calcularSecundario` (trimestral) | `calcularSuperior` (MP + Recurso) |
| Presenças/Stats | Modelo `Aula` (Turma) | Modelo `AulaLancada` (PlanoEnsino) |

---

## Frontend — Verificações manuais

Use **Instituição A (Secundário)** e **Instituição B (Superior)** do seed para testar.

### 1. Gestão Acadêmica (GestaoAcademica.tsx)

| Elemento | Secundário | Superior |
|---------|------------|----------|
| Tab "Classes (Anos)" | ✅ Visível | ❌ Oculto |
| Tab "Candidaturas" | ❌ Oculto | ✅ Visível |
| Label "Turmas" | "Turmas/Classes" | "Turmas" |
| Label "Notas" | "Notas Trimestrais" | "Notas" |
| Label "Pautas" | "Pautas Trimestrais" | "Pautas" |

### 2. Controle de Presenças (ControlePresencas.tsx)

| Elemento | Secundário | Superior |
|---------|------------|----------|
| Filtro principal | **Classe** (dropdown classes) | **Curso** (dropdown cursos) |
| Fonte de dados | `classesApi` | `cursosApi` |

### 3. Plano de Ensino / Atribuição

| Elemento | Secundário | Superior |
|---------|------------|----------|
| Contexto | `classeId` + `classeOuAno` | `cursoId` + `semestre` |
| Validação | Classe obrigatória | Curso + Semestre obrigatórios |

### 4. Conclusão de Curso (ConclusaoCursoTab.tsx)

| Elemento | Secundário | Superior |
|---------|------------|----------|
| Seleção principal | **Classe** | **Curso** |
| Campo "Curso" | Oculto | Visível |
| Campo "Classe" | Visível | Oculto |

### 5. Configuração de Ensino

| Elemento | Secundário | Superior |
|---------|------------|----------|
| SemestresTab | Não mostrado / vazio | Mostrado |
| TrimestresTab | Mostrado | Não mostrado / vazio |
| Configurações avançadas | Trimestres | Semestres |

### 6. Inscrição / Candidatura Online (Inscricao.tsx)

| Elemento | Secundário | Superior |
|---------|------------|----------|
| Label do campo | "Classe Pretendida" | "Curso Pretendido" |
| Fonte de dados | `instituicoesApi.getOpcoesInscricao()` → classes | `getOpcoesInscricao()` → cursos |
| Campo enviado | `classePretendida` | `cursoPretendido` |

**Implementado:** Diferenciação aplicada via endpoint público `/instituicoes/subdominio/:subdominio/opcoes-inscricao`.

### 7. Menu lateral (menuConfig.tsx)

| Elemento | Secundário | Superior |
|---------|------------|----------|
| "Classes (Anos)" | Visível em Gestão Acadêmica | Oculto |

---

## Pré-requisitos

Para o fluxo de Inscrição diferenciado funcionar:

1. **Migration:** `npx prisma migrate dev` (adiciona `classe_pretendida` em candidaturas)
2. **TenantContext:** Já inclui `tipoAcademico` no objeto instituicao
3. Aceder à página via subdomínio (ex: `inst-a-secundario.xxx.com/inscricao`)

---

## Resumo

- **Backend:** Diferenciação implementada em grande parte (JWT, semestres, trimestres, turmas, conclusão, notas, stats).
- **Frontend (admin):** Diferenciação em GestaoAcademica, ControlePresencas, ConclusaoCurso, PlanoEnsino.
- **Frontend (público):** Inscricao ainda usa fluxo único — **corrigir para Secundário vs Superior**.
