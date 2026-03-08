import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import { contabilidadeApi } from '@/services/api';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { useFormatarMoeda } from './useFormatarMoeda';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollText, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const DiarioTab = () => {
  const { instituicaoId, isSuperAdmin } = useTenantFilter();
  const { instituicao } = useInstituicao();
  const { formatarNumero } = useFormatarMoeda();

  const setPeriodo = (tipo: 'mes' | 'mesAnterior' | 'trimestre' | 'ano') => {
    const d = new Date();
    if (tipo === 'mes') {
      setDataInicio(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10));
      setDataFim(d.toISOString().slice(0, 10));
    } else if (tipo === 'mesAnterior') {
      d.setMonth(d.getMonth() - 1);
      setDataInicio(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10));
      setDataFim(new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10));
    } else if (tipo === 'trimestre') {
      const trim = Math.floor(d.getMonth() / 3) * 3;
      setDataInicio(new Date(d.getFullYear(), trim, 1).toISOString().slice(0, 10));
      setDataFim(d.toISOString().slice(0, 10));
    } else {
      setDataInicio(new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10));
      setDataFim(d.toISOString().slice(0, 10));
    }
  };

  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().slice(0, 10));

  const { data: linhas = [], isLoading } = useQuery({
    queryKey: ['diario', instituicaoId, dataInicio, dataFim],
    queryFn: () => contabilidadeApi.getDiario({ dataInicio, dataFim }),
    enabled: (!!instituicaoId || isSuperAdmin) && !!dataInicio && !!dataFim,
  });

  const exportarPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    const footerY = pageHeight - 10;
    let y = 18;

    const addHeader = () => {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(instituicao?.nome || 'Instituição', margin, y);
      y += 5;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Livro Diário · Período: ${format(new Date(dataInicio), 'dd/MM/yyyy', { locale: ptBR })} a ${format(new Date(dataFim), 'dd/MM/yyyy', { locale: ptBR })}`,
        margin,
        y
      );
      doc.text(`Emitido em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth - margin, y, { align: 'right' });
      y += 8;
    };

    const addFooter = (pag: number, total: number) => {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(128, 128, 128);
      doc.text(`Página ${pag} de ${total}`, pageWidth / 2, footerY, { align: 'center' });
      doc.text('DSICOLA · Módulo Contabilidade', margin, footerY);
      doc.text(`Período: ${dataInicio} a ${dataFim}`, pageWidth - margin, footerY, { align: 'right' });
      doc.setTextColor(0, 0, 0);
    };

    addHeader();

    const colWidths = [22, 25, 50, 35, 35, 25, 25];
    const headers = ['Data', 'Documento', 'Descrição', 'Conta Débito', 'Conta Crédito', 'Débito', 'Crédito'];

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    let x = margin;
    headers.forEach((h, i) => {
      doc.text(h, x, y);
      x += colWidths[i];
    });
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    const linhasPorPagina = Math.floor((footerY - y - 15) / 5);
    const totalPaginas = Math.ceil(linhas.length / linhasPorPagina) || 1;
    let paginaAtual = 1;
    let linhaIdx = 0;

    for (const l of linhas) {
      if (linhaIdx > 0 && linhaIdx % linhasPorPagina === 0) {
        addFooter(paginaAtual, totalPaginas);
        doc.addPage('a4', 'landscape');
        paginaAtual++;
        y = 18;
        addHeader();
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        x = margin;
        headers.forEach((h, i) => {
          doc.text(h, x, y);
          x += colWidths[i];
        });
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
      }

      const dataStr = format(new Date(l.data), 'dd/MM/yyyy', { locale: ptBR });
      const contaLabel = `${l.contaCodigo} ${l.contaDescricao}`;
      const debStr = l.debito > 0 ? formatarNumero(l.debito) : '-';
      const credStr = l.credito > 0 ? formatarNumero(l.credito) : '-';

      const contaDebito = l.debito > 0 ? contaLabel : '-';
      const contaCredito = l.credito > 0 ? contaLabel : '-';

      x = margin;
      doc.text(dataStr, x, y);
      x += colWidths[0];
      doc.text(l.documento, x, y);
      x += colWidths[1];
      doc.text((l.descricao || '').slice(0, 40), x, y);
      x += colWidths[2];
      doc.text(contaDebito.slice(0, 25), x, y);
      x += colWidths[3];
      doc.text(contaCredito.slice(0, 25), x, y);
      x += colWidths[4];
      doc.text(debStr, x, y);
      x += colWidths[5];
      doc.text(credStr, x, y);

      y += 5;
      linhaIdx++;
    }

    addFooter(paginaAtual, totalPaginas);
    doc.save(`livro-diario-${dataInicio}-${dataFim}.pdf`);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            Livro Diário
          </CardTitle>
          <CardDescription>
            Registo cronológico de todos os lançamentos do período. Use os atalhos de período ou defina as datas. <strong>Origem</strong>: Automático (gerado pelo sistema) ou Manual (criado por si).
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setPeriodo('mes')}>Este mês</Button>
            <Button variant="outline" size="sm" onClick={() => setPeriodo('mesAnterior')}>Mês ant.</Button>
            <Button variant="outline" size="sm" onClick={() => setPeriodo('trimestre')}>Trimestre</Button>
            <Button variant="outline" size="sm" onClick={() => setPeriodo('ano')}>Ano</Button>
          </div>
          <Label className="text-sm">De</Label>
          <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-36" />
          <Label className="text-sm">Até</Label>
          <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-36" />
          <Button variant="outline" onClick={exportarPDF} disabled={linhas.length === 0}>
            <FileDown className="h-4 w-4 mr-2" />
            Exportar Diário (PDF)
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Carregando...</div>
        ) : linhas.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground space-y-1">
            <p>Nenhum lançamento no período selecionado.</p>
            <p className="text-sm">Altere as datas ou crie lançamentos na aba Lançamentos.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Conta Débito</TableHead>
                  <TableHead>Conta Crédito</TableHead>
                  <TableHead className="text-right">Débito</TableHead>
                  <TableHead className="text-right">Crédito</TableHead>
                  <TableHead className="w-24">Origem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l: { data: string; documento: string; descricao?: string; contaCodigo: string; contaDescricao: string; debito: number; credito: number; origem?: string }, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(l.data), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-mono">{l.documento}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{l.descricao || '-'}</TableCell>
                    <TableCell>
                      {l.debito > 0 ? `${l.contaCodigo} - ${l.contaDescricao}` : '-'}
                    </TableCell>
                    <TableCell>
                      {l.credito > 0 ? `${l.contaCodigo} - ${l.contaDescricao}` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {l.debito > 0 ? formatarNumero(l.debito) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {l.credito > 0 ? formatarNumero(l.credito) : '-'}
                    </TableCell>
                    <TableCell>
                      {l.origem === 'AUTOMATICO' ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                          🟢 Automático
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                          🔵 Manual
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
