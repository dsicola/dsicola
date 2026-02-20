# Plano de Teste Completo do Sistema DSICOLA

## Objetivo

Realizar um teste completo e sistemático de todos os fluxos do sistema, garantindo que todos os módulos funcionem 100%, seguindo as regras de multi-tenancy, suportando dois tipos de instituição (ensino secundário e superior), e que o sistema esteja pronto para produção, sem erros e confiável.

---

## 1. Estrutura de Teste

### 1.1 Tipos de Instituição

| Tipo | Descrição | Testes Específicos |
|------|-----------|-------------------|
| **Ensino Superior** | Universidades, institutos superiores | turma.ano (1º-7º Ano), semestre, turno, IVA em recibos, série |
| **Ensino Secundário** | Colégios, liceus | classe (10ª, 11ª, 12ª), trimestre, pauta por classe |

### 1.2 Perfis e Roles

| Role | Acesso | Teste |
|------|--------|-------|
| **ADMIN** | Gestão completa da instituição | `test:admin-fluxo-completo` |
| **PROFESSOR** | Pautas, turmas, avaliações, planos de ensino | `test:professor-fluxo-completo` |
| **ALUNO** | Notas, disciplinas, mensalidades, documentos | `test:estudante-fluxo-completo` |
| **SECRETARIA** | Matrículas, documentos, operações administrativas | `test:secretaria-fluxo-completo` |
| **POS / FINANCEIRO** | Registro de pagamentos, recibos | `test:pos-fluxo-completo`, `test:rh-financeiro` |
| **COMERCIAL** | Onboarding, assinaturas (multi-tenant comercial) | `test:fluxo-comercial` |

### 1.3 Módulos a Testar

| Módulo | Comando | Descrição |
|--------|---------|-----------|
| Plano de ensino | `test:plano-ensino-fluxo-secundario`, `test:plano-ensino-professor-secundario-superior` | Cursos, disciplinas, distribuição |
| Cursos e disciplinas | `test:fluxo-planos-secundario-superior`, `test:matricula-turma-disciplina` | CRUD, associações |
| Turmas e classes | `test:turma-matricula-multitenant`, `test:diferenciacao-sec-sup` | Secundário: Classe; Superior: Ano |
| Gestão de usuários | `test:admin-fluxo-completo`, `test:rh-financeiro` | Criar, editar, roles |
| Roles e permissões | `test:multi-tenant`, `test:criterio-seguranca` | Isolamento, RBAC |
| Recibos mensalidade | `test:recibo-completo` | Secundário + Superior, todos os campos |
| Impressão pautas | `test:professor-fluxo-completo`, `test:lancamento-notas` | Pauta provisória/definitiva |
| Listas de admitidos | Via API `relatorios/imprimirListaAdmitidos` | PDF por turma/ano |
| Relatórios financeiros | `test:financas-propina`, `test:relatorios-completo` | Propinas, recibos, SAFT |
| Certificados/Histórico | `test:emitir-documento` | DECLARACAO, HISTORICO, CERTIFICADO |
| Multi-tenancy | `test:multi-tenant`, `test:multi-tenant:full` | Isolamento entre instituições |
| SAFT | `test:saft` | Exportação fiscal |
| Backup | `test:backup-fluxo-completo` | Backup e restauração |

---

## 2. Fluxos de Teste Detalhados

### 2.1 Gestão Acadêmica

| Cenário | Comando | Critérios |
|---------|---------|-----------|
| Criar cursos e disciplinas | `test:fluxo-planos-secundario-superior` | Curso com valorMensalidade, disciplinas no plano |
| Associar disciplinas a planos de ensino | `test:plano-ensino-fluxo-secundario` | PlanoEnsino → Disciplina, carga horária |
| Criar turmas e vincular alunos | `test:turma-matricula-multitenant` | Turma com turno, semestre (Sup), classe (Sec) |
| Distribuição de horários | `test:horarios`, `test:horarios:full` | Aulas por turma, sem conflitos |
| Matrícula e distribuição por classe/ano | `test:matricula-turma-disciplina` | Matrícula anual + matrícula em turma |
| Multi-tenancy | `test:multi-tenant` | Inst A ≠ Inst B nos dados |

### 2.2 Usuários e Permissões

| Cenário | Comando | Critérios |
|---------|---------|-----------|
| Criar usuários (ADMIN, PROFESSOR, ALUNO) | `test:admin-fluxo-completo` | User + UserRole_ |
| Login e autenticação | `test:perfil-estudante`, `test:perfil-professor` | JWT, instituicaoId no token |
| Acesso por role | `test:suite-completa` | ADMIN vê tudo; PROFESSOR só suas turmas; ALUNO só seus dados |
| Criação/edição/remoção de usuários | `test:admin-fluxo-completo` | CRUD com filtro instituição |
| Isolamento por instituição | `test:multi-tenant` | Cada instituição só vê seus usuários |

### 2.3 Impressões e Relatórios

| Cenário | Comando | Critérios |
|---------|---------|-----------|
| Certificados de conclusão | `test:emitir-documento CERTIFICADO` | PDF correto, dados da instituição |
| Declarações | `test:emitir-documento DECLARACAO_MATRICULA` | Matrícula, frequência |
| Histórico escolar | `test:emitir-documento HISTORICO` | Notas, equivalências |
| Pautas de turmas | `test:professor-fluxo-completo` | Pauta provisória/definitiva |
| Lista de admitidos | Via frontend ou API | PDF por turma/ano letivo |
| Relatórios financeiros | `test:financas-propina`, `test:relatorios-completo` | Propinas, pagamentos, extratos |
| Recibos mensalidade | `test:recibo-completo` | Campos completos Sec + Sup |
| Exportação SAFT | `test:saft` | XML válido, multi-tenant |

### 2.4 Funcionalidades Extras

| Cenário | Verificação | Critérios |
|---------|-------------|-----------|
| Upload de documentos | Configurações / Perfil | Avatar, logo instituição |
| Logo e informações institucionais | Configurações instituição | nome, endereço, tel, email |
| Notificações | `test:email-fluxo` | Envio de e-mails |
| Backup e restauração | `test:backup-fluxo-completo` | Export/import dados |

### 2.5 Testes de Integração

| Cenário | Comando | Critérios |
|---------|---------|-----------|
| Comunicação entre módulos | `test:ensino-secundario-fluxo-completo` | Matrícula → Mensalidade → Recibo |
| Plano diferente por turma | `test:plano-ensino-professor-secundario-superior` | Professor em várias turmas |
| Multi-tenancy simultâneo | `test:multi-tenant:full` | Seed + testes em paralelo conceitual |
| Bloqueio financeiro | `test:limites-bloqueio` | Bloquear matrícula/documentos por dívida |

---

## 3. Execução do Plano

### 3.1 Pré-requisitos

1. **Backend rodando**: `npm run dev` (porta 3001)
2. **Base de dados**: migrations aplicadas
3. **Seed (opcional para alguns testes)**: `npm run seed:multi-tenant`

### 3.2 Comando de Suite Completa para Produção

```bash
cd backend
npm run test:suite-producao
```

Executa a sequência de testes principais para validação de produção (multi-tenancy, perfis, académico, financeiro, segurança).

### 3.3 Execução Manual por Categoria

```bash
# 1. Multi-tenancy e segurança
npm run seed:multi-tenant
npm run test:multi-tenant

# 2. Perfis e roles
npm run test:admin-fluxo-completo
npm run test:secretaria-fluxo-completo
npm run test:professor-fluxo-completo
npm run test:estudante-fluxo-completo
npm run test:pos-fluxo-completo

# 3. Acadêmico (Secundário + Superior)
npm run test:fluxo-planos-secundario-superior
npm run test:plano-ensino-fluxo-secundario
npm run test:recibo-completo
npm run test:financas-propina

# 4. Relatórios e documentos
npm run test:relatorios-completo
npm run test:saft
npx tsx scripts/test-emitir-documento.ts CERTIFICADO

# 5. Suite de todos os perfis
npm run test:suite-completa
```

### 3.4 Checklist de Aceitação

- [ ] Todos os fluxos de teste passam sem erro
- [ ] Cada perfil acessa apenas o permitido
- [ ] Impressões e relatórios geram dados corretos da instituição
- [ ] Multi-tenancy garante isolamento total
- [ ] Recibos carregam todos os campos (Secundário e Superior)
- [ ] SAFT exporta corretamente
- [ ] Certificados/Histórico/DECLARACAO geram PDF válido
- [ ] Sistema estável e confiável para produção

---

## 4. Mapeamento de Testes Existentes

| Comando npm | Módulo | Tipo Inst. |
|-------------|--------|------------|
| `test:admin-fluxo-completo` | Gestão, usuários | Ambos |
| `test:secretaria-fluxo-completo` | Matrículas, documentos | Ambos |
| `test:professor-fluxo-completo` | Pautas, avaliações | Ambos |
| `test:estudante-fluxo-completo` | Notas, disciplinas | Ambos |
| `test:pos-fluxo-completo` | Pagamentos, recibos | Ambos |
| `test:rh-financeiro` | RH, folha, financeiro | Ambos |
| `test:recibo-completo` | Recibo mensalidade | Sec + Sup |
| `test:multi-tenant` | Isolamento | Ambos |
| `test:fluxo-planos-secundario-superior` | Cursos, planos | Sec + Sup |
| `test:plano-ensino-fluxo-secundario` | Plano de ensino | Secundário |
| `test:financas-propina` | Propinas, pagamentos | Sec + Sup |
| `test:relatorios-completo` | Relatórios diversos | Sec + Sup |
| `test:saft` | Exportação SAFT | Multi-tenant |
| `test:backup-fluxo-completo` | Backup/Restore | Geral |
| `test:emitir-documento` | Certificado, Histórico, Declaração | Geral |
| `test:suite-completa` | Todos os perfis | Ambos |
| `test:diferenciacao-sec-sup` | Regras Sec vs Sup | Sec + Sup |
| `test:criterio-seguranca` | RBAC, bloqueios | Geral |
| `test:horarios` | Distribuição de horários | Ambos |

---

## 5. Gaps e Recomendações

### Testes a desenvolver (se não existirem)

1. **Lista de admitidos**: Teste automatizado da geração do PDF
2. **Upload de logo/documentos**: Teste E2E de upload
3. **Notificações**: Cobertura do fluxo completo de e-mail
4. **Testes E2E frontend**: Playwright/Cypress para fluxos críticos

### Boas práticas

- Executar `test:suite-producao` antes de cada release
- Manter seed multi-tenant atualizado
- Documentar novos fluxos no plano
- Revisar critérios de aceitação periodicamente
