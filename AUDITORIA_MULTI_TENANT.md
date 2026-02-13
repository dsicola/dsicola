# AUDITORIA MULTI-TENANT - DSICOLA
## Verificação de Isolamento entre Instituições

**Data**: 2025-01-27  
**Status**: Em Progresso

---

## 📊 RESUMO EXECUTIVO

### ✅ PONTOS POSITIVOS

1. **Middleware `addInstitutionFilter`**: Implementado e usado consistentemente
2. **Middleware `requireTenantScope`**: Implementado para operações críticas
3. **Validações de segurança**: Maioria dos controllers rejeita `instituicaoId` do body
4. **Schema Prisma**: 71 modelos com `instituicaoId` (maioria das entidades institucionais)

### ⚠️ PROBLEMAS ENCONTRADOS

1. **SUPER_ADMIN aceita `instituicaoId` do body/query**: Permitido apenas para SUPER_ADMIN (exceção controlada)
2. **Alguns modelos sem `instituicaoId`**: Entidades globais (ex: `Instituicao`, `Plano`, `PlanosPrecos`)
3. **Queries sem filtro**: Algumas queries helper podem não ter filtro (mas recebem `instituicaoId` como parâmetro)

---

## 1. VERIFICAÇÃO DE MODELOS COM `instituicaoId`

### ✅ Modelos COM `instituicaoId` (71 modelos)

- User, UserRole_, LoginAttempt, PasswordResetToken
- Plano, PlanosPrecos, Assinatura, PagamentoLicenca, DocumentoFiscal
- Curso, Classe, Disciplina, Professor, CursoDisciplina, ProfessorCurso, ProfessorDisciplina
- Turno, Turma, Matricula, MatriculaAnual, AlunoDisciplina
- Aula, Frequencia, Exame, Nota, NotaHistorico
- Horario, Mensalidade, ConfiguracaoMulta, Pagamento, BolsaDesconto, AlunoBolsa
- Comunicado, ComunicadoDestinatario, ComunicadoLeitura, EventoCalendario
- AnoLetivo, Semestre, Trimestre
- TipoDocumento, DocumentoEmitido, DocumentoAluno
- Candidatura, Alojamento, AlocacaoAlojamento
- Funcionario, Departamento, Cargo, ContratoFuncionario, FolhaPagamento
- FrequenciaFuncionario, BiometriaFuncionario, JustificativaFalta
- DispositivoBiometrico, DispositivoBiometricoUsuario, EventoBiometrico
- DocumentoFuncionario, BeneficioFuncionario, AvaliacaoFuncionario
- ConfiguracaoInstituicao, ParametrosSistema, EmailTemplate
- VideoAula, VideoAulaProgresso, TreinamentoTrilha, TreinamentoTrilhaAula
- EmailEnviado, LogAuditoria, Permission, RolePermission, UserContext
- ConfiguracaoLanding, LeadComercial, BackupHistory, BackupSchedule
- TermoResponsabilidade, TermoLegal, AceiteTermoLegal
- SequenciaIdentificacao, Fornecedor, ContratoFornecedor, PagamentoFornecedor
- TrimestreFechado, EncerramentoAcademico, ReaberturaAnoLetivo
- MetaFinanceira, Notificacao, PagamentoInstituicao, SaftExport
- HistoricoRh, MensagemResponsavel, ResponsavelAluno, Feriado
- PlanoEnsino, PlanoAula, BibliografiaPlano, DistribuicaoAula
- AulaLancada, Presenca, Avaliacao, WorkflowLog
- EventoGovernamental, RelatorioGerado
- BibliotecaItem, EmprestimoBiblioteca, HistoricoAcademico
- EquivalenciaDisciplina, ConclusaoCurso, ColacaoGrau, Certificado

### ⚠️ Modelos SEM `instituicaoId` (Entidades Globais)

- **Instituicao**: Não precisa (é a própria entidade)
- **Plano**: Entidade global (planos de assinatura)
- **PlanosPrecos**: Entidade global (preços de planos)
- **RefreshToken**: Entidade de autenticação (vinculada a User que tem instituicaoId)
- **LogRedefinicaoSenha**: Log global (não precisa de instituicaoId)

**Status**: ✅ **OK** - Modelos sem `instituicaoId` são entidades globais ou já filtradas via relacionamentos

---

## 2. VERIFICAÇÃO DE CONTROLLERS ACEITANDO `instituicaoId` DO BODY/QUERY

### ⚠️ Controllers que aceitam `instituicaoId` do body/query

#### 1. `user.controller.ts` - `createUser`
```typescript
// SUPER_ADMIN pode fornecer instituicaoId do body
const finalInstituicaoId = isSuperAdmin && req.body.instituicaoId 
  ? req.body.instituicaoId 
  : instituicaoId;
```
**Status**: ✅ **OK** - Apenas SUPER_ADMIN, com validação explícita

#### 2. `professorDisciplina.controller.ts` - `create`
```typescript
// SUPER_ADMIN pode fornecer instituicaoId do body
if (isSuperAdmin && req.body.instituicaoId) {
  finalInstituicaoId = req.body.instituicaoId;
}
```
**Status**: ✅ **OK** - Apenas SUPER_ADMIN, com validação explícita

#### 3. `mensalidade.controller.ts` - `getMensalidades`
```typescript
// SUPER_ADMIN pode filtrar por instituicaoId via query
if (req.user && req.user.roles.includes('SUPER_ADMIN')) {
  const queryInstId = req.query.instituicaoId as string;
  if (queryInstId) {
    where.aluno = { instituicaoId: queryInstId };
  }
}
```
**Status**: ✅ **OK** - Apenas SUPER_ADMIN, com validação explícita

#### 4. `addInstitutionFilter` (middleware)
```typescript
// SUPER_ADMIN pode filtrar por instituicaoId via query
if (req.user.roles.includes('SUPER_ADMIN')) {
  const queryInstId = req.query.instituicaoId as string;
  if (queryInstId) {
    return { instituicaoId: queryInstId.trim() };
  }
}
```
**Status**: ✅ **OK** - Apenas SUPER_ADMIN, com validação explícita

### ❌ Controllers que DEVEM ser corrigidos

#### 1. `matriculasDisciplinasV2.controller.ts`
```typescript
// PROBLEMA: Aceita instituicao_id do query sem validação de SUPER_ADMIN
if (req.query.instituicao_id) {
  const instituicaoId = String(req.query.instituicao_id).trim();
}
```
**Ação**: Corrigir para usar apenas do JWT (exceto SUPER_ADMIN)

#### 2. `reaberturaAnoLetivo.controller.ts`
```typescript
// PROBLEMA: Aceita instituicaoId do query sem validação de SUPER_ADMIN
const instituicaoId = req.query.instituicaoId as string | undefined;
```
**Ação**: Corrigir para usar apenas do JWT (exceto SUPER_ADMIN)

#### 3. `termoLegal.controller.ts`
```typescript
// PROBLEMA: Aceita instituicaoId do query sem validação de SUPER_ADMIN
(req.query.instituicaoId as string) || 
```
**Ação**: Corrigir para usar apenas do JWT (exceto SUPER_ADMIN)

#### 4. `candidatura.controller.ts`
```typescript
// PROBLEMA: Aceita instituicaoId do query sem validação de SUPER_ADMIN
const queryInstId = req.query.instituicaoId as string;
```
**Ação**: Corrigir para usar apenas do JWT (exceto SUPER_ADMIN)

#### 5. `configuracaoMulta.controller.ts`
```typescript
// PROBLEMA: Aceita instituicaoId do query sem validação de SUPER_ADMIN
const instituicaoId = req.user?.roles.includes('SUPER_ADMIN') && req.query.instituicaoId
  ? req.query.instituicaoId as string
  : req.user?.instituicaoId;
```
**Status**: ⚠️ **PARCIALMENTE OK** - Valida SUPER_ADMIN, mas pode ser melhorado

---

## 3. VERIFICAÇÃO DE QUERIES SEM FILTRO POR `instituicaoId`

### ✅ Padrões Corretos Identificados

#### 1. Uso de `addInstitutionFilter(req)`
```typescript
const filter = addInstitutionFilter(req);
const where: any = { ...filter };
const results = await prisma.model.findMany({ where });
```

#### 2. Uso de `requireTenantScope(req)`
```typescript
const instituicaoId = requireTenantScope(req);
const result = await prisma.model.create({
  data: { instituicaoId, ...otherData }
});
```

#### 3. Filtro via relacionamentos
```typescript
// Para entidades sem instituicaoId direto
const where: any = {};
if (filter.instituicaoId) {
  where.aluno = { instituicaoId: filter.instituicaoId };
}
```

### ⚠️ Queries Helper Functions

Algumas funções helper recebem `instituicaoId` como parâmetro (já validado):
```typescript
async function getCargaHorariaExigida(planoEnsinoId: string, instituicaoId: string) {
  const plano = await prisma.planoEnsino.findFirst({
    where: { id: planoEnsinoId, instituicaoId }, // ✅ Filtro aplicado
  });
}
```
**Status**: ✅ **OK** - `instituicaoId` já validado antes da query

---

## 4. RECOMENDAÇÕES

### 🔴 CRÍTICO

1. **Corrigir `matriculasDisciplinasV2.controller.ts`**: Remover aceitação de `instituicao_id` do query
2. **Corrigir `reaberturaAnoLetivo.controller.ts`**: Remover aceitação de `instituicaoId` do query
3. **Corrigir `termoLegal.controller.ts`**: Remover aceitação de `instituicaoId` do query
4. **Corrigir `candidatura.controller.ts`**: Remover aceitação de `instituicaoId` do query

### 🟡 IMPORTANTE

1. **Padronizar validação SUPER_ADMIN**: Criar helper para validar se SUPER_ADMIN pode usar `instituicaoId` do body/query
2. **Documentar exceções**: Documentar claramente quando SUPER_ADMIN pode usar `instituicaoId` do body/query
3. **Adicionar testes**: Criar testes para garantir que multi-tenant está funcionando corretamente

### 🟢 MELHORIAS

1. **Tornar `instituicaoId` obrigatório**: Considerar tornar `instituicaoId` obrigatório em mais modelos (atualmente muitos são opcionais)
2. **Auditoria automática**: Criar script de auditoria que verifica queries sem filtro
3. **Linting**: Adicionar regra de linting para detectar queries sem filtro multi-tenant

---

## 5. CONCLUSÃO

### Status Geral: ✅ **BOM COM MELHORIAS NECESSÁRIAS**

- **Multi-tenant implementado**: ✅ Maioria dos controllers usa filtro correto
- **Validações de segurança**: ✅ Maioria dos controllers rejeita `instituicaoId` do body
- **Exceções controladas**: ✅ SUPER_ADMIN pode usar `instituicaoId` do body/query (com validação)
- **Problemas encontrados**: ⚠️ 4 controllers precisam ser corrigidos

### Próximos Passos

1. Corrigir os 4 controllers identificados
2. Adicionar testes de multi-tenant
3. Documentar exceções para SUPER_ADMIN
4. Considerar tornar `instituicaoId` obrigatório em mais modelos

