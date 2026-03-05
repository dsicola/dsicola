import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SmartSearch } from '@/components/common/SmartSearch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { FileText, Download, CheckCircle, AlertCircle, Loader2, FileArchive, History } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { instituicoesApi, saftExportsApi } from '@/services/api';
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

const ANOS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);
const MESES = [
  { value: 0, label: 'Ano inteiro' },
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

const ExportarSAFT = () => {
  const { user, role } = useAuth();
  const { instituicao, instituicaoId } = useInstituicao();
  const { toast } = useToast();
  const { searchInstituicoes } = useInstituicaoSearch();

  const [ano, setAno] = useState(new Date().getFullYear());
  const [mes, setMes] = useState<number>(0);
  const [instituicaoSelecionada, setInstituicaoSelecionada] = useState<string | undefined>(undefined);
  const [instituicoes, setInstituicoes] = useState<Instituicao[]>([]);
  const [historico, setHistorico] = useState<SAFTExport[]>([]);
  const [gerando, setGerando] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = role === 'SUPER_ADMIN';

  useEffect(() => {
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
      const data = await saftExportsApi.getAll({ instituicaoId: instId });
      setHistorico(data || []);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    }
  };

  const exportarSAFT = async () => {
    const instId = isSuperAdmin ? instituicaoSelecionada : instituicaoId;

    if (!instId) {
      toast({
        title: 'Erro',
        description: 'Selecione uma instituição',
        variant: 'destructive',
      });
      return;
    }

    setGerando(true);
    setValidationErrors([]);

    try {
      const blob = await saftExportsApi.exportXml({
        instituicaoId: instId,
        ano,
        mes: mes > 0 ? mes : undefined,
      });

      if (blob instanceof Blob && blob.type === 'application/json') {
        const text = await blob.text();
        const err = JSON.parse(text);
        setValidationErrors([err.message || 'Erro ao gerar SAFT']);
        toast({
          title: 'Erro de validação',
          description: err.message,
          variant: 'destructive',
        });
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const instName = isSuperAdmin
        ? instituicoes.find((i) => i.id === instituicaoSelecionada)?.nome || 'INSTITUICAO'
        : instituicao?.nome || 'INSTITUICAO';
      const nomeLimpo = instName
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9]/g, '-')
        .replace(/-+/g, '-');
      const filename = `saft-${nomeLimpo}-${ano}${mes > 0 ? `-${String(mes).padStart(2, '0')}` : ''}.xml`;

      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'SAFT Exportado',
        description: 'Arquivo XML baixado com sucesso.',
      });

      fetchHistorico();
    } catch (error: any) {
      let msg = error?.message || 'Erro ao exportar SAFT';
      const data = error?.response?.data;
      if (data instanceof Blob) {
        try {
          const text = await data.text();
          const parsed = JSON.parse(text);
          msg = parsed.message || msg;
        } catch {
          /* ignore */
        }
      } else if (data?.message) {
        msg = data.message;
      }
      setValidationErrors([msg]);
      toast({
        title: 'Erro',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setGerando(false);
    }
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
    } catch {
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
            Gere o arquivo SAFT (Standard Audit File for Tax) em conformidade com a legislação angolana. Os dados são
            gerados a partir dos documentos fiscais (Faturas e Recibos).
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Configuração da Exportação
              </CardTitle>
              <CardDescription>
                Defina o período (Ano e Mês) e exporte o arquivo SAFT-AO
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
                  <Label>Ano</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={ano}
                    onChange={(e) => setAno(parseInt(e.target.value, 10))}
                  >
                    {ANOS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Mês</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={mes}
                    onChange={(e) => setMes(parseInt(e.target.value, 10))}
                  >
                    {MESES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
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

              <Button
                onClick={exportarSAFT}
                disabled={gerando || (!isSuperAdmin && !instituicaoId)}
                className="w-full"
              >
                {gerando ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Exportando...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar SAFT
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Informações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                O SAFT é gerado a partir dos <strong>documentos fiscais</strong> (Faturas e Recibos) criados
                automaticamente quando:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Gera propinas/mensalidades → Fatura (FT)</li>
                <li>Registra pagamento → Recibo (RC)</li>
              </ul>
              <p className="text-sm text-muted-foreground">
                Configure NIF, nome e email fiscal em <strong>Configurações da Instituição → Dados Fiscais</strong>.
              </p>
            </CardContent>
          </Card>
        </div>

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
              <div className="rounded-md border overflow-x-auto -mx-1 sm:mx-0 max-w-full">
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
                        <TableCell>{formatDate(item.created_at, 'dd/MM/yyyy HH:mm')}</TableCell>
                        <TableCell>
                          {formatDate(item.periodo_inicio, 'dd/MM/yyyy')} - {formatDate(item.periodo_fim, 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{item.arquivo_nome}</TableCell>
                        <TableCell>{item.total_clientes}</TableCell>
                        <TableCell>{item.total_faturas}</TableCell>
                        <TableCell>{formatCurrency(item.valor_total)}</TableCell>
                        <TableCell>{item.usuario_nome}</TableCell>
                        <TableCell>
                          <Badge variant={item.status === 'gerado' ? 'default' : 'secondary'}>{item.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ExportarSAFT;
