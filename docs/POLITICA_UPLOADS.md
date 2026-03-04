# Política de Uploads - DSICOLA

Limites e tipos de ficheiros permitidos para conformidade e segurança.

---

## 1. Limites por Tipo

| Tipo | Tamanho máximo | Formatos | Config |
|------|----------------|----------|--------|
| **Logo/Capa/Favicon** (config instituição) | 1 MB | JPG, PNG (logo/capa); PNG, ICO, SVG (favicon) | `configuracaoInstituicao.routes` |
| **Upload geral** (storage) | 10 MB | Configurável | `storage.routes` |
| **Backup** (upload para restore) | 500 MB | SQL, JSON | `upload.middleware` |
| **Comunicados** (anexos) | 5 MB | PDF, imagens | `comunicadoUpload.middleware` |
| **Chat** (ficheiros) | 10 MB | Imagens, PDF, docs | `chatUpload.middleware` |
| **Documentos aluno/funcionário** | 10 MB | PDF, imagens | Controllers |

---

## 2. Validações

- **Tipo MIME:** Verificação de tipo permitido
- **Extensão:** Validação de extensão em alguns fluxos
- **Tamanho:** Rejeição imediata se exceder limite (multer `limits`)

---

## 3. Armazenamento

- **Produção (Railway):** Volume persistente em `/data` para backups; uploads em `./uploads` ou volume
- **Desenvolvimento:** `./uploads`, `./backups`

---

## 4. Segurança

- Uploads servidos com autenticação (exceto assets públicos como logo no login)
- Nomes de ficheiro sanitizados
- Sem execução de ficheiros no servidor

---

*Documento no âmbito do [ROADMAP-100.md](./ROADMAP-100.md) e [PERFORMANCE_CHECKLIST.md](./PERFORMANCE_CHECKLIST.md).*
