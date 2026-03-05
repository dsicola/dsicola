import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { format } from 'date-fns';

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
 * Validações obrigatórias antes de gerar SAFT
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
  }

  const emailFiscal = config?.emailFiscal || config?.email_fiscal || instituicao?.emailContato;
  if (!emailFiscal?.trim()) {
    erros.push('Email fiscal/contato não definido');
  }

  const nomeFiscal = config?.nomeFiscal || config?.nome_fiscal || instituicao?.nome;
  if (!nomeFiscal?.trim()) {
    erros.push('Nome fiscal não definido');
  }

  const documentos = await prisma.documentoFinanceiro.count({
    where: {
      instituicaoId,
      dataDocumento: { gte: dataInicio, lte: dataFim },
      estado: 'EMITIDO',
    },
  });

  if (documentos === 0) {
    erros.push('Nenhum documento fiscal no período. Gere propinas e registre pagamentos primeiro.');
  }

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
      estado: 'EMITIDO',
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
        select: { id: true, codigo: true, nome: true },
      });

  const nif = config?.nif?.trim() || '999999999';
  const nomeFiscal = config?.nomeFiscal || config?.nome_fiscal || instituicao.nome || 'Instituição';
  const enderecoFiscal = config?.enderecoFiscal || config?.endereco_fiscal || instituicao.endereco || 'Sem Endereço';
  const codigoPostal = config?.codigoPostalFiscal || config?.codigo_postal_fiscal || '0000';
  const emailFiscal = config?.emailFiscal || config?.email_fiscal || instituicao.emailContato || 'sem@email.com';
  const telefoneFiscal = config?.telefoneFiscal || config?.telefone_fiscal || instituicao.telefone || '000000000';

  const now = new Date();
  const dateCreated = format(now, 'yyyy-MM-dd');
  const startStr = format(dataInicio, 'yyyy-MM-dd');
  const endStr = format(dataFim, 'yyyy-MM-dd');

  const customersXML = estudantes
    .filter((s) => (s.numeroIdentificacao || '').trim())
    .map(
      (s) => `
      <Customer>
        <CustomerID>${s.id}</CustomerID>
        <AccountID>Desconhecido</AccountID>
        <CustomerTaxID>${String(s.numeroIdentificacao || '').replace(/[^0-9A-Za-z]/g, '')}</CustomerTaxID>
        <CompanyName>${escapeXML(s.nomeCompleto || 'Sem Nome')}</CompanyName>
        <BillingAddress>
          <AddressDetail>${escapeXML(s.morada || 'Sem Endereço')}</AddressDetail>
          <City>Luanda</City>
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
      </Product>`;

  const productsXML = cursos
    .map(
      (c: { codigo: string; nome: string }) => `
      <Product>
        <ProductType>S</ProductType>
        <ProductCode>${escapeXML(c.codigo)}</ProductCode>
        <ProductDescription>${escapeXML(c.nome)}</ProductDescription>
        <ProductNumberCode>${escapeXML(c.codigo)}</ProductNumberCode>
      </Product>`
    )
    .join('');

  const estudantesComBI = new Set(estudantes.filter((s) => (s.numeroIdentificacao || '').trim()).map((s) => s.id));
  const faturas = documentos.filter(
    (d) => (d.tipoDocumento === 'FT' || d.tipoDocumento === 'RC') && estudantesComBI.has(d.entidadeId)
  );

  const docsSemBI = documentos.filter((d) => !estudantesComBI.has(d.entidadeId));
  if (docsSemBI.length > 0) {
    throw new AppError(
      `${docsSemBI.length} documento(s) com cliente sem BI/NIF. Corrija os dados dos estudantes antes de exportar.`,
      400
    );
  }

  let totalCredit = 0;

  const invoicesXML = faturas
    .map((doc) => {
      const valorTotal = Number(doc.valorTotal);
      totalCredit += valorTotal;
      const invoiceDate = format(new Date(doc.dataDocumento), 'yyyy-MM-dd');
      const primeiroPagamento = doc.pagamentos[0];
      const metodoPag = primeiroPagamento?.metodoPagamento ?? 'NU';

      return `
      <Invoice>
        <InvoiceNo>${escapeXML(doc.numeroDocumento)}</InvoiceNo>
        <ATCUD>0</ATCUD>
        <DocumentStatus>
          <InvoiceStatus>N</InvoiceStatus>
          <InvoiceStatusDate>${invoiceDate}T00:00:00</InvoiceStatusDate>
          <SourceID>Sistema</SourceID>
          <SourceBilling>P</SourceBilling>
        </DocumentStatus>
        <Hash>${doc.hash || '0'}</Hash>
        <HashControl>${doc.hashControl || '0'}</HashControl>
        <Period>${new Date(doc.dataDocumento).getMonth() + 1}</Period>
        <InvoiceDate>${invoiceDate}</InvoiceDate>
        <InvoiceType>FR</InvoiceType>
        <SpecialRegimes>
          <SelfBillingIndicator>0</SelfBillingIndicator>
          <CashVATSchemeIndicator>0</CashVATSchemeIndicator>
          <ThirdPartiesBillingIndicator>0</ThirdPartiesBillingIndicator>
        </SpecialRegimes>
        <SourceID>Sistema</SourceID>
        <SystemEntryDate>${invoiceDate}T00:00:00</SystemEntryDate>
        <CustomerID>${doc.entidadeId}</CustomerID>
        <Line>
          <LineNumber>1</LineNumber>
          <ProductCode>PROPINA</ProductCode>
          <ProductDescription>${escapeXML(doc.linhas[0]?.descricao || 'Propina')}</ProductDescription>
          <Quantity>1</Quantity>
          <UnitOfMeasure>UN</UnitOfMeasure>
          <UnitPrice>${safeToFixed(valorTotal, 2)}</UnitPrice>
          <TaxPointDate>${invoiceDate}</TaxPointDate>
          <Description>Pagamento de mensalidade</Description>
          <CreditAmount>${safeToFixed(valorTotal, 2)}</CreditAmount>
          <Tax>
            <TaxType>IVA</TaxType>
            <TaxCountryRegion>AO</TaxCountryRegion>
            <TaxCode>ISE</TaxCode>
            <TaxPercentage>0</TaxPercentage>
          </Tax>
          <TaxExemptionReason>Isento Art. 12</TaxExemptionReason>
          <TaxExemptionCode>M01</TaxExemptionCode>
          <SettlementAmount>0.00</SettlementAmount>
        </Line>
        <DocumentTotals>
          <TaxPayable>0.00</TaxPayable>
          <NetTotal>${safeToFixed(valorTotal, 2)}</NetTotal>
          <GrossTotal>${safeToFixed(valorTotal, 2)}</GrossTotal>
          <Payment>
            <PaymentMechanism>${getPaymentMechanism(metodoPag)}</PaymentMechanism>
            <PaymentAmount>${safeToFixed(valorTotal, 2)}</PaymentAmount>
            <PaymentDate>${invoiceDate}</PaymentDate>
          </Payment>
        </DocumentTotals>
      </Invoice>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:AO_1.01_01" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Header>
    <AuditFileVersion>1.1.3</AuditFileVersion>
    <CompanyID>${instituicaoId}</CompanyID>
    <TaxRegistrationNumber>${nif.replace(/[^0-9]/g, '') || '999999999'}</TaxRegistrationNumber>
    <TaxAccountingBasis>F</TaxAccountingBasis>
    <CompanyName>${escapeXML(nomeFiscal)}</CompanyName>
    <CompanyAddress>
      <AddressDetail>${escapeXML(enderecoFiscal)}</AddressDetail>
      <City>Luanda</City>
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
    <SoftwareCertificateNumber>0</SoftwareCertificateNumber>
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
    </TaxTable>
  </MasterFiles>
  <SourceDocuments>
    <SalesInvoices>
      <NumberOfEntries>${faturas.length}</NumberOfEntries>
      <TotalDebit>0.00</TotalDebit>
      <TotalCredit>${safeToFixed(totalCredit, 2)}</TotalCredit>${invoicesXML}
    </SalesInvoices>
  </SourceDocuments>
</AuditFile>`;
}
