# Serviço de Integração Biométrica - DSICOLA

Serviço dedicado para integração com dispositivos biométricos (ZKTeco, Hikvision, Suprema).

## Arquitetura

```
Dispositivo Biométrico → Serviço de Integração → DSICOLA Backend API
```

O serviço escuta eventos dos dispositivos e converte para o formato padrão do DSICOLA.

## Instalação

```bash
npm install
```

## Configuração

Copie `.env.example` para `.env` e configure:

```env
DSICOLA_API_URL=http://localhost:3000
DSICOLA_API_KEY=seu-token-aqui

# Configuração do servidor
PORT=3001
NODE_ENV=development
```

## Uso

```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

## Providers Suportados

- **ZKTeco**: Via TCP/IP e SDK
- **Hikvision**: Via ISAPI/HTTP
- **Suprema**: Via BioStar API

## Estrutura

```
biometric-integration-service/
├── src/
│   ├── providers/
│   │   ├── BaseBiometricProvider.ts      # Classe abstrata base
│   │   ├── ZKTecoProvider.ts             # Implementação ZKTeco
│   │   ├── HikvisionProvider.ts          # Implementação Hikvision
│   │   └── SupremaProvider.ts            # Implementação Suprema
│   ├── services/
│   │   ├── EventProcessor.ts             # Processa eventos recebidos
│   │   └── DSICOLAClient.ts              # Cliente para API do DSICOLA
│   ├── types/
│   │   └── biometric.ts                  # Tipos TypeScript
│   └── index.ts                          # Entry point
└── package.json
```

