# GUIA COMPLETO - GESTÃO ACADÊMICA

**Sistema:** DSICOLA ERP Educacional  
**Área:** Gestão Acadêmica  
**Versão:** 1.0  
**Data:** 2025-01-XX

---

## 📚 ÍNDICE

1. [Descrição da Área](#descrição-da-área)
2. [Módulos Disponíveis](#módulos-disponíveis)
3. [Fluxo de Uso](#fluxo-de-uso)
4. [Como Cadastrar Cada Entidade](#como-cadastrar-cada-entidade)
5. [Regras Importantes](#regras-importantes)
6. [Observações Técnicas](#observações-técnicas)

---

## 📖 DESCRIÇÃO DA ÁREA

A **Gestão Acadêmica** é o módulo central do DSICOLA, responsável por gerenciar toda a estrutura acadêmica da instituição de ensino. Esta área permite:

- Gerenciar cursos, classes, turmas e disciplinas
- Cadastrar e gerenciar professores e alunos
- Realizar matrículas acadêmicas
- Organizar a estrutura curricular

**Características:**
- ✅ Multi-tenant (cada instituição vê apenas seus dados)
- ✅ Suporte para Ensino Secundário e Ensino Superior
- ✅ CRUD completo em todos os módulos
- ✅ Validações automáticas de integridade

---

## 🎯 MÓDULOS DISPONÍVEIS

### 1. **CURSOS**
Gerencia os cursos oferecidos pela instituição.

**Ensino Secundário:** Representam áreas/opções de estudo (ex: "Ciências e Tecnologias", "Línguas e Humanidades")  
**Ensino Superior:** Representam cursos de graduação (ex: "Engenharia Informática", "Direito")

### 2. **CLASSES / ANOS** (Apenas Ensino Secundário)
Gerencia os anos letivos do Ensino Secundário (ex: "10ª Classe", "11ª Classe", "12ª Classe").

### 3. **TURMAS**
Gerencia as turmas de alunos, vinculadas a cursos/classes e professores.

### 4. **DISCIPLINAS**
Gerencia as disciplinas oferecidas, vinculadas a cursos/classes.

### 5. **PROFESSORES**
Gerencia os professores da instituição (usuários com role PROFESSOR).

### 6. **ALUNOS**
Gerencia os alunos da instituição (usuários com role ALUNO).

### 7. **MATRÍCULAS ACADÊMICAS**
Gerencia as matrículas de alunos em turmas.

---

## 🔄 FLUXO DE USO

### Para Ensino Secundário:

```
1. Cursos (Área/Opção)
   ↓
2. Classes (Anos)
   ↓
3. Disciplinas (vinculadas a Curso + Classe)
   ↓
4. Turmas (vinculadas a Classe + opcionalmente Curso)
   ↓
5. Professores
   ↓
6. Alunos
   ↓
7. Matrículas (Aluno em Turma)
```

### Para Ensino Superior:

```
1. Cursos
   ↓
2. Disciplinas (vinculadas a Curso)
   ↓
3. Turmas (vinculadas a Curso)
   ↓
4. Professores
   ↓
5. Alunos
   ↓
6. Matrículas (Aluno em Turma)
```

---

## 📝 COMO CADASTRAR CADA ENTIDADE

### 1. CURSOS

**Acesso:** Gestão Acadêmica → Tab "Cursos"

**Campos Obrigatórios:**
- Nome
- Código (único por instituição)
- Carga Horária
- **Ensino Superior:** Valor da Mensalidade (obrigatório e > 0)
- **Ensino Secundário:** Mensalidade sempre = 0 (mensalidade está na Classe)

**Campos Opcionais:**
- Descrição
- Duração (apenas Ensino Superior)
- Grau (apenas Ensino Superior)
- Tipo

**Passos:**
1. Clique em "Novo Curso"
2. Preencha os campos obrigatórios
3. Clique em "Salvar"

**Observações:**
- Código deve ser único na instituição
- Ensino Secundário: Curso representa área/opção de estudo
- Ensino Superior: Curso representa curso de graduação

---

### 2. CLASSES (Apenas Ensino Secundário)

**Acesso:** Gestão Acadêmica → Tab "Classes"

**Campos Obrigatórios:**
- Nome (ex: "10ª Classe")
- Código (único por instituição)
- Carga Horária
- **Valor da Mensalidade** (obrigatório e > 0)

**Campos Opcionais:**
- Descrição

**Passos:**
1. Clique em "Nova Classe"
2. Preencha os campos obrigatórios
3. Clique em "Salvar"

**Observações:**
- Classes só existem no Ensino Secundário
- Mensalidade é obrigatória e deve ser > 0
- Código deve ser único na instituição

---

### 3. TURMAS

**Acesso:** Gestão Acadêmica → Tab "Turmas"

**Campos Obrigatórios:**
- Nome
- **Ensino Secundário:** Classe (obrigatório)
- **Ensino Superior:** Curso (obrigatório)
- Professor
- Ano Letivo

**Campos Opcionais:**
- **Ensino Secundário:** Curso (área/opção - opcional)
- Turno
- Disciplina
- Semestre
- Sala
- Capacidade (padrão: 30)

**Passos:**
1. Clique em "Nova Turma"
2. Preencha os campos obrigatórios
3. Selecione o Professor
4. Clique em "Salvar"

**Observações:**
- Ensino Secundário: Deve ter Classe (obrigatório) e pode ter Curso (opcional)
- Ensino Superior: Deve ter Curso (obrigatório) e NÃO pode ter Classe
- Professor deve pertencer à mesma instituição

---

### 4. DISCIPLINAS

**Acesso:** Gestão Acadêmica → Tab "Disciplinas"

**Campos Obrigatórios:**
- Nome
- **Ensino Secundário:** Classe (obrigatório) + Curso (obrigatório)
- **Ensino Superior:** Curso (obrigatório)
- Semestre/Trimestre
- Carga Horária

**Campos Opcionais:**
- Tipo de Disciplina (teórica, prática, mista)
- Trimestres Oferecidos (array)
- Obrigatória (padrão: true)

**Passos:**
1. Clique em "Nova Disciplina"
2. Preencha os campos obrigatórios
3. Selecione Classe e/ou Curso conforme o tipo acadêmico
4. Clique em "Salvar"

**Observações:**
- Ensino Secundário: Deve ter Classe E Curso
- Ensino Superior: Deve ter apenas Curso
- Não pode excluir disciplina com turmas ou alunos vinculados

---

### 5. PROFESSORES

**Acesso:** Gestão de Professores → Tab "Professores"

**Campos Obrigatórios:**
- Nome Completo
- Email (único no sistema)
- Senha
- Role: PROFESSOR

**Campos Opcionais:**
- Telefone
- Data de Nascimento
- Gênero
- Número de Identificação
- Endereço
- Cidade
- País
- Avatar

**Passos:**
1. Clique em "Novo Professor"
2. Preencha os campos obrigatórios
3. Clique em "Salvar"

**Observações:**
- Email deve ser único no sistema
- Professor é automaticamente vinculado à instituição do usuário logado
- Pode ser vinculado a um Funcionário (módulo RH)

---

### 6. ALUNOS

**Acesso:** Gestão de Estudantes → Tab "Estudantes"

**Campos Obrigatórios:**
- Nome Completo
- Email (único no sistema)
- Senha
- Role: ALUNO

**Campos Opcionais:**
- Telefone
- Data de Nascimento
- Gênero
- Número de Identificação
- Número de Identificação Pública
- Endereço
- Cidade
- País
- Status do Aluno (padrão: "Ativo")

**Passos:**
1. Clique em "Novo Estudante"
2. Preencha os campos obrigatórios
3. Clique em "Salvar"

**Observações:**
- Email deve ser único no sistema
- Aluno é automaticamente vinculado à instituição do usuário logado
- Pode ser desativado (soft delete) ou excluído permanentemente

---

### 7. MATRÍCULAS ACADÊMICAS

**Acesso:** Gestão de Estudantes → Tab "Matrículas em Turmas"

**Campos Obrigatórios:**
- Aluno
- Turma
- Status (padrão: "Ativa")
- Ano Letivo (padrão: ano atual)

**Passos:**
1. Clique em "Nova Matrícula"
2. Selecione o Aluno
3. Selecione a Turma
4. Clique em "Salvar"

**Observações:**
- Aluno e Turma devem pertencer à mesma instituição
- Aluno não pode estar matriculado duas vezes na mesma turma
- Turma não pode exceder sua capacidade
- Ao criar matrícula ativa, mensalidade é gerada automaticamente
- Aluno deve ter role ALUNO

---

## ⚠️ REGRAS IMPORTANTES

### Multi-Tenant (Segurança)

1. **NUNCA** envie `instituicaoId` do frontend
2. `instituicaoId` vem **EXCLUSIVAMENTE** do JWT (token de autenticação)
3. Uma instituição **NÃO pode** ver dados de outra
4. Todas as queries são filtradas automaticamente por `instituicaoId`

### Validações de Integridade

1. **Aluno e Turma:** Devem pertencer à mesma instituição
2. **Disciplina e Curso/Classe:** Devem pertencer à mesma instituição
3. **Professor e Turma:** Devem pertencer à mesma instituição
4. **Matrícula:** Aluno não pode estar matriculado duas vezes na mesma turma
5. **Capacidade:** Turma não pode exceder sua capacidade máxima

### Ensino Secundário vs Superior

**Ensino Secundário:**
- Usa **Classes** (anos letivos)
- Usa **Cursos** (áreas/opções de estudo)
- Disciplinas vinculadas a **Classe + Curso**
- Turmas vinculadas a **Classe** (obrigatório) + **Curso** (opcional)
- Mensalidade está na **Classe**

**Ensino Superior:**
- Usa apenas **Cursos**
- **NÃO usa Classes**
- Disciplinas vinculadas apenas a **Curso**
- Turmas vinculadas apenas a **Curso**
- Mensalidade está no **Curso**

### Exclusões

1. **Soft Delete:** Classes e Alunos podem ser desativados (soft delete)
2. **Hard Delete:** Cursos, Turmas, Disciplinas e Matrículas são excluídos permanentemente
3. **Dependências:** Não é possível excluir entidades com dependências:
   - Curso com disciplinas ou turmas
   - Classe com turmas, disciplinas ou mensalidades
   - Turma com matrículas ou aulas
   - Disciplina com turmas ou alunos vinculados

---

## 🔧 OBSERVAÇÕES TÉCNICAS

### Backend

**Estrutura:**
- Controllers: `backend/src/controllers/`
- Routes: `backend/src/routes/`
- Services: `backend/src/services/`
- Prisma Models: `backend/prisma/schema.prisma`

**Autenticação:**
- Middleware `authenticate` em todas as rotas
- Middleware `authorize` para validação de roles
- Middleware `validateLicense` para validação de licença

**Multi-Tenant:**
- Função `addInstitutionFilter(req)` aplica filtro automaticamente
- `req.user.instituicaoId` vem do JWT
- Validação explícita impede alteração de `instituicaoId`

### Frontend

**Estrutura:**
- Componentes: `frontend/src/components/admin/`
- Páginas: `frontend/src/pages/admin/`
- Services: `frontend/src/services/api.ts`

**Gerenciamento de Estado:**
- React Query para cache e sincronização
- Context API para dados globais (Instituição, Auth)

**Validações:**
- Zod para validação de schemas
- Validação no frontend e backend

### Banco de Dados

**Prisma:**
- ORM: Prisma
- Database: PostgreSQL
- Migrations: `backend/prisma/migrations/`

**Modelos Principais:**
- `Curso` - Cursos
- `Classe` - Classes/Anos
- `Turma` - Turmas
- `Disciplina` - Disciplinas
- `User` - Professores e Alunos (com roles)
- `Matricula` - Matrículas

---

## 📊 RESUMO DE FUNCIONALIDADES

| Módulo | Criar | Listar | Editar | Excluir | Multi-Tenant |
|--------|-------|--------|--------|---------|--------------|
| Cursos | ✅ | ✅ | ✅ | ✅ | ✅ |
| Classes | ✅ | ✅ | ✅ | ✅ (soft) | ✅ |
| Turmas | ✅ | ✅ | ✅ | ✅ | ✅ |
| Disciplinas | ✅ | ✅ | ✅ | ✅ | ✅ |
| Professores | ✅ | ✅ | ✅ | ✅ | ✅ |
| Alunos | ✅ | ✅ | ✅ | ✅ (soft/hard) | ✅ |
| Matrículas | ✅ | ✅ | ✅ (status) | ✅ | ✅ |

---

## 🎓 CONCLUSÃO

A área de **Gestão Acadêmica** está **100% funcional** com CRUD completo em todos os módulos. A segurança multi-tenant está implementada corretamente e todas as validações de integridade estão funcionando.

**Status:** ✅ **PRONTO PARA USO INSTITUCIONAL**

---

**Documento criado em:** 2025-01-XX  
**Última atualização:** 2025-01-XX

