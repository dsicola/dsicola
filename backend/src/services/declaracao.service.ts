/**
 * Templates de Declaração (Matrícula e Frequência) para Ensino Superior e Secundário.
 * Mesmo modelo visual dos certificados: cabeçalho, texto formal, rodapé com assinaturas e QR Code.
 */
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import type { PayloadDocumento } from './documento.service.js';

const TEMPLATE_SUPERIOR = path.join(process.cwd(), 'src', 'templates', 'declaracao-superior.html');
const TEMPLATE_SECUNDARIO = path.join(process.cwd(), 'src', 'templates', 'declaracao-secundario.html');

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

export interface OpcoesDeclaracao {
  assinaturaChefeNome?: string;
  assinaturaDirectorNome?: string;
  localidade?: string;
  baseUrlVerificacao?: string;
}

function buildTextoDeclaracao(
  payload: PayloadDocumento,
  tipo: 'DECLARACAO_MATRICULA' | 'DECLARACAO_FREQUENCIA'
): string {
  const instituicao = payload.instituicao;
  const estudante = payload.estudante;
  const contexto = payload.contextoAcademico;

  const nome = escapeHtml(estudante.nomeCompleto || '—');
  const bi = escapeHtml(estudante.bi ?? estudante.documentoId ?? '—');
  const instituicaoNome = escapeHtml(instituicao.nome || 'Instituição');
  const curso = escapeHtml(contexto.curso || '');
  const classe = escapeHtml(contexto.classe || '');
  const numeroEstudante = escapeHtml(estudante.numeroEstudante || '—');
  const anoLetivo = contexto.anoLetivo ?? new Date().getFullYear();
  const turma = escapeHtml(contexto.turma || '');

  const dataNasc = estudante.dataNascimento
    ? new Date(estudante.dataNascimento).toLocaleDateString('pt-AO', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';
  const dadosPessoais = dataNasc ? `nascido(a) aos ${dataNasc}, ` : '';
  const biComplementar = 'portador(a) do B.I. nº <strong>' + bi + '</strong>, passado pelo Arquivo de Identificação competente';

  const cursoClasse = [curso, classe].filter(Boolean).join(', ');
  const cursoClasseTexto = cursoClasse ? `<strong>${cursoClasse}</strong>` : 'nesta instituição';
  const turmaTexto = turma ? `, turma ${turma}` : '';
  const anoTexto = `no Ano Lectivo de ${anoLetivo}`;

  if (tipo === 'DECLARACAO_MATRICULA') {
    return `<p>De acordo com os registos constantes no arquivo desta Instituição, ${instituicaoNome} declara que <strong>${nome}</strong>, ${dadosPessoais}${biComplementar}, se encontra matriculado(a) em ${cursoClasseTexto}, com o número de estudante ${numeroEstudante}, ${anoTexto}${turmaTexto ? turmaTexto + '.' : '.'}</p>`;
  }

  return `<p>De acordo com os registos constantes no arquivo desta Instituição, ${instituicaoNome} declara que <strong>${nome}</strong>, ${dadosPessoais}${biComplementar}, frequenta ${cursoClasseTexto}, com o número de estudante ${numeroEstudante}, ${anoTexto}${turmaTexto ? turmaTexto + '.' : '.'}</p>`;
}

/**
 * Preenche o template HTML da declaração (Matrícula ou Frequência) para Superior ou Secundário.
 */
export async function preencherTemplateDeclaracao(
  payload: PayloadDocumento,
  tipo: 'DECLARACAO_MATRICULA' | 'DECLARACAO_FREQUENCIA',
  tipoAcademico: 'SUPERIOR' | 'SECUNDARIO',
  opcoes: OpcoesDeclaracao = {}
): Promise<string> {
  const instituicao = payload.instituicao;
  const documento = payload.documento;

  const tituloDocumento = tipo === 'DECLARACAO_MATRICULA' ? 'Declaração de Matrícula' : 'Declaração de Frequência';
  const textoDeclaracao = buildTextoDeclaracao(payload, tipo);

  const dataEmissao = formatarDataLonga(new Date(documento.dataEmissao));
  const instituicaoNome = escapeHtml(instituicao.nome || 'Instituição');
  const localidade = escapeHtml(opcoes.localidade || instituicao.endereco || '—');
  const codigoVerificacao = documento.codigoVerificacao || '';

  let logoImg = '';
  if (instituicao.logoUrl && instituicao.logoUrl.startsWith('http')) {
    logoImg = `<img class="logo" src="${escapeHtml(instituicao.logoUrl)}" alt="Logo" />`;
  }

  const baseUrl = opcoes.baseUrlVerificacao || process.env.FRONTEND_URL || process.env.PLATFORM_BASE_DOMAIN || 'https://app.dsicola.com';
  const urlVerificacao = `${baseUrl.replace(/\/$/, '')}/verificar-documento?codigo=${encodeURIComponent(codigoVerificacao)}`;
  let qrCodeDataUrl = '';
  try {
    qrCodeDataUrl = await QRCode.toDataURL(urlVerificacao, { width: 72, margin: 1 });
  } catch {
    qrCodeDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  }

  const assinaturaChefeNome = escapeHtml(opcoes.assinaturaChefeNome || '');
  const assinaturaDirectorNome = escapeHtml(opcoes.assinaturaDirectorNome || '');

  const templatePath = tipoAcademico === 'SUPERIOR' ? TEMPLATE_SUPERIOR : TEMPLATE_SECUNDARIO;
  let html = fs.readFileSync(templatePath, 'utf-8');

  const vars: Record<string, string> = {
    tituloDocumento,
    textoDeclaracao,
    numeroDocumento: escapeHtml(documento.numero),
    instituicaoNome,
    localidade,
    dataEmissao,
    codigoVerificacao,
    logoImg,
    qrCodeDataUrl,
    assinaturaChefeNome,
    assinaturaDirectorNome,
  };

  for (const [key, value] of Object.entries(vars)) {
    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  return html;
}

/** Gera PDF a partir do HTML da declaração (Puppeteer ou wkhtmltopdf). */
export async function gerarPDFDeclaracao(html: string): Promise<Buffer | null> {
  const { gerarPDFCertificadoSuperior } = await import('./certificadoSuperior.service.js');
  return gerarPDFCertificadoSuperior(html);
}
