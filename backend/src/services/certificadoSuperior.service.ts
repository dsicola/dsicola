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
function buildTabelasPorAno(disciplinas: DisciplinaHistorico[], labelValores: string = 'Valores'): string {
  const porAno = agruparPorAno(disciplinas);
  let html = '';
  let indice = 1;
  for (const [ano, list] of porAno) {
    const tituloAno = `${indice}º Ano`;
    html += `<div class="tabela-ano"><h4>${tituloAno}</h4><table><thead><tr><th>Cadeiras</th><th>${escapeHtml(labelValores)}</th></tr></thead><tbody>`;
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
  const localNasc = estudante.localNascimento ? escapeHtml(estudante.localNascimento) : '';
  const dadosPessoais = dataNasc && localNasc
    ? `nascido(a) aos ${dataNasc}, em ${localNasc}`
    : dataNasc
      ? `nascido(a) aos ${dataNasc}`
      : localNasc
        ? `natural de ${localNasc}`
        : '';
  const filiacao = estudante.filiacao ? escapeHtml(estudante.filiacao) : '';
  const partesTexto: string[] = [];
  if (filiacao) partesTexto.push(filiacao);
  if (dadosPessoais) partesTexto.push(dadosPessoais);
  const textoEstudante = partesTexto.length > 0 ? `, ${partesTexto.join(', ')}` : '';
  const opcaoCursoTexto = contexto.opcaoCurso ? `, na opção de ${escapeHtml(contexto.opcaoCurso)}` : '';
  let textoGrauDuracaoCurso = '';
  if (contexto.tipo === 'SUPERIOR') {
    const g = contexto.cursoGrau?.trim();
    const d = contexto.cursoDuracaoNominal?.trim();
    if (g || d) {
      const partes: string[] = [];
      if (g) partes.push(`de grau de <strong>${escapeHtml(g)}</strong>`);
      if (d) partes.push(`com duração nominal de <strong>${escapeHtml(d)}</strong>`);
      textoGrauDuracaoCurso = `, ${partes.join(', ')}`;
    }
  }
  const biComplementar = escapeHtml(instituicao.biComplementarCertificado || 'passado pelo Arquivo de Identificação competente');
  const labelValores = instituicao.labelValoresCertificado || 'Valores';
  const labelMediaFinal = instituicao.labelMediaFinalCertificado || 'Média Final da Licenciatura';

  const dataEmissao = formatarDataLonga(new Date(documento.dataEmissao));
  const instituicaoNome = escapeHtml(instituicao.nome || 'Instituição');
  const ministerioSuperior = escapeHtml(instituicao.ministerioSuperior || 'Ministério do Ensino Superior, Ciência, Tecnologia e Inovação');
  const decretoCriacao = escapeHtml(instituicao.decretoCriacao || 'Decreto n.º 7/09, de 12 de Maio');
  const localidade = escapeHtml(opcoes.localidade || instituicao.localidadeCertificado || instituicao.endereco || '—');
  const codigoVerificacao = documento.codigoVerificacao || '';

  let logoImg = '';
  if (instituicao.logoUrl && instituicao.logoUrl.startsWith('http')) {
    logoImg = `<img class="logo" src="${escapeHtml(instituicao.logoUrl)}" alt="Logo" />`;
  }

  const tabelasPorAno = disciplinas.length > 0 ? buildTabelasPorAno(disciplinas, labelValores) : '<p>Nenhuma disciplina registada.</p>';

  const notaTfc = opcoes.notaTfc ?? contexto.notaTfc ?? null;
  const notaDefesa = opcoes.notaDefesa ?? contexto.notaDefesa ?? null;
  const dataTfc = opcoes.dataTfc ?? contexto.dataTfc ?? null;
  const dataDefesa = opcoes.dataDefesa ?? contexto.dataDefesa ?? null;
  let resumoNotasTfcDefesa = '';
  if (notaTfc != null) {
    resumoNotasTfcDefesa += `<p>Nota do Trabalho de Fim de Curso: ${notaTfc} ${escapeHtml(labelValores)}${dataTfc ? ` (${dataTfc})` : ''}</p>`;
  }
  if (notaDefesa != null) {
    resumoNotasTfcDefesa += `<p>Nota da Defesa: ${notaDefesa} ${escapeHtml(labelValores)}${dataDefesa ? ` (${dataDefesa})` : ''}</p>`;
  }

  const baseUrl = opcoes.baseUrlVerificacao || process.env.FRONTEND_URL || process.env.PLATFORM_BASE_DOMAIN || 'https://app.dsicola.com';
  const urlVerificacao = `${baseUrl.replace(/\/$/, '')}/verificar-documento?codigo=${encodeURIComponent(codigoVerificacao)}`;
  let qrCodeDataUrl = '';
  try {
    qrCodeDataUrl = await QRCode.toDataURL(urlVerificacao, { width: 72, margin: 1 });
  } catch {
    qrCodeDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='; // 1px transparent
  }

  const assinaturaChefeNome = escapeHtml(opcoes.assinaturaChefeNome || instituicao.nomeChefeDaa || '');
  const assinaturaDirectorNome = escapeHtml(opcoes.assinaturaDirectorNome || instituicao.nomeDirectorGeral || '');
  const cargoAssinatura1 = escapeHtml(instituicao.cargoAssinatura1 || 'O CHEFE DO DAA');
  const cargoAssinatura2 = escapeHtml(instituicao.cargoAssinatura2 || 'O DIRECTOR GERAL');
  const textoFechoCertificado = escapeHtml(instituicao.textoFechoCertificado || 'E por ser verdade, e me ter sido solicitado mandei passar o presente Certificado que assino e autentico com carimbo de selo branco em uso nesta Instituição de Ensino Superior.');
  const textoRodapeCertificado = escapeHtml(instituicao.textoRodapeCertificado || `Departamento para os Assuntos Académicos de ${instituicaoNome}, ${localidade}, aos ${dataEmissao}.`);

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
    textoEstudante,
    opcaoCursoTexto,
    textoGrauDuracaoCurso,
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
    ministerioSuperior,
    decretoCriacao,
    cargoAssinatura1,
    cargoAssinatura2,
    textoFechoCertificado,
    textoRodapeCertificado,
    labelMediaFinalCertificado: escapeHtml(labelMediaFinal),
    labelValoresCertificado: escapeHtml(labelValores),
  };

  for (const [key, value] of Object.entries(vars)) {
    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  return html;
}

/** Opções para geração de PDF a partir de HTML */
export interface OpcoesPDFCertificado {
  /** Paisagem (horizontal) quando true; retrato (vertical) quando false ou omisso */
  landscape?: boolean;
}

/**
 * Gera PDF a partir do HTML do certificado.
 * 1) Tenta Puppeteer (se instalado: npm install puppeteer)
 * 2) Tenta wkhtmltopdf (se existir no PATH)
 * Caso contrário retorna null e o caller usa geraDocumentoPDF (template simples).
 */
export async function gerarPDFCertificadoSuperior(html: string, opcoes?: OpcoesPDFCertificado): Promise<Buffer | null> {
  const landscape = opcoes?.landscape === true;
  // 1) Tentar Puppeteer
  try {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    // `networkidle0` pode não terminar com logos externos lentos/inacessíveis → timeout no cliente (axios) e “erro ao imprimir”.
    // Puppeteer ≥23: opções de `setContent` nos tipos nem sempre incluem `timeout`; limite explícito com setTimeout.
    const setContentMs = 25_000;
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`setContent excedeu ${setContentMs}ms`)), setContentMs);
      t.unref?.();
      page
        .setContent(html, { waitUntil: 'domcontentloaded' })
        .then(() => {
          clearTimeout(t);
          resolve();
        })
        .catch((e) => {
          clearTimeout(t);
          reject(e);
        });
    });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape,
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    await browser.close();
    return Buffer.from(pdfBuffer);
  } catch {
    // 2) Tentar wkhtmltopdf (ex.: apt install wkhtmltopdf)
    try {
      const { spawn } = await import('child_process');
      const args = ['--quiet', ...(landscape ? ['-O', 'Landscape'] : []), '-', '-'];
      const proc = spawn('wkhtmltopdf', args, { stdio: ['pipe', 'pipe', 'ignore'] });
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
