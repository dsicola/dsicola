# 🔧 Solução: Página Branca (Sistema Não Abre)

## ❌ Problema

O sistema em **colegiodorianadealves.dsicola.com** (ou outro subdomínio) abre mas fica com a página completamente branca, sem conteúdo nem indicador de carregamento.

---

## 🔍 Diagnóstico Passo a Passo

### 1. Abrir as Ferramentas de Desenvolvedor

1. Pressione **F12** (ou clique direito → "Inspecionar")
2. Abra o separador **Console**
3. Procure por erros em vermelho

**O que verificar:**
- `Failed to load resource` (404) → ficheiros JS/CSS não encontrados
- `ERR_NETWORK` ou `Network Error` → API inacessível
- `Uncaught SyntaxError` → erro no bundle JavaScript
- `Uncaught ReferenceError` → módulo ou variável não encontrada

### 2. Abrir o separador Network (Rede)

1. Na DevTools, abra o separador **Network**
2. Recarregue a página (F5)
3. Verifique se os ficheiros `.js` e `.css` carregam com estado **200** (OK) ou **404** (Not Found)

**Se vir 404 nos ficheiros .js:**
- O deploy pode estar a servir a pasta errada (deve ser `dist/` e não `src/`)
- Ou o `base` no Vite está incorreto para o domínio

### 3. Verificar a configuração da API

No **Console**, depois da página carregar, execute:
```javascript
// Ver URL da API
console.log('API base:', document.querySelector('script[src*="index"]')?.src?.replace(/\/[^/]+$/, ''));
```

Em produção, o frontend usa **same-origin** – a API deve estar no mesmo domínio (ex: `https://colegiodorianadealves.dsicola.com/api`). Se o backend estiver noutro URL, pode haver bloqueio CORS ou falha de rede.

---

## ✅ Causas Comuns e Soluções

### Causa 1: Deploy a servir ficheiros errados

**Problema:** O servidor web está a servir o `index.html` do repositório em vez do `index.html` gerado pelo build.

**Solução:** Garantir que o deploy copia a pasta `frontend/dist/` após `npm run build`. O ficheiro `index.html` em `dist/` contém as referências corretas aos bundles (ex: `/assets/index-XXX.js`).

### Causa 2: Base path incorreto

**Problema:** A aplicação está em `https://dsicola.com/app/` mas os assets são pedidos em `https://dsicola.com/assets/`.

**Solução:** Definir `base: '/app/'` no `vite.config.ts` e reconstruir:
```ts
export default defineConfig({
  base: '/app/',  // se a app estiver em /app/
  // ...
});
```

### Causa 3: API inacessível ou timeout

**Problema:** O `TenantProvider` faz fetch a `/api/instituicoes/subdominio/colegiodorianadealves`. Se a API falhar ou demorar, o loading pode ficar indefinido (ou mostrar erro).

**Solução:**
- Verificar se o backend está a correr e acessível
- Verificar se o reverse proxy (Nginx, etc.) encaminha `/api/*` para o backend
- Verificar CORS no backend para o domínio do frontend

### Causa 4: Instituição não encontrada

**Problema:** O subdomínio `colegiodorianadealves` não existe ou está inativo na base de dados.

**Solução:** Verificar na base de dados se existe uma instituição com `subdominio = 'colegiodorianadealves'` e `status = 'ativa'`.

### Causa 5: Erro de JavaScript antes do React montar

**Problema:** Um erro em `main.tsx`, `i18n`, `sentry` ou noutro import inicial impede o React de montar.

**Solução:** Consultar o Console para identificar o ficheiro e a linha do erro, e corrigir o código ou dependências.

---

## 📋 Checklist Rápido

- [ ] Console do navegador sem erros em vermelho
- [ ] Network: ficheiros `.js` e `.css` com estado 200
- [ ] Backend a responder em `https://[subdominio].dsicola.com/api/health`
- [ ] Instituição com subdomínio correto e status ativo na BD
- [ ] Reverse proxy a encaminhar `/api` para o backend

---

## ⚠️ Nota sobre Fallback

Foi testado um fallback visual no `index.html` (spinner + "Carregando...") que causou o sistema a ficar preso nesse estado. Foi revertido. Se a página fica branca, siga o diagnóstico acima.

---

## 📞 Informação para Suporte

Ao reportar o problema, envie:
1. Captura de ecrã do **Console** (erros)
2. Captura de ecrã do **Network** (estado dos requests)
3. URL exata que está a falhar
4. Se funciona noutro navegador ou em janela anónima
