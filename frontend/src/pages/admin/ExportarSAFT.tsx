import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SmartSearch } from '@/components/common/SmartSearch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { FileText, Download, CheckCircle, AlertCircle, Loader2, FileArchive, History } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { instituicoesApi, profilesApi, cursosApi, mensalidadesApi, saftExportsApi, configuracoesInstituicaoApi } from '@/services/api';
import { useInstituicaoSearch } from '@/hooks/useSmartSearch';

interface Instituicao {
  id: string;
  nome: string;
  subdominio: string;
}

interface SAFTExport {
  id: string;
  periodo_inicio: string;
  periodo_fim: string;
  arquivo_nome: string;
  total_clientes: number;
  total_produtos: number;
  total_faturas: number;
  valor_total: number;
  status: string;
  created_at: string;
  usuario_nome: string;
}

const ExportarSAFT = () => {
  const { user, role } = useAuth();
  const { instituicao, instituicaoId } = useInstituicao();
  const { toast } = useToast();
  const { searchInstituicoes } = useInstituicaoSearch();
  
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim, setPeriodoFim] = useState('');
  const [instituicaoSelecionada, setInstituicaoSelecionada] = useState<string | undefined>(undefined);
  const [instituicoes, setInstituicoes] = useState<Instituicao[]>([]);
  const [historico, setHistorico] = useState<SAFTExport[]>([]);
  const [gerando, setGerando] = useState(false);
  const [xmlContent, setXmlContent] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = role === 'SUPER_ADMIN';

  useEffect(() => {
    const currentYear = new Date().getFullYear();
    setPeriodoInicio(`${currentYear}-01-01`);
    setPeriodoFim(`${currentYear}-12-31`);
    
    fetchData();
  }, []);

  useEffect(() => {
    if (instituicaoId) {
      setInstituicaoSelecionada(instituicaoId);
    } else if (!isSuperAdmin) {
      setInstituicaoSelecionada(undefined);
    }
  }, [instituicaoId, isSuperAdmin]);

  useEffect(() => {
    if (instituicaoSelecionada) {
      fetchHistorico();
    }
  }, [instituicaoSelecionada]);

  const fetchData = async () => {
    try {
      if (isSuperAdmin) {
        const instData = await instituicoesApi.getAll({ status: 'ativa' });
        setInstituicoes(instData || []);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setLoading(false);
    }
  };

  const fetchHistorico = async () => {
    const instId = isSuperAdmin ? instituicaoSelecionada : instituicaoId;
    if (!instId) {
      setHistorico([]);
      return;
    }
    
    try {
      const data = await saftExportsApi.getAll({ 
        instituicaoId: instId 
      });
      setHistorico(data || []);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    }
  };

  const validateData = async (instId: string): Promise<{ valid: boolean; errors: string[] }> => {
    const errors: string[] = [];
    
    const instData = await instituicoesApi.getById(instId);
    
    if (!instData) {
      errors.push('Instituição não encontrada');
      return { valid: false, errors };
    }
    
    // Buscar configurações: ADMIN usa token; SUPER_ADMIN passa instId para escopo
    let configData = null;
    try {
      configData = await configuracoesInstituicaoApi.get(isSuperAdmin ? instId : undefined);
    } catch (err) {
      console.error('Erro ao buscar configurações:', err);
    }
    
    // Verificar email fiscal (prioridade) ou email_contato (fallback)
    const emailFiscal = configData?.emailFiscal || configData?.email_fiscal;
    const emailContato = instData.email_contato || instData.emailContato;
    
    if (!emailFiscal && !emailContato) {
      errors.push('Email fiscal/contato da instituição não definido. Configure em Configurações da Instituição > Dados Fiscais');
    }
    
    // Verificar outros dados fiscais obrigatórios
    if (!configData?.nomeFiscal && !configData?.nome_fiscal && !instData.nome) {
      errors.push('Nome fiscal da instituição não definido');
    }
    
    const profiles = await profilesApi.getAll({ instituicaoId: instId });
    
    if (!profiles || profiles.length === 0) {
      errors.push('Nenhum estudante encontrado para esta instituição');
    }
    
    return { valid: errors.length === 0, errors };
  };

  const generateSAFTXML = async () => {
    const instId = isSuperAdmin ? instituicaoSelecionada : instituicaoId;
    
    if (!instId) {
      toast({
        title: 'Erro',
        description: 'Selecione uma instituição',
        variant: 'destructive',
      });
      return;
    }

    if (!periodoInicio || !periodoFim) {
      toast({
        title: 'Erro',
        description: 'Selecione o período de exportação',
        variant: 'destructive',
      });
      return;
    }

    setGerando(true);
    setValidationErrors([]);
    setXmlContent(null);

    try {
      const validation = await validateData(instId);
      if (!validation.valid) {
        setValidationErrors(validation.errors);
        setGerando(false);
        return;
      }

      const instData = await instituicoesApi.getById(instId);
      const students = await profilesApi.getAll({ instituicaoId: instId });
      const courses = await cursosApi.getAll({ instituicaoId: instId, ativo: true });
      const mensalidades = await mensalidadesApi.getAll({ 
        instituicaoId: instId, 
        status: 'Pago',
        dataInicio: periodoInicio,
        dataFim: periodoFim
      });

      const xml = generateXMLContent(instData, students || [], courses || [], mensalidades || [], periodoInicio, periodoFim);
      
      setXmlContent(xml);

      const totalValor = (mensalidades || []).reduce((sum: number, m: any) => sum + (m.valor || 0) + (m.valor_multa || 0), 0);

      // Multi-tenant: NUNCA enviar instituicao_id no body. Backend usa JWT.
      // SUPER_ADMIN: passar instId como query param para escopo.
      await saftExportsApi.create(
        {
          usuario_id: user?.id,
          usuario_nome: (user as any)?.nome_completo || user?.email || 'Desconhecido',
          usuario_email: user?.email || '',
          periodo_inicio: periodoInicio,
          periodo_fim: periodoFim,
          arquivo_nome: generateFileName(instData?.nome || 'INSTITUICAO'),
          total_clientes: students?.length || 0,
          total_produtos: courses?.length || 0,
          total_faturas: mensalidades?.length || 0,
          valor_total: totalValor,
          status: 'gerado'
        },
        isSuperAdmin ? instId : undefined
      );

      toast({
        title: 'SAFT Gerado',
        description: 'Arquivo XML gerado com sucesso. Clique em "Baixar XML" para fazer o download.',
      });

      fetchHistorico();

    } catch (error) {
      console.error('Erro ao gerar SAFT:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao gerar arquivo SAFT',
        variant: 'destructive',
      });
    } finally {
      setGerando(false);
    }
  };

  const generateFileName = (institutionName: string): string => {
    const cleanName = institutionName
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]/g, '-')
      .replace(/-+/g, '-');
    const date = format(new Date(), 'yyyy-MM-dd');
    return `saft-${cleanName}-${date}.xml`;
  };

  const escapeXML = (str: string): string => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const getPaymentMechanism = (method: string | null): string => {
    switch (method?.toLowerCase()) {
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

  const generateXMLContent = (
    instituicaoData: any,
    students: any[],
    courses: any[],
    invoices: any[],
    startDate: string,
    endDate: string
  ): string => {
    const now = new Date();
    const dateCreated = format(now, 'yyyy-MM-dd');
    const fiscalYear = new Date(startDate).getFullYear();

    const customersXML = students.map((s) => `
      <Customer>
        <CustomerID>${s.id}</CustomerID>
        <AccountID>Desconhecido</AccountID>
        <CustomerTaxID>${s.numero_bi || '999999999'}</CustomerTaxID>
        <CompanyName>${escapeXML(s.nome_completo || 'Sem Nome')}</CompanyName>
        <BillingAddress>
          <AddressDetail>${escapeXML(s.morada || 'Sem Endereço')}</AddressDetail>
          <City>Luanda</City>
          <PostalCode>0000</PostalCode>
          <Country>AO</Country>
        </BillingAddress>
        <Telephone>${s.telefone || '000000000'}</Telephone>
        <Email>${s.email || 'sem@email.com'}</Email>
        <SelfBillingIndicator>0</SelfBillingIndicator>
      </Customer>`).join('');

    const productsXML = courses.map((c: any) => `
      <Product>
        <ProductType>S</ProductType>
        <ProductCode>${escapeXML(c.codigo)}</ProductCode>
        <ProductDescription>${escapeXML(c.nome)}</ProductDescription>
        <ProductNumberCode>${escapeXML(c.codigo)}</ProductNumberCode>
      </Product>`).join('');

    const defaultProductXML = `
      <Product>
        <ProductType>S</ProductType>
        <ProductCode>PROPINA</ProductCode>
        <ProductDescription>Mensalidade/Propina</ProductDescription>
        <ProductNumberCode>PROPINA</ProductNumberCode>
      </Product>`;

    const invoicesXML = invoices.map((inv: any, index: number) => {
      const invoiceNo = inv.recibo_numero || `RC${String(index + 1).padStart(6, '0')}`;
      const invoiceDate = inv.data_pagamento || dateCreated;
      const grossTotal = (inv.valor || 0) + (inv.valor_multa || 0);
      
      return `
      <Invoice>
        <InvoiceNo>${invoiceNo}</InvoiceNo>
        <ATCUD>0</ATCUD>
        <DocumentStatus>
          <InvoiceStatus>N</InvoiceStatus>
          <InvoiceStatusDate>${invoiceDate}T00:00:00</InvoiceStatusDate>
          <SourceID>Sistema</SourceID>
          <SourceBilling>P</SourceBilling>
        </DocumentStatus>
        <Hash>0</Hash>
        <HashControl>0</HashControl>
        <Period>${inv.mes_referencia || 1}</Period>
        <InvoiceDate>${invoiceDate}</InvoiceDate>
        <InvoiceType>FR</InvoiceType>
        <SpecialRegimes>
          <SelfBillingIndicator>0</SelfBillingIndicator>
          <CashVATSchemeIndicator>0</CashVATSchemeIndicator>
          <ThirdPartiesBillingIndicator>0</ThirdPartiesBillingIndicator>
        </SpecialRegimes>
        <SourceID>Sistema</SourceID>
        <SystemEntryDate>${invoiceDate}T00:00:00</SystemEntryDate>
        <CustomerID>${inv.aluno_id}</CustomerID>
        <Line>
          <LineNumber>1</LineNumber>
          <ProductCode>PROPINA</ProductCode>
          <ProductDescription>Mensalidade ${inv.mes_referencia}/${inv.ano_referencia}</ProductDescription>
          <Quantity>1</Quantity>
          <UnitOfMeasure>UN</UnitOfMeasure>
          <UnitPrice>${inv.valor?.toFixed(2) || '0.00'}</UnitPrice>
          <TaxPointDate>${invoiceDate}</TaxPointDate>
          <Description>Pagamento de mensalidade</Description>
          <CreditAmount>${grossTotal.toFixed(2)}</CreditAmount>
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
          <NetTotal>${grossTotal.toFixed(2)}</NetTotal>
          <GrossTotal>${grossTotal.toFixed(2)}</GrossTotal>
          <Payment>
            <PaymentMechanism>${getPaymentMechanism(inv.forma_pagamento)}</PaymentMechanism>
            <PaymentAmount>${grossTotal.toFixed(2)}</PaymentAmount>
            <PaymentDate>${invoiceDate}</PaymentDate>
          </Payment>
        </DocumentTotals>
      </Invoice>`;
    }).join('');

    const totalDebit = 0;
    const totalCredit = invoices.reduce((sum: number, inv: any) => sum + (inv.valor || 0) + (inv.valor_multa || 0), 0);

    return `<?xml version="1.0" encoding="UTF-8"?>
<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:AO_1.01_01" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Header>
    <AuditFileVersion>1.1.3</AuditFileVersion>
    <CompanyID>${instituicaoData?.id || 'UNKNOWN'}</CompanyID>
    <TaxRegistrationNumber>${instituicaoData?.email_contato?.replace(/[^0-9]/g, '') || '999999999'}</TaxRegistrationNumber>
    <TaxAccountingBasis>F</TaxAccountingBasis>
    <CompanyName>${escapeXML(instituicaoData?.nome || 'Instituição')}</CompanyName>
    <CompanyAddress>
      <AddressDetail>${escapeXML(instituicaoData?.endereco || 'Sem Endereço')}</AddressDetail>
      <City>Luanda</City>
      <PostalCode>0000</PostalCode>
      <Country>AO</Country>
    </CompanyAddress>
    <FiscalYear>${fiscalYear}</FiscalYear>
    <StartDate>${startDate}</StartDate>
    <EndDate>${endDate}</EndDate>
    <CurrencyCode>AOA</CurrencyCode>
    <DateCreated>${dateCreated}</DateCreated>
    <TaxEntity>Global</TaxEntity>
    <ProductCompanyTaxID>999999999</ProductCompanyTaxID>
    <SoftwareCertificateNumber>0</SoftwareCertificateNumber>
    <ProductID>DSICOLA/1.0</ProductID>
    <ProductVersion>1.0</ProductVersion>
    <Telephone>${instituicaoData?.telefone || '000000000'}</Telephone>
    <Email>${instituicaoData?.email_contato || 'sem@email.com'}</Email>
  </Header>
  <MasterFiles>
    <GeneralLedgerAccounts>
      <Account>
        <AccountID>11</AccountID>
        <AccountDescription>Caixa</AccountDescription>
        <OpeningDebitBalance>0.00</OpeningDebitBalance>
        <OpeningCreditBalance>0.00</OpeningCreditBalance>
        <ClosingDebitBalance>${totalDebit.toFixed(2)}</ClosingDebitBalance>
        <ClosingCreditBalance>${totalCredit.toFixed(2)}</ClosingCreditBalance>
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
      <NumberOfEntries>${invoices.length}</NumberOfEntries>
      <TotalDebit>${totalDebit.toFixed(2)}</TotalDebit>
      <TotalCredit>${totalCredit.toFixed(2)}</TotalCredit>${invoicesXML}
    </SalesInvoices>
  </SourceDocuments>
</AuditFile>`;
  };

  const downloadXML = () => {
    if (!xmlContent) return;
    
    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    const instName = isSuperAdmin 
      ? instituicoes.find(i => i.id === instituicaoSelecionada)?.nome || 'INSTITUICAO'
      : instituicao?.nome || 'INSTITUICAO';
    
    a.href = url;
    a.download = generateFileName(instName);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(value);
  };

  const formatDate = (dateValue: string | null | undefined, formatStr: string = 'dd/MM/yyyy'): string => {
    if (!dateValue) return '-';
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return '-';
      return format(date, formatStr, { locale: pt });
    } catch (error) {
      console.error('Erro ao formatar data:', error, dateValue);
      return '-';
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileArchive className="h-8 w-8" />
            Exportar SAFT-AO
          </h1>
          <p className="text-muted-foreground">
            Gere o arquivo SAFT (Standard Audit File for Tax) em conformidade com a legislação angolana
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Configuration Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Configuração da Exportação
              </CardTitle>
              <CardDescription>
                Defina o período e os parâmetros do arquivo SAFT
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isSuperAdmin && (
                <div className="space-y-2">
                  <Label>Instituição</Label>
                  <SmartSearch
                    placeholder="Digite o nome, subdomínio ou email da instituição..."
                    value={instituicoes?.find((i) => i.id === instituicaoSelecionada)?.nome || ''}
                    selectedId={instituicaoSelecionada || undefined}
                    onSelect={(item) => setInstituicaoSelecionada(item ? item.id : undefined)}
                    onClear={() => setInstituicaoSelecionada(undefined)}
                    searchFn={searchInstituicoes}
                    minSearchLength={1}
                    emptyMessage="Nenhuma instituição encontrada"
                    silent
                  />
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data Início</Label>
                  <Input
                    type="date"
                    value={periodoInicio}
                    onChange={(e) => setPeriodoInicio(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Fim</Label>
                  <Input
                    type="date"
                    value={periodoFim}
                    onChange={(e) => setPeriodoFim(e.target.value)}
                  />
                </div>
              </div>

              {validationErrors.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-destructive">Erros de Validação</p>
                      <ul className="list-disc list-inside text-sm text-destructive/80 mt-1">
                        {validationErrors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button 
                  onClick={generateSAFTXML} 
                  disabled={gerando || (!isSuperAdmin && !instituicaoId)}
                  className="flex-1"
                >
                  {gerando ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Gerar SAFT
                    </>
                  )}
                </Button>
                
                {xmlContent && (
                  <Button onClick={downloadXML} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Baixar XML
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Status da Geração
              </CardTitle>
            </CardHeader>
            <CardContent>
              {xmlContent ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Arquivo gerado com sucesso!</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Clique em "Baixar XML" para fazer o download do arquivo SAFT-AO.
                  </p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Configure os parâmetros e clique em "Gerar SAFT"</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de Exportações
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historico.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhuma exportação registrada</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Clientes</TableHead>
                    <TableHead>Faturas</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historico.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {formatDate(item.created_at, 'dd/MM/yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        {formatDate(item.periodo_inicio, 'dd/MM/yyyy')} - {formatDate(item.periodo_fim, 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{item.arquivo_nome}</TableCell>
                      <TableCell>{item.total_clientes}</TableCell>
                      <TableCell>{item.total_faturas}</TableCell>
                      <TableCell>{formatCurrency(item.valor_total)}</TableCell>
                      <TableCell>{item.usuario_nome}</TableCell>
                      <TableCell>
                        <Badge variant={item.status === 'gerado' ? 'default' : 'secondary'}>
                          {item.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ExportarSAFT;
