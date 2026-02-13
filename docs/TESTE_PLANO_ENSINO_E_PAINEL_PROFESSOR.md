# Teste E2E Completo: Plano de Ensino → Painel do Professor

Este documento descreve o passo a passo para testar o fluxo completo do Plano de Ensino e verificar que o painel do professor exibe corretamente todas as atribuições.

---

## Pré-requisitos

1. **Backend a correr** em `http://localhost:3001`
2. **Base de dados** com seed executado (professores, instituições, anos letivos, etc.)
3. **Professor cadastrado** com email e senha conhecidos

---

## Passo 1: Garantir Atribuição ao Professor

Execute o script de atribuição para criar/verificar o Plano de Ensino do professor:

```bash
cd backend
npx tsx scripts/testar-atribuicao-plano-completo.ts [email_professor]
```

Exemplo:
```bash
npx tsx scripts/testar-atribuicao-plano-completo.ts avelino1@gmail.com
```

**Resultado esperado:** "✅ TESTE CONCLUÍDO COM SUCESSO" com 4 verificações OK.

---

## Passo 2: Teste E2E Completo

Execute o teste que simula o fluxo completo (ADMIN + PROFESSOR):

```bash
cd backend
npx tsx scripts/testar-plano-ensino-e-painel-professor-e2e.ts [email_admin] [pass_admin] [email_professor] [pass_professor]
```

Exemplo:
```bash
npx tsx scripts/testar-plano-ensino-e-painel-professor-e2e.ts superadmin@dsicola.com 'SuperAdmin@123' avelino1@gmail.com 'Professor@123'
```

**O que o script valida:**

| Fase | Descrição |
|------|-----------|
| 0 | Dados do professor via Prisma (planos, disciplinas, turmas) |
| 1 | Login como ADMIN |
| 2 | Login como PROFESSOR |
| 3 | `GET /turmas/professor` – Painel do Professor (turmas e disciplinas atribuídas) |
| 4 | `GET /professor-disciplinas/me` – Minhas atribuições |
| 5 | `GET /aulas-planejadas` como PROFESSOR (sem professorId – backend resolve do JWT) |
| 6 | `GET /aulas-planejadas` como ADMIN (com professorId na query) |

---

## Passo 3: Teste Manual no Frontend

### 3.1 Como ADMIN – Plano de Ensino

1. Aceder a **Configuração de Ensino → Plano de Ensino** (ou **Atribuição de Disciplinas**)
2. Selecionar:
   - Professor (ex.: Avelino José)
   - Curso (ex.: Engenharia de Informática)
   - Disciplina (ex.: Inglês)
   - Ano Letivo (ex.: 2026)
   - Turma (ex.: Turma A M)
   - Semestre (1 ou 2)
3. Criar ou editar o plano
4. Na aba **Planejar**, adicionar aulas planejadas
5. Aprovar o plano (se o workflow estiver configurado)

### 3.2 Como PROFESSOR – Painel

1. Fazer login com o professor (ex.: avelino1@gmail.com)
2. Aceder ao **Painel do Professor**
3. Verificar:
   - **Ano Letivo** correto
   - **Turmas Atribuídas** com a turma e disciplina
   - **Ações Rápidas** disponíveis (Registrar Aula, Gestão de Frequência, etc.)
4. Clicar em **Gestão de Frequência** ou **Lançar Aula**
5. Selecionar disciplina e turma
6. Verificar que as **aulas planejadas** aparecem

### 3.3 Lançamento de Aulas

1. Como ADMIN: **Configuração de Ensino → Lançamento de Aulas**
2. Preencher: Curso, Disciplina, Professor, Ano Letivo, Turma
3. Verificar que as aulas planejadas aparecem
4. Clicar em **➕ Lançar** numa aula para registar a data
5. Confirmar que o lançamento é guardado

---

## Credenciais de Teste (valores típicos)

| Perfil | Email | Senha |
|--------|-------|-------|
| Super Admin | superadmin@dsicola.com | SuperAdmin@123 |
| Professor | avelino1@gmail.com | Professor@123 |

*Nota: As senhas dependem do seed. O professor pode precisar de ser criado via frontend ou script `criar-professor.ts`.*

---

## Checklist de Validação

- [ ] Professor tem plano de ensino APROVADO no banco
- [ ] Plano tem turma vinculada
- [ ] Plano tem pelo menos 1 aula planejada
- [ ] `GET /turmas/professor` retorna turmas e/ou disciplinas
- [ ] `GET /professor-disciplinas/me` retorna atribuições
- [ ] `GET /aulas-planejadas` retorna aulas (como PROFESSOR e como ADMIN)
- [ ] Painel do Professor exibe turmas e ano letivo
- [ ] Lançamento de Aulas funciona com o contexto correto

---

## Resolução de Problemas

### "Professor sem planos"
Execute `testar-atribuicao-plano-completo.ts` com o email do professor.

### "Login falhou" (professor)
Redefina a senha do professor para testes:
```bash
npx tsx scripts/redefinir-senha-professor-teste.ts avelino1@gmail.com Professor@123
```

### "Login falhou" (geral)
- Verificar se o backend está a correr
- Confirmar credenciais (email/senha) no seed ou base de dados

### "/turmas/professor retornou vazio"
- Verificar se o plano está APROVADO (`estado = 'APROVADO'`)
- Verificar se o professor tem `req.professor.id` (middleware `resolveProfessor`)
- Verificar ano letivo ATIVO

### "/aulas-planejadas retornou vazio"
- Verificar se o plano tem aulas na tabela `plano_aulas`
- Confirmar contexto: `disciplinaId`, `professorId`, `anoLetivo`, `turmaId` (se aplicável)
