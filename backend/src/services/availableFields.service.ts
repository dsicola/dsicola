/**
 * Campos disponíveis para mapeamento dinâmico em templates.
 * GET /templates/available-fields - lista caminhos do sistema (student.fullName, etc).
 * Não hardcodar: estrutura derivada dos contextos de dados.
 */
export interface AvailableField {
  caminho: string;
  descricao: string;
  contexto: 'student' | 'instituicao' | 'documento' | 'finance' | 'pauta';
}

/**
 * Lista os campos disponíveis para mapeamento em templates DOCX.
 * Caminhos no formato objeto.propriedade (ex: student.fullName).
 * Fallback: campo inexistente → deixar vazio.
 */
export function listarCamposDisponiveis(): AvailableField[] {
  return [
    // Student / Estudante
    { caminho: 'student.fullName', descricao: 'Nome completo do estudante', contexto: 'student' },
    { caminho: 'student.birthDate', descricao: 'Data de nascimento', contexto: 'student' },
    { caminho: 'student.gender', descricao: 'Género', contexto: 'student' },
    { caminho: 'student.bi', descricao: 'Bilhete de identidade', contexto: 'student' },
    { caminho: 'student.numeroEstudante', descricao: 'Número de estudante', contexto: 'student' },
    { caminho: 'student.email', descricao: 'Email', contexto: 'student' },
    { caminho: 'student.telefone', descricao: 'Telefone', contexto: 'student' },
    { caminho: 'student.endereco', descricao: 'Endereço', contexto: 'student' },
    { caminho: 'student.curso', descricao: 'Nome do curso', contexto: 'student' },
    { caminho: 'student.classe', descricao: 'Classe (Secundário)', contexto: 'student' },
    { caminho: 'student.turma', descricao: 'Turma', contexto: 'student' },
    { caminho: 'student.anoLetivo', descricao: 'Ano letivo', contexto: 'student' },
    // Instituição
    { caminho: 'instituicao.nome', descricao: 'Nome da instituição', contexto: 'instituicao' },
    { caminho: 'instituicao.nif', descricao: 'NIF da instituição', contexto: 'instituicao' },
    { caminho: 'instituicao.endereco', descricao: 'Endereço da instituição', contexto: 'instituicao' },
    { caminho: 'instituicao.telefone', descricao: 'Telefone da instituição', contexto: 'instituicao' },
    { caminho: 'instituicao.email', descricao: 'Email da instituição', contexto: 'instituicao' },
    // Documento
    { caminho: 'document.number', descricao: 'Número do documento', contexto: 'documento' },
    { caminho: 'document.codigoVerificacao', descricao: 'Código de verificação', contexto: 'documento' },
    { caminho: 'document.dataEmissao', descricao: 'Data de emissão', contexto: 'documento' },
    { caminho: 'document.tipo', descricao: 'Tipo de documento', contexto: 'documento' },
    // Finance / Pagamento
    { caminho: 'finance.amount', descricao: 'Valor (pagamento)', contexto: 'finance' },
    { caminho: 'finance.dataPagamento', descricao: 'Data do pagamento', contexto: 'finance' },
    { caminho: 'finance.formaPagamento', descricao: 'Forma de pagamento', contexto: 'finance' },
    { caminho: 'finance.reciboNumero', descricao: 'Número do recibo', contexto: 'finance' },
    // Pauta / Mini Pauta
    { caminho: 'pauta.disciplina', descricao: 'Nome da disciplina', contexto: 'pauta' },
    { caminho: 'pauta.professor', descricao: 'Nome do professor', contexto: 'pauta' },
    { caminho: 'pauta.turma', descricao: 'Nome da turma', contexto: 'pauta' },
    { caminho: 'pauta.tipoPauta', descricao: 'PROVISÓRIA ou DEFINITIVA', contexto: 'pauta' },
    { caminho: 'pauta.anoLetivo', descricao: 'Ano letivo', contexto: 'pauta' },
    { caminho: 'pauta.tabelaAlunos', descricao: 'HTML da tabela de alunos', contexto: 'pauta' },
    { caminho: 'pauta.totalEstudantes', descricao: 'Total de estudantes', contexto: 'pauta' },
  ];
}
