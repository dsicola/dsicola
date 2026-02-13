# 🧪 GUIA DE USO - VALIDAÇÃO RBAC DSICOLA

Este guia explica como usar os scripts de validação de consistência RBAC implementados no sistema DSICOLA.

---

## 📋 VISÃO GERAL

O sistema DSICOLA possui **2 scripts de validação** para garantir que o RBAC (Role-Based Access Control) está implementado corretamente:

1. **Backend**: Validação de rotas e controllers
2. **Frontend**: Validação de menu/sidebar por perfil

---

## 🚀 COMO EXECUTAR

### 1. Validação Backend (Rotas e Controllers)

**Comando:**
```bash
cd backend
npm run script:validate-rbac
```

**O que valida:**
- ✅ Rotas usam `authenticate` middleware
- ✅ Rotas acadêmicas usam `requireConfiguracaoEnsino`
- ✅ Rotas usam `requireInstitution` (multi-tenant)
- ✅ Controllers usam `addInstitutionFilter` em queries
- ✅ CREATE/UPDATE rejeitam `instituicaoId` do body
- ✅ UPDATE verifica tenant antes de atualizar

**Saída esperada:**
```
🔍 Iniciando validação de consistência RBAC...

📁 Validando rotas...
📁 Validando controllers...

============================================================
📋 RELATÓRIO DE VALIDAÇÃO RBAC - DSICOLA
============================================================

📊 Resumo:
   ✅ Arquivos válidos: 45
   ❌ Arquivos com problemas: 2
   🚨 Erros: 3
   ⚠️  Avisos: 5
   📝 Total de issues: 8

------------------------------------------------------------
📋 DETALHES DOS PROBLEMAS
------------------------------------------------------------

📁 curso.routes.ts (route)
   Status: ✅ OK

📁 disciplina.controller.ts (controller)
   Status: ❌ FALHOU
   🚨 Controller disciplina usa queries mas não aplica addInstitutionFilter
      💡 Sugestão: Adicionar: const filter = addInstitutionFilter(req); e usar em queries
```

---

### 2. Validação Frontend (Menu/Sidebar)

**Comando:**
```bash
cd frontend
npm run script:validate-menu-rbac
```

**O que valida:**
- ✅ Cada perfil vê apenas menus permitidos
- ✅ Menus não permitidos não aparecem
- ✅ Roles estão corretamente definidos no `sidebar.config.ts`

**Saída esperada:**
```
🔍 Iniciando validação de menu/sidebar RBAC...

📁 Lendo sidebar.config.ts...
📋 Extraindo menus da configuração...

============================================================
📋 RELATÓRIO DE VALIDAÇÃO DE MENU/SIDEBAR RBAC - DSICOLA FRONTEND
============================================================

📊 Resumo:
   ✅ Perfis válidos: 4
   ❌ Perfis com problemas: 1
   📝 Total de issues: 2

------------------------------------------------------------
📋 DETALHES POR PERFIL
------------------------------------------------------------

👤 SUPER_ADMIN
   Status: ✅ OK
   ✅ Menus permitidos encontrados: Dashboard, Instituições, Assinaturas

👤 PROFESSOR
   Status: ❌ FALHOU
   ❌ Menus proibidos encontrados: Gestão Acadêmica
   📝 Issues:
      ❌ Menu "Gestão Acadêmica" NÃO deve aparecer para PROFESSOR
```

---

## 🔧 CORRIGINDO PROBLEMAS

### Problema: Rota não usa `requireConfiguracaoEnsino`

**Sintoma:**
```
🚨 Rota curso deve usar requireConfiguracaoEnsino para bloquear PROFESSOR/ALUNO/SUPER_ADMIN
```

**Solução:**
```typescript
// backend/src/routes/curso.routes.ts
import { requireConfiguracaoEnsino } from '../middlewares/rbac.middleware.js';

router.use(authenticate);
router.use(validateLicense);
router.use(requireConfiguracaoEnsino); // ← ADICIONAR
router.use(requireInstitution);
```

---

### Problema: Controller não usa `addInstitutionFilter`

**Sintoma:**
```
🚨 Controller disciplina usa queries mas não aplica addInstitutionFilter (risco multi-tenant)
```

**Solução:**
```typescript
// backend/src/controllers/disciplina.controller.ts
import { addInstitutionFilter } from '../middlewares/auth.js';

export const getDisciplinas = async (req: Request, res: Response) => {
  const filter = addInstitutionFilter(req); // ← ADICIONAR
  
  const disciplinas = await prisma.disciplina.findMany({
    where: filter, // ← USAR FILTRO
  });
  
  res.json(disciplinas);
};
```

---

### Problema: CREATE aceita `instituicaoId` do body

**Sintoma:**
```
🚨 CREATE em curso pode aceitar instituicaoId do body (risco multi-tenant)
```

**Solução:**
```typescript
export const createCurso = async (req: Request, res: Response) => {
  // Rejeitar instituicaoId do body
  if (req.body.instituicaoId !== undefined) {
    throw new AppError('Não é permitido alterar a instituição', 400);
  }
  
  const curso = await prisma.curso.create({
    data: {
      nome: req.body.nome,
      instituicaoId: req.user.instituicaoId, // ← USAR DO TOKEN
    },
  });
  
  res.json(curso);
};
```

---

### Problema: Menu aparece para perfil incorreto

**Sintoma:**
```
❌ Menu "Gestão Acadêmica" NÃO deve aparecer para PROFESSOR
```

**Solução:**
```typescript
// frontend/src/components/layout/sidebar.config.ts
{
  label: 'Gestão Acadêmica',
  icon: GraduationCap,
  path: '/admin-dashboard/gestao-academica',
  roles: ['ADMIN', 'SECRETARIA'], // ← REMOVER 'PROFESSOR'
}
```

---

## ✅ CHECKLIST PRÉ-DEPLOY

Antes de fazer deploy, execute:

- [ ] `npm run script:validate-rbac` (backend) → ✅ Sem erros
- [ ] `npm run script:validate-menu-rbac` (frontend) → ✅ Sem erros
- [ ] Testar login com cada perfil manualmente
- [ ] Verificar que menus corretos aparecem para cada perfil
- [ ] Testar acesso a rotas proibidas (deve retornar 403)
- [ ] Verificar que dados de outra instituição não aparecem

---

## 🐛 PROBLEMAS COMUNS

### Erro: "Cannot find module 'tsx'"

**Solução:**
```bash
cd backend  # ou frontend
npm install --save-dev tsx
```

---

### Erro: "File not found"

**Solução:**
Verifique se os arquivos existem:
- `backend/scripts/validate-rbac-consistency.ts`
- `frontend/scripts/validate-menu-rbac.ts`

---

### Validação não encontra problemas mas sistema ainda tem bugs

**Nota:** Os scripts fazem validação **estática** do código. Eles não executam o código de fato. Para validação completa:

1. Execute os scripts (validação estática)
2. Execute testes manuais (validação dinâmica)
3. Use o checklist do documento `TESTE_CONSISTENCIA_RBAC.md`

---

## 📚 DOCUMENTAÇÃO RELACIONADA

- **Checklist completo**: `TESTE_CONSISTENCIA_RBAC.md`
- **RBAC Middleware**: `backend/src/middlewares/rbac.middleware.ts`
- **Auth Middleware**: `backend/src/middlewares/auth.ts`
- **Sidebar Config**: `frontend/src/components/layout/sidebar.config.ts`

---

## 🔄 INTEGRAÇÃO COM CI/CD (FUTURO)

Para integrar com pipeline CI/CD:

```yaml
# .github/workflows/validate-rbac.yml
name: Validate RBAC

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: cd backend && npm install
      - run: cd backend && npm run script:validate-rbac
      - run: cd frontend && npm install
      - run: cd frontend && npm run script:validate-menu-rbac
```

---

**Última atualização**: 2025-01-27  
**Versão**: 1.0.0

