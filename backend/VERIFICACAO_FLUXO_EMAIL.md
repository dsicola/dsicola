# Verificação do fluxo de e-mail

## Resumo

O fluxo de e-mail foi verificado de ponta a ponta. Está **consistente e seguro**; abaixo está o mapa dos pontos críticos e recomendações.

---

## 1. Configuração e envio

| Aspecto | Estado | Detalhe |
|--------|--------|---------|
| **Prioridade de envio** | OK | 1) `RESEND_API_KEY` → API HTTPS Resend (evita timeout em clouds). 2) `SMTP_USER` + `SMTP_PASS` → SMTP. 3) Nenhum → modo simulado (só log). |
| **Remetente** | OK | Um único domínio verificado: `EMAIL_FROM` ou `SMTP_FROM`. Nome da instituição como display: `"Nome da Instituição <noreply@dsicola.com>"`. |
| **Timeout Resend** | OK | 25 s em `sendViaResendApi`; evita bloqueios em produção. |
| **Anexos (Resend)** | OK | Anexos em base64; recibo folha envia PDF corretamente. |

Ficheiro principal: `backend/src/services/email.service.ts` (`sendEmail`, `sendViaResendApi`).

---

## 2. Tipos de e-mail e RBAC

Todos os tipos em `EmailType` têm:

- **Template HTML** em `generateTemplate` (incl. `RECIBO_FOLHA_PAGAMENTO`).
- **Assunto** em `getSubject`.
- **Regra RBAC** em `regrasRBAC` (quem pode receber).

| Tipo | Destinatário típico | RBAC |
|------|--------------------|------|
| `RECIBO_FOLHA_PAGAMENTO` | E-mail do funcionário | `permitidos: []`, `bloqueados: []` → qualquer destinatário (funcionário pode não ter user). |
| `RECUPERACAO_SENHA` / `SENHA_REDEFINIDA` | Qualquer usuário | Sem restrição. |
| `INSTITUICAO_CRIADA` / `CREDENCIAIS_ADMIN` | Admin | Apenas SUPER_ADMIN, ADMIN. |
| `MATRICULA_ALUNO` / `BOLETIM_ESCOLAR` / `NOTA_LANCADA` | Aluno | Apenas ALUNO. |
| `PLANO_ENSINO_ATRIBUIDO` | Professor | Apenas PROFESSOR. |
| Outros | Conforme regra | Ver `validarDestinatarioRBAC`. |

Se o destinatário **não existir** como user (`findFirst` por email), o envio é **permitido** (ex.: recibo para email só de funcionário).

---

## 3. Multi-tenant e segurança

| Ponto | Comportamento |
|-------|----------------|
| **Contexto** | `instituicaoId` vem de `req` (tenant) ou de `options.instituicaoId`. |
| **Bloqueio cross-tenant** | Se user não for SUPER_ADMIN e `instituicaoId` ≠ instituição do user, o envio é bloqueado e `instituicaoId` é corrigido para o do user; tentativa é registada em segurança. |
| **Registo** | Todos os envios (sucesso ou erro) vão para `emails_enviados` com `instituicaoId`. |
| **Auditoria** | `AuditService.log` para EMAIL_SENT / EMAIL_FAILED quando há `req`. |

---

## 4. Fluxos que disparam e-mail

| Fluxo | Onde | Tipo | Observação |
|-------|------|------|------------|
| **Recibo folha (fechar folha)** | `PayrollClosingService.fecharFolha` → `enviarReciboFolhaPorEmail` | RECIBO_FOLHA_PAGAMENTO | Opção "enviar recibo por e-mail"; funcionário precisa de email. |
| **Recibo folha (marcar como pago)** | `PayrollPaymentService.marcarComoPago` → `enviarReciboFolhaPorEmail` | RECIBO_FOLHA_PAGAMENTO | Idem. |
| **Recuperação de senha** | `AuthService.solicitarResetSenha` | RECUPERACAO_SENHA | Link com token. |
| **Senha redefinida por admin** | `AuthService.resetUserPassword` (sendEmail=true) | SENHA_REDEFINIDA | Nova senha no corpo. |
| **Instituição criada** | `InstituicaoController` (onboarding) | INSTITUICAO_CRIADA | Credenciais e URL. |
| **Licença / assinatura** | `license.middleware`, `PagamentoLicencaController`, `AssinaturaController` | ASSINATURA_ATIVADA / EXPIRADA | Conforme evento. |
| **Matrícula** | `MatriculaController` | MATRICULA_ALUNO | Confirmação. |
| **Boletim** | `BoletimController` | BOLETIM_ESCOLAR | Envio ao aluno. |
| **Nota lançada** | `NotaController` | NOTA_LANCADA | Notificação ao aluno. |
| **Plano de ensino** | `PlanoEnsinoController` | PLANO_ENSINO_ATRIBUIDO | Notificação ao professor. |
| **Encerramento / reabertura ano** | `AnoLetivoController`, `ReaberturaAnoLetivoController` | ENCERRAMENTO_ANO_LETIVO / REABERTURA_ANO_LETIVO | Secretaria / admin. |
| **Conta de acesso criada** | `UserAccessController` | CRIACAO_CONTA_ACESSO | Credenciais. |
| **Pagamento confirmado** | `PagamentoController` | PAGAMENTO_CONFIRMADO | Cliente. |
| **Comunicado** | `ComunicacaoService` / controller | COMUNICADO_OFICIAL | Conteúdo variável. |
| **Mensalidade (recibo)** | `MensalidadeController` | PAGAMENTO_CONFIRMADO | Recibo de mensalidade. |

---

## 5. Recibo de folha (detalhe)

- **Serviço:** `reciboFolhaPagamento.service.ts`  
  - `gerarPDFReciboFolha` → PDF (Buffer).  
  - `enviarReciboFolhaPorEmail` → valida folha + email do funcionário, gera PDF, chama `EmailService.sendEmail` com anexo.
- **Condições:** Folha da instituição; funcionário com email; envio não bloqueia fechamento/pagamento.
- **Dados no template:** nomeFuncionario, mesNome, ano, reciboNumero, enderecoInstituicao, nomeInstituicao.
- **Atualização:** Em sucesso, `folhaPagamento.reciboEnviadoEm` e `reciboEnviadoPor` são preenchidos.

---

## 6. Retry de e-mails falhados

- **Serviço:** `emailRetry.service.ts` (`EmailRetryService.processarEmailsFalhados`).
- **Fonte:** `emails_enviados` com `status = 'erro'`, `tentativas < 3`, `proximaTentativa <= agora`.
- **Dados guardados para retry:** `tipo`, `data`, `subject`, `html` (em `dadosEmail`). **Anexos não são guardados.**

**Implicação:** No retry, e-mails com anexos (ex.: RECIBO_FOLHA_PAGAMENTO) são reenviados **sem anexo**. Para recibos, o utilizador deve voltar a solicitar "Enviar recibo por e-mail" na UI se o primeiro envio falhar.

---

## 7. Checklist produção

- [ ] `RESEND_API_KEY` definida (Recomendado) **ou** `SMTP_USER` + `SMTP_PASS`.
- [ ] `EMAIL_FROM` (ou `SMTP_FROM`) com domínio verificado no Resend (ex.: `noreply@dsicola.com`).
- [ ] Domínio verificado em [resend.com/domains](https://resend.com/domains).
- [ ] Testar envio real (ex.: script `test-email-fluxo.ts` ou fluxo de recibo na UI).
- [ ] Consultar `emails_enviados` para confirmar `status = 'enviado'` ou diagnosticar `erro`.

---

## 8. Teste rápido

```bash
# Backend a correr; variáveis de email configuradas
cd backend && npx tsx scripts/test-email-fluxo.ts
```

O script cobre: pedido de reset de senha, registo em `emails_enviados`, confirmação de reset e login.
