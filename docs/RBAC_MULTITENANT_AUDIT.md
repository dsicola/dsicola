# Auditoria RBAC e Multi-tenant

**Data:** 2026-02-22  
**Sistema em produção** – alterações mínimas e conservadoras.

---

## 1. Roles e Acesso

| Role | Descrição | Instituição | Acesso Principal |
|------|-----------|-------------|------------------|
| SUPER_ADMIN | SaaS global | Opcional (query param) | Instituições, assinaturas, logs |
| COMERCIAL | Equipe comercial | Opcional | Instituições, assinaturas, planos |
| ADMIN | Administrador instituição | Obrigatório | Total na instituição |
| DIRECAO | Direção acadêmica | Obrigatório | Acadêmico + Config. Ensinos |
| COORDENADOR | Coordenação | Obrigatório | Acadêmico + Config. Ensinos |
| SECRETARIA | Secretaria | Obrigatório | Alunos, matrículas, acadêmico |
| RH | Recursos Humanos | Obrigatório (via Funcionário) | Funcionários, folha, biometria |
| FINANCEIRO | Financeiro | Obrigatório | Mensalidades, pagamentos |
| POS | Ponto de venda | Obrigatório | Pagamentos, recibos |
| PROFESSOR | Professor | Obrigatório (via Professor) | Turmas, notas, frequências |
| ALUNO | Estudante | Obrigatório | Matrículas, notas, documentos |
| RESPONSAVEL | Responsável | Obrigatório | Dados do(s) aluno(s) |
| AUDITOR | Auditoria | Obrigatório | Apenas leitura |

---

## 2. Resolução de instituicaoId

- **User.instituicaoId** – fonte principal no login.
- **Staff (RH, SECRETARIA, etc.)** – se `User.instituicaoId` é null, usa `Funcionario.instituicaoId`.
- **PROFESSOR** – se `User.instituicaoId` é null, usa `Professor.instituicaoId`.
- **ALUNO** – se `User.instituicaoId` é null, usa `MatriculaAnual.instituicaoId` (primeira matrícula).
- **JWT** – sempre carrega `instituicaoId` após login.
- **Auth middleware** – fallback em runtime para Staff/PROFESSOR/ALUNO se o token vier com `instituicaoId` null.

---

## 3. Multi-tenant

- Controllers usam `getInstituicaoIdFromAuth(req)` ou `requireTenantScope(req)`.
- Nunca usar `instituicaoId` do body/query/params para usuários não SUPER_ADMIN.
- SUPER_ADMIN pode passar `?instituicaoId=xxx` em rotas que exigem escopo.
- Todas as operações de listagem/criação/atualização devem filtrar por `instituicaoId` quando aplicável.

---

## 4. Tipos de instituição (SECUNDARIO / SUPERIOR)

- **tipoAcademico** – vem da instituição e é injetado no JWT no login.
- **SUPERIOR** – semestres (quantidadeSemestresPorAno = 2).
- **SECUNDARIO** – trimestres (quantidadeSemestresPorAno = null).
- Parâmetros do sistema respeitam `tipoAcademico` (ex.: `parametrosSistema.controller`).

---

## 5. Permissões RH (verificadas)

| Recurso | Backend | Frontend |
|---------|---------|----------|
| Criar usuário | ✅ ADMIN, SECRETARIA, RH, SUPER_ADMIN | usersApi.create |
| Criar funcionário | ✅ ADMIN, RH, SUPER_ADMIN | funcionariosApi |
| Estrutura organizacional | ✅ ADMIN, SECRETARIA, DIRECAO, COORDENADOR, RH | RecursosHumanos |
| Documentos funcionário | ✅ ADMIN, RH, SUPER_ADMIN | DocumentosFuncionarioDialog |
| Folha de pagamento | ✅ ADMIN, RH, SECRETARIA, SUPER_ADMIN | FolhaPagamentoTab |
| Biometria | ✅ ADMIN, RH, SECRETARIA, etc. | DispositivosBiometricosTab |
| Rota /recursos-humanos | ✅ ADMIN, SECRETARIA, DIRECAO, COORDENADOR, RH | ProtectedRoute |

---

## 6. Alteração feita (2026-02-22)

**Auth middleware** – fallback de `instituicaoId` no token:
- Staff (RH, SECRETARIA, FINANCEIRO, POS, DIRECAO, COORDENADOR): busca em `Funcionario` quando null.
- PROFESSOR: busca em `Professor` quando null.
- Garante funcionamento correto mesmo com tokens antigos ou dados desatualizados.

---

## 7. Boas práticas

1. Novas rotas devem usar `authorize()` com as roles corretas.
2. Operações sensíveis devem validar `instituicaoId` da entidade vs. do token.
3. Staff deve estar vinculado a Funcionário com `instituicaoId` preenchido.
4. Ao adicionar roles, manter consistência entre backend (`authorize`), frontend (sidebar, ProtectedRoute) e RBAC middleware.

---

## 8. Auditoria roleLabel e multi-tenant (2026-02-23)

### roleLabel

| Componente | Status | Observação |
|------------|--------|------------|
| `DashboardLayout` | ✅ | Usa `getRoleLabel(role)` → passado para `DynamicSidebar` como `roleLabel` |
| `DynamicSidebar` | ✅ | Recebe `roleLabel` (prop) e exibe no header do usuário |
| `AdminDashboard` | ✅ | Usa `getRoleLabel(recentUser.role)` para badge de utilizadores recentes |
| `RedefinirSenha` | ✅ | Usa `getRoleLabel(user.role)` para lista de utilizadores |
| `SegurancaTab` | ✅ | Corrigido: usa `getRoleLabel(item.role)` na hierarquia de roles |
| `roleLabels.ts` | ✅ | `ROLE_LABELS` completo: SUPER_ADMIN, COMERCIAL, ADMIN, DIRECAO, COORDENADOR, SECRETARIA, RH, FINANCEIRO, POS, PROFESSOR, RESPONSAVEL, ALUNO, AUDITOR |

**Layout único:** Todos os dashboards (Admin, Secretaria, POS, Professor, Aluno, SuperAdmin, Responsável) usam `DashboardLayout`, que centraliza a exibição do perfil via `getRoleLabel(role)`.

### Multi-tenant – controllers críticos

| Controller | addInstitutionFilter | requireTenantScope | Rejeita body.instituicaoId |
|------------|---------------------|--------------------|----------------------------|
| funcionario | ✅ | - | - (usa req.user.instituicaoId) |
| matricula | ✅ | ✅ (create/update) | ✅ |
| mensalidade | ✅ | ✅ | ✅ |
| curso | ✅ | ✅ | ✅ |
| turma | ✅ | ✅ | ✅ |
| classe | ✅ | - | ✅ |
| bolsa | ✅ | ✅ (create) | ✅ |
| nota | ✅ | ✅ | ✅ |
| avaliacao | ✅ | ✅ | - |
| estudante | - | ✅ | - |
| user | ✅ | ✅ (createInstituicaoUser) | SUPER_ADMIN pode passar |
| disciplina | req.user.instituicaoId | - | ✅ |
| professorDisciplina | ✅ | ✅ | ✅ (non-SA) |
| contratoFuncionario | ✅ | - | ✅ |
| frequenciaFuncionario | addInstitutionFilter | - | - |
| documentoAluno | ✅ | - | - |
| folhaPagamento | ✅ | - | - |
| fornecedor | ✅ | - | - |
| horario | - | ✅ | ✅ |
| planoEnsino | - | - | ✅ |

**Princípio verificado:** `instituicaoId` provém exclusivamente do JWT (com fallback via Funcionario/Professor para staff). Controllers que recebem `req.body.instituicaoId` rejeitam ou ignoram esse valor para utilizadores não SUPER_ADMIN.

---

## 9. Auditoria tipoAcademico (SECUNDARIO / SUPERIOR) – 2026-02-19

### Fluxo principal

| Camada | Fonte | Uso |
|--------|-------|-----|
| Backend auth | `Instituicao.tipoAcademico` | Injetado no JWT no login (auth.service) |
| Frontend InstituicaoContext | JWT decoded + config API | `tipoAcademico`, `isSuperior`, `isSecundario` |
| parametrosSistema | `req.user.tipoAcademico` | `quantidadeSemestresPorAno`: SUPERIOR=2, SECUNDARIO=null |
| sidebar.modules | `getSidebarModulesForRole(roles, tipoAcademico)` | Filtra módulos por `tipoInstituicao` |
| AnoLetivoContextHeader | `tipoAcademico` | Semestre (SUPERIOR) vs Trimestre (SECUNDARIO) |
| PeriodoAcademicoSelect | `isSuperior` / `isSecundario` | Semestres vs Trimestres |
| pdfGenerator | `tipoAcademico` em ReciboData/ExtratoFinanceiroData | "Ano" vs "Classe" em recibos |

### Componentes verificados

| Componente | tipoAcademico | Observação |
|------------|---------------|------------|
| ConfiguracoesInstituicao | ✅ | Labels, quantidadeSemestresPorAno, cores |
| GestaoFinanceira | ✅ | Passa tipoAcademico a selects |
| SecretariaDashboard | ✅ | anoFrequencia/classeFrequencia por nivelEnsino |
| POSDashboard | ✅ | termoEstudante, formatAnoFrequenciaSuperior |
| MinhasMensalidades | ✅ | tipoAcademico em ExtratoFinanceiroData |
| MatriculasAlunoTab | ✅ | isSecundario para anoFrequencia/classeFrequencia |
| MatriculasTurmasTab | ✅ | isSecundario para classeOuAnoCurso |
| ProfessorDashboard | ✅ | isSecundario para exibir turma.ano/semestre |
| GestaoNotas | ✅ | Lógica trimestres (SECUNDARIO) vs semestres |
| ConfiguracaoEnsino | ✅ | Tabs Semestres/Trimestres condicionais |

### Boas práticas

1. Preferir `tipoAcademico` explícito sobre `isSecundario`/`isSuperior` em payloads (ex: ExtratoFinanceiroData).
2. Quando `tipoAcademico` é null (loading), fallback para `isSecundario ? 'SECUNDARIO' : 'SUPERIOR'` em PDFs.
3. PeriodoAcademicoSelect: quando tipo não detectado, exibe "Tipo de instituição não detectado".
