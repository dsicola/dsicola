# 📚 MANUAL DO SISTEMA DSICOLA
## Sistema de Gestão Acadêmica Multi-Tenant

**Versão:** 1.4  
**Data:** Março 2025  
**Última Atualização:** 2025-03-03

**Changelog v1.4:**
- ✅ Controle de versão do Plano de Ensino (padrão SIGAE): criar nova versão após aprovação
- ✅ COORDENADOR pode criar nova versão de plano (junto com ADMIN)
- ✅ Sincronização Horário ↔ Distribuição de Aulas: dias obtidos automaticamente do Horário
- ✅ Badge de versão (v1, v2) visível nas abas Apresentação e Finalizar

**Changelog v1.3:**
- ✅ Guias práticos passo a passo para Ensino Secundário e Ensino Superior
- ✅ Manual PDF atualizado com secções 14 e 15 (suporte a utilizadores)
- ✅ Índice por perfil inclui referência à equipa de suporte

**Changelog v1.2:**
- ✅ Correção crítica: Permissões de encerramento de períodos acadêmicos
- ✅ Melhorias de UX no Plano de Ensino (Carga Horária)
- ✅ Auditoria completa de UI/UX aplicada
- ✅ Componente CargaHorariaStatusCard implementado
- ✅ Bloqueios inteligentes baseados em carga horária

**Changelog v1.1:**
- ✅ Adicionados filtros de data/hora na página de logs
- ✅ Melhorada formatação de datas/horas (incluindo segundos)
- ✅ Documentação completa de multi-tenant em logs e backups
- ✅ Validações de segurança detalhadas
- ✅ Processo de execução automática de backups documentado

---

## 📋 ÍNDICE

1. [Introdução](#introdução)
2. [Arquitetura Multi-Tenant](#arquitetura-multi-tenant)
3. [Logs de Auditoria](#logs-de-auditoria)
4. [Sistema de Backups](#sistema-de-backups)
5. [Fluxo Acadêmico](#fluxo-acadêmico)
6. [Plano de Ensino e Carga Horária](#plano-de-ensino-e-carga-horária)
7. [Encerramento de Períodos Acadêmicos](#encerramento-de-períodos-acadêmicos)
8. [Permissões e Perfis](#permissões-e-perfis)
9. [Segurança](#segurança)
10. [Troubleshooting](#troubleshooting)
11. [Guias Práticos - Ensino Secundário e Superior](#11-guias-práticos---ensino-secundário-e-superior)

---

## 1. INTRODUÇÃO

O **DSICOLA** é um sistema SaaS (Software as a Service) completo para gestão acadêmica de instituições de ensino, desenvolvido para suportar tanto **Ensino Secundário** quanto **Ensino Superior**.

### Características Principais

- ✅ **Multi-Tenant**: Isolamento completo de dados por instituição
- ✅ **RBAC**: Controle de acesso baseado em perfis
- ✅ **Auditoria Completa**: Rastreamento de todas as ações
- ✅ **Backups Automáticos**: Sistema de backup e restauração
- ✅ **Fluxo Acadêmico Completo**: Do planejamento ao encerramento

---

## 2. ARQUITETURA MULTI-TENANT

### 2.1 Princípios Fundamentais

O sistema DSICOLA garante **isolamento total** de dados entre instituições:

- ✅ Cada instituição vê **apenas seus próprios dados**
- ✅ `instituicaoId` **NUNCA** vem do frontend
- ✅ Todas as queries são **filtradas automaticamente** por instituição
- ✅ Backend é **sempre a fonte da verdade**

### 2.2 Como Funciona

#### No Backend

```typescript
// ✅ CORRETO: instituicaoId vem do JWT
const instituicaoId = requireTenantScope(req);

// ✅ CORRETO: Filtro automático em queries
const filter = addInstitutionFilter(req);
const dados = await prisma.entidade.findMany({ where: filter });
```

#### No Frontend

```typescript
// ✅ CORRETO: Frontend NÃO envia instituicaoId
const { data } = await api.get('/endpoint'); // Backend filtra automaticamente
```

### 2.3 SUPER_ADMIN

O perfil `SUPER_ADMIN` tem permissões especiais:

- ✅ Pode visualizar dados de qualquer instituição (via `?instituicaoId=xxx`)
- ✅ Pode gerenciar assinaturas e licenças
- ✅ **NÃO** pode acessar módulos acadêmicos diretamente
- ✅ Sempre respeita isolamento multi-tenant

---

## 3. LOGS DE AUDITORIA

### 3.1 Visão Geral

O sistema registra **automaticamente** todas as ações críticas:

- ✅ Criação, edição e exclusão de registros
- ✅ Submissão e aprovação de documentos
- ✅ Encerramento de períodos acadêmicos
- ✅ Ações de backup e restauração
- ✅ Tentativas de acesso não autorizado

### 3.2 Acessando os Logs

**Rota:** `/admin-dashboard/logs`

**Permissões:**
- ✅ `ADMIN`: Vê logs da sua instituição
- ✅ `AUDITOR`: Apenas leitura
- ✅ `SUPER_ADMIN`: Vê logs de todas as instituições

### 3.3 Informações Registradas

Cada log contém:

- **Data/Hora**: Timestamp completo (DD/MM/YYYY HH:mm:ss)
- **Usuário**: Nome e email do usuário que executou a ação
- **Ação**: Tipo de ação (CREATE, UPDATE, DELETE, etc.)
- **Módulo**: Módulo do sistema afetado
- **Entidade**: Tipo de registro afetado
- **Dados Anteriores/Novos**: Comparação de valores (quando aplicável)
- **IP Address**: Endereço IP de origem
- **User Agent**: Navegador/dispositivo utilizado
- **Observações**: Notas adicionais sobre a ação

### 3.4 Filtros Disponíveis

A página de logs (`/admin-dashboard/logs`) oferece os seguintes filtros:

#### Busca por Texto
- Busca em: Nome do usuário, email, ação, módulo, tabela/entidade, observações
- Busca em tempo real conforme você digita

#### Filtro por Ação
- **Todas as ações**: Mostra todos os logs
- **Criações**: Apenas ações de CREATE/INSERT
- **Edições**: Apenas ações de UPDATE
- **Exclusões**: Apenas ações de DELETE
- **Login/Logout**: Ações de autenticação

#### Filtro por Período (Data/Hora)
- **Data Início**: Filtra logs a partir desta data (inclusive)
- **Data Fim**: Filtra logs até esta data (inclusive)
- **Formato**: DD/MM/YYYY
- **Comportamento**: 
  - Se apenas Data Início: mostra todos os logs a partir desta data
  - Se apenas Data Fim: mostra todos os logs até esta data
  - Se ambas: mostra logs no intervalo especificado
  - O backend inclui todo o dia final (até 23:59:59.999)

**Exemplo de Uso:**
```
Data Início: 01/01/2025
Data Fim: 31/01/2025
Resultado: Todos os logs de janeiro de 2025
```

### 3.5 Formatação de Datas e Horas

As datas são exibidas no formato brasileiro com **horário completo**:

- **Tabela de Logs**: `DD/MM/YYYY HH:mm:ss`
  - Exemplo: `27/01/2025 14:30:45`
- **Detalhes do Log**: `DD/MM/YYYY às HH:mm:ss`
  - Exemplo: `27/01/2025 às 14:30:45`
- **Backups**: `DD/MM/YYYY às HH:mm:ss`
  - Exemplo: `27/01/2025 às 14:30:45`

**Importante:**
- Todas as datas incluem **segundos** para precisão
- Horário é exibido em formato 24 horas
- Fuso horário: UTC (convertido para horário local do navegador)

### 3.6 Multi-Tenant nos Logs

#### Segurança Implementada

- ✅ **Filtro Automático**: Backend usa `addInstitutionFilter(req)` em todas as queries
- ✅ **Isolamento Total**: Usuários veem **apenas logs da sua instituição**
- ✅ **Validação de Acesso**: Tentativas de acessar logs de outra instituição são bloqueadas
- ✅ **Auditoria**: Tentativas de acesso cross-tenant são registradas em logs

#### Comportamento por Perfil

**ADMIN / DIRECAO / SECRETARIA:**
- Veem apenas logs da sua instituição
- Filtros de data/hora aplicados apenas aos seus logs
- Não podem acessar logs de outras instituições

**SUPER_ADMIN:**
- Pode filtrar por `instituicaoId` via query param (`?instituicaoId=xxx`)
- Se não especificar, vê logs de todas as instituições
- Sempre respeita isolamento multi-tenant

**AUDITOR:**
- Apenas leitura
- Vê apenas logs da instituição atribuída
- Não pode modificar ou excluir logs

#### Validação Backend

```typescript
// ✅ CORRETO: Filtro automático
const filter = addInstitutionFilter(req);
const logs = await prisma.logAuditoria.findMany({
  where: { ...filter, ...outrosFiltros }
});
```

### 3.7 Estatísticas de Logs

A página de logs exibe estatísticas em tempo real:

- **Total de Logs**: Número total de registros
- **Criações**: Quantidade de ações CREATE
- **Edições**: Quantidade de ações UPDATE
- **Exclusões**: Quantidade de ações DELETE

**Nota:** Estatísticas são calculadas com base nos logs filtrados (respeitando multi-tenant e filtros de data).

---

## 4. SISTEMA DE BACKUPS

### 4.1 Visão Geral

O sistema DSICOLA possui um sistema completo de backup e restauração:

- ✅ **Backups Manuais**: Criados sob demanda
- ✅ **Backups Automáticos**: Agendados por frequência
- ✅ **Restauração**: Recuperação de dados de backups
- ✅ **Multi-Tenant**: Cada instituição gerencia seus próprios backups

### 4.2 Tipos de Backup

#### Backup Completo
Inclui todos os dados da instituição:
- Dados acadêmicos (cursos, turmas, alunos, etc.)
- Dados financeiros (mensalidades, pagamentos)
- Dados de RH (funcionários, folhas de pagamento)
- Configurações da instituição

#### Backup de Dados
Apenas dados estruturados (sem arquivos)

#### Backup de Arquivos
Apenas arquivos enviados (documentos, imagens, etc.)

### 4.3 Criando um Backup Manual

**Rota:** `POST /backups/generate`

**Permissões:** `ADMIN`, `SUPER_ADMIN`

**Exemplo:**
```typescript
POST /backups/generate
{
  "tipo": "completo" // ou "dados", "arquivos"
}
```

**Resposta:**
```json
{
  "id": "uuid",
  "instituicaoId": "uuid",
  "tipo": "completo",
  "status": "concluido",
  "tamanhoBytes": 1234567,
  "createdAt": "2025-01-27T14:30:45Z",
  "backupData": { ... }
}
```

### 4.4 Agendamento de Backups Automáticos

#### Criar Agendamento

**Rota:** `POST /backups/schedules`

**Permissões:** `ADMIN`, `SUPER_ADMIN`

**Exemplo:**
```typescript
POST /backups/schedules
{
  "frequencia": "diario", // "diario", "semanal", "mensal"
  "horaExecucao": "03:00",
  "diaSemana": 1, // 0-6 (domingo-sábado) - apenas para semanal
  "diaMes": 1, // 1-31 - apenas para mensal
  "tipoBackup": "completo",
  "ativo": true
}
```

#### Frequências Disponíveis

**Diário:**
- Executa todos os dias no horário especificado
- Exemplo: `"frequencia": "diario", "horaExecucao": "03:00"`

**Semanal:**
- Executa uma vez por semana
- Exemplo: `"frequencia": "semanal", "horaExecucao": "03:00", "diaSemana": 1` (segunda-feira)

**Mensal:**
- Executa uma vez por mês
- Exemplo: `"frequencia": "mensal", "horaExecucao": "03:00", "diaMes": 1` (dia 1 de cada mês)

#### Listar Agendamentos

**Rota:** `GET /backups/schedules`

Retorna todos os agendamentos da instituição do usuário.

#### Atualizar Agendamento

**Rota:** `PUT /backups/schedules/:id`

**Exemplo:**
```typescript
PUT /backups/schedules/uuid
{
  "ativo": false // Desativar agendamento
}
```

#### Excluir Agendamento

**Rota:** `DELETE /backups/schedules/:id`

### 4.5 Histórico de Backups

**Rota:** `GET /backups/history`

**Parâmetros:**
- `limit`: Número máximo de registros (padrão: 50)

**Resposta:**
```json
[
  {
    "id": "uuid",
    "instituicaoId": "uuid",
    "userId": "uuid",
    "userEmail": "admin@instituicao.com",
    "tipo": "completo",
    "status": "concluido",
    "tamanhoBytes": 1234567,
    "createdAt": "2025-01-27T14:30:45Z"
  }
]
```

**Status Possíveis:**
- `em_progresso`: Backup em andamento
- `concluido`: Backup concluído com sucesso
- `erro`: Erro durante o backup

### 4.6 Restaurando um Backup

**Rota:** `POST /backups/restore`

**Permissões:** `ADMIN`, `SUPER_ADMIN`

**⚠️ ATENÇÃO:** A restauração é uma operação **crítica** e **irreversível**.

**Validações:**
- ✅ Backup deve pertencer à **mesma instituição** do usuário
- ✅ Tentativas de restaurar backup de outra instituição são **bloqueadas e auditadas**
- ✅ Operação é **registrada em logs de auditoria**

**Exemplo:**
```typescript
POST /backups/restore
{
  "backupData": {
    "metadata": {
      "backup_id": "uuid",
      "instituicao_id": "uuid",
      "generated_at": "2025-01-27T14:30:45Z",
      ...
    },
    "instituicao": [...],
    "cursos": [...],
    ...
  },
  "options": {
    "sobrescrever": false
  }
}
```

**Resposta:**
```json
{
  "success": true,
  "message": "Backup restaurado com sucesso",
  "restoreId": "uuid",
  "results": {
    "cursos": { "success": 10, "errors": 0 },
    "turmas": { "success": 25, "errors": 0 },
    ...
  }
}
```

### 4.7 Multi-Tenant nos Backups

#### Segurança Implementada

**Backend (Fonte da Verdade):**
- ✅ `instituicaoId` **NUNCA** vem do frontend
- ✅ Backend usa `requireTenantScope(req)` para obter `instituicaoId` do JWT
- ✅ Todas as queries filtram por `instituicaoId` automaticamente
- ✅ Validação explícita: Backend rejeita `instituicaoId` do body com erro 400

**Frontend:**
- ✅ Frontend **NÃO envia** `instituicaoId` em requisições
- ✅ Backend filtra automaticamente por instituição do token
- ✅ Interface mostra apenas backups da instituição do usuário

**Validações Críticas:**

1. **Geração de Backup:**
   ```typescript
   // ✅ CORRETO: Backend obtém do JWT
   const instituicaoId = requireTenantScope(req);
   
   // ❌ BLOQUEADO: Rejeita se vier do body
   if (req.body.instituicaoId) {
     throw new AppError('instituicaoId não deve ser fornecido...', 400);
   }
   ```

2. **Restauração de Backup:**
   ```typescript
   // ✅ VALIDAÇÃO CRÍTICA: Backup deve pertencer à mesma instituição
   if (backupData.metadata.instituicao_id !== instituicaoId) {
     // Auditoria de tentativa cross-tenant
     await AuditService.log(req, {
       acao: 'BLOCK_RESTORE',
       observacao: 'Tentativa de restaurar backup de outra instituição bloqueada',
     });
     throw new AppError('Acesso negado: Este backup pertence a outra instituição...', 403);
   }
   ```

3. **Agendamento de Backup:**
   ```typescript
   // ✅ CORRETO: instituicaoId do JWT
   const instituicaoId = requireTenantScope(req);
   
   // ❌ BLOQUEADO: Não permite alterar instituicaoId
   if (data.instituicaoId) {
     throw new AppError('Não é permitido alterar instituicaoId', 400);
   }
   ```

#### Isolamento Garantido

- ✅ Cada instituição gerencia **apenas seus próprios backups**
- ✅ Agendamentos são **isolados por instituição**
- ✅ Histórico mostra **apenas backups da instituição**
- ✅ Restauração valida pertencimento antes de executar
- ✅ Tentativas de acesso cross-tenant são **bloqueadas e auditadas**

#### Formatação de Datas nos Backups

Todas as datas de backup são exibidas no formato brasileiro com horário completo:

- **Último Backup**: `DD/MM/YYYY às HH:mm:ss`
- **Próximo Backup**: `DD/MM/YYYY HH:mm`
- **Histórico**: `DD/MM/YYYY às HH:mm:ss`
- **Metadata do Backup**: `DD/MM/YYYY às HH:mm:ss`

**Exemplo:**
```
Último backup: 27/01/2025 às 14:30:45
Próximo backup: 28/01/2025 03:00
```

### 4.8 Execução Automática de Backups

Os backups agendados são executados automaticamente por:

1. **Supabase Edge Function** (`scheduled-backup`)
   - Executa periodicamente (configurado no Supabase Cron)
   - Processa todos os agendamentos ativos
   - Atualiza `ultimo_backup` e `proximo_backup`
   - Registra erros em `backup_history` com status `erro`

2. **Validação Multi-Tenant na Execução**
   - Cada backup é criado com `instituicaoId` do agendamento
   - Dados são filtrados automaticamente por instituição usando `instituicao_id` do schedule
   - Nenhum dado de outra instituição é incluído
   - Validação ocorre antes de gerar o backup

3. **Processo de Execução Detalhado**
   ```
   1. Edge Function é acionada pelo Supabase Cron
   2. Busca agendamentos ativos onde `proximo_backup <= agora`
   3. Para cada agendamento encontrado:
      a. Obtém `instituicao_id` do agendamento
      b. Filtra TODAS as queries por `instituicao_id`
      c. Gera backup apenas com dados da instituição
      d. Calcula tamanho do backup
      e. Registra em `backup_history` com:
         - instituicao_id: do agendamento
         - tipo: do agendamento
         - status: 'concluido' ou 'erro'
         - tamanho_bytes: tamanho calculado
      f. Atualiza agendamento:
         - ultimo_backup: agora
         - proximo_backup: calculado baseado na frequência
   ```

4. **Filtros Multi-Tenant na Edge Function**
   ```typescript
   // ✅ CORRETO: Filtra por instituicao_id do schedule
   const instituicaoFilter = schedule.instituicao_id;
   
   // Todas as queries filtram por instituição
   let profilesQuery = supabaseAdmin.from('profiles').select('*');
   if (instituicaoFilter) {
     profilesQuery = profilesQuery.eq('instituicao_id', instituicaoFilter);
   }
   ```

5. **Tratamento de Erros**
   - Erros são registrados em `backup_history` com status `erro`
   - Mensagem de erro é salva no campo `erro`
   - Agendamento continua ativo (não é desativado automaticamente)
   - Próximo backup é recalculado normalmente
   - Logs de erro são registrados no console da Edge Function

6. **Configuração do Cron**
   - Edge Function deve ser configurada no Supabase Dashboard
   - Frequência recomendada: A cada 1 hora
   - Verifica agendamentos e executa apenas os que estão no horário

### 4.9 Boas Práticas

1. **Frequência Recomendada:**
   - **Diário**: Para instituições com alta movimentação
   - **Semanal**: Para uso normal
   - **Mensal**: Para backup de arquivo

2. **Horário Recomendado:**
   - **03:00**: Horário de menor uso do sistema

3. **Retenção:**
   - Manter backups dos últimos **30 dias** (diários)
   - Manter backups dos últimos **3 meses** (semanais)
   - Manter backups dos últimos **12 meses** (mensais)

4. **Teste de Restauração:**
   - Testar restauração **pelo menos uma vez por mês**
   - Validar integridade dos dados restaurados

### 4.10 Notas Importantes sobre Backups

#### Storage e Arquivos

**Limitação Atual:**
- Storage buckets (avatars, instituicao, documentos_alunos) não têm filtro direto por `instituicaoId`
- Backups de arquivos listam todos os arquivos do bucket
- **Recomendação:** Implementar estrutura de pastas por instituição no futuro

**Estrutura Recomendada para Storage:**
```
avatars/
  {instituicao_id}/
    {user_id}.jpg
    
instituicao/
  {instituicao_id}/
    logo.jpg
    capa.jpg
    
documentos_alunos/
  {instituicao_id}/
    {aluno_id}/
      documento.pdf
```

#### Validações de Segurança

**Backend (Sempre Valida):**
- ✅ `instituicaoId` vem do JWT (nunca do body)
- ✅ Backup gerado contém apenas dados da instituição
- ✅ Restauração valida pertencimento antes de executar
- ✅ Tentativas cross-tenant são bloqueadas e auditadas

**Edge Function (Execução Automática):**
- ✅ Filtra todas as queries por `instituicao_id` do agendamento
- ✅ Matrículas filtradas através de turmas da instituição
- ✅ Notas filtradas por `instituicao_id`
- ✅ Nenhum dado de outra instituição é incluído

---

## 5. FLUXO ACADÊMICO

### 5.1 Visão Geral

O fluxo acadêmico segue uma sequência rigorosa:

```
Calendário Acadêmico
  ↓
Ano Letivo
  ↓
Semestre/Trimestre (PLANEJADO → ATIVO → ENCERRADO)
  ↓
Plano de Ensino
  ↓
Matrículas
  ↓
Distribuição de Aulas
  ↓
Lançamento de Aulas
  ↓
Controle de Presenças
  ↓
Avaliações e Notas
  ↓
Encerramento de Período
  ↓
Encerramento de Ano Letivo
```

### 5.2 Validações de Datas

#### Lançamento de Aulas
- ✅ Período deve estar **ATIVO**
- ✅ Data da aula deve estar **dentro do período**
- ✅ Bloqueado se período estiver **ENCERRADO**

#### Lançamento de Notas
- ✅ Período deve estar **ATIVO**
- ✅ Data deve estar entre `dataInicioNotas` e `dataFimNotas`
- ✅ Bloqueado se período estiver **ENCERRADO**

#### Controle de Presenças
- ✅ Aula deve estar **lançada**
- ✅ Período deve estar **ATIVO**
- ✅ Bloqueado se período estiver **ENCERRADO**

### 5.3 Encerramento de Períodos

#### Pré-requisitos para Encerramento

**Trimestre (Ensino Secundário):**
1. Todas as aulas do trimestre lançadas
2. Todas as aulas lançadas têm presenças registradas
3. Todas as avaliações do trimestre fechadas

**Semestre (Ensino Superior):**
1. Todas as aulas do semestre lançadas
2. Todas as presenças registradas
3. Todas as avaliações fechadas

**Ano Letivo:**
1. Todos os períodos (trimestres/semestres) encerrados
2. Nenhum plano de ensino pendente

---

## 8. PERMISSÕES E PERFIS

### 6.1 Perfis Disponíveis

#### SUPER_ADMIN
- ✅ Gerenciamento de plataforma
- ✅ Visualização de todas as instituições
- ✅ Gerenciamento de assinaturas
- ❌ **NÃO** acessa módulos acadêmicos diretamente

#### ADMIN
- ✅ Acesso total à instituição
- ✅ Configuração de calendário acadêmico
- ✅ Aprovação de planos de ensino
- ✅ Encerramento de períodos
- ✅ Gerenciamento de backups

#### DIRECAO
- ✅ Similar ao ADMIN
- ✅ Acesso administrativo amplo

#### COORDENADOR
- ✅ Coordenação de cursos específicos
- ✅ Visualização de dados do curso
- ✅ Aprovação de planos de ensino do curso
- ✅ Criar nova versão de plano aprovado (padrão SIGAE)

#### PROFESSOR
- ✅ Lançamento de aulas
- ✅ Controle de presenças
- ✅ Lançamento de notas
- ✅ Apenas para suas disciplinas/turmas atribuídas
- ❌ **NÃO** pode configurar calendário
- ❌ **NÃO** pode alterar plano após aprovação

#### SECRETARIA
- ✅ Execução de matrículas
- ✅ Visualização de presenças e notas
- ✅ Emissão de documentos
- ❌ **NÃO** pode alterar regras acadêmicas
- ❌ **NÃO** pode encerrar períodos

#### ALUNO
- ✅ Consulta de notas
- ✅ Consulta de presenças
- ✅ Consulta de calendário
- ❌ **NÃO** pode alterar dados

#### AUDITOR
- ✅ Apenas leitura de logs
- ✅ Visualização de auditoria
- ❌ **NÃO** pode executar ações

#### POS (Ponto de Venda)
- ✅ Registro de pagamentos
- ✅ Visualização de mensalidades
- ❌ **NÃO** pode alterar dados acadêmicos

---

## 9. SEGURANÇA

### 7.1 Multi-Tenant

- ✅ `instituicaoId` **sempre** do JWT (nunca do frontend)
- ✅ Todas as queries filtradas automaticamente
- ✅ Validação de pertencimento antes de operações
- ✅ Tentativas de acesso cross-tenant bloqueadas e auditadas

### 7.2 Autenticação

- ✅ JWT com expiração
- ✅ Refresh tokens
- ✅ Bloqueio de conta após tentativas falhadas
- ✅ Validação de senha forte

### 7.3 Auditoria

- ✅ Todas as ações críticas registradas
- ✅ Rastreamento de IP e User Agent
- ✅ Comparação antes/depois de alterações
- ✅ Logs imutáveis (apenas leitura)

### 7.4 Backups

- ✅ Validação de instituição antes de restauração
- ✅ Auditoria de todas as operações de backup
- ✅ Isolamento completo entre instituições

---

## 10. TROUBLESHOOTING

### 8.1 Logs Não Aparecem

**Problema:** Logs não são exibidos na página

**Soluções:**
1. Verificar se o usuário tem permissão (`ADMIN`, `AUDITOR`, `SUPER_ADMIN`)
2. Verificar se `instituicaoId` está presente no token
3. Verificar filtros aplicados (data, ação, módulo)
4. Verificar console do navegador para erros

### 8.2 Datas Não Formatadas Corretamente

**Problema:** Datas aparecem como strings ou timestamps

**Soluções:**
1. Verificar se a data está no formato ISO (`YYYY-MM-DDTHH:mm:ssZ`)
2. Verificar timezone do servidor
3. Verificar se `date-fns` está instalado
4. Verificar console para erros de parsing

### 8.3 Backup Não Executa Automaticamente

**Problema:** Backups agendados não são executados

**Soluções:**
1. Verificar se o agendamento está **ativo** (`ativo: true`)
2. Verificar se `proximo_backup` está no passado
3. Verificar logs do Supabase Edge Function
4. Verificar se a função `scheduled-backup` está configurada no Supabase
5. Verificar se `pg_cron` está habilitado no banco de dados

### 8.4 Restauração Bloqueada

**Problema:** Não consigo restaurar um backup

**Soluções:**
1. Verificar se o backup pertence à sua instituição
2. Verificar se você tem permissão `ADMIN` ou `SUPER_ADMIN`
3. Verificar logs de auditoria para tentativas bloqueadas
4. Verificar se o formato do backup está correto

### 8.5 Acesso Cross-Tenant Bloqueado

**Problema:** Tentativa de acessar dados de outra instituição

**Soluções:**
1. **Isso é esperado!** O sistema bloqueia acesso cross-tenant por segurança
2. Verificar se você está usando o token correto
3. Verificar se `instituicaoId` no token corresponde à instituição desejada
4. SUPER_ADMIN pode acessar outras instituições via `?instituicaoId=xxx`

---

### 10.5 Erro de Permissão ao Encerrar Período

**Problema:** ADMIN recebe erro "Você não tem permissão para encerrar períodos acadêmicos"

**Soluções:**
1. **Verificar se o problema foi corrigido**: Versão 1.2 corrige este problema
2. **Verificar token**: Fazer logout e login novamente para renovar token
3. **Verificar roles no token**: Verificar se o usuário tem role ADMIN no token JWT
4. **Verificar logs do backend**: Logs em desenvolvimento mostram roles detectadas

**Status:** ✅ **CORRIGIDO na v1.2** - Correção aplicada em 2025-01-28

### 10.6 Carga Horária Incompleta no Plano de Ensino

**Problema:** Não consigo finalizar/aprovar o Plano de Ensino

**Soluções:**
1. Verificar card de status de carga horária no topo do plano
2. Adicionar aulas até completar a carga horária exigida
3. Usar botão "Adicionar Aula" no card de status para facilitar
4. Verificar se a carga planejada atende à exigida (indicador verde)

### 10.7 Plano de Ensino - Controle de Versão (SIGAE)

**Como alterar um plano já aprovado:**
1. ADMIN ou COORDENADOR acessam o plano aprovado
2. Na aba "Finalizar", clicam em "Criar nova versão (v2)"
3. O sistema cria um novo plano em RASCUNHO vinculado ao anterior
4. Editar o novo plano e submeter para aprovação
5. O plano anterior permanece aprovado; o novo inicia o fluxo de aprovação

**Distribuição de Aulas e Horário:**
- Se o Horário (Gestão Acadêmica → Horários) estiver cadastrado para o plano, os dias da semana na Distribuição vêm automaticamente do Horário
- Se alterar o Horário após gerar a distribuição, o sistema exibe aviso de divergência — use "Re-gerar Distribuição" para sincronizar

---

## 11. GUIAS PRÁTICOS - ENSINO SECUNDÁRIO E SUPERIOR

> **Nota:** Estes guias estão disponíveis no **Manual PDF** gerado pelo sistema (botão "Manual" no painel Admin). O PDF inclui instruções passo a passo detalhadas para suporte e utilizadores.

### 11.1 Guia Ensino Secundário (7ª a 13ª classe)

**Configuração inicial:** Ano Letivo → Trimestres → Calendário → Cursos → Classes → Disciplinas → Professores → Turmas.

**Fluxo trimestral (Professor):** Plano de Ensino → Distribuição de Aulas → Lançamento de Aulas → Presenças → Avaliações e Notas.

**Sistema de notas:** Média = (Prova + Trabalho) / 2 por trimestre. Aprovado ≥ 10 e frequência ≥ 75%. Recurso entre 8-9,9.

### 11.2 Guia Ensino Superior (Universidades)

**Configuração inicial:** Ano Letivo → Semestres → Calendário → Cursos → Disciplinas (com créditos) → Professores → Turmas.

**Fluxo semestral (Professor):** Mesma ordem que Secundário, adaptado a semestres.

**Sistema de avaliação:** P1, P2, Exame, Recurso. Créditos por disciplina. Conclusão de curso com verificação de créditos.

### 11.3 Resolução de Problemas (Suporte)

| Problema | Secundário | Superior |
|----------|------------|----------|
| Aba bloqueada | Concluir etapa anterior | Idem |
| Aluno não recebe nota | Frequência < 75% | Idem |
| Período não aparece | Criar Trimestres | Criar Semestres |
| Professor não vê turma | Atribuição de Disciplinas | Idem |

---

## 12. CONTATO E SUPORTE

Para suporte técnico ou dúvidas sobre o sistema:

- **Manual PDF no sistema:** Botão "Manual" no painel Admin (gera PDF com guias práticos completos)
- **Documentação Técnica:** Ver arquivos `.md` na raiz do projeto
- **Logs de Auditoria:** `/admin-dashboard/logs`
- **Relatórios de Auditoria:** `RELATORIO_AUDITORIA_COMPLETA_DSICOLA.md`

---

## 13. CHANGELOG

### Versão 1.3 (2025-02-14)

**Guias Práticos para Suporte:**
- ✅ **Seção 14 (PDF):** Guia Prático Passo a Passo - Ensino Secundário (configuração, fluxo trimestral, notas, pautas, troubleshooting)
- ✅ **Seção 15 (PDF):** Guia Prático Passo a Passo - Ensino Superior (configuração, fluxo semestral, créditos, conclusão de curso)
- ✅ Índice do manual PDF atualizado com secções 14 e 15
- ✅ Índice por perfil inclui referência para equipa de suporte
- ✅ Manual gerado adapta-se ao tipo da instituição (tipoAcademico)

### Versão 1.2 (2025-01-28)

**Correções Críticas:**
- ✅ **Correção de Permissões**: Corrigido bug que impedia ADMIN de encerrar períodos acadêmicos
- ✅ **Validação de Roles**: Corrigido mapeamento incorreto de roles no controller de encerramentos

**Melhorias de UX/UI:**
- ✅ **Componente CargaHorariaStatusCard**: Novo card visual para status de carga horária
- ✅ **Feedback Visual**: Indicadores coloridos (verde/amarelo/vermelho) para status de carga
- ✅ **Bloqueios Inteligentes**: Sistema bloqueia ações quando carga horária incompleta
- ✅ **Ação Guiada**: Botão contextual para adicionar aulas faltantes
- ✅ **Mensagens Institucionais**: Textos claros e educativos para usuários não técnicos

**Auditoria de Interface:**
- ✅ **AnoLetivoContextHeader**: Adicionado em ProfessorDashboard
- ✅ **AnoLetivoAtivoGuard**: Aplicado em TurmasTab com tooltips explicativos
- ✅ **Validações de UI**: Bloqueios visuais quando não há ano letivo ativo

**Documentação:**
- ✅ Seção completa sobre Plano de Ensino e Carga Horária
- ✅ Seção completa sobre Encerramento de Períodos Acadêmicos
- ✅ Troubleshooting expandido com novos problemas comuns

### Versão 1.1 (2025-01-27)

- ✅ Adicionados filtros de data/hora na página de logs
- ✅ Melhorada formatação de datas/horas (incluindo segundos)
- ✅ Documentação completa de multi-tenant em logs e backups
- ✅ Validações de segurança detalhadas
- ✅ Processo de execução automática de backups documentado

### Versão 1.0 (2025-01-27)

- ✅ Sistema de logs de auditoria completo
- ✅ Sistema de backups manual e automático
- ✅ Validações multi-tenant em todos os módulos
- ✅ Formatação correta de datas/horas nos logs
- ✅ Manual do sistema atualizado

---

**Fim do Manual**

