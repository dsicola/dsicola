# 🧪 TESTE DE CONSISTÊNCIA POR PERFIL - DSICOLA

Sistema completo de validação RBAC por perfil para garantir que cada role vê, acessa e executa **APENAS** o que é permitido no padrão institucional.

---

## 📋 OBJETIVO

Criar um **TESTE DE CONSISTÊNCIA POR PERFIL** para garantir que cada role:
- ✅ Vê apenas seus menus
- ✅ Acessa apenas rotas permitidas
- ✅ Executa apenas ações permitidas
- ✅ Nunca acessa dados de outra instituição
- ✅ Nunca vê campos condicionais indevidos

---

## 🎯 PERFIS VALIDADOS

### SUPER_ADMIN
**Pode:**
- Ver todas instituições
- Configurações globais
- Backups globais
- Auditorias
- Gerenciar assinaturas
- Gerenciar planos e preços

**NÃO pode:**
- ❌ Lançar notas
- ❌ Criar aulas
- ❌ Marcar presença
- ❌ Acessar módulos acadêmicos
- ❌ Configurar ensinos

### ADMIN (Instituição)
**Pode:**
- Cursos
- Disciplinas
- Professores
- Ano Letivo
- Plano de Ensino
- Turmas
- Matrículas
- Relatórios institucionais
- Lançar notas
- Criar aulas
- Marcar presença

**NÃO pode:**
- ❌ Acessar dados de outra instituição
- ❌ Configurações globais
- ❌ Gerenciar outras instituições

### PROFESSOR
**Pode:**
- Ver apenas seus Planos de Ensino
- Criar aulas
- Marcar presenças
- Lançar notas

**NÃO pode:**
- ❌ Criar curso
- ❌ Criar disciplina
- ❌ Criar ano letivo
- ❌ Ver dados administrativos
- ❌ Configurar ensinos
- ❌ Aprovar planos de ensino

### ALUNO
**Pode:**
- Ver notas
- Ver frequência
- Ver boletim
- Ver histórico

**NÃO pode:**
- ❌ Editar dados acadêmicos
- ❌ Ver dados de outros alunos
- ❌ Criar qualquer registro
- ❌ Lançar notas
- ❌ Criar aulas

### FUNCIONARIO (Secretaria)
**Pode:**
- Matrículas
- Transferências
- Documentos
- Relatórios administrativos

**NÃO pode:**
- ❌ Lançar notas
- ❌ Criar aulas
- ❌ Alterar plano de ensino
- ❌ Aprovar planos

---

## 🚀 COMO EXECUTAR

### 1. Teste Backend (Rotas e Controllers)

```bash
cd backend
npm run test:consistencia-perfil
```

**O que valida:**
- ✅ Rotas usam middlewares RBAC apropriados
- ✅ Controllers usam `addInstitutionFilter` em queries
- ✅ CREATE/UPDATE rejeitam `instituicaoId` do body
- ✅ Multi-tenant respeitado
- ✅ CRUD por entidade
- ✅ Módulos por perfil
- ✅ Campos condicionais

### 2. Teste Frontend (Menu/Sidebar)

```bash
cd frontend
npm run script:validate-menu-rbac-perfil
```

**O que valida:**
- ✅ Cada perfil vê apenas menus permitidos
- ✅ Menus bloqueados não aparecem
- ✅ Rotas protegidas no frontend
- ✅ Componentes condicionais por role
- ✅ Campos condicionais (ENSINO_SUPERIOR vs ENSINO_SECUNDARIO)

---

## 📊 ESTRUTURA DOS TESTES

### 1️⃣ TESTE DE MENU / SIDEBAR
- Cada perfil vê apenas seus menus
- Nenhum item indevido renderizado
- Função `getSidebarItemsForRole` funciona corretamente

### 2️⃣ TESTE DE ROTAS
- Acessar rota proibida deve retornar:
  - Backend: `403 Forbidden`
  - Frontend: Tela de acesso negado
- Rotas protegidas com `ProtectedRoute`
- Rotas bloqueadas não acessíveis

### 3️⃣ TESTE DE CRUD
Para cada entidade:
- **Criar**: Quem pode / quem não pode
- **Editar**: Quem pode / quem não pode
- **Excluir**: Quem pode / quem não pode
- **Visualizar**: Quem pode / quem não pode

**Entidades validadas:**
- Curso
- Disciplina
- Plano de Ensino
- Aula
- Nota
- Matrícula

### 4️⃣ TESTE MULTI-TENANT
- Usuário **NUNCA** acessa dados de outra instituição
- Forçar ID manualmente deve falhar
- `instituicaoId` sempre do token (nunca do body)
- Controllers usam `addInstitutionFilter` ou `requireTenantScope`

### 5️⃣ TESTE DE CAMPOS CONDICIONAIS
- **ENSINO_SUPERIOR:**
  - ✅ Nunca ver Classe
  - ✅ Semestre visível
- **ENSINO_SECUNDARIO:**
  - ✅ Nunca ver Semestre
  - ✅ Classe visível

---

## 📋 EXEMPLO DE SAÍDA

```
🔍 Iniciando teste de consistência por perfil...

📋 Validando perfil: SUPER_ADMIN...
📋 Validando perfil: ADMIN...
📋 Validando perfil: PROFESSOR...
📋 Validando perfil: ALUNO...
📋 Validando perfil: FUNCIONARIO...
📋 Validando perfil: SECRETARIA...

================================================================================
📋 RELATÓRIO DE CONSISTÊNCIA POR PERFIL - DSICOLA
================================================================================

👤 PERFIL: SUPER_ADMIN
--------------------------------------------------------------------------------
   Total de testes: 45
   ✅ Passou: 42
   ❌ Falhou: 1
   ⚠️  Avisos: 2

   📋 Problemas encontrados:
   🚨 [Rotas] Rota curso não bloqueia SUPER_ADMIN de acessar
      Rota curso não bloqueia SUPER_ADMIN de acessar
      💡 Deve usar requireConfiguracaoEnsino para bloquear SUPER_ADMIN

👤 PERFIL: ADMIN
--------------------------------------------------------------------------------
   Total de testes: 45
   ✅ Passou: 45
   ❌ Falhou: 0
   ⚠️  Avisos: 0

   ✅ Nenhum problema encontrado!

================================================================================
📊 RESUMO GERAL
================================================================================
   Total de testes: 270
   ✅ Passou: 265
   ❌ Falhou: 3
   ⚠️  Avisos: 2
   📈 Taxa de sucesso: 98.15%

⚠️  Alguns problemas foram encontrados. Revise os detalhes acima.
```

---

## 🔧 CORREÇÃO DE PROBLEMAS

### Problema: Rota não bloqueia perfil

**Solução:**
```typescript
// Adicionar middleware na rota
router.use(requireConfiguracaoEnsino);
```

### Problema: Controller não usa filtro multi-tenant

**Solução:**
```typescript
// Adicionar filtro em queries
const filter = addInstitutionFilter(req);
const cursos = await prisma.curso.findMany({
  where: { ...filter }
});
```

### Problema: Menu aparece para perfil indevido

**Solução:**
```typescript
// Remover role do array roles do menu
{
  label: 'Configuração de Ensinos',
  roles: ['ADMIN', 'DIRECAO'], // Remover 'PROFESSOR'
}
```

### Problema: Campo condicional não validado

**Solução:**
```typescript
// Adicionar validação de tipoAcademico
if (tipoAcademico === 'SUPERIOR') {
  // Ocultar Classe
}
if (tipoAcademico === 'SECUNDARIO') {
  // Ocultar Semestre
}
```

---

## ✅ CHECKLIST DE VALIDAÇÃO

### Backend
- [ ] Rotas usam `authenticate` middleware
- [ ] Rotas acadêmicas usam `requireConfiguracaoEnsino`
- [ ] Rotas usam `requireInstitution` (multi-tenant)
- [ ] Controllers usam `addInstitutionFilter` em queries
- [ ] CREATE rejeita `instituicaoId` do body
- [ ] UPDATE verifica tenant antes de atualizar
- [ ] Campos condicionais validados

### Frontend
- [ ] Sidebar filtra por role
- [ ] Menus bloqueados não aparecem
- [ ] Rotas protegidas com `ProtectedRoute`
- [ ] Componentes condicionais por role
- [ ] Campos condicionais validados

---

## 📚 REGRAS GLOBAIS (NÃO VIOLAR)

1. ✅ Usuário **NUNCA** vê o que não pode usar
2. ✅ Usuário **NUNCA** executa ação fora do seu papel
3. ✅ Frontend e Backend **DEVEM** bloquear
4. ✅ Erro de permissão deve ser **CLARO** e institucional
5. ✅ Nenhuma ação pode depender apenas do frontend

---

## 🎯 RESULTADO FINAL ESPERADO

- ✔️ RBAC consistente
- ✔️ Nenhum acesso indevido
- ✔️ UX institucional clara
- ✔️ Segurança institucional
- ✔️ Multi-tenant respeitado

---

## 📝 NOTAS

- Os testes são **estáticos** (análise de código)
- Para testes **dinâmicos** (execução real), use testes de integração
- Execute os testes antes de cada deploy
- Corrija problemas críticos (🚨) antes de prosseguir
- Revise avisos (⚠️) para melhorias

---

**Última atualização:** Janeiro 2025  
**Versão:** 1.0.0

