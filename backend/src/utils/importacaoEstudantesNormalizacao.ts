/** Normaliza BI/NIF para comparação e gravação consistente na importação. */
export function normalizarDocumentoIdentificacao(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toUpperCase();
}

/** Apenas dígitos; usado para detetar telefone repetido no ficheiro. */
export function normalizarTelefoneParaDedupe(raw: string): string {
  return raw.replace(/\D/g, '');
}
