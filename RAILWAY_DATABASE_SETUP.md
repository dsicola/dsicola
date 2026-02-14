# Configurar DATABASE_URL no Railway

O erro "DATABASE_URL não definida" indica que o Railway **não está** a passar a variável ao serviço dsicola.

## Solução: Usar Referência de Variável

No Railway, as variáveis do Postgres são ligadas via **referência**, não por cópia.

### Passos (no painel Railway)

1. Abra o seu projeto e clique no serviço **dsicola** (o backend).
2. Vá à aba **Variables**.
3. Clique em **+ New Variable** ou **Add Variable**.
4. Em **Variable Name**, escreva exatamente: `DATABASE_URL`
5. Em **Value**, escreva exatamente (substitua `Postgres` se o seu serviço tiver outro nome):
   ```
   ${{Postgres.DATABASE_URL}}
   ```
   - O nome do serviço deve ser igual ao que aparece na barra lateral (ex: `Postgres`, `PostgreSQL`, etc.).
6. Guarde (Apply / Save).
7. Faça **Deploy** ou **Redeploy** para aplicar as alterações.

### Se o serviço não se chamar "Postgres"

Se o nome do seu banco for outro (ex: `postgres`, `PostgreSQL`, `banco`), use esse nome na referência:

| Nome do serviço na barra lateral | Value a usar |
|----------------------------------|---------------|
| Postgres                         | `${{Postgres.DATABASE_URL}}` |
| postgres                         | `${{postgres.DATABASE_URL}}` |
| PostgreSQL                       | `${{PostgreSQL.DATABASE_URL}}` |

### Verificar

Depois de guardar, em **Variables** deve aparecer algo como:
- `DATABASE_URL` → `${{Postgres.DATABASE_URL}}` (ou referência similar)

Não é para ver a URL completa; o Railway resolve a referência quando o serviço arranca.

### Alternativa: variável pública

Se a referência privada não funcionar, pode usar a URL pública:

```
DATABASE_URL = ${{Postgres.DATABASE_PUBLIC_URL}}
```

---

**Importante:** Não coloque a URL do banco diretamente no valor. Use sempre a sintaxe `${{NomeDoServiço.NOME_DA_VARIAVEL}}`.
