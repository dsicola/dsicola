import type { PayloadDocumento } from './documento.service.js';

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

