# Gerar Exigências AGT — Instituição em Produção

**Duas formas** de gerar todos os documentos exigidos pela AGT:

---

## Opção 1: Botão na interface (recomendado)

1. Faça login como **ADMIN** ou **FINANCEIRO** da instituição
2. Aceda a **Documentos Fiscais** (menu lateral)
3. Clique no botão **"Gerar todos AGT"** no canto superior direito
4. Aguarde a mensagem de sucesso

---

## Opção 2: Script na consola do browser

1. Faça login no DSICOLA como **ADMIN** da instituição
2. Abra a consola do browser (F12 → aba Console, ou Cmd+Option+J no Mac)
3. Cole o script completo abaixo e prima Enter
4. Aguarde a mensagem de sucesso

---

## Script (copie tudo)

```javascript
(async function gerarExigenciasAGT() {
  const token = localStorage.getItem('accessToken');
  if (!token) {
    console.error('❌ Não está autenticado. Faça login como ADMIN da instituição.');
    return;
  }
  const apiUrl = window.__DSICOLA_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? (window.location.protocol + '//' + window.location.hostname + ':3001') 
    : window.location.origin);
  const url = apiUrl.replace(/\/$/, '') + '/agt/gerar-certificacao-completo';
  console.log('🔄 A gerar documentos AGT...', url);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('❌ Erro:', data?.message || data?.error || res.statusText);
      return;
    }
    console.log('✅', data.mensagem || 'Documentos AGT criados com sucesso.');
    console.log('📋 Próximos passos: Documentos Fiscais → Lista | Exportar SAFT | Gerar PDFs | Enviar à AGT');
  } catch (e) {
    console.error('❌ Erro de rede:', e.message);
  }
})();
```

---

## Se a API estiver noutro URL

Se o backend estiver noutro domínio/porta, defina antes de colar:

```javascript
window.__DSICOLA_API_URL = 'https://api.seudominio.com';  // ou http://localhost:3001
```

Depois cole o script principal.

---

## Requisitos

- Login como **ADMIN**, **FINANCEIRO** ou **SUPER_ADMIN** da instituição
- NIF configurado em Configurações → Dados Fiscais
- O script usa automaticamente os **2 meses anteriores** ao mês atual (exigência AGT)
