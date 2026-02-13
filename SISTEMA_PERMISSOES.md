# Sistema Avançado de Permissões (RBAC + Contexto + Workflow)

Sistema completo de controle de acesso baseado em:
1. **RBAC** (Role-Based Access Control)
2. **Permissões Contextuais** (curso, disciplina, turma)
3. **Permissões Baseadas em Estado** (workflow)

## Estrutura

### Tabelas Criadas

- `permissions`: Permissões do sistema
- `role_permissions`: Associação de roles com permissões
- `user_contexts`: Contexto académico dos usuários (professor-disciplina-turma)

### Perfis Padrão

- `SUPER_ADMIN`: Acesso total à plataforma
- `ADMIN`: Acesso total à instituição
- `DIREÇÃO`: Acesso administrativo amplo
- `COORDENADOR`: Coordenação de cursos específicos
- `PROFESSOR`: Acesso às suas disciplinas/turmas
- `SECRETARIA`: Acesso administrativo
- `AUDITOR`: Apenas leitura
- `ALUNO`: Acesso restrito ao próprio perfil

## Uso no Backend

### Exemplo 1: Permissão Simples

```typescript
import { checkPermission } from '../middlewares/permission.middleware';

router.post(
  '/plano-ensino',
  authenticate,
  checkPermission('PLANO_ENSINO', 'CREATE', 'plano_ensino'),
  controller.create
);
```

### Exemplo 2: Permissão com Contexto

```typescript
import { checkPermissionWithContext } from '../middlewares/permission.middleware';

router.post(
  '/plano-ensino/:id/aulas',
  authenticate,
  checkPermissionWithContext(
    'PLANO_ENSINO',
    'CREATE',
    'plano_aula',
    (req) => ({
      disciplinaId: req.body.disciplinaId,
      cursoId: req.body.cursoId,
    })
  ),
  controller.createAula
);
```

### Exemplo 3: Permissão com Workflow

```typescript
import { checkPermissionWithWorkflow } from '../middlewares/permission.middleware';

router.post(
  '/plano-ensino/:id/submit',
  authenticate,
  checkPermissionWithWorkflow(
    'PLANO_ENSINO',
    'SUBMIT',
    'plano_ensino',
    async (req) => {
      const plano = await getPlano(req.params.id);
      return {
        disciplinaId: plano.disciplinaId,
        cursoId: plano.cursoId,
      };
    },
    async (req) => {
      const plano = await getPlano(req.params.id);
      return {
        status: plano.status,
        bloqueado: plano.bloqueado,
      };
    }
  ),
  controller.submit
);
```

### Exemplo 4: Uso Direto no Controller

```typescript
import { PermissionService } from '../services/permission.service';

export const updatePlano = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Verificar permissão
    await PermissionService.requirePermission(
      req,
      'PLANO_ENSINO',
      'UPDATE',
      'plano_ensino',
      {
        disciplinaId: req.body.disciplinaId,
        cursoId: req.body.cursoId,
      },
      {
        status: 'RASCUNHO',
        bloqueado: false,
      }
    );

    // Continuar com a lógica...
  } catch (error) {
    next(error);
  }
};
```

## Uso no Frontend

### Hook usePermissions

```typescript
import { usePermissions } from '@/hooks/usePermissions';

function PlanoEnsinoComponent() {
  const { can, hasPermission } = usePermissions();
  const plano = usePlano(); // Dados do plano

  return (
    <div>
      {can.criarPlano() && (
        <Button onClick={criarPlano}>Novo Plano</Button>
      )}

      {can.editarPlano(
        { disciplinaId: plano.disciplinaId },
        { status: plano.status }
      ) && (
        <Button onClick={editarPlano}>Editar</Button>
      )}

      {can.submeterPlano(
        { disciplinaId: plano.disciplinaId },
        { status: plano.status }
      ) && (
        <Button onClick={submeterPlano}>Submeter</Button>
      )}

      {can.aprovarPlano(
        { disciplinaId: plano.disciplinaId },
        { status: plano.status }
      ) && (
        <Button onClick={aprovarPlano}>Aprovar</Button>
      )}
    </div>
  );
}
```

### Verificação Direta

```typescript
const { hasPermission } = usePermissions();

const podeEditar = hasPermission(
  'PLANO_ENSINO',
  'UPDATE',
  { disciplinaId: 'xxx' },
  { status: 'RASCUNHO' }
);
```

## Regras de Workflow

### Plano de Ensino

- **RASCUNHO**: Professor pode CREATE, UPDATE, DELETE, SUBMIT
- **SUBMETIDO**: Apenas leitura para professor. COORDENADOR/DIREÇÃO pode APPROVE/REJECT
- **APROVADO**: Bloqueado. Apenas ADMIN/DIREÇÃO pode REOPEN
- **REJEITADO**: Professor pode voltar para RASCUNHO (UPDATE)

### Lançamento de Aulas

- **PLANEJADA**: Professor pode CREATE (lançar)
- **MINISTRADA**: Bloqueado. Apenas ADMIN/DIREÇÃO pode REOPEN

### Presenças

- **Aberta**: Professor pode CREATE, UPDATE
- **Fechada**: Apenas ADMIN/DIREÇÃO pode REOPEN

### Avaliações/Notas

- **Aberta**: Professor pode CREATE, UPDATE, CLOSE
- **Fechada**: Bloqueado. Apenas ADMIN/DIREÇÃO pode REOPEN

## Permissões Contextuais

### Professor

- Só pode atuar em disciplinas/turmas atribuídas
- Contexto verificado via tabela `user_contexts`

### Coordenador

- Só pode atuar em cursos sob coordenação
- Contexto verificado via tabela `user_contexts`

### ADMIN/DIREÇÃO

- Acesso total (sem restrições contextuais)

## Auditoria

Todas as ações são registradas automaticamente:

- **Ações permitidas**: Log normal com ação executada
- **Ações bloqueadas**: Log com `acao='BLOCK'` e motivo

Ver logs em: `/admin/auditoria`

## Segurança

⚠️ **IMPORTANTE**: 

1. **NUNCA confiar apenas no frontend**
2. **Todas as validações ocorrem no backend**
3. **Frontend apenas oculta ações não permitidas (UX)**
4. **Backend SEMPRE valida antes de executar**

## Próximos Passos

1. Criar migration do Prisma
2. Seed de permissões padrão
3. Interface de gestão de permissões
4. Interface de gestão de contextos (atribuir professor-disciplina)

