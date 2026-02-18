# Padrão Multi-Tenant para Novos Endpoints

Guia rápido para implementar novos endpoints respeitando o isolamento multi-tenant.

## Checklist ao criar um novo endpoint

1. [ ] Usar `authenticate` em todas as rotas protegidas
2. [ ] Usar `authorize(...roles)` conforme perfil necessário
3. [ ] Usar `addInstitutionFilter(req)` em consultas (findMany, findFirst)
4. [ ] Usar `requireTenantScope(req)` em criações e quando precisar do `instituicaoId`
5. [ ] **Nunca** aceitar `instituicaoId` de `req.body`, `req.query` ou `req.params` para usuários não-SUPER_ADMIN

## Exemplos

### GET (listar)

```typescript
router.get('/', authenticate, authorize('ADMIN', 'SECRETARIA'), async (req, res) => {
  const filter = addInstitutionFilter(req);
  const itens = await prisma.entidade.findMany({
    where: { ...filter, ...outrosFiltros }
  });
  return res.json(itens);
});
```

### GET por ID (detalhe)

```typescript
router.get('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  const filter = addInstitutionFilter(req);
  const item = await prisma.entidade.findFirst({
    where: { id: req.params.id, ...filter }
  });
  if (!item) {
    throw new AppError('Registro não encontrado ou acesso negado', 404);
  }
  return res.json(item);
});
```

### POST (criar)

```typescript
router.post('/', authenticate, authorize('ADMIN'), async (req, res) => {
  const instituicaoId = requireTenantScope(req);
  const item = await prisma.entidade.create({
    data: {
      instituicaoId,  // sempre do contexto, nunca do body
      ...req.body
    }
  });
  return res.status(201).json(item);
});
```

### PUT/PATCH (atualizar)

```typescript
router.put('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  const filter = addInstitutionFilter(req);
  const existente = await prisma.entidade.findFirst({
    where: { id: req.params.id, ...filter }
  });
  if (!existente) {
    throw new AppError('Registro não encontrado ou acesso negado', 404);
  }
  const item = await prisma.entidade.update({
    where: { id: req.params.id },
    data: req.body
  });
  return res.json(item);
});
```

### DELETE

```typescript
router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  const filter = addInstitutionFilter(req);
  const existente = await prisma.entidade.findFirst({
    where: { id: req.params.id, ...filter }
  });
  if (!existente) {
    throw new AppError('Registro não encontrado ou acesso negado', 404);
  }
  await prisma.entidade.delete({ where: { id: req.params.id } });
  return res.status(204).send();
});
```

## Regras de ouro

| Situação | O que usar | Nunca fazer |
|----------|------------|-------------|
| Listar dados | `addInstitutionFilter(req)` | Filtrar sem instituicaoId |
| Criar registro | `requireTenantScope(req)` | Usar `req.body.instituicaoId` |
| Buscar por ID | `addInstitutionFilter(req)` no where | Buscar só por `id` |
| Atualizar/Deletar | Validar com `addInstitutionFilter` antes | Atualizar sem validar tenant |

## SUPER_ADMIN

- Pode passar `?instituicaoId=xxx` na query para filtrar por instituição
- `getInstituicaoIdFromAuth(req)` e `addInstitutionFilter(req)` já tratam isso
- Sem `instituicaoId` na query, SUPER_ADMIN vê dados da instituição do token (ou tudo, conforme implementação)

## Mensagens de erro padronizadas

- **401**: "Não autenticado. Faça login para continuar." (`reason: UNAUTHORIZED`)
- **403**: "Acesso negado: permissão insuficiente para esta ação." (`reason: INSUFFICIENT_PERMISSIONS`)
- **403**: "Acesso negado: usuário sem instituição associada." (`reason: NO_INSTITUTION`)
- **403**: "Operação requer escopo de instituição." (`reason: TENANT_SCOPE_REQUIRED`)
- **404**: "Registro não encontrado ou acesso negado" (quando o recurso não existe ou pertence a outra instituição)

## Documentação relacionada

- [MULTI_TENANT_SUPER_ADMIN.md](./MULTI_TENANT_SUPER_ADMIN.md) – Detalhes sobre SUPER_ADMIN e validações
- [SECURITY_MONITORING.md](./SECURITY_MONITORING.md) – Monitoramento de tentativas bloqueadas
