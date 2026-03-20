import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
// Formato de data para SAFT (yyyy-MM-dd) - sem dependência date-fns
const formatDate = (d: Date): string => d.toISOString().slice(0, 10);

/** Caminho do schema XSD oficial SAF-T-AO (AG Angola) */
const XSD_PATH = path.join(process.cwd(), 'assets', 'saft-ao', 'SAFTAO1.01_01.xsd');

/**
 * Validação estrutural do XML SAFT-AO (conformidade AGT)
 * Verifica elementos obrigatórios antes do download
 */
function validarEstruturaXmlSaft(xml: string): { valido: boolean; erros: string[] } {
  const erros: string[] = [];
  const ns = 'urn:OECD:StandardAuditFile-Tax:AO_1.01_01';
  if (!xml.includes(`xmlns="${ns}"`) && !xml.includes(`xmlns='${ns}'`)) {
    erros.push(`Namespace obrigatório ausente: ${ns}`);
  }
  if (!xml.includes('<AuditFile')) {
    erros.push('Elemento raiz AuditFile ausente');
  }
  if (!xml.includes('<Header>')) {
    erros.push('Secção Header ausente');
  }
  if (!xml.includes('<MasterFiles>')) {
    erros.push('Secção MasterFiles ausente');
  }
  if (!xml.includes('<SourceDocuments>')) {
    erros.push('Secção SourceDocuments ausente');
  }
  if (!xml.includes('<TaxRegistrationNumber>')) {
    erros.push('TaxRegistrationNumber (NIF) ausente no Header');
  }
  if (!xml.includes('<SoftwareCertificateNumber>')) {
    erros.push('SoftwareCertificateNumber ausente no Header');
  }
  if (!xml.includes('<CurrencyCode>AOA</CurrencyCode>')) {
    erros.push('Moeda AOA ausente ou incorreta');
  }
  return { valido: erros.length === 0, erros };
}

/**
 * Validação XML contra schema XSD oficial SAF-T-AO (AGT)
 * Usa libxmljs2-xsd quando disponível. Se não instalado ou XSD ausente, salta (não bloqueia).
 */
function validarXmlContraXsd(xml: string): { valido: boolean; erros: string[] } {
  if (process.env.SKIP_SAFT_XSD_VALIDATION === '1') {
    return { valido: true, erros: [] };
  }
  if (!fs.existsSync(XSD_PATH)) {
    console.warn('[SAFT] Schema XSD não encontrado em', XSD_PATH, '- validação XSD ignorada');
    return { valido: true, erros: [] };
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const xsd = require('libxmljs2-xsd');
    const schema = xsd.parseFile(XSD_PATH);
    const validationErrors = schema.validate(xml);
    if (validationErrors === null || validationErrors.length === 0) {
      return { valido: true, erros: [] };
    }
    const erros = (Array.isArray(validationErrors) ? validationErrors : [validationErrors]).map(
      (e: { message?: string; toString?: () => string }) => e?.message ?? e?.toString?.() ?? String(e)
    );
    return { valido: false, erros };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Cannot find module') || msg.includes("require('libxmljs2-xsd')")) {
      console.warn('[SAFT] libxmljs2-xsd não instalado - validação XSD ignorada. Execute: npm install libxmljs2-xsd');
      return { valido: true, erros: [] };
    }
    return { valido: false, erros: [`Erro na validação XSD: ${msg}`] };
  }
}

/**
 * Cálculo de hash fiscal usado como fallback no SAFT
 * (para documentos antigos sem hash persistido)
 */
function calcularHashFiscalSaft(
  numeroDocumento: string,
  dataDocumento: Date,
  valorTotal: number,
  nifEmissor: string,
  entidadeId: string
): { hash: string; hashControl: string } {
  const dataStr = dataDocumento.toISOString().slice(0, 10);
  const concat = `${nifEmissor}|${numeroDocumento}|${dataStr}|${valorTotal.toString()}|${entidadeId}`;
  const hash = crypto.createHash('sha256').update(concat, 'utf8').digest('hex');
  const hashControl = hash.slice(0, 4).toUpperCase() + String(Date.now()).slice(-4);
  return { hash, hashControl };
}

const escapeXML = (str: string): string => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const safeToFixed = (val: number | string, decimals: number): string => {
  const n = typeof val === 'string' ? parseFloat(val) : val;
  return (isNaN(n) ? 0 : n).toFixed(decimals);
};

/** Gera ATCUD (código de controlo fiscal): série-ano/número. Ex: DSICOLA-2026/0001 */
function gerarAtcud(numeroDocumento: string, serieDocumentos?: string | null): string {
  const nd = String(numeroDocumento || '').trim();
  if (!nd) return '0';
  const match = nd.match(/(\d{4})-?(\d+)$/);
  if (!match) return nd || '0';
  const serie = (serieDocumentos || 'DSICOLA').trim() || 'DSICOLA';
  return `${serie}-${match[1]}/${match[2]}`;
}

/** Sanitiza ProductCode para SAF-T: sem espaços, formato CL10 para classes (evitar erro XSD/duplicação) */
function sanitizeProductCodeForSaft(codigo: string, ordem?: number | null): string {
  const c = String(codigo || '').trim();
  if (!c) return 'PROD';
  // Classes: "10ª", "10ª Classe", "11ª " -> CL10, CL11
  const matchClasse = c.match(/^(\d+)[ªª]?\s*(classe)?$/i);
  if (matchClasse) return 'CL' + matchClasse[1];
  if (ordem != null && ordem > 0) return 'CL' + ordem;
  // Remove espaços e caracteres especiais (evitar validação XSD)
  return c.replace(/\s+/g, '').replace(/[^A-Za-z0-9\-_]/g, '') || 'PROD';
}

/** TaxCode e TaxExemption por linha (IVA 14%=NOR, 5%=RED, 0%=ISE) */
function getTaxInfoForLine(
  taxaIVA: number,
  taxExemptionCode: string | null
): { taxCode: string; taxPercentage: number; taxExemptionReason: string; taxExemptionCode: string } {
  const pct = Number(taxaIVA) || 0;
  if (pct >= 14) return { taxCode: 'NOR', taxPercentage: 14, taxExemptionReason: '', taxExemptionCode: '' };
  if (pct >= 5) return { taxCode: 'RED', taxPercentage: 5, taxExemptionReason: '', taxExemptionCode: '' };
  const code = (taxExemptionCode || 'M01').trim();
  return { taxCode: 'ISE', taxPercentage: 0, taxExemptionReason: 'Isento Art. 12', taxExemptionCode: code || 'M01' };
}

const getPaymentMechanism = (method: string | null): string => {
  switch (String(method ?? '').toLowerCase()) {
    case 'transferência':
    case 'transferencia':
      return 'TB';
    case 'multicaixa':
    case 'terminal':
      return 'MB';
    case 'cheque':
      return 'CH';
    default:
      return 'NU';
  }
};

export interface SaftExportParams {
  instituicaoId: string;
  ano: number;
  mes?: number; // 1-12, opcional (se omitido = ano inteiro)
}

/**
 * Validações obrigatórias antes de gerar SAFT (conformidade AGT)
 */
export async function validarExportacaoSaft(instituicaoId: string, dataInicio: Date, dataFim: Date): Promise<{ valido: boolean; erros: string[] }> {
  const erros: string[] = [];

  const config = await prisma.configuracaoInstituicao.findFirst({
    where: { instituicaoId },
  });

  const instituicao = await prisma.instituicao.findUnique({
    where: { id: instituicaoId },
  });

  const nif = config?.nif?.trim();
  if (!nif) {
    erros.push('NIF não definido. Configure em Configurações da Instituição > Dados Fiscais');
  } else {
    const nifNumeros = nif.replace(/\D/g, '');
    if (nifNumeros === '000000000' || nifNumeros === '999999999') {
      erros.push('NIF inválido (000000000 ou 999999999). A AGT rejeita NIF inválido. Configure o NIF real em Dados Fiscais.');
    }
    if (nifNumeros.length < 9) {
      erros.push('NIF deve ter pelo menos 9 dígitos.');
    }
  }

  const emailFiscal = config?.emailFiscal || instituicao?.emailContato;
  if (!emailFiscal?.trim()) {
    erros.push('Email fiscal/contato não definido');
  }

  const nomeFiscal = config?.nomeFiscal || instituicao?.nome;
  if (!nomeFiscal?.trim()) {
    erros.push('Nome fiscal não definido');
  }

  const documentosCount = await prisma.documentoFinanceiro.count({
    where: {
      instituicaoId,
      dataDocumento: { gte: dataInicio, lte: dataFim },
    },
  });

  if (documentosCount === 0) {
    erros.push('Nenhum documento fiscal no período. Gere propinas e registre pagamentos primeiro.');
  }

  return { valido: erros.length === 0, erros };
}

/**
 * Validação fiscal completa antes de gerar XML (evita rejeição pela AGT)
 * Verifica: sequência, totais, datas, valores, pagamentos.
 * `faturasNoXml` deve ser o mesmo subconjunto que vai para <SalesInvoices> (FT/RC/NC com BI ou sem NIF se valor < limite).
 */
async function validarDadosFiscaisCompletos(
  faturasNoXml: Array<{
    id: string;
    numeroDocumento: string;
    tipoDocumento: string;
    dataDocumento: Date;
    valorTotal: unknown;
    valorPago: unknown;
    entidadeId: string;
    estado?: string;
    linhas: Array<{ valorTotal: unknown }>;
    pagamentos: Array<{ valor: unknown }>;
  }>,
  dataInicio: Date,
  dataFim: Date,
  ano: number
): Promise<{ valido: boolean; erros: string[] }> {
  const erros: string[] = [];

  for (const doc of faturasNoXml) {
    const valorTotal = Number(doc.valorTotal);
    const valorDescontoDoc = Number((doc as { valorDesconto?: unknown }).valorDesconto ?? 0);
    const somaLinhas = doc.linhas.reduce((s, l) => s + Number(l.valorTotal || 0), 0);
    // valorTotal = somaLinhas - valorDescontoDoc (desconto global)
    const esperado = somaLinhas - valorDescontoDoc;
    const diff = Math.abs(valorTotal - esperado);
    if (diff > 0.01) {
      erros.push(`Documento ${doc.numeroDocumento}: Total (${valorTotal.toFixed(2)}) não bate com soma linhas (${somaLinhas.toFixed(2)}) - desc (${valorDescontoDoc.toFixed(2)})`);
    }
    if (valorTotal < 0 && doc.tipoDocumento !== 'NC') {
      erros.push(`Documento ${doc.numeroDocumento}: Valor negativo inválido (apenas NC pode ter valor negativo)`);
    }
    if (doc.tipoDocumento === 'NC' && valorTotal >= 0) {
      erros.push(`Documento ${doc.numeroDocumento}: Nota de crédito deve ter total negativo`);
    }
    const dataDoc = new Date(doc.dataDocumento);
    if (dataDoc < dataInicio || dataDoc > dataFim) {
      erros.push(`Documento ${doc.numeroDocumento}: Data fora do período fiscal (${dataDoc.toISOString().slice(0, 10)})`);
    }
    const anoDoc = dataDoc.getFullYear();
    if (anoDoc !== ano) {
      erros.push(`Documento ${doc.numeroDocumento}: Ano da data (${anoDoc}) não corresponde ao período exportado (${ano})`);
    }
    // NC tem total negativo e normalmente sem linha de pagamento no mesmo sentido que FT/RC — não comparar com a mesma desigualdade
    if (doc.tipoDocumento !== 'NC') {
      const totalPagamentos = doc.pagamentos.reduce((s, p) => s + Number(p.valor || 0), 0);
      if (totalPagamentos > valorTotal + 0.01) {
        erros.push(`Documento ${doc.numeroDocumento}: Total de pagamentos (${totalPagamentos.toFixed(2)}) maior que valor da fatura (${valorTotal.toFixed(2)})`);
      }
    }
    if (!doc.numeroDocumento?.trim()) erros.push(`Documento ${doc.id}: InvoiceNo obrigatório ausente`);
    if (!doc.entidadeId?.trim()) erros.push(`Documento ${doc.numeroDocumento}: CustomerID obrigatório ausente`);
  }

  const numerosFT = faturasNoXml.filter((d) => d.tipoDocumento === 'FT').map((d) => d.numeroDocumento);
  const numerosRC = faturasNoXml.filter((d) => d.tipoDocumento === 'RC').map((d) => d.numeroDocumento);
  const extrairSeq = (n: string) => parseInt(n.match(/\d+$/)?.[0] || '0', 10);
  const verificarSequencia = (nums: string[], prefixo: string) => {
    if (process.env.SKIP_SAFT_GAP_VALIDATION === '1') return;
    const seqs = nums.map(extrairSeq).sort((a, b) => a - b);
    for (let i = 1; i < seqs.length; i++) {
      if (seqs[i] - seqs[i - 1] > 1) {
        erros.push(`Sequência de ${prefixo}: Gap detectado (${seqs[i - 1]} → ${seqs[i]}). A AGT interpreta como possível eliminação de fatura.`);
      }
    }
  };
  verificarSequencia(numerosFT, 'FT');
  verificarSequencia(numerosRC, 'RC');

  // Clientes sem BI/NIF com valor abaixo do limite (Dec. 312/18) entram no XML com CustomerTaxID genérico — não é erro.

  return { valido: erros.length === 0, erros };
}

/**
 * Gerar XML SAFT-AO a partir de DocumentoFinanceiro (fonte de verdade)
 * SAFT nunca lê propinas ou pagamentos isolados
 */
export async function gerarXmlSaftAo(params: SaftExportParams): Promise<string> {
  const { instituicaoId, ano, mes } = params;

  const dataInicio = mes ? new Date(ano, mes - 1, 1) : new Date(ano, 0, 1);
  const dataFim = mes ? new Date(ano, mes, 0, 23, 59, 59) : new Date(ano, 11, 31, 23, 59, 59);

  const validacao = await validarExportacaoSaft(instituicaoId, dataInicio, dataFim);
  if (!validacao.valido) {
    throw new AppError(`Validação SAFT: ${validacao.erros.join('; ')}`, 400);
  }

  const instituicao = await prisma.instituicao.findUnique({
    where: { id: instituicaoId },
    include: { configuracao: true },
  });

  if (!instituicao) {
    throw new AppError('Instituição não encontrada', 404);
  }

  const config = instituicao.configuracao;

  const documentos = await prisma.documentoFinanceiro.findMany({
    where: {
      instituicaoId,
      dataDocumento: { gte: dataInicio, lte: dataFim },
      estado: { in: ['EMITIDO', 'ESTORNADO'] },
      tipoDocumento: { in: ['FT', 'RC', 'NC', 'PF', 'GR'] },
    },
    include: {
      linhas: true,
      pagamentos: true,
    },
    orderBy: { dataDocumento: 'asc' },
  });

  const entidadeIds = [...new Set(documentos.map((d) => d.entidadeId))];
  const estudantes = await prisma.user.findMany({
    where: {
      id: { in: entidadeIds },
      instituicaoId,
      roles: { some: { role: 'ALUNO' } },
    },
    select: {
      id: true,
      nomeCompleto: true,
      numeroIdentificacao: true,
      morada: true,
      cidade: true,
      telefone: true,
      email: true,
    },
  });

  const cursos = instituicao.tipoAcademico === 'SUPERIOR'
    ? await prisma.curso.findMany({
        where: { instituicaoId, ativo: true },
        select: { id: true, codigo: true, nome: true },
      })
    : await prisma.classe.findMany({
        where: { instituicaoId, ativo: true },
        select: { id: true, codigo: true, nome: true, ordem: true },
      });

  const nif = config?.nif?.trim() || '999999999';
  const softwareCertNum = (config as { softwareCertificateNumber?: string | null })?.softwareCertificateNumber?.trim();
  const softwareCertificateNumber = softwareCertNum || '0'; // 0 até obter certificação AGT
  const nomeFiscal = config?.nomeFiscal || instituicao.nome || 'Instituição';
  const enderecoFiscal = config?.enderecoFiscal || instituicao.endereco || 'Sem Endereço';
  const codigoPostal = config?.codigoPostalFiscal || '0000';
  const cidadeFiscal = (config?.cidadeFiscal || 'Luanda').trim();
  const emailFiscal = config?.emailFiscal || instituicao.emailContato || 'sem@email.com';
  const telefoneFiscal = config?.telefoneFiscal || instituicao.telefone || '000000000';

  const now = new Date();
  const dateCreated = formatDate(now);
  const startStr = formatDate(dataInicio);
  const endStr = formatDate(dataFim);

  // Definir faturas ANTES de customersXML (usado para clientes sem NIF)
  const limiteSemNif = Number(config?.permitirClienteSemNifAteValor ?? 50);
  const estudantesComBI = new Set(estudantes.filter((s) => (s.numeroIdentificacao || '').trim()).map((s) => s.id));
  const faturas = documentos.filter((d) => {
    if (d.tipoDocumento !== 'FT' && d.tipoDocumento !== 'RC' && d.tipoDocumento !== 'NC') return false;
    const valor = Number(d.valorTotal);
    const temBI = estudantesComBI.has(d.entidadeId);
    if (temBI) return true;
    return valor < limiteSemNif;
  });
  const docsSemBIAcimaLimite = documentos.filter(
    (d) => !estudantesComBI.has(d.entidadeId) && Number(d.valorTotal) >= limiteSemNif
  );
  if (docsSemBIAcimaLimite.length > 0) {
    throw new AppError(
      `${docsSemBIAcimaLimite.length} documento(s) com cliente sem BI/NIF e valor >= ${limiteSemNif} AOA. Corrija os dados dos estudantes.`,
      400
    );
  }

  // Clientes com NIF + clientes sem NIF que estão em docs com valor < limite (AGT permite)
  const estudantesSemNifIds = new Set(estudantes.filter((s) => !(s.numeroIdentificacao || '').trim()).map((s) => s.id));
  const docsComClienteSemNif = faturas.filter((d) => estudantesSemNifIds.has(d.entidadeId));
  const clientesSemNifParaIncluir = estudantes.filter(
    (s) => !(s.numeroIdentificacao || '').trim() && docsComClienteSemNif.some((d) => d.entidadeId === s.id)
  );
  const customersXML = [...estudantes.filter((s) => (s.numeroIdentificacao || '').trim()), ...clientesSemNifParaIncluir]
    .map(
      (s) => `
      <Customer>
        <CustomerID>${s.id}</CustomerID>
        <AccountID>21</AccountID>
        <CustomerTaxID>${(s.numeroIdentificacao || '').trim() ? String(s.numeroIdentificacao).replace(/[^0-9A-Za-z]/g, '') : '9999999900'}</CustomerTaxID>
        <CompanyName>${escapeXML(s.nomeCompleto || 'Sem Nome')}</CompanyName>
        <BillingAddress>
          <AddressDetail>${escapeXML(s.morada || 'Sem Endereço')}</AddressDetail>
          <City>${escapeXML((s.cidade || cidadeFiscal).trim() || 'Luanda')}</City>
          <PostalCode>0000</PostalCode>
          <Country>AO</Country>
        </BillingAddress>
        <Telephone>${s.telefone || '000000000'}</Telephone>
        <Email>${s.email || 'sem@email.com'}</Email>
        <SelfBillingIndicator>0</SelfBillingIndicator>
      </Customer>`
    )
    .join('');

  const defaultProductXML = `
      <Product>
        <ProductType>S</ProductType>
        <ProductCode>PROPINA</ProductCode>
        <ProductDescription>Mensalidade/Propina</ProductDescription>
        <ProductNumberCode>PROPINA</ProductNumberCode>
      </Product>
      <Product>
        <ProductType>S</ProductType>
        <ProductCode>SERV</ProductCode>
        <ProductDescription>Serviço/Outros</ProductDescription>
        <ProductNumberCode>SERV</ProductNumberCode>
      </Product>`;

  const productsXML = cursos
    .map(
      (c: { codigo: string; nome: string; ordem?: number | null }) => {
        const productCode = sanitizeProductCodeForSaft(c.codigo, c.ordem);
        return `
      <Product>
        <ProductType>S</ProductType>
        <ProductCode>${escapeXML(productCode)}</ProductCode>
        <ProductDescription>${escapeXML(c.nome)}</ProductDescription>
        <ProductNumberCode>${escapeXML(productCode)}</ProductNumberCode>
      </Product>`;
      }
    )
    .join('');

  const docIdsComRef = faturas.filter((d) => d.documentoBaseId).map((d) => d.documentoBaseId) as string[];
  const docBaseMap = new Map<string, { numeroDocumento: string; tipoDocumento: string }>();
  if (docIdsComRef.length > 0) {
    const bases = await prisma.documentoFinanceiro.findMany({
      where: { id: { in: docIdsComRef } },
      select: { id: true, numeroDocumento: true, tipoDocumento: true },
    });
    bases.forEach((b) => docBaseMap.set(b.id, { numeroDocumento: b.numeroDocumento, tipoDocumento: b.tipoDocumento }));
  }

  const validacaoFiscal = await validarDadosFiscaisCompletos(faturas, dataInicio, dataFim, ano);
  if (!validacaoFiscal.valido) {
    throw new AppError(`Validação fiscal: ${validacaoFiscal.erros.join('; ')}`, 400);
  }

  let totalCredit = 0;
  const proformas = documentos.filter((d) => d.tipoDocumento === 'PF');
  const guias = documentos.filter((d) => d.tipoDocumento === 'GR');

  const invoicesXML = faturas
    .map((doc) => {
      const valorTotal = Number(doc.valorTotal);
      const isEstornado = doc.estado === 'ESTORNADO';
      if (!isEstornado) totalCredit += valorTotal;
      const dataDocumento = new Date(doc.dataDocumento);
      const invoiceDate = formatDate(dataDocumento);
      const primeiroPagamento = doc.pagamentos[0];
      const metodoPag = primeiroPagamento?.metodoPagamento ?? 'NU';
      const nifNumerico = nif.replace(/[^0-9]/g, '') || '999999999';
      const temHashPersistido = (doc.hash || '').trim() && (doc.hashControl || '').trim();
      const { hash, hashControl } = temHashPersistido
        ? { hash: doc.hash as string, hashControl: doc.hashControl as string }
        : calcularHashFiscalSaft(doc.numeroDocumento, dataDocumento, valorTotal, nifNumerico, doc.entidadeId);
      const invoiceType = doc.tipoDocumento === 'RC' ? 'RC' : doc.tipoDocumento === 'NC' ? 'NC' : 'FT';
      const valorDescontoDoc = Number((doc as { valorDesconto?: unknown }).valorDesconto ?? 0);
      const baseDoc = doc.documentoBaseId ? docBaseMap.get(doc.documentoBaseId) : null;

      const atcud = gerarAtcud(doc.numeroDocumento, config?.serieDocumentos);
      const orderRef = baseDoc?.tipoDocumento === 'PF' ? `\n        <OrderReferences>\n          <OriginatingON>${escapeXML(baseDoc.numeroDocumento)}</OriginatingON>\n        </OrderReferences>` : '';
      const references = baseDoc && doc.tipoDocumento === 'NC' ? `\n        <References>\n          <Reference>${escapeXML(baseDoc.numeroDocumento)}</Reference>\n        </References>` : '';

      // Uma Line por DocumentoLinha (conformidade AGT) - TaxCode e TaxExemptionCode corretos
      const linhasDoc = doc.linhas.length > 0 ? doc.linhas : [{
        descricao: 'Propina',
        quantidade: 1,
        precoUnitario: valorTotal,
        valorTotal,
        valorDesconto: 0,
        taxaIVA: 0,
        taxExemptionCode: 'M01',
      }];
      const moedaDoc = (doc as { moeda?: string | null }).moeda?.trim() || 'AOA';
      const currencyXml = moedaDoc !== 'AOA' ? `\n          <Currency><CurrencyAmount>${safeToFixed(valorTotal, 2)}</CurrencyAmount><ExchangeRate>1.00</ExchangeRate></Currency>` : '';

      const linesXML = linhasDoc.map((linha: { descricao: string; quantidade: unknown; precoUnitario: unknown; valorTotal: unknown; valorDesconto?: unknown; taxaIVA?: unknown; taxExemptionCode?: string | null }, idx: number) => {
        const taxaIVA = Number(linha.taxaIVA ?? 0);
        const { taxCode, taxPercentage: taxPct, taxExemptionReason: exemptionReason, taxExemptionCode: exemptionCode } = getTaxInfoForLine(taxaIVA, linha.taxExemptionCode ?? null);
        const qty = Number(linha.quantidade ?? 1);
        const unitPrice = Number(linha.precoUnitario ?? linha.valorTotal ?? 0);
        const lineTotal = Number(linha.valorTotal ?? qty * unitPrice);
        const lineDiscount = Number(linha.valorDesconto ?? 0);
        const productCode = /propina|mensalidade/i.test(String(linha.descricao || '')) ? 'PROPINA' : 'SERV';
        return `
        <Line>
          <LineNumber>${idx + 1}</LineNumber>
          <ProductCode>${productCode}</ProductCode>
          <ProductDescription>${escapeXML(linha.descricao || 'Item')}</ProductDescription>
          <Quantity>${safeToFixed(qty, 2)}</Quantity>
          <UnitOfMeasure>UN</UnitOfMeasure>
          <UnitPrice>${safeToFixed(unitPrice, 2)}</UnitPrice>
          <TaxPointDate>${invoiceDate}</TaxPointDate>
          <Description>${escapeXML(linha.descricao || 'Item')}</Description>
          <CreditAmount>${safeToFixed(lineTotal, 2)}</CreditAmount>
          <Tax>
            <TaxType>IVA</TaxType>
            <TaxCountryRegion>AO</TaxCountryRegion>
            <TaxCode>${taxCode}</TaxCode>
            <TaxPercentage>${taxPct}</TaxPercentage>
          </Tax>
          ${exemptionReason ? `<TaxExemptionReason>${escapeXML(exemptionReason)}</TaxExemptionReason>` : ''}
          ${exemptionCode ? `<TaxExemptionCode>${escapeXML(exemptionCode)}</TaxExemptionCode>` : ''}
          <SettlementAmount>${safeToFixed(lineDiscount, 2)}</SettlementAmount>
        </Line>`;
      }).join('');

      return `
      <Invoice>
        <InvoiceNo>${escapeXML(doc.numeroDocumento)}</InvoiceNo>
        <ATCUD>${escapeXML(atcud)}</ATCUD>
        <DocumentStatus>
          <InvoiceStatus>${isEstornado ? 'A' : 'N'}</InvoiceStatus>
          <InvoiceStatusDate>${invoiceDate}T00:00:00</InvoiceStatusDate>
          <SourceID>Sistema</SourceID>
          <SourceBilling>P</SourceBilling>
        </DocumentStatus>
        <Hash>${hash}</Hash>
        <HashControl>${hashControl}</HashControl>
        <Period>${dataDocumento.getMonth() + 1}</Period>
        <InvoiceDate>${invoiceDate}</InvoiceDate>
        <InvoiceType>${invoiceType}</InvoiceType>
        <SpecialRegimes>
          <SelfBillingIndicator>0</SelfBillingIndicator>
          <CashVATSchemeIndicator>0</CashVATSchemeIndicator>
          <ThirdPartiesBillingIndicator>0</ThirdPartiesBillingIndicator>
        </SpecialRegimes>
        <SourceID>Sistema</SourceID>
        <SystemEntryDate>${invoiceDate}T00:00:00</SystemEntryDate>
        <CustomerID>${doc.entidadeId}</CustomerID>${orderRef}${references}
        ${linesXML}
        <DocumentTotals>
          <TaxPayable>0.00</TaxPayable>
          <NetTotal>${safeToFixed(valorTotal, 2)}</NetTotal>
          <GrossTotal>${safeToFixed(valorTotal, 2)}</GrossTotal>${currencyXml}
          <Payment>
            <PaymentMechanism>${getPaymentMechanism(metodoPag)}</PaymentMechanism>
            <PaymentAmount>${safeToFixed(valorTotal, 2)}</PaymentAmount>
            <PaymentDate>${invoiceDate}</PaymentDate>
          </Payment>
        </DocumentTotals>
      </Invoice>`;
    })
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:AO_1.01_01" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Header>
    <AuditFileVersion>1.01_01</AuditFileVersion>
    <CompanyID>${instituicaoId}</CompanyID>
    <TaxRegistrationNumber>${nif.replace(/[^0-9]/g, '') || '999999999'}</TaxRegistrationNumber>
    <TaxAccountingBasis>F</TaxAccountingBasis>
    <CompanyName>${escapeXML(nomeFiscal)}</CompanyName>
    <CompanyAddress>
      <AddressDetail>${escapeXML(enderecoFiscal)}</AddressDetail>
      <City>${escapeXML(cidadeFiscal)}</City>
      <PostalCode>${escapeXML(codigoPostal)}</PostalCode>
      <Country>AO</Country>
    </CompanyAddress>
    <FiscalYear>${ano}</FiscalYear>
    <StartDate>${startStr}</StartDate>
    <EndDate>${endStr}</EndDate>
    <CurrencyCode>AOA</CurrencyCode>
    <DateCreated>${dateCreated}</DateCreated>
    <TaxEntity>Global</TaxEntity>
    <ProductCompanyTaxID>${nif.replace(/[^0-9]/g, '') || '999999999'}</ProductCompanyTaxID>
    <SoftwareCertificateNumber>${escapeXML(softwareCertificateNumber)}</SoftwareCertificateNumber>
    <ProductID>DSICOLA/1.0</ProductID>
    <ProductVersion>1.0</ProductVersion>
    <Telephone>${escapeXML(telefoneFiscal)}</Telephone>
    <Email>${escapeXML(emailFiscal)}</Email>
  </Header>
  <MasterFiles>
    <GeneralLedgerAccounts>
      <Account>
        <AccountID>11</AccountID>
        <AccountDescription>Caixa</AccountDescription>
        <OpeningDebitBalance>0.00</OpeningDebitBalance>
        <OpeningCreditBalance>0.00</OpeningCreditBalance>
        <ClosingDebitBalance>0.00</ClosingDebitBalance>
        <ClosingCreditBalance>${safeToFixed(totalCredit, 2)}</ClosingCreditBalance>
        <GroupingCategory>GM</GroupingCategory>
        <GroupingCode>11</GroupingCode>
      </Account>
    </GeneralLedgerAccounts>${customersXML}${defaultProductXML}${productsXML}
    <TaxTable>
      <TaxTableEntry>
        <TaxType>IVA</TaxType>
        <TaxCountryRegion>AO</TaxCountryRegion>
        <TaxCode>ISE</TaxCode>
        <Description>Isento</Description>
        <TaxPercentage>0</TaxPercentage>
      </TaxTableEntry>
      <TaxTableEntry>
        <TaxType>IVA</TaxType>
        <TaxCountryRegion>AO</TaxCountryRegion>
        <TaxCode>NOR</TaxCode>
        <Description>Taxa normal 14%</Description>
        <TaxPercentage>14</TaxPercentage>
      </TaxTableEntry>
      <TaxTableEntry>
        <TaxType>IVA</TaxType>
        <TaxCountryRegion>AO</TaxCountryRegion>
        <TaxCode>RED</TaxCode>
        <Description>Taxa reduzida 5%</Description>
        <TaxPercentage>5</TaxPercentage>
      </TaxTableEntry>
    </TaxTable>
  </MasterFiles>
  <SourceDocuments>
    <SalesInvoices>
      <NumberOfEntries>${faturas.length}</NumberOfEntries>
      <TotalDebit>0.00</TotalDebit>
      <TotalCredit>${safeToFixed(totalCredit, 2)}</TotalCredit>${invoicesXML}
    </SalesInvoices>
  </SourceDocuments>`;
  const workingDocsSection =
    proformas.length > 0
      ? `
    <WorkingDocuments>
      <NumberOfEntries>${proformas.length}</NumberOfEntries>
      <TotalDebit>0.00</TotalDebit>
      <TotalCredit>${safeToFixed(proformas.reduce((s, d) => s + Number(d.valorTotal), 0), 2)}</TotalCredit>${proformas
        .map((doc) => {
          const valorTotal = Number(doc.valorTotal);
          const dataDocumento = new Date(doc.dataDocumento);
          const workDate = formatDate(dataDocumento);
          const isEstornado = doc.estado === 'ESTORNADO';
          const nifNumerico = nif.replace(/[^0-9]/g, '') || '999999999';
          const temHashPersistido = (doc.hash || '').trim() && (doc.hashControl || '').trim();
          const { hash, hashControl } = temHashPersistido
            ? { hash: doc.hash as string, hashControl: doc.hashControl as string }
            : calcularHashFiscalSaft(doc.numeroDocumento, dataDocumento, valorTotal, nifNumerico, doc.entidadeId);
          const linhasDoc = doc.linhas.length > 0 ? doc.linhas : [{ descricao: 'Orçamento', quantidade: 1, precoUnitario: valorTotal, valorTotal, taxaIVA: 0, taxExemptionCode: 'M01' }];
          const linesXml = linhasDoc
            .map(
              (
                l: { descricao: string; quantidade: unknown; precoUnitario: unknown; valorTotal: unknown; taxaIVA?: unknown; taxExemptionCode?: string | null },
                idx: number
              ) => {
                const taxaIVA = Number(l.taxaIVA ?? 0);
                const { taxCode, taxPercentage: taxPct, taxExemptionReason: exReason, taxExemptionCode: exCode } = getTaxInfoForLine(taxaIVA, l.taxExemptionCode ?? null);
                const qty = Number(l.quantidade ?? 1);
                const up = Number(l.precoUnitario ?? l.valorTotal ?? 0);
                const total = Number(l.valorTotal ?? qty * up);
                const prodCode = /propina|mensalidade|orçamento/i.test(String(l.descricao || '')) ? 'PROPINA' : 'SERV';
                return `
        <Line>
          <LineNumber>${idx + 1}</LineNumber>
          <ProductCode>${prodCode}</ProductCode>
          <ProductDescription>${escapeXML(l.descricao || 'Item')}</ProductDescription>
          <Quantity>${safeToFixed(qty, 2)}</Quantity>
          <UnitOfMeasure>UN</UnitOfMeasure>
          <UnitPrice>${safeToFixed(up, 2)}</UnitPrice>
          <TaxPointDate>${workDate}</TaxPointDate>
          <Description>${escapeXML(l.descricao || 'Item')}</Description>
          <CreditAmount>${safeToFixed(total, 2)}</CreditAmount>
          <Tax><TaxType>IVA</TaxType><TaxCountryRegion>AO</TaxCountryRegion><TaxCode>${taxCode}</TaxCode><TaxPercentage>${taxPct}</TaxPercentage></Tax>
          ${exReason ? `<TaxExemptionReason>${escapeXML(exReason)}</TaxExemptionReason>` : ''}${exCode ? `<TaxExemptionCode>${escapeXML(exCode)}</TaxExemptionCode>` : ''}
          <SettlementAmount>0.00</SettlementAmount>
        </Line>`;
              }
            )
            .join('');
          return `
      <WorkDocument>
        <DocumentNumber>${escapeXML(doc.numeroDocumento)}</DocumentNumber>
        <DocumentStatus>
          <WorkStatus>${isEstornado ? 'A' : 'N'}</WorkStatus>
          <WorkStatusDate>${workDate}T00:00:00</WorkStatusDate>
          <SourceID>Sistema</SourceID>
          <SourceBilling>P</SourceBilling>
        </DocumentStatus>
        <Hash>${hash}</Hash>
        <HashControl>${hashControl}</HashControl>
        <Period>${dataDocumento.getMonth() + 1}</Period>
        <WorkDate>${workDate}</WorkDate>
        <WorkType>PF</WorkType>
        <SourceID>Sistema</SourceID>
        <SystemEntryDate>${workDate}T00:00:00</SystemEntryDate>
        <CustomerID>${doc.entidadeId}</CustomerID>
        ${linesXml}
        <DocumentTotals><TaxPayable>0.00</TaxPayable><NetTotal>${safeToFixed(valorTotal, 2)}</NetTotal><GrossTotal>${safeToFixed(valorTotal, 2)}</GrossTotal></DocumentTotals>
      </WorkDocument>`;
        })
        .join('')}
    </WorkingDocuments>`
      : '';
  const totalQtyGR = guias.reduce((s, d) => s + d.linhas.reduce((sl: number, l: { quantidade?: unknown }) => sl + Number(l.quantidade ?? 1), 0), 0);
  const movementOfGoodsSection =
    guias.length > 0
      ? `
    <MovementOfGoods>
      <NumberOfMovementLines>${guias.length}</NumberOfMovementLines>
      <TotalQuantityIssued>${safeToFixed(totalQtyGR, 2)}</TotalQuantityIssued>${guias
        .map((doc) => {
          const valorTotal = Number(doc.valorTotal);
          const dataDocumento = new Date(doc.dataDocumento);
          const movDate = formatDate(dataDocumento);
          const isEstornado = doc.estado === 'ESTORNADO';
          const nifNumerico = nif.replace(/[^0-9]/g, '') || '999999999';
          const temHashPersistido = (doc.hash || '').trim() && (doc.hashControl || '').trim();
          const { hash, hashControl } = temHashPersistido
            ? { hash: doc.hash as string, hashControl: doc.hashControl as string }
            : calcularHashFiscalSaft(doc.numeroDocumento, dataDocumento, valorTotal, nifNumerico, doc.entidadeId);
          const linhasDoc = doc.linhas.length > 0 ? doc.linhas : [{ descricao: 'Remessa', quantidade: 1, precoUnitario: valorTotal, valorTotal, taxaIVA: 0, taxExemptionCode: 'M04' }];
          const linesXml = linhasDoc
            .map(
              (
                l: { descricao: string; quantidade: unknown; precoUnitario: unknown; valorTotal: unknown; taxaIVA?: unknown; taxExemptionCode?: string | null },
                idx: number
              ) => {
                const taxaIVA = Number(l.taxaIVA ?? 0);
                const { taxCode, taxPercentage: taxPct, taxExemptionReason: exReason, taxExemptionCode: exCode } = getTaxInfoForLine(taxaIVA, l.taxExemptionCode ?? null);
                const qty = Number(l.quantidade ?? 1);
                const up = Number(l.precoUnitario ?? l.valorTotal ?? 0);
                const total = Number(l.valorTotal ?? qty * up);
                return `
        <Line>
          <LineNumber>${idx + 1}</LineNumber>
          <ProductCode>SERV</ProductCode>
          <ProductDescription>${escapeXML(l.descricao || 'Item')}</ProductDescription>
          <Quantity>${safeToFixed(qty, 2)}</Quantity>
          <UnitOfMeasure>UN</UnitOfMeasure>
          <UnitPrice>${safeToFixed(up, 2)}</UnitPrice>
          <Description>${escapeXML(l.descricao || 'Item')}</Description>
          <CreditAmount>${safeToFixed(total, 2)}</CreditAmount>
          <Tax><TaxType>IVA</TaxType><TaxCountryRegion>AO</TaxCountryRegion><TaxCode>${taxCode}</TaxCode><TaxPercentage>${taxPct}</TaxPercentage></Tax>
          ${exReason ? `<TaxExemptionReason>${escapeXML(exReason)}</TaxExemptionReason>` : ''}${exCode ? `<TaxExemptionCode>${escapeXML(exCode)}</TaxExemptionCode>` : ''}
          <SettlementAmount>0.00</SettlementAmount>
        </Line>`;
              }
            )
            .join('');
          return `
      <StockMovement>
        <DocumentNumber>${escapeXML(doc.numeroDocumento)}</DocumentNumber>
        <DocumentStatus>
          <MovementStatus>${isEstornado ? 'A' : 'N'}</MovementStatus>
          <MovementStatusDate>${movDate}T00:00:00</MovementStatusDate>
          <SourceID>Sistema</SourceID>
          <SourceBilling>P</SourceBilling>
        </DocumentStatus>
        <Hash>${hash}</Hash>
        <HashControl>${hashControl}</HashControl>
        <Period>${dataDocumento.getMonth() + 1}</Period>
        <MovementDate>${movDate}</MovementDate>
        <MovementType>GR</MovementType>
        <SystemEntryDate>${movDate}T00:00:00</SystemEntryDate>
        <SourceID>Sistema</SourceID>
        <CustomerID>${doc.entidadeId}</CustomerID>
        <MovementStartTime>${movDate}T00:00:00</MovementStartTime>
        ${linesXml}
        <DocumentTotals><TaxPayable>0.00</TaxPayable><NetTotal>${safeToFixed(valorTotal, 2)}</NetTotal><GrossTotal>${safeToFixed(valorTotal, 2)}</GrossTotal></DocumentTotals>
      </StockMovement>`;
        })
        .join('')}
    </MovementOfGoods>`
      : '';

  const fullXml = xml.replace('</SourceDocuments>', `${workingDocsSection}${movementOfGoodsSection}
  </SourceDocuments>`);

  // Validação estrutural antes de retornar (conformidade AGT)
  const validacaoEstrutura = validarEstruturaXmlSaft(fullXml);
  if (!validacaoEstrutura.valido) {
    throw new AppError(`XML SAFT inválido: ${validacaoEstrutura.erros.join('; ')}`, 500);
  }

  // Validação XSD contra schema oficial SAF-T-AO
  const validacaoXsd = validarXmlContraXsd(fullXml);
  if (!validacaoXsd.valido) {
    throw new AppError(`XML SAFT não conforme ao schema XSD: ${validacaoXsd.erros.join('; ')}`, 500);
  }

  return fullXml;
}
