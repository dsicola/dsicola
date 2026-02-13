# Blindagem de Endpoints CREATE/UPDATE - DSICOLA

## 📋 Resumo

Este documento descreve o padrão de blindagem implementado em todos os endpoints CREATE e UPDATE do sistema DSICOLA, garantindo que nenhum endpoint retorne erro 500 por campos ausentes, undefined ou dados inconsistentes.

## 🎯 Objetivo

**BLINDAR TODOS os endpoints de CREATE e UPDATE do sistema**, evitando erros 500 por:
- Campos undefined
- Status ausentes
- Dados inconsistentes entre módulos
- Falta de valores padrão

## ✅ Regras Obrigatórias

### 1. NENHUM create ou update pode:
- ❌ Quebrar se um campo opcional não vier
- ❌ Confiar que o frontend sempre enviará status, estado ou flags
- ❌ Gerar erro 500 por undefined

### 2. TODOS os models devem:
- ✅ Ter valores DEFAULT no Prisma para campos críticos
- ✅ Ter fallback no Service (não no Controller)

### 3. Controllers:
- ✅ Apenas recebem request
- ✅ Nunca fazem lógica de default
- ✅ Nunca manipulam status diretamente

### 4. Services:
- ✅ São responsáveis por:
  - Definir valores padrão
  - Normalizar dados
  - Garantir consistência institucional
  - Respeitar instituicao_id sempre

## 🛠️ Implementação

### Schema Prisma

Todos os models devem ter defaults para campos críticos:

```prisma
model Funcionario {
  id            String   @id @default(uuid())
  nome          String
  status        StatusFuncionario @default(ATIVO)
  instituicaoId String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

### Service Layer

Criar services específicos para normalização:

**Exemplo: `funcionario.service.ts`**

```typescript
export class FuncionarioService {
  static normalizeStatus(status?: string): StatusFuncionario {
    if (!status) return StatusFuncionario.ATIVO; // Default seguro
    // ... normalização
  }

  static async prepareCreateData(rawData: any, userRoles: string[]): Promise<any> {
    return {
      ...rawData,
      status: this.normalizeStatus(rawData.status), // Default aplicado
      instituicaoId: rawData.instituicaoId, // SEMPRE do token
    };
  }
}
```

### Controller Pattern

**❌ ANTES (ERRADO):**
```typescript
export const create = async (req: Request, res: Response, next: NextFunction) => {
  const { status, nome } = req.body;
  
  const data = {
    nome,
    status, // ❌ Pode ser undefined!
    instituicaoId: req.body.instituicaoId, // ❌ Confia no frontend!
  };
  
  await prisma.entidade.create({ data }); // ❌ Pode quebrar!
};
```

**✅ DEPOIS (CORRETO):**
```typescript
export const create = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new AppError('Usuário não autenticado', 401);
  }

  // Preparar dados usando Service
  const rawData = {
    ...req.body,
    instituicaoId: req.user.instituicaoId, // SEMPRE do token
  };

  const data = await EntidadeService.prepareCreateData(
    rawData,
    req.user.roles || []
  );

  const entidade = await prisma.entidade.create({ data });
  res.status(201).json(entidade);
};
```

## 📦 Services Criados

### 1. `normalize.service.ts`
Service genérico com funções utilitárias:
- `normalizeString()` - Normaliza strings (trim, null se vazio)
- `normalizeDecimal()` - Normaliza números decimais
- `normalizeInt()` - Normaliza números inteiros
- `normalizeDate()` - Normaliza datas
- `normalizeBoolean()` - Normaliza booleanos
- `normalizeEnum()` - Normaliza enums
- `ensureInstituicaoId()` - Garante instituicaoId do token

### 2. `funcionario.service.ts`
Service específico para Funcionários:
- `normalizeStatus()` - Normaliza StatusFuncionario
- `normalizeTipoVinculo()` - Normaliza TipoVinculo
- `normalizeRegimeTrabalho()` - Normaliza RegimeTrabalho
- `prepareCreateData()` - Prepara dados para CREATE
- `prepareUpdateData()` - Prepara dados para UPDATE

## 🔒 Campos Críticos com Defaults

### Status/Estado
- **Funcionário**: `StatusFuncionario.ATIVO`
- **PlanoEnsino**: `EstadoRegistro.RASCUNHO`
- **Avaliacao**: `EstadoRegistro.RASCUNHO`
- **Semestre**: `EstadoRegistro.RASCUNHO`
- **Assinatura**: `StatusAssinatura.ativa`
- **Mensalidade**: `StatusMensalidade.Pendente`

### Datas
- **createdAt**: `@default(now())`
- **updatedAt**: `@updatedAt`
- **dataAdmissao**: `@default(now())` (quando aplicável)

### Booleanos
- **ativo**: `@default(true)`
- **multa**: `@default(false)`

### Números
- **cargaHoraria**: `@default(0)`
- **valorMensalidade**: `@default(0)`
- **peso**: `@default(1)` (avaliações)

## 🎯 Multi-Tenant

**REGRA CRÍTICA**: `instituicaoId` é SEMPRE do token, NUNCA do body.

```typescript
// ✅ CORRETO
const instituicaoId = req.user.instituicaoId;

// ❌ ERRADO
const instituicaoId = req.body.instituicaoId;
```

**Exceção**: SUPER_ADMIN pode criar instituições (usa do body).

## 📝 Checklist de Blindagem

Para cada endpoint CREATE/UPDATE:

- [ ] Service criado/atualizado com normalização
- [ ] Controller usa Service para preparar dados
- [ ] `instituicaoId` sempre do token (exceto SUPER_ADMIN)
- [ ] Status/Estado tem default seguro
- [ ] Campos opcionais normalizados (null se vazio)
- [ ] Validação de relacionamentos (IDs existem)
- [ ] Prisma schema tem defaults onde aplicável
- [ ] Testado com campos undefined/null/vazios

## 🚀 Status da Implementação

### ✅ Concluído
- [x] Service genérico de normalização (`normalize.service.ts`)
- [x] Service de Funcionário (`funcionario.service.ts`)
- [x] Controller de Funcionário (CREATE/UPDATE blindados)
- [x] Controllers de Cargo e Departamento (já estavam bem blindados)

### 🔄 Em Progresso
- [ ] Controllers Acadêmicos (Curso, Disciplina, Turma, Classe)
- [ ] Controllers de PlanoEnsino e Avaliacao
- [ ] Controllers de Presença e Nota
- [ ] Controllers de Aulas Lançadas

### ⏳ Pendente
- [ ] Controllers de Biblioteca
- [ ] Controllers Financeiros
- [ ] Controllers de Super Admin
- [ ] Controllers de Instituições

## 📚 Exemplos de Uso

### Exemplo 1: CREATE com Status

```typescript
// Service
static async prepareCreateData(rawData: any): Promise<any> {
  return {
    nome: normalizeRequiredString(rawData.nome, 'Nome'),
    status: normalizeEnum(rawData.status, StatusFuncionario, StatusFuncionario.ATIVO),
    instituicaoId: ensureInstituicaoId(rawData.instituicaoId, tokenInstituicaoId),
  };
}

// Controller
export const create = async (req: Request, res: Response, next: NextFunction) => {
  const data = await EntidadeService.prepareCreateData({
    ...req.body,
    instituicaoId: req.user.instituicaoId,
  });
  const entidade = await prisma.entidade.create({ data });
  res.status(201).json(entidade);
};
```

### Exemplo 2: UPDATE com Campos Opcionais

```typescript
// Service
static async prepareUpdateData(id: string, rawData: any): Promise<any> {
  const data: any = {};
  
  if (rawData.nome !== undefined) {
    data.nome = normalizeRequiredString(rawData.nome, 'Nome');
  }
  if (rawData.status !== undefined) {
    data.status = normalizeEnum(rawData.status, StatusFuncionario, StatusFuncionario.ATIVO);
  }
  
  return data;
}

// Controller
export const update = async (req: Request, res: Response, next: NextFunction) => {
  const data = await EntidadeService.prepareUpdateData(req.params.id, req.body);
  
  if (Object.keys(data).length === 0) {
    throw new AppError('Nenhum campo fornecido para atualização', 400);
  }
  
  const entidade = await prisma.entidade.update({
    where: { id: req.params.id },
    data,
  });
  res.json(entidade);
};
```

## 🎓 Boas Práticas

1. **Sempre normalizar no Service**, nunca no Controller
2. **Sempre usar defaults seguros** para campos críticos
3. **Sempre validar relacionamentos** antes de salvar
4. **Nunca confiar no frontend** para campos críticos
5. **Sempre usar instituicaoId do token** (exceto SUPER_ADMIN)
6. **Sempre tratar undefined/null/vazio** de forma consistente

## 🔍 Validação

Para testar a blindagem:

```bash
# Teste 1: Campos undefined
curl -X POST /api/entidades \
  -H "Authorization: Bearer TOKEN" \
  -d '{}'

# Teste 2: Campos null
curl -X POST /api/entidades \
  -H "Authorization: Bearer TOKEN" \
  -d '{"status": null, "nome": null}'

# Teste 3: Campos vazios
curl -X POST /api/entidades \
  -H "Authorization: Bearer TOKEN" \
  -d '{"status": "", "nome": ""}'
```

**Resultado esperado**: Nenhum erro 500. Sistema deve aplicar defaults e retornar 400 apenas se campos obrigatórios estiverem ausentes.

## 📞 Suporte

Para dúvidas ou problemas com a blindagem, consulte:
- `backend/src/services/normalize.service.ts` - Funções genéricas
- `backend/src/services/funcionario.service.ts` - Exemplo completo
- `backend/src/controllers/funcionario.controller.ts` - Exemplo de uso

---

**Última atualização**: 2025-01-27
**Versão**: 1.0.0

