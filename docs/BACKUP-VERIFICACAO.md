# Verificação de Backups — ROADMAP-100

Garantir que **backups estão a ser feitos e que o restore foi testado** (release estável, nível 100%).

---

## 1. Backups automatizados

- O sistema possui rotas e serviços de backup (ver `backend/src/routes/backup.routes.ts`, `backend/src/services/backup.service.ts`).
- Em produção, configurar **agendamento** (cron/scheduler) para executar o backup com a periodicidade definida (ex.: diário).
- Definir **retenção** (ex.: manter últimos 7 dias, 4 semanas, 12 meses) conforme política da instituição.

---

## 2. Testar o restore (obrigatório)

**Não basta fazer backup — tem que testar restauração.** Pelo menos uma vez por trimestre (ou após alterações importantes no schema).

### Passos para testar a restauração

1. **Obter um ficheiro de backup recente**  
   Ex.: gerado pela rota de backup (Admin) ou pelo agendamento em produção. Exemplo de ficheiro: `backup_YYYYMMDD_HHMMSS.sql` (ou o formato usado pelo `backup.service.ts`).

2. **Usar uma base de dados de teste** (nunca a de produção).  
   Exemplo com PostgreSQL:
   ```bash
   # Criar DB de teste
   createdb dsicola_restore_test
   export TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/dsicola_restore_test"
   ```

3. **Restaurar o backup na base de teste**
   ```bash
   psql "$TEST_DATABASE_URL" < /caminho/para/backup_YYYYMMDD_HHMMSS.sql
   ```

4. **Verificar que a aplicação arranca** com a base restaurada:
   ```bash
   cd backend
   DATABASE_URL="$TEST_DATABASE_URL" npm run dev
   ```
   Confirmar que não há erros de migração/conexão.

5. **Verificar dados críticos** (queries de verificação rápida):
   ```sql
   SELECT COUNT(*) FROM "users";
   SELECT COUNT(*) FROM "instituicoes";
   SELECT COUNT(*) FROM "matriculas";
   SELECT COUNT(*) FROM "mensalidades";
   ```
   Os números devem fazer sentido face ao backup (ex.: não zeros se o backup tinha dados).

6. **Documentar** o resultado na tabela abaixo e, se possível, destruir a base de teste após o teste:
   ```bash
   dropdb dsicola_restore_test
   ```

**Script auxiliar:** Pode usar `scripts/test-restore-backup.sh` para restaurar e verificar contagens básicas (ver uso no próprio script). Exemplo:
```bash
BACKUP_FILE=./backups/backup_YYYYMMDD_HHMMSS.sql TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/dsicola_restore_test" ./scripts/test-restore-backup.sh
```

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
