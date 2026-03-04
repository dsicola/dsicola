# Processo de Release — DSICOLA

Fluxo estável para deploy com staging, rollback e testes automatizados (ROADMAP-100).

---

## 1. Ambientes

| Ambiente | Uso | URL |
|----------|-----|-----|
| **Desenvolvimento** | Desenvolvimento local | localhost |
| **Staging** | Testes antes de produção | (configurar conforme infra) |
| **Produção** | Utilizadores finais | (configurar conforme infra) |

---

## 2. Fluxo de Release

1. **Desenvolvimento** → Commit e push para branch
2. **CI** → Testes automatizados (build, unit, integration, E2E)
3. **Staging** → Deploy em staging; smoke test manual
4. **Produção** → Deploy em produção após aprovação
5. **Pós-deploy** → Verificar health, login, logs

---

## 3. Testes Antes do Deploy

```bash
cd backend && npm run build && npm run test
cd frontend && npm run build
cd frontend && npm run test:e2e:roadmap-login-nav
```

---

## 4. Rollback

- Se o deploy tiver opção de rollback: usar o mecanismo da plataforma
- Se não: manter backup da base antes do deploy; em caso de erro, restaurar backup e reverter código

---

## 5. Checklist

Ver [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md).

---

*Documento no âmbito do [ROADMAP-100.md](./ROADMAP-100.md).*
