/** Rótulo consistente para select de plano de ensino (disciplina · classe/ano no sec. · professor · semestre no sup.). */
export function labelPlanoEnsino(p: unknown, isSecundario: boolean): string {
  const o = p as {
    disciplina?: { nome?: string };
    professor?: { user?: { nomeCompleto?: string } };
    semestre?: number | null;
    classe?: { nome?: string };
    classeOuAno?: string | null;
  };
  const disc = o?.disciplina?.nome || 'Disciplina';
  const prof = o?.professor?.user?.nomeCompleto;
  const sem = !isSecundario && o?.semestre != null ? ` · S${o.semestre}` : '';
  const classeBit = isSecundario
    ? (() => {
        const c = String(o?.classe?.nome || o?.classeOuAno || '').trim();
        return c ? ` · ${c}` : '';
      })()
    : '';
  return `${disc}${classeBit}${prof ? ` · ${prof}` : ''}${sem}`;
}
