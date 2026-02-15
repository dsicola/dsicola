# Atualização: Fluxo Comercial e Subdomínios

Checklist para aplicar todas as alterações recentes e refletir em dev/produção.

---

## Alterações feitas (resumo)

| Área | Alteração |
|------|-----------|
| **Fluxo comercial** | Email `ASSINATURA_ATIVADA` ao confirmar pagamento, com URL de acesso e instruções |
| **Lead → Instituição** | Botão "Criar Instituição a partir do Lead" em leads convertidos |
| **Gateways** | Estrutura para Angola (MULTICAIXA, PAYMENTE) e internacional (STRIPE, PAYPAL, TAZAPAY) |
| **CORS** | Aceita subdomínios `*.dsicola.com` |
| **Subdomínios** | URLs nos emails baseadas em `PLATFORM_BASE_DOMAIN` |
| **Manual Super Admin** | Secção 11 ampliada (abas, fluxo comercial, onboarding, leads, planos, gateways) |

---

## 1. Variáveis de ambiente (Backend)

Adicionar no `.env` local e nas variáveis do Railway/host do backend:

```env
PLATFORM_BASE_DOMAIN=dsicola.com
```

Em produção, `FRONTEND_URL` deve incluir o domínio principal (ex: `https://app.dsicola.com`).

---

## 2. Commit e Push

```bash
git status
git add .
git commit -m "feat: fluxo comercial completo, subdomínios, lead→instituição, gateways"
git push origin main
```

---

## 3. Deploy

- **Backend (Railway/etc.):** Deploy automático após push (se CI/CD configurado) ou deploy manual
- **Frontend (Vercel):** Deploy automático após push
- Verificar que `PLATFORM_BASE_DOMAIN=dsicola.com` está nas variáveis de ambiente do backend em produção

---

## 4. Documentação relacionada

| Documento | Propósito |
|-----------|-----------|
| `docs/CONFIGURACAO_SUBDOMINIOS_PRODUCAO.md` | DNS, Vercel, backend – subdomínios |
| `docs/ATUALIZACAO_FLUXO_COMERCIAL.md` | Este checklist de atualização |

---

## 5. Testes

Para validar o fluxo comercial localmente:

```bash
cd backend
npm run test:fluxo-comercial
```

---

## 6. Arquivos alterados/criados

### Backend
- `src/controllers/pagamentoLicenca.controller.ts` – email em `confirmarPagamento` e webhook
- `src/services/email.service.ts` – templates `INSTITUICAO_CRIADA`, `ASSINATURA_ATIVADA` com URL
- `src/controllers/lead.controller.ts` – `update` com campos permitidos
- `src/services/gateway.service.ts` – enums Angola/Internacional
- `src/app.ts` – CORS para `*.dsicola.com`
- `src/middlewares/errorHandler.ts` – CORS em erros
- `scripts/test-fluxo-comercial-completo.ts` – script de teste
- `package.json` – script `test:fluxo-comercial`

### Frontend
- `src/components/superadmin/LeadsTab.tsx` – botão "Criar Instituição a partir do Lead"
- `src/components/superadmin/OnboardingInstituicaoForm.tsx` – preenchimento via `?fromLead=leadId`
- `src/services/api.ts` – `leadsApi.getById`
- `src/utils/systemManualGenerator.ts` – secção 11 Super Admin

### Docs
- `docs/CONFIGURACAO_SUBDOMINIOS_PRODUCAO.md` – guia subdomínios
- `docs/ATUALIZACAO_FLUXO_COMERCIAL.md` – este checklist
