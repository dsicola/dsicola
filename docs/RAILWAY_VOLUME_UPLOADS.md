# Uploads de Logo, Favicon e Capa no Railway

## Solução 1: Armazenamento no Banco (recomendado, sem volume)

Desde 2026-02, logo, favicon e capa podem ser salvos **diretamente no PostgreSQL**.
Não é necessário configurar volume nem S3.

- Os arquivos são gravados nas colunas `logo_data`, `imagem_capa_login_data`, `favicon_data` (BYTEA)
- Funciona em Railway, Vercel e qualquer host sem disco persistente
- Tamanho máximo: 1MB por arquivo

## Solução 2: Volume Persistente (opcional)

Se preferir usar disco em vez do banco:

### Configurar o volume

1. Abra o projeto no [Railway Dashboard](https://railway.app/dashboard)
2. Na **área do projeto** (canvas à esquerda, onde vê os blocos "dsicola" e "Postgres")
3. No bloco do serviço **dsicola** (backend):
   - **Clique com o botão direito** no bloco, **ou**
   - Clique no menu **⋯** (três pontos) do bloco
4. Selecione **Attach Volume**
5. **Mount Path**: `/app/uploads`
6. Defina o tamanho (ex.: 1GB) e salve
7. Faça um **Redeploy** do serviço

> **Nota:** O volume não fica em Settings. A opção fica no menu de contexto do bloco do serviço.

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
