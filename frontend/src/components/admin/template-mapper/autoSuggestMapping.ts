/**
 * Auto-suggest: mapeia placeholders comuns aos campos do sistema.
 * Heurística: nome do placeholder → campo mais provável.
 * Ex: "Nome do Paciente" → student.fullName, "NOME_ESTUDANTE" → student.fullName
 */
const SUGGESTIONS: Array<{ patterns: RegExp[]; campo: string }> = [
  { patterns: [/nome|name|paciente|patient|estudante|aluno|fullname|full_name|nome_completo/i], campo: "student.fullName" },
  { patterns: [/NOME_ESTUDANTE|NOME_ALUNO|NOME_COMPLETO|ALUNO_NOME|ESTUDANTE_NOME/i], campo: "student.fullName" },
  { patterns: [/data\s*nasc|birth|nascimento|idade/i], campo: "student.birthDate" },
  { patterns: [/sexo|género|genero|gender/i], campo: "student.gender" },
  { patterns: [/bi\b|bilhete|documento\s*id|identidade|BI_ESTUDANTE|BI_ALUNO/i], campo: "student.bi" },
  { patterns: [/numero|número|matrícula|matricula|NR_ESTUDANTE|NUMERO_ESTUDANTE|NREC|MATRICULA/i], campo: "student.numeroEstudante" },
  { patterns: [/email|e-mail/i], campo: "student.email" },
  { patterns: [/telefone|telemovel|celular/i], campo: "student.telefone" },
  { patterns: [/endereço|endereco|morada|address/i], campo: "student.endereco" },
  { patterns: [/curso\b(?!\s*id)/i], campo: "student.curso" },
  { patterns: [/classe\b(?!\s*id)/i], campo: "student.classe" },
  { patterns: [/turma/i], campo: "student.turma" },
  { patterns: [/ano\s*letivo|anoLetivo/i], campo: "student.anoLetivo" },
  { patterns: [/institui[cç]ao|instituição|establishment|INSTITUICAO_NOME|NOME_INSTITUICAO/i], campo: "instituicao.nome" },
  { patterns: [/nif/i], campo: "instituicao.nif" },
  { patterns: [/n[º°]?\s*doc|numero\s*doc|documento\s*numero|codigo|NUM_DOC|DOC_NUMERO|CODIGO_DOC/i], campo: "document.number" },
  { patterns: [/código\s*verif|codigo\s*verif|verificação|CODIGO_VERIF|VERIFICACAO|COD_VERIFICACAO/i], campo: "document.codigoVerificacao" },
  { patterns: [/data\s*emissão|data\s*emissao|emissao|DATA_EMISSAO|DATA_EMISSÃO|EMISSAO/i], campo: "document.dataEmissao" },
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
