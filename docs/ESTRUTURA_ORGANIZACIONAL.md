# Estrutura Organizacional - DSICOLA

## Visão Geral

A Estrutura Organizacional do DSICOLA implementa uma hierarquia de três níveis:

```
📁 DEPARTAMENTO
  └── 💼 CARGO
      └── 👤 FUNCIONÁRIO
```

Esta estrutura permite organizar e visualizar a estrutura completa da instituição de forma hierárquica e intuitiva.

---

## Modelo de Dados

### 1. Departamento

**Tabela**: `departamentos`

**Campos Principais**:
- `id` (UUID)
- `nome` (String) - Nome do departamento
- `descricao` (String, opcional) - Descrição do departamento
- `ativo` (Boolean) - Status do departamento
- `instituicaoId` (UUID) - Multi-tenant

**Relacionamentos**:
- `funcionarios` → Lista de funcionários do departamento
- `users` → Usuários vinculados ao departamento

**Exemplo**:
```json
{
  "id": "dept-001",
  "nome": "Departamento Acadêmico",
  "descricao": "Responsável pela gestão acadêmica",
  "ativo": true,
  "instituicao_id": "inst-001"
}
```

---

### 2. Cargo

**Tabela**: `cargos`

**Campos Principais**:
- `id` (UUID)
- `nome` (String) - Nome do cargo
- `descricao` (String, opcional) - Descrição do cargo
- `tipo` (Enum) - `ACADEMICO` ou `ADMINISTRATIVO`
- `salarioBase` (Decimal, opcional) - Salário base do cargo
- `ativo` (Boolean) - Status do cargo
- `instituicaoId` (UUID) - Multi-tenant

**Tipos de Cargo**:
- **ACADEMICO**: Para professores e cargos acadêmicos
- **ADMINISTRATIVO**: Para secretaria, coordenação, etc.

**Relacionamentos**:
- `funcionarios` → Lista de funcionários com este cargo
- `contratos` → Contratos vinculados ao cargo
- `users` → Usuários vinculados ao cargo

**Exemplo**:
```json
{
  "id": "cargo-001",
  "nome": "Professor de Matemática",
  "descricao": "Professor responsável pela disciplina de Matemática",
  "tipo": "ACADEMICO",
  "salario_base": 50000.00,
  "ativo": true,
  "instituicao_id": "inst-001"
}
```

---

### 3. Funcionário

**Tabela**: `funcionarios`

**Campos Principais**:
- `id` (UUID)
- `userId` (UUID, opcional) - Link com usuário do sistema
- `nomeCompleto` (String) - Nome completo
- `email` (String, opcional)
- `telefone` (String, opcional)
- `cargoId` (UUID, opcional) - **Vínculo com Cargo**
- `departamentoId` (UUID, opcional) - **Vínculo com Departamento**
- `salarioBase` (Decimal, opcional) - Salário do funcionário
- `status` (Enum) - `ATIVO`, `SUSPENSO`, `ENCERRADO`
- `dataAdmissao` (DateTime) - Data de admissão
- `dataDemissao` (DateTime, opcional) - Data de demissão
- `instituicaoId` (UUID) - Multi-tenant

**Relacionamentos**:
- `cargo` → Cargo do funcionário
- `departamento` → Departamento do funcionário
- `user` → Usuário vinculado (se houver)

**Exemplo**:
```json
{
  "id": "func-001",
  "nome_completo": "João Silva",
  "email": "joao.silva@instituicao.edu",
  "cargo_id": "cargo-001",
  "departamento_id": "dept-001",
  "salario_base": 50000.00,
  "status": "ATIVO",
  "data_admissao": "2024-01-15",
  "instituicao_id": "inst-001"
}
```

---

## Hierarquia Completa

### Estrutura de Dados Retornada

A API `/rh/estrutura-organizacional` retorna a hierarquia completa:

```json
{
  "estrutura": [
    {
      "id": "dept-001",
      "nome": "Departamento Acadêmico",
      "descricao": "Responsável pela gestão acadêmica",
      "total_cargos": 3,
      "total_funcionarios": 15,
      "cargos": [
        {
          "id": "cargo-001",
          "nome": "Professor de Matemática",
          "descricao": "Professor responsável pela disciplina",
          "tipo": "ACADEMICO",
          "salario_base": 50000.00,
          "quantidade_funcionarios": 5,
          "funcionarios": [
            {
              "id": "func-001",
              "nome_completo": "João Silva",
              "email": "joao.silva@instituicao.edu",
              "telefone": "+244 923 456 789",
              "status": "ATIVO",
              "data_admissao": "2024-01-15",
              "foto_url": "https://..."
            },
            // ... mais funcionários
          ]
        },
        // ... mais cargos
      ],
      "funcionarios_sem_cargo": [
        {
          "id": "func-999",
          "nome_completo": "Maria Santos",
          "email": "maria@instituicao.edu",
          "status": "ATIVO",
          "aviso": "Funcionário sem cargo vinculado"
        }
      ]
    },
    // ... mais departamentos
  ],
  "inconsistencias": {
    "cargos_sem_departamento": [
      {
        "id": "cargo-999",
        "nome": "Cargo Órfão",
        "quantidade_funcionarios": 2,
        "aviso": "Cargo sem departamento vinculado"
      }
    ],
    "funcionarios_sem_cargo": [
      {
        "id": "func-888",
        "nome_completo": "Pedro Costa",
        "email": "pedro@instituicao.edu",
        "departamento": {
          "id": "dept-001",
          "nome": "Departamento Acadêmico"
        },
        "aviso": "Funcionário sem cargo vinculado"
      }
    ]
  },
  "estatisticas": {
    "total_departamentos": 5,
    "total_cargos": 12,
    "total_funcionarios": 45,
    "total_inconsistencias": 3
  }
}
```

---

## Fluxo de Funcionamento

### 1. Criação da Estrutura

#### Passo 1: Criar Departamento
```http
POST /departamentos
{
  "nome": "Departamento Acadêmico",
  "descricao": "Responsável pela gestão acadêmica"
}
```

#### Passo 2: Criar Cargo
```http
POST /cargos
{
  "nome": "Professor de Matemática",
  "tipo": "ACADEMICO",
  "salario_base": 50000.00
}
```

#### Passo 3: Criar Funcionário
```http
POST /funcionarios
{
  "nome_completo": "João Silva",
  "email": "joao.silva@instituicao.edu",
  "cargo_id": "cargo-001",
  "departamento_id": "dept-001",
  "salario_base": 50000.00,
  "data_admissao": "2024-01-15"
}
```

---

### 2. Visualização da Hierarquia

#### Endpoint
```http
GET /rh/estrutura-organizacional
```

#### Processamento

1. **Busca Departamentos Ativos**
   - Filtra por `instituicaoId` (multi-tenant)
   - Apenas departamentos com `ativo = true`
   - Ordena por nome

2. **Para Cada Departamento**:
   - Busca funcionários ativos do departamento
   - Agrupa funcionários por `cargoId`
   - Busca cargos únicos do departamento
   - Formata cargos com seus funcionários
   - Identifica funcionários sem cargo

3. **Identifica Inconsistências**:
   - Cargos sem departamento (funcionários com cargo mas sem departamento)
   - Funcionários sem cargo (global)

4. **Calcula Estatísticas**:
   - Total de departamentos
   - Total de cargos
   - Total de funcionários
   - Total de inconsistências

---

## Validações e Regras

### 1. Multi-tenant
- Todos os registros são filtrados por `instituicaoId` do JWT
- Não é possível acessar dados de outras instituições

### 2. Validação de Cargo com Perfil
- **PROFESSOR** só pode estar em cargos `ACADEMICO`
- **SECRETARIA** só pode estar em cargos `ADMINISTRATIVO`
- **ADMIN** pode estar em qualquer cargo

### 3. Exclusão em Cascata
- **Não é possível excluir** departamento com funcionários vinculados
- **Não é possível excluir** cargo com funcionários vinculados
- Mensagem: "Não é possível excluir [departamento/cargo] com funcionários vinculados"

### 4. Status
- Apenas departamentos e cargos **ativos** aparecem na estrutura
- Apenas funcionários **ativos** aparecem na estrutura

---

## Inconsistências Detectadas

### 1. Funcionários sem Cargo
**Problema**: Funcionário ativo sem `cargoId` ou com cargo inativo

**Detecção**:
- Busca funcionários ativos com `cargoId = null`
- Verifica se cargo está ativo

**Solução**:
- Vincular funcionário a um cargo ativo
- Ou criar novo cargo se necessário

### 2. Cargos sem Departamento
**Problema**: Funcionários com cargo mas sem `departamentoId`

**Detecção**:
- Busca cargos com funcionários
- Verifica se algum funcionário tem `departamentoId`

**Solução**:
- Vincular funcionários a um departamento
- Ou criar novo departamento se necessário

---

## Frontend - Visualização

### Componente: `EstruturaOrganizacionalTab`

**Localização**: `frontend/src/components/rh/EstruturaOrganizacionalTab.tsx`

**Funcionalidades**:
1. **Accordion de Departamentos**
   - Expande/colapsa departamentos
   - Mostra estatísticas (total de cargos e funcionários)

2. **Accordion de Cargos**
   - Dentro de cada departamento
   - Mostra quantidade de funcionários por cargo

3. **Lista de Funcionários**
   - Dentro de cada cargo
   - Mostra nome, email, telefone, status
   - Botão para ver perfil completo

4. **Alertas de Inconsistências**
   - Cargos sem departamento
   - Funcionários sem cargo
   - Badge amarelo com aviso

5. **Estatísticas Gerais**
   - Total de departamentos
   - Total de cargos
   - Total de funcionários
   - Total de inconsistências

---

## API Endpoints

### Departamentos
```http
GET    /departamentos              # Listar todos
GET    /departamentos/:id          # Buscar por ID
POST   /departamentos              # Criar (ADMIN)
PUT    /departamentos/:id          # Atualizar (ADMIN)
DELETE /departamentos/:id          # Excluir (ADMIN)
```

### Cargos
```http
GET    /cargos                     # Listar todos
GET    /cargos/:id                 # Buscar por ID
POST   /cargos                     # Criar (ADMIN)
PUT    /cargos/:id                 # Atualizar (ADMIN)
DELETE /cargos/:id                 # Excluir (ADMIN)
```

### Funcionários
```http
GET    /funcionarios               # Listar todos
GET    /funcionarios/:id           # Buscar por ID
POST   /funcionarios               # Criar (ADMIN)
PUT    /funcionarios/:id           # Atualizar (ADMIN)
DELETE /funcionarios/:id           # Excluir (ADMIN)
```

### Estrutura Organizacional
```http
GET    /rh/estrutura-organizacional  # Hierarquia completa
```

---

## Permissões (RBAC)

### Criar/Editar/Excluir
- **ADMIN**: ✅ Total
- **SUPER_ADMIN**: ✅ Total
- **Outros**: ❌ Apenas visualização

### Visualizar
- Todos os usuários autenticados podem visualizar
- Filtrado por `instituicaoId` (multi-tenant)

---

## Exemplo de Uso

### Cenário: Criar estrutura completa

1. **Criar Departamento**
```bash
POST /departamentos
{
  "nome": "Departamento de Ciências",
  "descricao": "Responsável pelas disciplinas de ciências"
}
```

2. **Criar Cargo**
```bash
POST /cargos
{
  "nome": "Professor de Física",
  "tipo": "ACADEMICO",
  "salario_base": 55000.00
}
```

3. **Criar Funcionário**
```bash
POST /funcionarios
{
  "nome_completo": "Maria Santos",
  "email": "maria.santos@instituicao.edu",
  "cargo_id": "cargo-002",
  "departamento_id": "dept-002",
  "salario_base": 55000.00,
  "data_admissao": "2024-02-01"
}
```

4. **Visualizar Hierarquia**
```bash
GET /rh/estrutura-organizacional
```

**Resultado**:
```
📁 Departamento de Ciências
  └── 💼 Professor de Física
      └── 👤 Maria Santos
```

---

## Boas Práticas

### 1. Ordem de Criação
1. Primeiro: Criar Departamentos
2. Segundo: Criar Cargos
3. Terceiro: Criar Funcionários (vinculando a departamento e cargo)

### 2. Nomenclatura
- Departamentos: Nomes descritivos (ex: "Departamento Acadêmico")
- Cargos: Específicos (ex: "Professor de Matemática")
- Funcionários: Nome completo

### 3. Manutenção
- Verificar inconsistências regularmente
- Desativar (não excluir) departamentos/cargos não utilizados
- Manter dados atualizados

### 4. Validação
- Sempre validar tipo de cargo com perfil do usuário
- Verificar se departamento/cargo está ativo antes de vincular
- Não excluir se houver funcionários vinculados

---

## Troubleshooting

### Problema: Funcionário não aparece na estrutura
**Causas possíveis**:
- Funcionário está inativo (`status != 'ATIVO'`)
- Departamento está inativo (`ativo = false`)
- Cargo está inativo (`ativo = false`)
- Funcionário não tem `departamentoId` ou `cargoId`

**Solução**:
- Verificar status do funcionário
- Verificar se departamento e cargo estão ativos
- Vincular funcionário a departamento e cargo

### Problema: Cargo não aparece na estrutura
**Causas possíveis**:
- Cargo está inativo (`ativo = false`)
- Cargo não tem funcionários ativos vinculados

**Solução**:
- Ativar cargo
- Vincular funcionários ao cargo

### Problema: Departamento vazio
**Causas possíveis**:
- Departamento não tem funcionários
- Funcionários estão inativos
- Funcionários não têm cargo vinculado

**Solução**:
- Vincular funcionários ao departamento
- Ativar funcionários
- Vincular funcionários a cargos

---

## Conclusão

A Estrutura Organizacional do DSICOLA fornece uma visão hierárquica completa e organizada da instituição, facilitando:

- ✅ Gestão de recursos humanos
- ✅ Organização por departamentos
- ✅ Controle de cargos e salários
- ✅ Identificação de inconsistências
- ✅ Relatórios e estatísticas

**Última atualização**: 2024
**Versão**: 1.0.0

