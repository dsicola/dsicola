import type { PayloadDocumento } from './documento.service.js';

/**
 * Extrai placeholders de HTML ({{CHAVE}}, {CHAVE}, [CHAVE]).
 * Usado para popular templatePlaceholdersJson em modelos HTML/Word.
 */
export function extractPlaceholdersFromHtml(html: string): string[] {
  if (!html?.trim()) return [];
  const set = new Set<string>();
  const addKey = (key: string) => {
    const k = key.trim();
    if (k && !k.startsWith('#') && !k.startsWith('/')) set.add(k);
  };
  // {{CHAVE}} - formato comum em templates
  let m: RegExpExecArray | null;
  const doubleRegex = /\{\{([^}]+)\}\}/g;
  while ((m = doubleRegex.exec(html)) !== null) addKey(m[1]);
  // {CHAVE} - formato docxtemplater
  const singleRegex = /\{([^{}]+)\}/g;
  while ((m = singleRegex.exec(html)) !== null) addKey(m[1]);
  // [CHAVE] - formato alternativo (só se parecer placeholder: letra + alfanumérico)
  const bracketRegex = /\[([A-Za-z_][A-Za-z0-9_.]*)\]/g;
  while ((m = bracketRegex.exec(html)) !== null) addKey(m[1]);
  return Array.from(set);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Monta um conjunto de variáveis básicas a partir do payload padrão de documentos,
 * para serem usadas em templates HTML genéricos com placeholders {{CHAVE}}.
 * Valores de texto são escapados para evitar XSS; LOGO_IMG não é escapado (já é HTML seguro).
 */
export function montarVarsBasicas(
  payload: PayloadDocumento,
  tipo: 'CERTIFICADO' | 'DECLARACAO_MATRICULA' | 'DECLARACAO_FREQUENCIA',
  tipoAcademico: 'SUPERIOR' | 'SECUNDARIO'
): Record<string, string> {
  const { instituicao, estudante, contextoAcademico, documento } = payload;

  const nomeAluno = estudante.nomeCompleto || '—';
  const bi = estudante.bi || estudante.documentoId || '—';
  const numeroEstudante = estudante.numeroEstudante || '—';
  const curso = contextoAcademico.curso || '';
  const classe = contextoAcademico.classe || '';
  const turma = contextoAcademico.turma || '';
  const anoLetivo = String(contextoAcademico.anoLetivo ?? new Date().getFullYear());

  const instituicaoNome = instituicao.nome || 'Instituição';
  const localidade =
    instituicao.localidadeCertificado ||
    instituicao.endereco ||
    '';

  const dataEmissao = new Date(documento.dataEmissao).toLocaleDateString('pt-AO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  // Logo opcional
  const logoImg =
    instituicao.logoUrl && instituicao.logoUrl.startsWith('http')
      ? `<img class="logo" src="${instituicao.logoUrl}" alt="Logo" />`
      : '';

  // Imagem de fundo: URL para usar em style="background-image: url({{IMAGEM_FUNDO_URL}})"
  const imagemFundoUrl = (instituicao as any).imagemFundoDocumentoUrl;
  const imagemFundoUrlSafe =
    imagemFundoUrl && typeof imagemFundoUrl === 'string' && imagemFundoUrl.startsWith('http')
      ? imagemFundoUrl
      : '';

  return {
    NOME_ALUNO: escapeHtml(nomeAluno),
    BI: escapeHtml(bi),
    NUMERO_ESTUDANTE: escapeHtml(numeroEstudante),
    CURSO: escapeHtml(curso),
    CLASSE: escapeHtml(classe),
    TURMA: escapeHtml(turma),
    ANO_LETIVO: escapeHtml(anoLetivo),
    N_DOCUMENTO: escapeHtml(documento.numero),
    CODIGO_VERIFICACAO: escapeHtml(documento.codigoVerificacao || ''),
    NOME_INSTITUICAO: escapeHtml(instituicaoNome),
    LOCALIDADE: escapeHtml(localidade),
    DATA_EMISSAO: escapeHtml(dataEmissao),
    TIPO_DOCUMENTO: escapeHtml(tipo),
    TIPO_ACADEMICO: escapeHtml(tipoAcademico),
    LOGO_IMG: logoImg, // já é HTML intencional
    IMAGEM_FUNDO_URL: imagemFundoUrlSafe, // URL para background-image
    // Textos institucionais (configuráveis em Configurações)
    MINISTERIO_SUPERIOR: escapeHtml((instituicao as any).ministerioSuperior || ''),
    DECRETO_CRIACAO: escapeHtml((instituicao as any).decretoCriacao || ''),
    NOME_CHEFE_DAA: escapeHtml((instituicao as any).nomeChefeDaa || ''),
    NOME_DIRECTOR_GERAL: escapeHtml((instituicao as any).nomeDirectorGeral || ''),
    LOCALIDADE_CERTIFICADO: escapeHtml((instituicao as any).localidadeCertificado || localidade),
    CARGO_ASSINATURA_1: escapeHtml((instituicao as any).cargoAssinatura1 || ''),
    CARGO_ASSINATURA_2: escapeHtml((instituicao as any).cargoAssinatura2 || ''),
    TEXTO_FECHO_CERTIFICADO: escapeHtml((instituicao as any).textoFechoCertificado || ''),
    TEXTO_RODAPE_CERTIFICADO: escapeHtml((instituicao as any).textoRodapeCertificado || ''),
    REPUBLICA_ANGOLA: escapeHtml((instituicao as any).republicaAngola || ''),
    GOVERNO_PROVINCIA: escapeHtml((instituicao as any).governoProvincia || ''),
    ESCOLA_NOME_NUMERO: escapeHtml((instituicao as any).escolaNomeNumero || ''),
    ENSINO_GERAL: escapeHtml((instituicao as any).ensinoGeral || ''),
    TITULO_CERTIFICADO_SECUNDARIO: escapeHtml((instituicao as any).tituloCertificadoSecundario || ''),
    TEXTO_FECHO_CERTIFICADO_SECUNDARIO: escapeHtml((instituicao as any).textoFechoCertificadoSecundario || ''),
    CARGO_ASSINATURA_1_SECUNDARIO: escapeHtml((instituicao as any).cargoAssinatura1Secundario || ''),
    CARGO_ASSINATURA_2_SECUNDARIO: escapeHtml((instituicao as any).cargoAssinatura2Secundario || ''),
    NOME_ASSINATURA_1_SECUNDARIO: escapeHtml((instituicao as any).nomeAssinatura1Secundario || ''),
    NOME_ASSINATURA_2_SECUNDARIO: escapeHtml((instituicao as any).nomeAssinatura2Secundario || ''),
    LABEL_RESULTADO_FINAL_SECUNDARIO: escapeHtml((instituicao as any).labelResultadoFinalSecundario || ''),
  };
}

/**
 * Converte PayloadDocumento para o formato esperado por templateRender (docxtemplater).
 * Estrutura: { student: {...}, instituicao: {...}, document: {...} } para mapeamento campoTemplate → campoSistema.
 */
export function payloadToTemplateData(
  payload: PayloadDocumento,
  tipo: 'CERTIFICADO' | 'DECLARACAO_MATRICULA' | 'DECLARACAO_FREQUENCIA',
  tipoAcademico: 'SUPERIOR' | 'SECUNDARIO'
): Record<string, unknown> {
  const { instituicao, estudante, contextoAcademico, documento } = payload;
  const dataEmissao = new Date(documento.dataEmissao).toLocaleDateString('pt-AO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return {
    student: {
      fullName: estudante.nomeCompleto || '—',
      birthDate: estudante.dataNascimento ? new Date(estudante.dataNascimento).toLocaleDateString('pt-AO') : null,
      bi: estudante.bi || estudante.documentoId || '—',
      numeroEstudante: estudante.numeroEstudante || '—',
      email: estudante.email ?? null,
      telefone: estudante.telefone ?? null,
      endereco: estudante.endereco ?? null,
      nomePai: estudante.nomePai ?? null,
      nomeMae: estudante.nomeMae ?? null,
      localNascimento: estudante.localNascimento ?? null,
      filiacao: estudante.filiacao ?? null,
      curso: contextoAcademico.curso || '',
      classe: contextoAcademico.classe || '',
      turma: contextoAcademico.turma || '',
      anoLetivo: String(contextoAcademico.anoLetivo ?? new Date().getFullYear()),
      semestre: contextoAcademico.semestre ?? null,
      opcaoCurso: contextoAcademico.opcaoCurso ?? null,
      notaTfc: contextoAcademico.notaTfc ?? null,
      notaDefesa: contextoAcademico.notaDefesa ?? null,
      dataTfc: contextoAcademico.dataTfc ?? null,
      dataDefesa: contextoAcademico.dataDefesa ?? null,
      disciplinas: (payload.disciplinas ?? []).map(d => ({
        nome: d.disciplinaNome,
        mediaFinal: d.mediaFinal ?? null,
        situacao: d.situacao ?? null,
        anoLetivo: d.anoLetivo ?? null,
      })),
    },
    instituicao: {
      nome: instituicao.nome || 'Instituição',
      nif: instituicao.nif,
      endereco: instituicao.endereco || instituicao.localidadeCertificado,
      telefone: instituicao.telefone,
      email: instituicao.email,
      ministerioSuperior: instituicao.ministerioSuperior,
      decretoCriacao: instituicao.decretoCriacao,
      cargoAssinatura1: instituicao.cargoAssinatura1,
      cargoAssinatura2: instituicao.cargoAssinatura2,
      nomeChefeDaa: instituicao.nomeChefeDaa,
      nomeDirectorGeral: instituicao.nomeDirectorGeral,
      localidadeCertificado: instituicao.localidadeCertificado,
      textoFechoCertificado: instituicao.textoFechoCertificado,
      textoRodapeCertificado: instituicao.textoRodapeCertificado,
      republicaAngola: instituicao.republicaAngola,
      governoProvincia: instituicao.governoProvincia,
      escolaNomeNumero: instituicao.escolaNomeNumero,
    },
    document: {
      number: documento.numero,
      codigoVerificacao: documento.codigoVerificacao || '',
      dataEmissao,
      tipo,
    },
    finance: {},
  };
}

/**
 * Converte BoletimAluno para o formato esperado por templateRender (Word/PDF).
 * Estrutura: { student: {...}, instituicao: {...}, boletim: { anoLetivo, disciplinas } }
 */
export function boletimToTemplateData(boletim: {
  instituicao?: { nome: string; logoUrl?: string | null };
  aluno: { nomeCompleto: string; numeroIdentificacao?: string | null; numeroIdentificacaoPublica?: string | null };
  anoLetivo?: { ano: number };
  disciplinas?: Array<{
    disciplinaNome: string;
    notaFinal: number | null;
    situacaoAcademica: string;
    professorNome: string;
    cargaHoraria: number;
    turmaNome?: string | null;
  }>;
}): Record<string, unknown> {
  const disciplinas = (boletim.disciplinas ?? []).map((d) => ({
    disciplinaNome: d.disciplinaNome,
    notaFinal: d.notaFinal,
    situacaoAcademica: d.situacaoAcademica,
    professorNome: d.professorNome,
    cargaHoraria: d.cargaHoraria,
    turmaNome: d.turmaNome ?? '',
  }));
  const dataEmissao = new Date().toLocaleDateString('pt-AO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return {
    student: {
      fullName: boletim.aluno.nomeCompleto || '—',
      numeroEstudante: boletim.aluno.numeroIdentificacaoPublica ?? boletim.aluno.numeroIdentificacao ?? '—',
    },
    instituicao: {
      nome: boletim.instituicao?.nome || 'Instituição',
    },
    boletim: {
      anoLetivo: String(boletim.anoLetivo?.ano ?? ''),
      disciplinas,
    },
    document: {
      dataEmissao,
      tipo: 'BOLETIM',
    },
  };
}

/**
 * Monta variáveis flat para template HTML de Boletim (placeholders {{NOME_ALUNO}}, etc.).
 */
export function boletimToVarsBasicas(boletim: {
  instituicao?: { nome: string };
  aluno: { nomeCompleto: string; numeroIdentificacao?: string | null; numeroIdentificacaoPublica?: string | null };
  anoLetivo?: { ano: number };
  disciplinas?: Array<{
    disciplinaNome: string;
    notaFinal: number | null;
    situacaoAcademica: string;
    professorNome: string;
    cargaHoraria: number;
    turmaNome?: string | null;
  }>;
}): Record<string, string> {
  const disciplinasRows = (boletim.disciplinas ?? []).map((d, i) => ({
    [`DISCIPLINA_${i + 1}`]: escapeHtml(d.disciplinaNome),
    [`NOTA_${i + 1}`]: d.notaFinal != null ? escapeHtml(String(d.notaFinal)) : '-',
    [`SITUACAO_${i + 1}`]: escapeHtml(d.situacaoAcademica),
    [`TURMA_${i + 1}`]: escapeHtml(d.turmaNome || ''),
    [`PROFESSOR_${i + 1}`]: escapeHtml(d.professorNome),
  }));
  const discFlat = Object.assign({}, ...disciplinasRows);
  return {
    NOME_ALUNO: escapeHtml(boletim.aluno.nomeCompleto || ''),
    NUMERO_ESTUDANTE: escapeHtml(
      boletim.aluno.numeroIdentificacaoPublica ?? boletim.aluno.numeroIdentificacao ?? ''
    ),
    ANO_LETIVO: escapeHtml(String(boletim.anoLetivo?.ano ?? '')),
    INSTITUICAO_NOME: escapeHtml(boletim.instituicao?.nome || ''),
    ...discFlat,
  };
}

/**
 * Aplica as variáveis {{CHAVE}} sobre o HTML base de um template genérico.
 * Placeholders não reconhecidos permanecem no HTML, para não quebrar o modelo.
 */
export function preencherTemplateHtmlGenerico(
  htmlBase: string,
  vars: Record<string, string>
): string {
  let html = htmlBase;
  for (const [key, value] of Object.entries(vars)) {
    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value ?? '');
  }
  return html;
}

