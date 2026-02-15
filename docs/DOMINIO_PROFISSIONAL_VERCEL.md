# Domínio Profissional na Vercel

Trocar `dsicola-tsx2.vercel.app` por um domínio próprio como `dsicola.com` ou `www.dsicola.com`.

---

## Passos na Vercel

### 1. Abrir as configurações de domínio

1. Aceda ao painel [Vercel](https://vercel.com) → projeto **dsicola-tsx2**
2. **Settings** → **Domains**

### 2. Adicionar domínio próprio

Na secção **Domains**, clique em **Add** e adicione:

| Domínio           | Uso              |
|-------------------|------------------|
| `dsicola.com`     | Domínio principal (apex) |
| `www.dsicola.com` | Alternativa com www     |

### 3. Configurar DNS

A Vercel mostra as instruções exatas. Em geral:

**Se usar os nameservers da Vercel (recomendado):**
- No registrador (GoDaddy, Namecheap, Cloudflare, etc.) altere os nameservers para:
  - `ns1.vercel-dns.com`
  - `ns2.vercel-dns.com`
- A Vercel passa a gerir todo o DNS; os domínios são verificados automaticamente.

**Se manter DNS noutro provedor:**
- Para **dsicola.com** (apex): CNAME ou A record conforme indicado pela Vercel
- Para **www.dsicola.com**: CNAME `www` → `cname.vercel-dns.com` (valor exato mostrado pela Vercel)

### 4. Definir domínio primário

Depois de `dsicola.com` e `www.dsicola.com` estarem verificados:

1. Em **Domains**, marque `dsicola.com` como **Primary**
2. Opcionalmente configure redirect: `www.dsicola.com` → `dsicola.com` (ou o contrário)

---

## Resultado

| Antes                         | Depois                 |
|------------------------------|------------------------|
| `https://dsicola-tsx2.vercel.app` | `https://dsicola.com`      |
| `https://dsicola-tsx2.vercel.app/vendas` | `https://dsicola.com/vendas` ou `https://dsicola.com` |

---

## Subdomínios (instituições)

O wildcard `*.dsicola.com` já deve estar configurado (conforme `CONFIGURACAO_SUBDOMINIOS_PRODUCAO.md`). Com isso:

- `https://dsicola.com` → landing principal
- `https://escola.dsicola.com` → instituição "escola"
- `https://universidade.dsicola.com` → instituição "universidade"

---

## Atualizar variáveis de ambiente

Após o domínio estar ativo:

1. **Backend (Railway):** `FRONTEND_URL` deve incluir os novos domínios:
   ```
   https://dsicola.com,https://www.dsicola.com,https://dsicola-tsx2.vercel.app
   ```

2. **Backend:** `PLATFORM_BASE_DOMAIN=dsicola.com` (já deve estar definido)

---

## Verificação

Depois da propagação DNS (até 48h, geralmente minutos):

- `https://dsicola.com` → deve abrir a landing page
- `https://dsicola.com/auth` → deve abrir o login
- A barra de endereço mostra `dsicola.com` em vez de `dsicola-tsx2.vercel.app`
