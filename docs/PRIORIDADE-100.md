# Ordem de prioridade para nível 100% — DSICOLA

Ordem acordada para chegar ao nível SIGAE / 100%:

1. **Paridade SIGAE** — Lista de funcionalidades e relatórios fechada e validada  
2. **Segurança** — Auditoria, rate limit, sessão, backups testados  
3. **Estabilidade** — Release estável, testes antes do deploy, rollback possível  
4. **Performance** (nível SIGAE) — Métricas, paginação, índices, cache  
5. **UX** — Loading em tudo, feedback visual, responsivo, empty states  

Referência geral: [ROADMAP-100.md](./ROADMAP-100.md).

---

## 1. Paridade SIGAE

- Lista de funcionalidades vs SIGAE fechada e validada — [PARIDADE-SIGAE.md](./PARIDADE-SIGAE.md)
- Relatórios oficiais implementados e validados
- Exportações (SAFT, Excel, PDF) estáveis e testadas

---

## 2. Segurança

- Auditoria (editou nota, cancelou recibo, apagou aluno/matrícula) — implementado
- Rate limit (login, recuperação de senha) — implementado
- Política de sessão (expirar após inatividade) — documentado em [SESSAO-E-SEGURANCA.md](./SESSAO-E-SEGURANCA.md)
- Backups testados — [BACKUP-VERIFICACAO.md](./BACKUP-VERIFICACAO.md), script `scripts/test-restore-backup.sh`

Detalhe: [PRIORIDADE-SEGURANCA-PERFORMANCE.md](./PRIORIDADE-SEGURANCA-PERFORMANCE.md).

---

## 3. Estabilidade

- Testes automatizados antes do deploy
- Staging e rollback possível
- Health check — endpoint `/health` (inclui `version`)
- Checklist de release — [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md)

---

## 4. Performance (nível SIGAE)

- Métrica: p95 &lt; 2–3 s por página/listagem
- Paginação em listagens (alunos, utilizadores, mensalidades, matrículas)
- Índices (User: email, NIF, número matrícula, instituição)
- Cache (dashboard stats, 60 s)

Detalhe: [PERFORMANCE-100.md](./PERFORMANCE-100.md).

---

## 5. UX (objetivo 100%)

- **Loading em tudo** — Botão mostra “Processando...” / “Salvando...” durante ações
- **Feedback visual** — Sucesso, erro, alerta (toasts/notificações consistentes)
- **Responsivo** — Funcionar bem em computador, tablet e telemóvel
- **Empty states** — Mensagens e ações sugeridas quando não há dados

Detalhe: [UX-100.md](./UX-100.md).

---

*Última atualização: fevereiro 2026.*
