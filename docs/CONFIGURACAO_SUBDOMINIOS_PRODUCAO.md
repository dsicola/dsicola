# Configuração de Subdomínios em Produção

Como fazer cada instituição acessar o DSICOLA pelo seu próprio subdomínio após cadastro ou conversão de lead.

---

## Resumo: O que precisa estar configurado

| Passo | Onde | O quê |
|-------|------|-------|
| 1 | DNS | Wildcard `*.dsicola.com` → frontend |
| 2 | Frontend (Vercel/Netlify) | Adicionar domínio `*.dsicola.com` |
| 3 | Backend | `PLATFORM_BASE_DOMAIN=dsicola.com` e CORS atualizado |
| 4 | Backend | `FRONTEND_URL` com app.dsicola.com (já suporta subdomínios) |

**Não é preciso criar subdomínios manualmente.** Quando você cadastra uma instituição com subdomínio `escola`, o acesso `https://escola.dsicola.com` funciona automaticamente após a configuração abaixo.

---

## 1. DNS – Subdomínio curinga (*)

Para que `escola.dsicola.com`, `universidade.dsicola.com`, etc. funcionem sem cadastrar cada um no DNS, use **wildcard**:

### Opção A: Vercel (Recomendado – DNS incluso)

1. No painel da Vercel → seu projeto → **Settings** → **Domains**
2. Adicione: `*.dsicola.com`
3. A Vercel pede para usar os **nameservers da Vercel**:
   - `ns1.vercel-dns.com`
   - `ns2.vercel-dns.com`
4. No registrador do domínio (ex: GoDaddy, Namecheap, Cloudflare), altere os nameservers para os da Vercel
5. Adicione também `app.dsicola.com` (ou `admin.dsicola.com`) se quiser o portal principal em subdomínio

### Opção B: DNS manual (Cloudflare, etc.)

Se o DNS não for gerenciado pela Vercel:

| Tipo | Nome | Valor (exemplo) |
|------|------|-----------------|
| CNAME | `*` | `cname.vercel-dns.com` (valor indicado pela Vercel) |
| CNAME | `app` | `cname.vercel-dns.com` |

**Importante:** Nem todos os provedores aceitam CNAME com `*`. A Vercel recomenda usar os nameservers dela para wildcards.

---

## 2. Frontend – Domínio curinga na hospedagem

### Vercel

1. **Settings** → **Domains** → **Add**
2. Digite: `*.dsicola.com`
3. Confirme a verificação (geralmente automática com nameservers da Vercel)
4. O mesmo build do frontend atende **todos** os subdomínios

### Netlify

1. **Domain settings** → **Add domain** → **Add subdomain**
2. Digite: `*.dsicola.com`
3. Siga as instruções de DNS

### Railway

O Railway também permite wildcard; configure conforme a documentação de custom domains.

---

## 3. Backend – Variáveis de ambiente

No Railway (ou onde o backend estiver):

| Variável | Valor | Descrição |
|----------|-------|-----------|
| `PLATFORM_BASE_DOMAIN` | `dsicola.com` | Domínio raiz. CORS permite `*.dsicola.com` automaticamente |
| `FRONTEND_URL` | `https://app.dsicola.com` | | 
| `CORS_ORIGIN` | (opcional) | Se usar, inclua `https://app.dsicola.com` |

O backend já está preparado para aceitar requisições de:
- `https://app.dsicola.com` (portal principal)
- `https://admin.dsicola.com` (se usar)
- `https://QUALQUERSUB.dsicola.com` (cada instituição)

---

## 4. Fluxo completo em produção

1. **Super Admin** cria instituição no Onboarding (ou a partir de lead convertido).
2. Define o subdomínio (ex: `escola`, `uniluas`).
3. A instituição é criada no banco com `subdominio: 'escola'`.
4. O admin recebe email com: `https://escola.dsicola.com/auth`
5. Ao acessar:
   - O frontend carrega em `escola.dsicola.com`
   - O JavaScript lê `window.location.hostname` → `escola.dsicola.com`
   - Extrai o subdomínio `escola`
   - Chama `GET /instituicoes/subdominio/escola` (API pública)
   - Recebe os dados da instituição
   - O login usa o JWT com `instituicaoId` e filtra os dados

**Nada mais precisa ser configurado por instituição.** O subdomínio é apenas o valor cadastrado no onboarding.

---

## 5. Testar localmente

Em desenvolvimento, subdomínios não funcionam em `localhost`. Use o parâmetro de query:

```
http://localhost:5173?subdomain=escola
```

O `useSubdomain` trata `?subdomain=escola` e simula o subdomínio.

---

## 6. Checklist final

- [ ] DNS: `*.dsicola.com` apontando para o frontend
- [ ] Frontend: domínio `*.dsicola.com` adicionado e verificado
- [ ] Backend: `PLATFORM_BASE_DOMAIN=dsicola.com`
- [ ] Backend: `FRONTEND_URL` com URL do app principal
- [ ] Emails: `PLATFORM_BASE_DOMAIN` usado para gerar URLs nos emails (ASSINATURA_ATIVADA, INSTITUICAO_CRIADA)

---

## 7. Troubleshooting

### "Instituição não encontrada" ao acessar escola.dsicola.com

- Confirme que a instituição existe no banco com `subdominio = 'escola'`
- Verifique se o status da instituição é `ativa`

### CORS bloqueado em subdomínio

- Confirme `PLATFORM_BASE_DOMAIN=dsicola.com` no backend
- Reinicie o backend após alterar variáveis
- Verifique os logs: `[CORS] Allowed origins` deve indicar suporte a `*.dsicola.com`

### Subdomínio não resolve (DNS)

- A propagação pode levar até 48h
- Use `dig escola.dsicola.com` ou [dnschecker.org](https://dnschecker.org) para verificar
