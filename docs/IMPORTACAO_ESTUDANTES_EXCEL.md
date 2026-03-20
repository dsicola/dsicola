# Importação de estudantes via Excel

Fluxo em duas fases: **pré-visualização** (leitura do ficheiro) e **confirmação** (criação de utilizadores e, quando aplicável, matrícula anual + matrícula na turma).

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/importar/estudantes/simples` | Multipart: campo `file` (.xlsx / .xls). Opcional: `columnHints` (JSON), `modoImportacao` (`seguro` \| `flexivel`). |
| `POST` | `/api/importar/estudantes/confirmar` | JSON: `linhas[]`, `modoImportacao` (`seguro` \| `flexivel`, default `seguro`). |

### Limite de pedido

- Até **2000** linhas por confirmação.
- **Rate limit** (por IP): ~40 pedidos / 15 min nas rotas de importação (ajustável no código).

### Compatibilidade

- `importarMesmoSeMatriculaFalhar: true` (corpo JSON na confirmação) equivale a **`modoImportacao: flexivel`** quando `modoImportacao` não é enviado.

### Escopo de instituição (multi-tenant)

- Utilizadores com instituição no token: o escopo vem do JWT.
- `SUPER_ADMIN` / `COMERCIAL`: enviar **`?instituicaoId=`** nas rotas que usam `requireTenantScope`.
- Limites de plano (alunos) usam o **mesmo** `instituicaoId` da operação (incl. quando o token é de SUPER_ADMIN com query).

## Modos de importação

### Seguro (`seguro`)

- Mesmas regras de matrícula que o fluxo manual (período letivo, capacidade da turma, coerência superior/secundário, ano de curso no superior, etc.).
- **Transação única** por linha: se a matrícula na turma falhar, **não** fica criado o utilizador dessa linha.
- Na pré-visualização, o backend devolve **`avisosMatriculaSeguro`** por linha (e **`resumoMatriculaSeguro`**) quando deteta condições que fariam falhar a matrícula na confirmação (sem depender do aluno — não inclui dívida nem progressão, que para utilizadores novos raramente bloqueiam).

### Flexível (`flexivel`)

- Afrouxa **apenas nesta operação**: período letivo, bloqueio por dívida, capacidade da turma e validação de progressão.
- Criação do aluno e tentativa de matrícula em **transações separadas**: se a matrícula falhar por outro motivo, o cadastro pode manter-se para regularização manual.
- Adequado a cargas em massa com correção posterior na secretaria.

## Duplicados (BI, telefone, e-mail)

- **E-mail**: duplicado no ficheiro ou já existente na instituição → linha ignorada na confirmação.
- **BI/NIF** (`numeroIdentificacao`): normalizado (maiúsculas, espaços); duplicado no ficheiro ou já existente na instituição → ignorado.
- **Telefone**: com **9+ dígitos** após normalização, duplicado no ficheiro → ignorado. (Não valida duplicidade na base por telefone — apenas no Excel.)
- Na **pré-visualização**, BI e telefone duplicados no ficheiro marcam a linha como **inválida** com mensagem explícita.

## Resposta da pré-visualização

Além de `dados`, `validos`, `erros`, `mapeamentoColunas`:

- **`modoImportacao`**: modo usado para calcular avisos.
- **`resumoMatriculaSeguro`** (só modo seguro): `foraDoPeriodoLetivo`, `linhasComAvisoMatricula`, `mensagemPeriodo` (quando aplicável).

## Resposta da confirmação

- `importados`, `matriculasEmTurma`, `matriculasFalharam`, `ignorados`, **`detalhes`** (linhas ignoradas / erro geral), **`detalhesMatricula`** (falha de matrícula em modo flexível ou outras situações), **listas completas** até ao limite do pedido.
- `modoImportacao`, `importarMesmoSeMatriculaFalhar` (espelho: `true` se flexível).
- **`orientacaoPrimeiroAcesso`**: texto fixo sobre senha inicial (aleatória), recuperação de e-mail e redefinição na secretaria.

### Primeiro acesso e senha

- Cada aluno importado recebe **palavra-passe aleatória** (hash); **não** é comunicada no Excel.
- **`mustChangePassword`** fica **`false`** na importação para não bloquear o fluxo de “esqueci a senha” / primeiro reset pelo admin.
- Com **e-mail real**: o aluno pode usar **recuperação de senha** no login.
- Com **e-mail técnico** (`@importacao.dsicola`) ou sem e-mail: a secretaria deve **redefinir senha** em gestão de alunos (o reset por admin pode voltar a exigir troca no próximo login, conforme política já existente no `resetUserPassword`).

## Auditoria

Cada confirmação com sucesso regista um evento em **`LogAuditoria`**: módulo `ALUNOS`, entidade `USER`, ação `CREATE`, com `dadosNovos.tipo = IMPORTACAO_EXCEL_ESTUDANTES`, totais agregados e `senhaInicialAleatoria: true`.

## Permissões

Roles: `ADMIN`, `SECRETARIA`, `DIRECAO`, `COORDENADOR`, `SUPER_ADMIN` (com instituição e licença válidos).

## Testes (backend)

- Unitários: `npm run test:importacao-estudantes:unit`
- Integração leve (auth + corpo): `npm run test:importacao-estudantes:integration`

## Teste E2E (Playwright, frontend + API)

Na **raiz do repositório** (inicia backend, frontend, seeds e corre um fluxo real de preview):

```bash
npm run test:e2e:import-estudantes
```

Com **servidores já a correr** (backend `http://127.0.0.1:3001`, Vite `http://127.0.0.1:8080`):

```bash
cd frontend && E2E_SKIP_WEB_SERVER=1 E2E_BASE_URL=http://127.0.0.1:8080 npm run test:e2e:import-estudantes:no-server
```

Seeds opcionais no script: `SKIP_SEED=1 bash scripts/run-e2e-import-estudantes.sh` quando a BD já tiver o admin de teste (`admin.inst.a@teste.dsicola.com`).
