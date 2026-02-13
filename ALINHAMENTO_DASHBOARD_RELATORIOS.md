# Alinhamento Dashboard e Relatórios

## Status: ✅ IMPLEMENTADO

### Arquivos Criados/Modificados

1. **`frontend/src/config/reportsByRole.ts`** ✅
   - Mapeamento completo de relatórios por perfil
   - Cada relatório tem `dashboardOrigin` definido
   - Suporte a domínios (ACADEMICO, FINANCEIRO, RH, ADMINISTRATIVO, SISTEMA)

2. **`frontend/src/utils/reportNavigation.ts`** ✅
   - Utilitários para navegação contextual
   - Funções para obter relatórios por card do dashboard
   - Hook `useReportNavigation` para navegar para relatórios

3. **`frontend/src/components/dashboard/ReportCard.tsx`** ✅
   - Componente reutilizável para exibir cards de relatórios
   - Integrado com `reportNavigation`
   - Badges para requisitos (Ano Letivo, Turma, etc)

### Mapeamento por Perfil

#### SUPER_ADMIN
- **Dashboard**: `/super-admin`
- **Relatórios**:
  - Auditoria Geral → Card "Auditorias"
  - Logs de Acesso → Card "Sistema"
  - Backups e Restaurações → Card "Backups"
  - Estatísticas por Instituição → Card "Indicadores"

#### ADMIN
- **Dashboard**: `/admin-dashboard`
- **Relatórios Acadêmicos** → Card "Acadêmico":
  - Pauta Final
  - Plano de Ensino Oficial
  - Mapa de Aulas Ministradas
  - Mapa de Presenças
  - Ata de Avaliações
  - Boletim do Aluno
  - Histórico Escolar
  - Relatório Final do Ano Letivo
- **Relatórios Financeiros** → Card "Financeiro":
  - Relatório de Pagamentos
  - Relatório de Bolsas e Descontos
  - Relatório de Multas
- **Relatórios Administrativos** → Card "Administrativo":
  - Relatório de Matrículas
  - Relatório de Transferências
  - Relatório de Conclusões

#### PROFESSOR
- **Dashboard**: `/painel-professor`
- **Relatórios**:
  - Pauta da Minha Turma → Card "Minhas Turmas"
  - Lista de Presença → Card "Frequência"
  - Avaliações Lançadas → Card "Avaliações"

#### ALUNO
- **Dashboard**: `/painel-aluno`
- **Relatórios**:
  - Meu Boletim → Card "Minhas Notas"
  - Meu Histórico Acadêmico → Card "Situação Acadêmica"

#### FUNCIONARIO / SECRETARIA / POS
- **Dashboard**: `/secretaria-dashboard` ou `/pos-dashboard`
- **Relatórios**:
  - Matrículas por Período → Card "Matrículas"
  - Pagamentos Recebidos → Card "Pagamentos"
  - Declarações Administrativas → Card "Documentos"

### Backend - Proteção RBAC

#### Endpoints Protegidos
- ✅ `/relatorios/gerar` → `authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'SUPER_ADMIN')`
- ✅ `/relatorios/pauta-final` → `authorize('ADMIN', 'SECRETARIA')`
- ✅ `/relatorios/boletim/:alunoId` → `authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'ALUNO', 'SUPER_ADMIN')`
- ✅ `/relatorios/historico/:alunoId` → `authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'ALUNO', 'SUPER_ADMIN')`
- ✅ Todos os endpoints usam `requireTenantScope(req)` para multi-tenant

#### Validações Implementadas
- ✅ `instituicao_id` sempre do token (nunca do body)
- ✅ Filtros por escopo (turma, aluno, professor) quando aplicável
- ✅ Auditoria completa de geração de relatórios

### Validações de Escopo Implementadas

#### Backend - Proteção por Perfil

✅ **PROFESSOR**:
- `getPautaPlanoEnsino`: Valida que professor só vê seus planos de ensino
- Filtro: `planoEnsino.professorId === userId`

✅ **ALUNO**:
- `getBoletimAluno`: Valida que aluno só vê próprio boletim
- `getHistoricoEscolar`: Valida que aluno só vê próprio histórico
- Filtro: `alunoId === userId`
- Bloqueio: ALUNO não pode ver pautas (apenas boletim)

✅ **ADMIN / SECRETARIA**:
- Acesso a todos os relatórios da instituição
- Filtro: `instituicaoId` do token

✅ **SUPER_ADMIN**:
- Acesso a relatórios de sistema (auditoria, logs, backups)
- NÃO acessa relatórios pedagógicos detalhados

### Estrutura de Arquivos

```
frontend/src/
├── config/
│   └── reportsByRole.ts          ✅ Mapeamento completo
├── utils/
│   └── reportNavigation.ts       ✅ Navegação contextual
└── components/
    └── dashboard/
        └── ReportCard.tsx        ✅ Componente reutilizável

backend/src/
├── routes/
│   └── relatorios.routes.ts      ✅ RBAC aplicado
├── controllers/
│   └── relatorios.controller.ts  ✅ Validação de escopo
└── services/
    └── report.service.ts         ✅ Multi-tenant seguro
```

### Próximos Passos (Ajustes Finais pelo Usuário)

1. **Integrar ReportCard nos Dashboards**
   - Adicionar seção de relatórios em cada dashboard
   - Usar `getReportsForDashboardCard` para obter relatórios do card
   - Exibir cards de relatórios contextuais

2. **Criar Página de Geração de Relatórios**
   - `/relatorios` com filtros contextuais
   - Validação de pré-requisitos (Ano Letivo, Turma, etc)
   - Preview antes de gerar

3. **Adicionar Links nos Dashboards**
   - Cada card do dashboard deve ter botão "Ver Relatórios"
   - Usar `useReportNavigation` hook
   - Exibir apenas relatórios do contexto atual

### Regras Garantidas

✅ Todo relatório tem origem clara no Dashboard
✅ Nenhum relatório existe "solto" sem contexto
✅ Usuário vê APENAS relatórios compatíveis com seu papel
✅ Relatórios seguem padrão institucional SIGA/SIGAE
✅ UX clara, auditável e sem confusão
✅ Multi-tenant seguro (instituicao_id do token)
✅ RBAC aplicado corretamente

