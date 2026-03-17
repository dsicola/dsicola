/**
 * Auto-suggest: mapeia placeholders comuns aos campos do sistema.
 * Heurística: nome do placeholder → campo mais provável.
 * Ex: "Nome do Paciente" → student.fullName, "Data" → document.dataEmissao
 */
const SUGGESTIONS: Array<{ patterns: RegExp[]; campo: string }> = [
  { patterns: [/nome|name|paciente|patient|estudante|aluno/i], campo: "student.fullName" },
  { patterns: [/data\s*nasc|birth|nascimento|idade/i], campo: "student.birthDate" },
  { patterns: [/sexo|género|genero|gender/i], campo: "student.gender" },
  { patterns: [/bi\b|bilhete|documento\s*id|identidade/i], campo: "student.bi" },
  { patterns: [/numero|número|matrícula|matricula/i], campo: "student.numeroEstudante" },
  { patterns: [/email|e-mail/i], campo: "student.email" },
  { patterns: [/telefone|telemovel|celular/i], campo: "student.telefone" },
  { patterns: [/endereço|endereco|morada|address/i], campo: "student.endereco" },
  { patterns: [/curso\b(?!\s*id)/i], campo: "student.curso" },
  { patterns: [/classe\b(?!\s*id)/i], campo: "student.classe" },
  { patterns: [/turma/i], campo: "student.turma" },
  { patterns: [/ano\s*letivo|anoLetivo/i], campo: "student.anoLetivo" },
  { patterns: [/institui[cç]ao|instituição|establishment/i], campo: "instituicao.nome" },
  { patterns: [/nif/i], campo: "instituicao.nif" },
  { patterns: [/n[º°]?\s*doc|numero\s*doc|documento\s*numero|codigo/i], campo: "document.number" },
  { patterns: [/código\s*verif|codigo\s*verif|verificação/i], campo: "document.codigoVerificacao" },
  { patterns: [/data\s*emissão|data\s*emissao|emissao/i], campo: "document.dataEmissao" },
  { patterns: [/valor|amount|montante|pagamento/i], campo: "finance.amount" },
  { patterns: [/recibo|reciboNumero/i], campo: "finance.reciboNumero" },
];

export function suggestMapping(
  placeholder: string,
  availableFields: string[]
): string | null {
  const ph = placeholder.trim().toLowerCase();
  const validSet = new Set(availableFields);

  for (const { patterns, campo } of SUGGESTIONS) {
    if (!validSet.has(campo)) continue;
    for (const re of patterns) {
      if (re.test(ph)) return campo;
    }
  }
  return null;
}

/**
 * Sugere mapeamentos para todos os placeholders não mapeados.
 */
export function suggestAllMappings(
  placeholders: string[],
  availableFields: string[],
  existingMappings: Record<string, string>
): Record<string, string> {
  const result = { ...existingMappings };
  for (const ph of placeholders) {
    if (result[ph]) continue;
    const suggested = suggestMapping(ph, availableFields);
    if (suggested) result[ph] = suggested;
  }
  return result;
}
