/**
 * Campos disponíveis para mapeamento dinâmico em templates.
 * GET /templates/available-fields - lista caminhos do sistema (student.fullName, etc).
 * Não hardcodar: estrutura derivada dos contextos de dados.
 */
export interface AvailableField {
  caminho: string;
  descricao: string;
  contexto: 'student' | 'instituicao' | 'documento' | 'finance' | 'pauta' | 'boletim' | 'pauta_conclusao';
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
    { caminho: 'student.nomePai', descricao: 'Nome do pai', contexto: 'student' },
    { caminho: 'student.nomeMae', descricao: 'Nome da mãe', contexto: 'student' },
    { caminho: 'student.localNascimento', descricao: 'Local de nascimento', contexto: 'student' },
    { caminho: 'student.filiacao', descricao: 'Filiação formatada', contexto: 'student' },
    { caminho: 'student.curso', descricao: 'Nome do curso', contexto: 'student' },
    { caminho: 'student.classe', descricao: 'Classe (Secundário)', contexto: 'student' },
    { caminho: 'student.turma', descricao: 'Turma', contexto: 'student' },
    { caminho: 'student.anoLetivo', descricao: 'Ano letivo', contexto: 'student' },
    { caminho: 'student.semestre', descricao: 'Semestre (Superior)', contexto: 'student' },
    { caminho: 'student.opcaoCurso', descricao: 'Opção do curso', contexto: 'student' },
    { caminho: 'student.notaTfc', descricao: 'Nota TFC (Superior)', contexto: 'student' },
    { caminho: 'student.notaDefesa', descricao: 'Nota Defesa (Superior)', contexto: 'student' },
    { caminho: 'student.dataTfc', descricao: 'Data TFC (Superior)', contexto: 'student' },
    { caminho: 'student.dataDefesa', descricao: 'Data Defesa (Superior)', contexto: 'student' },
    // Instituição
    { caminho: 'instituicao.nome', descricao: 'Nome da instituição', contexto: 'instituicao' },
    { caminho: 'instituicao.nif', descricao: 'NIF da instituição', contexto: 'instituicao' },
    { caminho: 'instituicao.endereco', descricao: 'Endereço da instituição', contexto: 'instituicao' },
    { caminho: 'instituicao.telefone', descricao: 'Telefone da instituição', contexto: 'instituicao' },
    { caminho: 'instituicao.email', descricao: 'Email da instituição', contexto: 'instituicao' },
    { caminho: 'instituicao.ministerioSuperior', descricao: 'Ministério (cert. superior)', contexto: 'instituicao' },
    { caminho: 'instituicao.decretoCriacao', descricao: 'Decreto de criação', contexto: 'instituicao' },
    { caminho: 'instituicao.cargoAssinatura1', descricao: 'Cargo assinatura 1', contexto: 'instituicao' },
    { caminho: 'instituicao.cargoAssinatura2', descricao: 'Cargo assinatura 2', contexto: 'instituicao' },
    { caminho: 'instituicao.nomeChefeDaa', descricao: 'Nome Chefe DAA', contexto: 'instituicao' },
    { caminho: 'instituicao.nomeDirectorGeral', descricao: 'Nome Director Geral', contexto: 'instituicao' },
    { caminho: 'instituicao.localidadeCertificado', descricao: 'Localidade certificado', contexto: 'instituicao' },
    { caminho: 'instituicao.textoFechoCertificado', descricao: 'Texto fecho certificado', contexto: 'instituicao' },
    { caminho: 'instituicao.textoRodapeCertificado', descricao: 'Texto rodapé certificado', contexto: 'instituicao' },
    { caminho: 'instituicao.republicaAngola', descricao: 'República de Angola (cert. secund.)', contexto: 'instituicao' },
    { caminho: 'instituicao.governoProvincia', descricao: 'Governo da Província', contexto: 'instituicao' },
    { caminho: 'instituicao.escolaNomeNumero', descricao: 'Escola nome/número', contexto: 'instituicao' },
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
    // Boletim Excel (placeholders do boletimToExcelData)
    { caminho: 'NOME_ALUNO', descricao: 'Nome do aluno (Boletim)', contexto: 'boletim' },
    { caminho: 'NUMERO_ESTUDANTE', descricao: 'Número de estudante (Boletim)', contexto: 'boletim' },
    { caminho: 'ANO_LETIVO', descricao: 'Ano letivo (Boletim)', contexto: 'boletim' },
    { caminho: 'INSTITUICAO_NOME', descricao: 'Nome da instituição (Boletim)', contexto: 'boletim' },
    { caminho: 'DISCIPLINA_1', descricao: 'Disciplina 1 (Boletim)', contexto: 'boletim' },
    { caminho: 'NOTA_1', descricao: 'Nota 1 (Boletim)', contexto: 'boletim' },
    { caminho: 'SITUACAO_1', descricao: 'Situação 1 (Boletim)', contexto: 'boletim' },
    { caminho: 'TURMA_1', descricao: 'Turma 1 (Boletim)', contexto: 'boletim' },
    { caminho: 'PROFESSOR_1', descricao: 'Professor 1 (Boletim)', contexto: 'boletim' },
    // Pauta Conclusão Excel (placeholders do pautaConclusaoToExcelData)
    { caminho: 'TURMA', descricao: 'Turma (Pauta Conclusão)', contexto: 'pauta_conclusao' },
    { caminho: 'ESPECIALIDADE', descricao: 'Especialidade (Pauta Conclusão)', contexto: 'pauta_conclusao' },
    { caminho: 'TABELA_ALUNOS', descricao: 'Tabela de alunos (Pauta Conclusão)', contexto: 'pauta_conclusao' },
    { caminho: 'DISCIPLINAS', descricao: 'Disciplinas (Pauta Conclusão)', contexto: 'pauta_conclusao' },
    // Pauta Final - placeholders célula a célula (modelo governo)
    { caminho: 'ALUNO_1_NOME', descricao: 'Nome aluno 1 (Pauta Final)', contexto: 'pauta_conclusao' },
    { caminho: 'ALUNO_1_NREC', descricao: 'Nº REC aluno 1 (Pauta Final)', contexto: 'pauta_conclusao' },
    { caminho: 'ALUNO_1_OBS', descricao: 'Observação aluno 1 - APTO/A (Pauta Final)', contexto: 'pauta_conclusao' },
    { caminho: 'ALUNO_1_DISC_1_MAC', descricao: 'MAC disciplina 1, aluno 1 (Pauta Final)', contexto: 'pauta_conclusao' },
    { caminho: 'ALUNO_1_DISC_1_MT1', descricao: 'MT1 disciplina 1, aluno 1 (Pauta Final)', contexto: 'pauta_conclusao' },
    { caminho: 'ALUNO_1_DISC_1_MT2', descricao: 'MT2 disciplina 1, aluno 1 (Pauta Final)', contexto: 'pauta_conclusao' },
    { caminho: 'ALUNO_1_DISC_1_MT3', descricao: 'MT3 disciplina 1, aluno 1 (Pauta Final)', contexto: 'pauta_conclusao' },
    { caminho: 'ALUNO_1_DISC_1_EX', descricao: 'Exame disciplina 1, aluno 1 (Pauta Final)', contexto: 'pauta_conclusao' },
    { caminho: 'ALUNO_1_DISC_1_MFD', descricao: 'MFD disciplina 1, aluno 1 (Pauta Final)', contexto: 'pauta_conclusao' },
  ];
}

/**
 * Valida mapeamentos antes de gerar documento.
 * Retorna lista de mapeamentos inválidos (campoSistema inexistente em validPaths).
 * Para DOCX: validPaths = getCamposValidosDocx(). Para Excel: validPaths = Object.keys(baseData).
 * Regra: Validar campos inexistentes antes de gerar documento.
 */
export function validarMapeamentosCampos(
  mappings: Array<{ campoTemplate: string; campoSistema: string }>,
  validPaths: Set<string>
): string[] {
  const invalid: string[] = [];
  for (const m of mappings) {
    const path = m.campoSistema?.trim();
    if (!path) continue;
    if (!validPaths.has(path)) {
      invalid.push(`${m.campoTemplate} → ${path}`);
    }
  }
  return invalid;
}

/** Retorna Set dos caminhos válidos para DOCX (campos do sistema). */
export function getCamposValidosDocx(): Set<string> {
  const base = listarCamposDisponiveis().map((f) => f.caminho);
  const paths = new Set(base);
  // student.disciplinas[i].{nome,mediaFinal,situacao,anoLetivo} para i 0..19
  for (let i = 0; i < 20; i++) {
    paths.add(`student.disciplinas.${i}.nome`);
    paths.add(`student.disciplinas.${i}.mediaFinal`);
    paths.add(`student.disciplinas.${i}.situacao`);
    paths.add(`student.disciplinas.${i}.anoLetivo`);
  }
  return paths;
}
