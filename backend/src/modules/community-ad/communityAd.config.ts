/**
 * Configuração da monetização “publicidade na Comunidade / vitrine Social”.
 *
 * **COMMUNITY_PUBLICIDADE_OBRIGATORIA** (env):
 * - `true` | `1` | `yes` — exige campanha **APROVADA** em vigência para:
 *   - criar ou tornar público um post Social (`isPublic`);
 *   - aparecer no feed público da vitrine (filtragem por instituição).
 * - omitido ou `false` — mantém apenas a regra de plano activo existente
 *   (`institutionVisibleInCommunityWhere`), sem bloqueio por campanha paga.
 *
 * O destaque no diretório (`DESTAQUE_DIRETORIO` / `BOTH`) funciona **sempre** que houver
 * campanha aprovada em vigência (independente desta flag), para não afectar listagens
 * quando a flag está desligada — apenas o badge “Patrocinado” deixa de ter critérios alternativos.
 */
export function isCommunityPublicidadeObrigatoria(): boolean {
  const v = process.env.COMMUNITY_PUBLICIDADE_OBRIGATORIA?.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}
