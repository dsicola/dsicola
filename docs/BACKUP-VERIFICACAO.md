# Verificação de Backups — ROADMAP-100

Garantir que **backups estão a ser feitos e que o restore foi testado** (release estável, nível 100%).

---

## 1. Backups automatizados

- O sistema possui rotas e serviços de backup (ver `backend/src/routes/backup.routes.ts`, `backend/src/services/backup.service.ts`).
- Em produção, configurar **agendamento** (cron/scheduler) para executar o backup com a periodicidade definida (ex.: diário).
- Definir **retenção** (ex.: manter últimos 7 dias, 4 semanas, 12 meses) conforme política da instituição.

---

## 2. Testar o restore

- **Periodicidade sugerida:** pelo menos uma vez por trimestre, ou após alterações importantes no schema.
- **Passos:**
  1. Numa base de dados de teste (cópia ou staging), restaurar um backup recente.
  2. Verificar que a aplicação arranca e que dados críticos (utilizadores, instituições, matrículas, mensalidades) estão presentes e consistentes.
  3. Documentar o resultado e a data do teste.

| Data do teste | Quem executou | Resultado (OK / Falha) | Observações |
|---------------|----------------|------------------------|-------------|
| _____________ | _____________  | ______________________ | ___________ |

---

## 3. Política de retenção (exemplo)

- **Diário:** últimos 7 dias.
- **Semanal:** últimas 4 semanas.
- **Mensal:** últimos 12 meses.

Ajustar conforme capacidade de armazenamento e requisitos legais/institucionais.

---

*Documento criado no âmbito do [ROADMAP-100.md](./ROADMAP-100.md).*
