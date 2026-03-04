# Changelog — DSICOLA

Registro de alterações relevantes para integradores e equipa de frontend.  
Formato inspirado em [Keep a Changelog](https://keepachangelog.com/).

---

## [Unreleased]

### Adicionado
- Cache de configuração da instituição (TTL 5 min) — `configCache.service.ts`
- Códigos de erro uniformes (VALIDATION_ERROR, NOT_FOUND, etc.) no errorHandler
- Documentação: PROCESSO_RELEASE.md, AUDITORIA_BACKUPS.md
- Índice composto: mensalidades (aluno_id, status)
- Documentação: POLITICA_LGPD.md, API_VERSIONING.md, QUERIES_REVISAO.md, VALIDACAO_RELATORIOS_EXPORTACOES.md
- Métricas de tempo de resposta definidas em PERFORMANCE_CHECKLIST
- Documentação: ACESSIBILIDADE.md, DESIGN_SYSTEM.md
- Medição APM: Sentry Performance documentado em SENTRY_CONFIG
- ROADMAP-100: todos os itens concluídos
- E2E Configurações: `e2e/roadmap-100-configuracoes.spec.ts`; comando `npm run test:e2e:roadmap-configuracoes`
- Testes de integração: Auth/Config (`integration-auth-config.test.ts`), Mensalidades (`integration-mensalidades.test.ts`)
- Testes unitários: cargo-departamento (`cargo-departamento.test.ts`) — validações de perfil
- Documentação: `POLITICAS_SESSAO_SENHA.md`, `POLITICA_UPLOADS.md`, `PARIDADE-SIGAE.md`
- Documentação: `ONBOARDING.md` — guia de primeiro uso

### Alterado
- ROADMAP-100: itens E2E Config, Integração Auth/Config/Mensalidades, Políticas, Paridade marcados como concluídos

---

## [1.x] — Histórico

Para versões anteriores, consultar commits e documentação em `docs/`.

---

*Última atualização: março 2026.*
