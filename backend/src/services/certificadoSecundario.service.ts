/**
 * Template de Certificado para Ensino Secundário (Angola)
 * Modelo: Certificado de Habilitações (II Ciclo - 10ª, 11ª, 12ª Classe)
 * HTML + CSS preparado para geração via PDF (wkhtmltopdf, Puppeteer ou similar).
 * Configurável por instituição (multi-tenant, dois tipos: SECUNDARIO / SUPERIOR).
 */
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import type { PayloadDocumento, DisciplinaHistorico } from './documento.service.js';

const TEMPLATE_PATH = path.join(process.cwd(), 'src', 'templates', 'certificado-secundario.html');

/** Valor por extenso para notas 0-20 (com suporte a decimais: 14.5 → "catorze vírgula cinco") */
function valorPorExtensoValores(n: number): string {
  const unidades = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez',
    'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezasseis', 'dezassete', 'dezoito', 'dezanove', 'vinte'];
  const int = Math.floor(n);
  const dec = Math.round((n - int) * 10); // 1 casa decimal (ex.: 14.7 → 7)
  if (dec === 0) {
    if (int >= 0 && int <= 20) return unidades[int];
    return String(int);
  }
  const parteInt = int >= 0 && int <= 20 ? unidades[int] : String(int);
  const parteDec = dec >= 1 && dec <= 9 ? unidades[dec] : String(dec);
  return `${parteInt} vírgula ${parteDec}`;
}

function calcularMediaFinal(disciplinas: DisciplinaHistorico[]): number | null {
  const comNota = disciplinas.filter(d => d.mediaFinal != null && d.mediaFinal >= 0);
  if (comNota.length === 0) return null;
  const soma = comNota.reduce((acc, d) => acc + (d.mediaFinal ?? 0), 0);
  return Math.round((soma / comNota.length) * 10) / 10;
}

/** Agrupar disciplinas por ano letivo */
function agruparPorAno(disciplinas: DisciplinaHistorico[]): Map<number, DisciplinaHistorico[]> {
  const map = new Map<number, DisciplinaHistorico[]>();
  for (const d of disciplinas) {
    const ano = d.anoLetivo ?? 0;
    if (!map.has(ano)) map.set(ano, []);
    map.get(ano)!.push(d);
  }
  const anos = Array.from(map.keys()).sort((a, b) => a - b);
  const ordenado = new Map<number, DisciplinaHistorico[]>();
  anos.forEach(ano => ordenado.set(ano, map.get(ano)!));
  return ordenado;
}

/** Tabela por ano (1º Ano, 2º Ano, 3º Ano) - formato simples */
function buildTabelasPorAno(disciplinas: DisciplinaHistorico[], labelValores: string = 'Valores'): string {
  const porAno = agruparPorAno(disciplinas);
  let html = '';
  let indice = 1;
  for (const [, list] of porAno) {
    const tituloAno = `${indice}º Ano`;
    html += `<div class="tabela-ano"><h4>${tituloAno}</h4><table><thead><tr><th>Disciplinas</th><th>${escapeHtml(labelValores)}</th></tr></thead><tbody>`;
    for (const d of list) {
      const nota = d.mediaFinal != null ? String(Math.round(d.mediaFinal * 10) / 10) : '—';
      const nome = escapeHtml((d.disciplinaNome || '').trim() || '—');
      html += `<tr><td>${nome}</td><td>${nota}</td></tr>`;
    }
    html += '</tbody></table></div>';
    indice++;
  }
  return html;
}

/** Tabela Angola: Disciplinas | 10ª Classe | 11ª Classe | 12ª Classe (pivot por ano) */
function buildTabelaAngola(disciplinas: DisciplinaHistorico[], labelValores: string = 'Valores'): string {
  if (disciplinas.length === 0) return '';

  const anosOrdenados = Array.from(new Set(disciplinas.map(d => d.anoLetivo ?? 0))).filter(a => a > 0).sort((a, b) => a - b);
  const labelsClasse = anosOrdenados.length >= 3
    ? ['10ª Classe', '11ª Classe', '12ª Classe']
    : anosOrdenados.map((_, i) => `${10 + i}ª Classe`);

  // Mapa: disciplinaNome -> { anoIndex -> nota }
  const pivot = new Map<string, Map<number, number | null>>();
  for (const d of disciplinas) {
    const nome = (d.disciplinaNome || '').trim() || '—';
    if (!pivot.has(nome)) pivot.set(nome, new Map());
    const anoIdx = anosOrdenados.indexOf(d.anoLetivo ?? 0);
    if (anoIdx >= 0) {
      pivot.get(nome)!.set(anoIdx, d.mediaFinal != null ? Math.round(d.mediaFinal * 10) / 10 : null);
    }
  }

  let html = '<div class="tabela-angola"><table><thead><tr><th>Disciplinas</th>';
  for (const lbl of labelsClasse) {
    html += `<th>${escapeHtml(lbl)}</th>`;
  }
  html += '</tr></thead><tbody>';

  for (const [nome, notas] of pivot) {
    html += `<tr><td>${escapeHtml(nome)}</td>`;
    for (let i = 0; i < labelsClasse.length; i++) {
      const n = notas.get(i);
      html += `<td>${n != null ? String(n) : '—'}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  return html;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatarDataLonga(d: Date): string {
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const day = d.getDate();
  const month = meses[d.getMonth()];
  const year = d.getFullYear();
  return `${String(day).padStart(2, '0')} de ${month} de ${year}`;
}

export interface OpcoesCertificadoSecundario {
  assinaturaDirectorNome?: string;
  localidade?: string;
  baseUrlVerificacao?: string;
  /** Usar formato Angola (10ª/11ª/12ª Classe) em vez de 1º/2º/3º Ano */
  formatoAngola?: boolean;
}

export async function preencherTemplateCertificadoSecundario(
  payload: PayloadDocumento,
  opcoes: OpcoesCertificadoSecundario = {}
): Promise<string> {
  const instituicao = payload.instituicao;
  const estudante = payload.estudante;
  const contexto = payload.contextoAcademico;
  const documento = payload.documento;

  const disciplinas = payload.disciplinas ?? [];
  const mediaFinalNum = calcularMediaFinal(disciplinas);
  const mediaFinal = mediaFinalNum != null ? String(mediaFinalNum) : '—';
  const mediaFinalPorExtenso = mediaFinalNum != null ? valorPorExtensoValores(mediaFinalNum) : '—';

  const nome = escapeHtml(estudante.nomeCompleto || '—');
  const bi = escapeHtml(estudante.bi ?? estudante.documentoId ?? '—');
  const curso = escapeHtml(contexto.curso || contexto.classe || '—');
  const areaAcademica = escapeHtml(contexto.opcaoCurso || contexto.curso || contexto.classe || '—');
  const numeroEstudante = escapeHtml(estudante.numeroEstudante || '—');
  const anoLetivo = contexto.anoLetivo ?? new Date().getFullYear();

  const dataNasc = estudante.dataNascimento
    ? new Date(estudante.dataNascimento).toLocaleDateString('pt-AO', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';
  const localNasc = estudante.localNascimento ? escapeHtml(estudante.localNascimento) : '';
  const filiacao = estudante.filiacao ? escapeHtml(estudante.filiacao) : '';
  const dadosPessoais: string[] = [];
  if (filiacao) dadosPessoais.push(filiacao);
  if (dataNasc) dadosPessoais.push(`nascido(a) aos ${dataNasc}`);
  if (localNasc) dadosPessoais.push(`natural de ${localNasc}`);
  const dadosPessoaisStr = dadosPessoais.length > 0 ? dadosPessoais.join(', ') : '';

  const biComplementar = escapeHtml(instituicao.biComplementarCertificado || 'passado pelo Arquivo de Identificação competente');
  const labelValores = instituicao.labelValoresCertificado || 'Valores';
  const labelResultadoFinal = instituicao.labelResultadoFinalSecundario || 'Resultado final';

  const dataEmissao = formatarDataLonga(new Date(documento.dataEmissao));
  const instituicaoNome = escapeHtml(instituicao.nome || 'Instituição');
  const localidade = escapeHtml(opcoes.localidade || instituicao.localidadeCertificado || instituicao.endereco || '—');
  const codigoVerificacao = documento.codigoVerificacao || '';

  // Configuráveis Angola (modelo II Ciclo)
  const republicaAngola = escapeHtml(instituicao.republicaAngola || 'REPÚBLICA DE ANGOLA');
  const governoProvincia = escapeHtml(instituicao.governoProvincia || 'GOVERNO DA PROVINCIA DE LUANDA');
  const escolaNomeNumero = escapeHtml(instituicao.escolaNomeNumero || instituicaoNome);
  const ensinoGeral = escapeHtml(instituicao.ensinoGeral || 'ENSINO GERAL');
  const tituloCertificado = escapeHtml(instituicao.tituloCertificadoSecundario || 'CERTIFICADO DE HABILITAÇÕES');
  const textoFecho = escapeHtml(instituicao.textoFechoCertificadoSecundario || 'Por ser verdade e me ter sido pedido, passo o presente certificado que vai por mim assinado e autenticado com o carimbo a óleo em uso nesta Instituição.');
  const cargo1 = escapeHtml(instituicao.cargoAssinatura1Secundario || 'O Subdirector Pedagógico');
  const cargo2 = escapeHtml(instituicao.cargoAssinatura2Secundario || 'A Directora');
  const nomeAssinatura1 = escapeHtml(instituicao.nomeAssinatura1Secundario || '');
  const nomeAssinatura2 = escapeHtml(instituicao.nomeAssinatura2Secundario || opcoes.assinaturaDirectorNome || instituicao.nomeDirectorGeral || '');

  let logoImg = '';
  if (instituicao.logoUrl && instituicao.logoUrl.startsWith('http')) {
    logoImg = `<img class="logo" src="${escapeHtml(instituicao.logoUrl)}" alt="Logo" />`;
  }

  const formatoAngola = opcoes.formatoAngola ?? true;
  const tabelasPorAno = disciplinas.length > 0
    ? (formatoAngola ? buildTabelaAngola(disciplinas, labelValores) : buildTabelasPorAno(disciplinas, labelValores))
    : '';

  const baseUrl = opcoes.baseUrlVerificacao || process.env.FRONTEND_URL || process.env.PLATFORM_BASE_DOMAIN || 'https://app.dsicola.com';
  const urlVerificacao = `${baseUrl.replace(/\/$/, '')}/verificar-documento?codigo=${encodeURIComponent(codigoVerificacao)}`;
  let qrCodeDataUrl = '';
  try {
    qrCodeDataUrl = await QRCode.toDataURL(urlVerificacao, { width: 72, margin: 1 });
  } catch {
    qrCodeDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  }

  let html = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
  const vars: Record<string, string> = {
    nome,
    bi,
    curso,
    areaAcademica,
    mediaFinal,
    mediaFinalPorExtenso,
    numeroDocumento: escapeHtml(documento.numero),
    instituicaoNome,
    dadosPessoais: dadosPessoaisStr,
    biComplementar,
    numeroEstudante,
    anoLetivo: String(anoLetivo),
    dataEmissao,
    localidade,
    codigoVerificacao,
    tabelasPorAno,
    logoImg,
    qrCodeDataUrl,
    republicaAngola,
    governoProvincia,
    escolaNomeNumero,
    ensinoGeral,
    tituloCertificado,
    textoFecho,
    cargo1,
    cargo2,
    nomeAssinatura1,
    nomeAssinatura2: nomeAssinatura2 || nomeAssinatura1,
    labelResultadoFinal,
    labelValores,
  };

  for (const [key, value] of Object.entries(vars)) {
    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  return html;
}

/** Reutiliza a mesma lógica de PDF do certificado superior (Puppeteer / wkhtmltopdf). */
export async function gerarPDFCertificadoSecundario(html: string): Promise<Buffer | null> {
  const { gerarPDFCertificadoSuperior } = await import('./certificadoSuperior.service.js');
  return gerarPDFCertificadoSuperior(html);
}
