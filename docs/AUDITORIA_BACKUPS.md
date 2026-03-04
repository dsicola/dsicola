# Auditoria e Backups — DSICOLA

Documentação para logs de auditoria e testes de restore (ROADMAP-100).

---

## 1. Auditoria de Alterações Sensíveis

**Objetivo:** Registar alterações em notas, matrículas, dados fiscais e outros dados sensíveis com logs imutáveis e consultáveis.

### Implementação

- O sistema já possui registo de auditoria em:
  - **Correções de nota:** `CorrecaoNota` com `corrigidoPor`, `motivo`, `createdAt`
  - **Backup:** logs de auditoria em operações de backup/restore
  - **Reabertura de períodos:** `motivoReabertura` em trimestres/semestres

### Próximos passos (opcional)

- Criar tabela `AuditLog` genérica para registar:
  - `userId`, `instituicaoId`, `acao`, `entidade`, `entidadeId`, `dadosAntes`, `dadosDepois`, `timestamp`
- Integrar em controllers: `nota.controller`, `matricula.controller`, `configuracaoInstituicao.controller`

---

## 2. Backups Automatizados

- **Agendamento:** `BackupScheduler` no frontend (admin) permite configurar horários
- **Backup manual:** Endpoint disponível para SUPER_ADMIN
- **Armazenamento:** Conforme configurado (local, S3, etc.)

---

## 3. Testes de Restore

**Recomendação:** Testar restores periodicamente (ex.: mensalmente).

### Procedimento

1. Fazer backup em ambiente de staging
2. Alterar dados de teste
3. Executar restore do backup
4. Verificar que os dados foram restaurados corretamente
5. Documentar o resultado

### Comando de teste (exemplo)

```bash
# O restore é feito via API ou interface admin
# Ver documentação do módulo de backup
```

---

*Documento no âmbito do [ROADMAP-100.md](./ROADMAP-100.md).*
