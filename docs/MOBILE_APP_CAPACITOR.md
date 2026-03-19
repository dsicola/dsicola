# App móvel DSICOLA (iOS e Android) — Capacitor

O frontend React partilha o mesmo código com a **app nativa**: o Capacitor embute o build (`dist/`) em projetos Xcode (iOS) e Android Studio (Android).

## Requisitos

- **Node** (como no resto do projeto)
- **iOS**: macOS, **Xcode** e **CocoaPods** (obrigatório para `npx cap add ios`):
  - `brew install cocoapods` ou `sudo gem install cocoapods`
  - Na primeira vez: `cd frontend && npx cap add ios && npx cap sync`
  - Depois: `npm run cap:ios` (abre o Xcode; no projeto iOS pode ser necessário `pod install` em `ios/App` se o Capacitor pedir)
- **Android**: Android Studio, SDK, variável `ANDROID_HOME` configurada — a pasta `frontend/android/` já está no repositório após o setup inicial; use `npm run cap:android`.

## Comandos úteis (na pasta `frontend/`)

| Comando | Descrição |
|--------|-----------|
| `npm run build` | Build **web** normal (com PWA) — inalterado |
| `npm run build:mobile` | Build para empacotar na app (sem Service Worker PWA) |
| `npm run cap:sync` | `build:mobile` + copia ficheiros para `ios/` e `android/` |
| `npm run cap:ios` | Sync + abre Xcode |
| `npm run cap:android` | Sync + abre Android Studio |

## URL da API na app

No **browser**, a API pode ser o mesmo domínio ou `localhost`. Na **app nativa**, a “origem” não é o servidor do backend.

1. **Produção**: defina `VITE_API_URL` com a URL **HTTPS** pública do backend (ex.: `https://api.instituicao.ao`) antes do build:
   - Copie `frontend/mobile.env.example` para `frontend/.env.production` e ajuste, ou
   - Na CI: `VITE_API_URL=https://... npm run build:mobile`

2. **Desenvolvimento com telemóvel na rede**: no PC, o backend em `localhost:3001` não é o mesmo que no telemóvel. Use o IP da máquina na LAN:
   - `VITE_CAPACITOR_DEV_API_HOST=192.168.x.x` no `.env.local` (modo dev)
   - Garanta que o backend aceita pedidos dessa origem (CORS / firewall)

## CORS e cookies

O backend deve permitir o **origin** da app ou pedidos com credenciais conforme a vossa configuração atual (`withCredentials: true` no axios). Em produção, use sempre HTTPS.

## Publicação nas lojas

1. Ajustar **app id** se necessário: `frontend/capacitor.config.ts` → `appId` (ex.: `com.instituicao.dsicola`).
2. Ícones e splash: pode usar `@capacitor/assets` ou substituir recursos em `ios` / `android` após `cap sync`.
3. **Apple**: conta de developer, certificados, App Store Connect.
4. **Google**: conta Play Console, assinatura do APK/AAB.

## O que não muda

- **Backend** e **API REST** mantêm-se iguais.
- **`npm run dev`** e **`npm run build`** para o site continuam como antes; só o build móvel usa `CAPACITOR_WEB_BUILD=true` para desativar o plugin PWA no bundle da WebView.
