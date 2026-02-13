# Testes Obrigatórios - Ano Letivo como Eixo Central

## Regra Mestra Validada
**Nenhuma operação acadêmica pode existir fora de um Ano Letivo ATIVO.**

## Testes de Validação Backend

### 1. Criar entidade SEM Ano Letivo → BLOQUEAR

#### Teste 1.1: Criar Matrícula Anual sem anoLetivoId
```bash
POST /matriculas-anuais
Body: {
  "alunoId": "uuid-aluno",
  "nivelEnsino": "SUPERIOR",
  "classeOuAnoCurso": "1º Ano"
  // SEM anoLetivoId
}
```
**Resultado Esperado:** HTTP 400 - "Não existe Ano Letivo ativo..."

#### Teste 1.2: Criar Plano de Ensino sem anoLetivoId
```bash
POST /plano-ensino
Body: {
  "disciplinaId": "uuid-disciplina",
  "professorId": "uuid-professor"
  // SEM anoLetivoId
}
```
**Resultado Esperado:** HTTP 400 - Middleware bloqueia

### 2. Criar com Ano Letivo ENCERRADO → BLOQUEAR

#### Teste 2.1: Criar Matrícula Anual com anoLetivoId ENCERRADO
```bash
# Primeiro, criar e encerrar um ano letivo
POST /anos-letivos
# ... criar ano letivo ...
POST /anos-letivos/{id}/encerrar

# Tentar criar matrícula com ano letivo encerrado
POST /matriculas-anuais
Body: {
  "alunoId": "uuid-aluno",
  "anoLetivoId": "uuid-ano-letivo-encerrado",
  ...
}
```
**Resultado Esperado:** HTTP 400 - "Não é possível criar matrícula. O ano letivo está ENCERRADO."

### 3. Criar com Ano Letivo de outra instituição → BLOQUEAR

#### Teste 3.1: Tentar usar anoLetivoId de outra instituição
```bash
# Usuário da Instituição A tentando usar anoLetivoId da Instituição B
POST /matriculas-anuais
Headers: {
  "Authorization": "Bearer token-instituicao-A"
}
Body: {
  "anoLetivoId": "uuid-ano-letivo-instituicao-B",
  ...
}
```
**Resultado Esperado:** HTTP 403/404 - "Ano letivo não encontrado ou não pertence à sua instituição"

### 4. Criar com Ano Letivo ATIVO → PERMITIR

#### Teste 4.1: Criar Matrícula Anual com anoLetivoId ATIVO
```bash
POST /matriculas-anuais
Body: {
  "alunoId": "uuid-aluno",
  "anoLetivoId": "uuid-ano-letivo-ativo",
  "nivelEnsino": "SUPERIOR",
  "classeOuAnoCurso": "1º Ano"
}
```
**Resultado Esperado:** HTTP 201 - Matrícula criada com sucesso

## Validações Implementadas

### Backend - Middlewares Aplicados
- ✅ `/plano-ensino/*` (POST, PUT) - `requireAnoLetivoAtivo`
- ✅ `/aulas-lancadas/*` (POST) - `requireAnoLetivoAtivo`
- ✅ `/avaliacoes/*` (POST) - `requireAnoLetivoAtivo`
- ✅ `/matriculas-anuais/*` (POST) - `requireAnoLetivoAtivo`
- ✅ `/presencas/*` (POST) - `requireAnoLetivoAtivo`
- ✅ `/notas/*` (POST, PUT) - `requireAnoLetivoAtivo`
- ✅ `/aluno-disciplinas/*` (POST, PUT) - `requireAnoLetivoAtivo`

### Backend - Controllers Validados
- ✅ `matriculaAnual.controller.ts` - Valida `anoLetivoId` ou busca ativo
- ✅ `planoEnsino.controller.ts` - Valida `anoLetivoId` obrigatório
- ✅ `aulasLancadas.controller.ts` - Valida ano letivo do plano
- ✅ `avaliacao.controller.ts` - Valida ano letivo do plano

### Frontend - Componentes Atualizados
- ✅ `PlanoEnsinoTab` - Usa `AnoLetivoSelect` e `AnoLetivoAtivoGuard`
- ✅ `LancamentoAulasTab` - Usa anos letivos da API
- ✅ `AnoLetivoSelect` - Componente reutilizável criado
- ✅ `AnoLetivoAtivoGuard` - Guard para bloquear ações

### Schema Prisma - Campos Obrigatórios
- ✅ `MatriculaAnual.anoLetivoId` - String (obrigatório)
- ✅ `PlanoEnsino.anoLetivoId` - String (obrigatório)
- ✅ `Semestre.anoLetivoId` - String (obrigatório) - JÁ ESTAVA
- ✅ `Trimestre.anoLetivoId` - String (obrigatório) - JÁ ESTAVA

## Checklist de Testes Manuais

### Setup Inicial
- [ ] Criar instituição de teste
- [ ] Criar usuário ADMIN na instituição
- [ ] Fazer login e obter token

### Cenário 1: Sem Ano Letivo Ativo
- [ ] Tentar criar matrícula anual → Deve bloquear
- [ ] Tentar criar plano de ensino → Deve bloquear
- [ ] Tentar lançar aula → Deve bloquear
- [ ] Verificar mensagem de erro: "Não existe Ano Letivo ativo..."

### Cenário 2: Com Ano Letivo PLANEJADO
- [ ] Criar ano letivo com status PLANEJADO
- [ ] Tentar criar matrícula anual → Deve bloquear (middleware requer ATIVO)
- [ ] Ativar ano letivo
- [ ] Tentar criar matrícula anual → Deve permitir

### Cenário 3: Com Ano Letivo ENCERRADO
- [ ] Criar e ativar ano letivo
- [ ] Criar matrícula anual (sucesso)
- [ ] Encerrar ano letivo
- [ ] Tentar criar nova matrícula com ano encerrado → Deve bloquear
- [ ] Verificar mensagem: "O ano letivo está ENCERRADO"

### Cenário 4: Multi-tenant
- [ ] Criar ano letivo na Instituição A
- [ ] Tentar usar anoLetivoId da Instituição A com token da Instituição B → Deve bloquear
- [ ] Verificar mensagem: "não pertence à sua instituição"

### Cenário 5: Operações Permitidas
- [ ] Criar ano letivo ATIVO
- [ ] Criar matrícula anual → Sucesso
- [ ] Criar plano de ensino → Sucesso
- [ ] Lançar aula → Sucesso
- [ ] Criar avaliação → Sucesso
- [ ] Lançar nota → Sucesso

## Validações Frontend

### Componente: AnoLetivoSelect
- [ ] Carrega apenas anos letivos criados no sistema
- [ ] Não permite digitação manual
- [ ] Mostra status (Ativo, Encerrado, Planejado)
- [ ] Desabilita quando não há ano letivo ativo

### Componente: AnoLetivoAtivoGuard
- [ ] Mostra alerta quando não há ano letivo ativo
- [ ] Desabilita ações acadêmicas quando não há ano letivo ativo
- [ ] Mostra botão para gerenciar anos letivos

### Páginas Principais
- [ ] Plano de Ensino: Bloqueia criação sem ano letivo ativo
- [ ] Lançamento de Aulas: Bloqueia lançamento sem ano letivo ativo
- [ ] Avaliações: Bloqueia criação sem ano letivo ativo
- [ ] Matrículas: Bloqueia criação sem ano letivo ativo

## Notas Importantes

1. **Migration Necessária:** Após tornar `anoLetivoId` obrigatório no schema, é necessário:
   ```bash
   npx prisma migrate dev --name tornar_ano_letivo_id_obrigatorio
   ```
   **ATENÇÃO:** Migração pode falhar se houver registros com `anoLetivoId` NULL.
   Execute script de migração de dados primeiro:
   - Atribuir `anoLetivoId` para todos os registros existentes
   - Ou criar ano letivo padrão para registros históricos

2. **Backward Compatibility:** Campos `anoLetivo` (Int) foram mantidos para compatibilidade, mas validações usam `anoLetivoId`.

3. **Performance:** Middleware `requireAnoLetivoAtivo` faz query no banco. Considere cache se necessário.

