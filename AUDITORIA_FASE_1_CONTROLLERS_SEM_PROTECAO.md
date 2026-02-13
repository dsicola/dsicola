# CONTROLLERS SEM PROTEÇÃO MULTI-TENANT

## Controllers que NÃO usam addInstitutionFilter ou requireTenantScope (25)

1. **alocacaoAlojamento.controller.ts** - VERIFICAR
2. **backup.controller.ts** - Pode ser SUPER_ADMIN only, verificar
3. **configuracaoInstituicao.controller.ts** - VERIFICAR (pode ser por instituição)
4. **configuracaoLanding.controller.ts** - Pode ser público/Super Admin only
5. **documentoEmitido.controller.ts** - VERIFICAR
6. **documentoFuncionario.controller.ts** - VERIFICAR
7. **estatistica.controller.ts** - Pode ser SUPER_ADMIN only
8. **historicoRh.controller.ts** - VERIFICAR
9. **horario.controller.ts** - VERIFICAR
10. **instituicao.controller.ts** - SUPER_ADMIN only (esperado)
11. **lead.controller.ts** - Pode ser público/Super Admin
12. **logsRedefinicaoSenha.controller.ts** - VERIFICAR
13. **matriculasDisciplinasV2.controller.ts** - ✅ CORRIGIDO (usa service com proteção)
14. **mensagemResponsavel.controller.ts** - VERIFICAR
15. **metaFinanceira.controller.ts** - VERIFICAR
16. **notificacao.controller.ts** - VERIFICAR
17. **onboarding.controller.ts** - Pode ser público/Super Admin
18. **pauta.controller.ts** - VERIFICAR
19. **plano.controller.ts** - VERIFICAR (pode ser plano de pagamento)
20. **responsavelAluno.controller.ts** - VERIFICAR
21. **saftExport.controller.ts** - VERIFICAR
22. **storage.controller.ts** - Pode ser utilitário público
23. **tipoDocumento.controller.ts** - VERIFICAR
24. **trimestreFechado.controller.ts** - VERIFICAR
25. **utils.controller.ts** - Utilitário, verificar se precisa

## PRIORIDADES

### CRÍTICO (dados sensíveis):
- alocacaoAlojamento
- documentoEmitido
- documentoFuncionario
- historicoRh
- horario
- mensagemResponsavel
- metaFinanceira
- notificacao
- pauta
- responsavelAluno
- saftExport
- tipoDocumento
- trimestreFechado

### MÉDIO (pode precisar):
- configuracaoInstituicao
- logsRedefinicaoSenha

### BAIXO (pode ser SUPER_ADMIN only ou público):
- backup
- configuracaoLanding
- estatistica
- instituicao (já é SUPER_ADMIN)
- lead
- onboarding
- storage
- utils

