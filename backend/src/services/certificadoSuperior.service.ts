/**
 * Template de Certificado para Ensino Superior
 * HTML + CSS preparado para geração via PDF (wkhtmltopdf, Puppeteer ou similar).
 * Baseado em modelo institucional (ex.: ESP-Bié).
 */
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import type { PayloadDocumento, DisciplinaHistorico } from './documento.service.js';

const TEMPLATE_PATH = path.join(process.cwd(), 'src', 'templates', 'certificado-superior.html');

/** Valor por extenso (1-20) para média final */
function valorPorExtensoValores(n: number): string {
  const unidades = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez',
    'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezasseis', 'dezassete', 'dezoito', 'dezanove', 'vinte'];
  const int = Math.round(n);
  if (int >= 0 && int <= 20) return unidades[int];
  return String(int);
}

/** Calcular média final a partir das disciplinas (média das notas) */
function calcularMediaFinal(disciplinas: DisciplinaHistorico[]): number | null {
  const comNota = disciplinas.filter(d => d.mediaFinal != null && d.mediaFinal >= 0);
  if (comNota.length === 0) return null;
  const soma = comNota.reduce((acc, d) => acc + (d.mediaFinal ?? 0), 0);
  return Math.round((soma / comNota.length) * 10) / 10; // 1 decimal
}

/** Agrupar disciplinas por ano letivo e ordenar */
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

/** Gerar HTML das tabelas por ano (Cadeiras | Valores) */
function buildTabelasPorAno(disciplinas: DisciplinaHistorico[]): string {
  const porAno = agruparPorAno(disciplinas);
  let html = '';
  let indice = 1;
  for (const [ano, list] of porAno) {
    const tituloAno = `${indice}º Ano`;
    html += `<div class="tabela-ano"><h4>${tituloAno}</h4><table><thead><tr><th>Cadeiras</th><th>Valores</th></tr></thead><tbody>`;
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Formatar data para texto (ex.: 01 de Julho de 2020) */
function formatarDataLonga(d: Date): string {
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const day = d.getDate();
  const month = meses[d.getMonth()];
  const year = d.getFullYear();
  return `${String(day).padStart(2, '0')} de ${month} de ${year}`;
}

export interface OpcoesCertificadoSuperior {
  /** Nome do chefe do DAA (assinatura esquerda) */
  assinaturaChefeNome?: string;
  /** Nome do director geral (assinatura direita) */
  assinaturaDirectorNome?: string;
  /** Localidade (ex.: Kuito) */
  localidade?: string;
  /** Nota do Trabalho de Fim de Curso (opcional) */
  notaTfc?: number;
  /** Data TFC (ex.: Julho/2019) */
  dataTfc?: string;
  /** Nota da Defesa (opcional) */
  notaDefesa?: number;
  /** Data Defesa (ex.: Julho/2019) */
  dataDefesa?: string;
  /** URL base para verificação do documento (QR code) */
  baseUrlVerificacao?: string;
}

/**
 * Preenche o template HTML do certificado com os dados do payload.
 * Retorna HTML pronto para conversão em PDF (wkhtmltopdf, Puppeteer, etc.).
 */
export async function preencherTemplateCertificadoSuperior(
  payload: PayloadDocumento,
  opcoes: OpcoesCertificadoSuperior = {}
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
  const curso = escapeHtml(contexto.curso || '—');
  const numeroEstudante = escapeHtml(estudante.numeroEstudante || '—');
  const anoLetivo = contexto.anoLetivo ?? new Date().getFullYear();

  const dataNasc = estudante.dataNascimento
    ? new Date(estudante.dataNascimento).toLocaleDateString('pt-AO', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';
  const dadosPessoais = dataNasc ? `nascido(a) aos ${dataNasc}` : '';
  const biComplementar = 'passado pelo Arquivo de Identificação competente';

  const dataEmissao = formatarDataLonga(new Date(documento.dataEmissao));
  const instituicaoNome = escapeHtml(instituicao.nome || 'Instituição');
  const localidade = escapeHtml(opcoes.localidade || instituicao.endereco || '—');
  const codigoVerificacao = documento.codigoVerificacao || '';

  let logoImg = '';
  if (instituicao.logoUrl && instituicao.logoUrl.startsWith('http')) {
    logoImg = `<img class="logo" src="${escapeHtml(instituicao.logoUrl)}" alt="Logo" />`;
  }

  const tabelasPorAno = disciplinas.length > 0 ? buildTabelasPorAno(disciplinas) : '<p>Nenhuma disciplina registada.</p>';

  let resumoNotasTfcDefesa = '';
  if (opcoes.notaTfc != null) {
    resumoNotasTfcDefesa += `<p>Nota do Trabalho de Fim de Curso: ${opcoes.notaTfc} Valores${opcoes.dataTfc ? ` (${opcoes.dataTfc})` : ''}</p>`;
  }
  if (opcoes.notaDefesa != null) {
    resumoNotasTfcDefesa += `<p>Nota da Defesa: ${opcoes.notaDefesa} Valores${opcoes.dataDefesa ? ` (${opcoes.dataDefesa})` : ''}</p>`;
  }

  const baseUrl = opcoes.baseUrlVerificacao || process.env.FRONTEND_URL || process.env.PLATFORM_BASE_DOMAIN || 'https://app.dsicola.com';
  const urlVerificacao = `${baseUrl.replace(/\/$/, '')}/verificar-documento?codigo=${encodeURIComponent(codigoVerificacao)}`;
  let qrCodeDataUrl = '';
  try {
    qrCodeDataUrl = await QRCode.toDataURL(urlVerificacao, { width: 72, margin: 1 });
  } catch {
    qrCodeDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='; // 1px transparent
  }

  const assinaturaChefeNome = escapeHtml(opcoes.assinaturaChefeNome || '');
  const assinaturaDirectorNome = escapeHtml(opcoes.assinaturaDirectorNome || '');

  let html = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
  const vars: Record<string, string> = {
    nome,
    bi,
    curso,
    mediaFinal,
    mediaFinalPorExtenso,
    numeroDocumento: escapeHtml(documento.numero),
    instituicaoNome,
    dadosPessoais,
    biComplementar,
    numeroEstudante,
    anoLetivo: String(anoLetivo),
    dataEmissao,
    localidade,
    codigoVerificacao,
    tabelasPorAno,
    resumoNotasTfcDefesa,
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

/**
 * Gera PDF a partir do HTML do certificado.
 * 1) Tenta Puppeteer (se instalado: npm install puppeteer)
 * 2) Tenta wkhtmltopdf (se existir no PATH)
 * Caso contrário retorna null e o caller usa geraDocumentoPDF (template simples).
 */
export async function gerarPDFCertificadoSuperior(html: string): Promise<Buffer | null> {
  // 1) Tentar Puppeteer
  try {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    await browser.close();
    return Buffer.from(pdfBuffer);
  } catch {
    // 2) Tentar wkhtmltopdf (ex.: apt install wkhtmltopdf)
    try {
      const { spawn } = await import('child_process');
      const proc = spawn('wkhtmltopdf', ['--quiet', '-', '-'], { stdio: ['pipe', 'pipe', 'ignore'] });
      const chunks: Buffer[] = [];
      proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
      proc.stdin.write(html, 'utf8');
      proc.stdin.end();
      await new Promise<void>((resolve, reject) => {
        proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`wkhtmltopdf exit ${code}`))));
        proc.on('error', reject);
      });
      return Buffer.concat(chunks);
    } catch {
      return null;
    }
  }
}
