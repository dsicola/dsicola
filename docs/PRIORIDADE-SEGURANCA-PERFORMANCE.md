# Prioridade: Segurança → Performance

Ordem de trabalho acordada para o ROADMAP-100:

1. **Segurança** (primeiro)
2. **Performance** (depois)

Referência: [ROADMAP-100.md](./ROADMAP-100.md) (secções 4 e 2).

---

## 1. Segurança (fazer primeiro)

Itens do ROADMAP-100 e estado atual.

### 1.1 Auditoria

| Estado | Ação |
|--------|------|
| Parcial | **Auditoria de acessos e alterações sensíveis** (notas, matrículas, dados fiscais) com logs imutáveis e consultáveis. |

**Já existe:** `AuditService` e `logAuditoria` em vários controllers (notas, matrículas, folha, backup, conclusão, etc.). Rotas de consulta em `logAuditoria.controller.ts` e painel em `seguranca.controller.ts`.

**Implementado (rastreabilidade “quem fez o quê”):**
- **Editou nota:** auditoria em `nota.controller.ts` (AuditService.logUpdate em correções e atualizações de nota).
- **Cancelou recibo (estorno):** auditoria em `pagamento.controller.ts` (estornarPagamento) — log RECIBO status ESTORNADO + log PAGAMENTO ESTORNAR.
- **Apagou aluno (utilizador):** auditoria em `user.controller.ts` (deleteUser) — log DELETE USER com email, roles, instituição.
- **Apagou matrícula:** auditoria em `matricula.controller.ts` (deleteMatricula) — log DELETE MATRICULA com alunoId, turmaId, status.

**Fazer (opcional):**
- Garantir que logs são **imutáveis** (apenas INSERT na tabela de auditoria) e que a consulta está restrita a roles adequados (Admin/Direção).

### 1.2 Rate limiting

| Estado | Ação |
|--------|------|
| Parcial | **Rate limiting** em APIs públicas e em login/recuperação de senha; revisar cobertura. |

**Já existe:**
- `express-rate-limit` no backend.
- **Login:** 10 req/min (30 em dev) em `auth.routes.ts` (`loginRateLimiter`).
- **Auth sensível:** 5 req/15 min para reset de senha, etc. (`authSensitiveRateLimiter`).
- **API geral:** 200 req/min por IP em `app.ts` (`apiLimiter`); `/health` e `/api-docs` excluídos.

**Cobertura confirmada:** Login, login-step2 (2FA), register, reset-password e confirm-reset-password estão sob rate limit. Limites documentados em [SESSAO-E-SEGURANCA.md](./SESSAO-E-SEGURANCA.md).

### 1.3 Política de sessão e senha

| Estado | Ação |
|--------|------|
| Pendente | **Política de senha e de sessão** (expiração, renovação de token) **documentada e aplicada**. |

**Já existe:** JWT com access + refresh; `JWT_SECRET` e `JWT_REFRESH_SECRET` obrigatórios em produção (`jwtSecrets.ts`). Auth service com login, refresh, logout.

**Documentado:** [SESSAO-E-SEGURANCA.md](./SESSAO-E-SEGURANCA.md) — expiração do access token (15m = inatividade), refresh (7d), e rate limit. Em produção definir `JWT_EXPIRES_IN=15m` e `JWT_REFRESH_EXPIRES_IN=7d`.

### 1.4 Dados pessoais

| Estado | Ação |
|--------|------|
| Pendente | **Alinhamento a boas práticas** (minimização, retenção, direito ao esquecimento onde aplicável). |

**Fazer:**
- Rever retenção de dados pessoais (logs de auditoria, backups) e documentar política.
- Definir processo para direito ao esquecimento (anonimização/remoção) onde a lei aplicar.

### 1.5 Backups

| Estado | Ação |
|--------|------|
| Parcial | **Backups automatizados** com **restores testados** periodicamente e **política de retenção** definida. |

**Já existe:** Rotas e serviço de backup (`backup.routes.ts`, `backup.service.ts`). [BACKUP-VERIFICACAO.md](./BACKUP-VERIFICACAO.md) descreve verificação de restore e tabela de testes.

**Restauração testada:** [BACKUP-VERIFICACAO.md](./BACKUP-VERIFICACAO.md) descreve passos para testar restore; script `scripts/test-restore-backup.sh` restaura um backup numa DB de teste e verifica contagens. Executar pelo menos um restore de teste por trimestre e preencher a tabela no doc.
- **Fazer:** Em produção, agendar backup (cron/scheduler) e definir retenção (ex.: 7 dias, 4 semanas, 12 meses).

---

## 2. Performance (fazer depois da Segurança)

Itens do ROADMAP-100 (secção 2).

| Estado | Item |
|--------|------|
| ☐ | Métricas de tempo de resposta definidas (ex.: p95 &lt; 2–3s para salvamentos e listagens críticas) |
| ☐ | Medição em produção ou staging (logs/APM) para endpoints críticos |
| ☐ | Paginação em todas as listagens que podem crescer (alunos, mensalidades, notas, documentos, logs) |
| ☐ | Revisão de queries (N+1, select mínimo) nos fluxos mais usados |
| ☐ | Índices de base de dados revisados/criados onde necessário (Prisma/DB) |
| ☐ | Cache onde fizer sentido (ex.: configuração da instituição, listas estáticas) |
| ☐ | Política de uploads (tamanho, tipos, armazenamento) documentada e aplicada |

Quando a fase de **Segurança** estiver concluída (ou em checkpoint acordado), avançar para estes itens na ordem que fizer mais sentido (ex.: métricas e paginação primeiro, depois índices e cache).

---

## Resumo

- **Ordem:** 1º Segurança → 2º Performance.
- **Segurança:** fechar auditoria (cobertura + imutabilidade), rever rate limit, documentar sessão/senha, definir retenção e direito ao esquecimento, backups agendados + restore testado.
- **Performance:** seguir a tabela da secção 2 do ROADMAP-100 após segurança.

*Última atualização: fevereiro 2026.*
