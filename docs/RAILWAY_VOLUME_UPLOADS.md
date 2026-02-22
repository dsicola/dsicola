# Volume Persistente para Uploads no Railway

Para que logo, favicon e imagem de capa **persistam** entre deploys no Railway (sem S3/R2):

## Configurar o volume

1. Abra o projeto no [Railway Dashboard](https://railway.app/dashboard)
2. Clique no serviço do **backend** (API)
3. Vá em **Settings** → **Volumes**
4. Clique em **Add Volume** (ou **+ New Volume**)
5. **Mount Path**: `/app/uploads`
6. Salve

## Por que funciona

- O backend grava arquivos em `process.cwd()/uploads` = `/app/uploads`
- O volume do Railway persiste essa pasta entre deploys e reinícios
- Limites do plano (ver [docs](https://docs.railway.app/deploy/volumes)):
  - **Hobby**: 5GB
  - **Pro**: até 50GB (ou mais)

## Alternativa: variável de ambiente

Se o volume não funcionar (por exemplo, em plano Free sem volumes), Railway pode fornecer:
- `RAILWAY_VOLUME_MOUNT_PATH` – path de montagem (quando o volume existe)

## Deploy

Após criar o volume, faça um novo deploy. Os uploads passam a persistir.
