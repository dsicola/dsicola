/** Rótulo consistente para select de plano de ensino (disciplina · professor · semestre no superior). */
export function labelPlanoEnsino(p: unknown, isSecundario: boolean): string {
  const o = p as {
    disciplina?: { nome?: string };
    professor?: { user?: { nomeCompleto?: string } };
    semestre?: number | null;
  };
  const disc = o?.disciplina?.nome || 'Disciplina';
  const prof = o?.professor?.user?.nomeCompleto;
  const sem = !isSecundario && o?.semestre != null ? ` · S${o.semestre}` : '';
  return `${disc}${prof ? ` · ${prof}` : ''}${sem}`;
}
