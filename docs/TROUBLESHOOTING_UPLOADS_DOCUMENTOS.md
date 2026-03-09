# Resolução de Problemas: Uploads e Documentos

## Por que os ficheiros abrem em `dsicola-production.up.railway.app` e não no subdomínio?

### Arquitetura

| Componente | URL | Função |
|------------|-----|--------|
| **Backend (API)** | `dsicola-production.up.railway.app` | Serve a API, ficheiros (uploads), e signed URLs |
| **Frontend** | `escola.dsicola.com` (subdomínio) ou `app.dsicola.com` | Aplicação React (SPA) |

**Comportamento esperado:** Quando abre um comprovativo ou documento, o link aponta sempre para o **backend** (onde os ficheiros estão). Isso é correto.

- **Instituição** (subdomínio): Frontend em `escola.dsicola.com` → ao clicar "Ver comprovativo", abre `dsicola-production.up.railway.app/storage/file/...`
- **Super-admin** (domínio principal): Frontend em `app.dsicola.com` → ao clicar, abre o **mesmo** `dsicola-production.up.railway.app/storage/file/...`

O backend é o servidor de ficheiros. O subdomínio serve apenas a interface. Por isso, o domínio do link é sempre o do backend.

---

## Erro "File not found" / "Arquivo não encontrado"

### Causa 1: Volume não montado no Railway

Sem volume persistente, os uploads são **efémeros** – perdem-se em cada deploy ou reinício.

**Solução:** Configurar volume conforme [RAILWAY_VOLUME_UPLOADS.md](./RAILWAY_VOLUME_UPLOADS.md):

1. Railway Dashboard → bloco do serviço **dsicola**
2. Menu ⋯ → **Attach Volume**
3. Mount Path: `/app/uploads`
4. Redeploy

### Causa 2: Path truncado na URL

Se a URL mostrar `path=669440c3-639e-4876-94e9` (incompleto), o path pode estar a ser cortado.

- Verificar se o `comprovativoUrl` na base de dados está completo
- URLs muito longas (token JWT) podem ser truncadas em alguns contextos

### Causa 3: Documentos Aluno – URL incorreta

Se aparecer `/documentos-aluno/xxx/arquive` em vez de `/arquivo`, é um typo. A rota correta é `/arquivo` (com "o").

---

## OpaqueResponseBlocking (consola do browser)

Este aviso surge em pedidos cross-origin (frontend num domínio, ficheiro noutro) quando a resposta não tem cabeçalhos CORS adequados.

**Verificar:** O backend deve enviar `Access-Control-Allow-Origin` para o domínio do frontend. A configuração CORS em `app.ts` já trata disso; confirmar que `FRONTEND_URL` inclui o subdomínio da instituição.

---

## Resumo

1. **Domínio:** O link abrir no backend (`dsicola-production`) é o comportamento esperado.
2. **"File not found":** Na maioria dos casos, falta volume persistente no Railway.
3. **Subdomínio vs domínio principal:** A URL do ficheiro é sempre a do backend; o que muda é só o domínio da aplicação (frontend).
