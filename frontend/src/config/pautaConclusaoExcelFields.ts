/**
 * Campos de mapeamento Excel — Pauta de Conclusão (PAUTA_CONCLUSAO).
 * Alinhados a `getValueByPath` no backend (nota.MAC1 … nota.NPT3 …).
 * Sufixo 1 / 2 / 3 = 1.º, 2.º e 3.º trimestre (modelo angolano).
 */

export type CampoMapeamentoExcel = { value: string; label: string };

/** Notas por disciplina: use com coluna «Disciplina» preenchida na lista de alunos. */
export const CAMPOS_NOTA_PAUTA_CONCLUSAO: CampoMapeamentoExcel[] = [
  // 1.º trimestre
  { value: "nota.MAC1", label: "1.º trimestre — MAC (média avaliação contínua)" },
  { value: "nota.NPP1", label: "1.º trimestre — NPP (nota prova do professor)" },
  { value: "nota.NPT1", label: "1.º trimestre — NPT (nota prova trimestral)" },
  // 2.º trimestre
  { value: "nota.MAC2", label: "2.º trimestre — MAC (média avaliação contínua)" },
  { value: "nota.NPP2", label: "2.º trimestre — NPP (nota prova do professor)" },
  { value: "nota.NPT2", label: "2.º trimestre — NPT (nota prova trimestral)" },
  // 3.º trimestre
  { value: "nota.MAC3", label: "3.º trimestre — MAC (média avaliação contínua)" },
  { value: "nota.NPP3", label: "3.º trimestre — NPP (legado)" },
  { value: "nota.NPT3", label: "3.º trimestre — NPT (legado / sinónimo de exame)" },
  { value: "nota.EN", label: "3.º trimestre — EN (exame nacional — mini-pauta oficial)" },
  // Médias trimestrais
  { value: "nota.MT1", label: "1.º trimestre — MT (média trimestral)" },
  { value: "nota.MT2", label: "2.º trimestre — MT (média trimestral)" },
  { value: "nota.MT3", label: "3.º trimestre — MT (média trimestral)" },
  // Classificação final / exame
  { value: "nota.EX", label: "Exame (EX)" },
  { value: "nota.MFD", label: "MFD (média final da disciplina)" },
  { value: "nota.CFD", label: "CFD (classificação final da disciplina)" },
  { value: "nota.HA", label: "HA" },
  { value: "nota.NPG", label: "NPG" },
  { value: "nota.CA", label: "CA / aproveitamento (legado — ver documentação)" },
  // Compatibilidade com modelos que usam campo único por componente
  { value: "nota.MAC", label: "MAC — sem trimestre (legado; o sistema preenche a partir do 1.º disponível)" },
  { value: "nota.NPP", label: "NPP — sem trimestre (legado)" },
];

/** Categorias só da secção «Notas» (para painel lateral com grupos). */
export const CATEGORIAS_NOTAS_PAUTA_CONCLUSAO_EXCEL: { titulo: string; campos: CampoMapeamentoExcel[] }[] =
  [
    {
      titulo: "Notas — 1.º trimestre (escolha a disciplina em cada coluna)",
      campos: CAMPOS_NOTA_PAUTA_CONCLUSAO.filter((c) =>
        ["nota.MAC1", "nota.NPP1", "nota.NPT1"].includes(c.value)
      ),
    },
    {
      titulo: "Notas — 2.º trimestre",
      campos: CAMPOS_NOTA_PAUTA_CONCLUSAO.filter((c) =>
        ["nota.MAC2", "nota.NPP2", "nota.NPT2"].includes(c.value)
      ),
    },
    {
      titulo: "Notas — 3.º trimestre",
      campos: CAMPOS_NOTA_PAUTA_CONCLUSAO.filter((c) =>
        ["nota.MAC3", "nota.EN", "nota.NPP3", "nota.NPT3"].includes(c.value)
      ),
    },
    {
      titulo: "Médias trimestrais (MT)",
      campos: CAMPOS_NOTA_PAUTA_CONCLUSAO.filter((c) =>
        ["nota.MT1", "nota.MT2", "nota.MT3"].includes(c.value)
      ),
    },
    {
      titulo: "Exame e classificação final",
      campos: CAMPOS_NOTA_PAUTA_CONCLUSAO.filter((c) =>
        ["nota.EX", "nota.MFD", "nota.CFD"].includes(c.value)
      ),
    },
    {
      titulo: "Outros / legado",
      campos: CAMPOS_NOTA_PAUTA_CONCLUSAO.filter((c) =>
        ["nota.HA", "nota.NPG", "nota.CA", "nota.MAC", "nota.NPP"].includes(c.value)
      ),
    },
  ];
