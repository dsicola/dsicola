import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Printer, FileText, Download } from 'lucide-react';
import {
  ReciboData,
  downloadReciboA4,
  downloadReciboTermico,
  downloadAmbosRecibos,
  downloadFaturaA4,
} from '@/utils/pdfGenerator';

interface PrintReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reciboData: ReciboData | null;
}

export const PrintReceiptDialog: React.FC<PrintReceiptDialogProps> = ({
  open,
  onOpenChange,
  reciboData,
}) => {
  const [printA4, setPrintA4] = useState(true);
  const [printTermico, setPrintTermico] = useState(false);
  const [printFatura, setPrintFatura] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handlePrint = async () => {
    if (!reciboData) return;

    if (!printA4 && !printTermico && !printFatura) {
      toast({
        title: 'Selecione um formato',
        description: 'Por favor, selecione pelo menos um formato (Recibo ou Fatura).',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const downloads: string[] = [];
      if (printA4) {
        await downloadReciboA4(reciboData);
        downloads.push('Recibo A4');
      }
      if (printTermico) {
        await downloadReciboTermico(reciboData);
        downloads.push('Recibo Térmico');
      }
      if (printFatura) {
        await downloadFaturaA4(reciboData);
        downloads.push('Fatura A4');
      }
      toast({
        title: 'Documento(s) gerado(s)',
        description: downloads.join(', ') + ' baixado(s) com sucesso.',
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Erro ao gerar documento',
        description: 'Ocorreu um erro ao gerar o PDF.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadBoth = async () => {
    if (!reciboData) return;

    setIsLoading(true);
    try {
      await downloadAmbosRecibos(reciboData);
      toast({
        title: 'Recibos gerados',
        description: 'Ambos os formatos foram baixados com sucesso.',
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Erro ao gerar recibos',
        description: 'Ocorreu um erro ao gerar os PDFs.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!reciboData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Imprimir Comprovante
          </DialogTitle>
          <DialogDescription>
            Selecione o formato do recibo para impressão ou download
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-1">
            <p className="font-medium">{reciboData.aluno.nome}</p>
            <p className="text-sm text-muted-foreground">
              Recibo: {reciboData.pagamento.reciboNumero}
            </p>
            <p className="text-sm text-muted-foreground">
              Valor: {new Intl.NumberFormat('pt-AO', {
                style: 'currency',
                currency: 'AOA',
              }).format(reciboData.pagamento.valor + (reciboData.pagamento.valorMulta || 0))}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
              <Checkbox
                id="print-a4"
                checked={printA4}
                onCheckedChange={(checked) => setPrintA4(checked as boolean)}
              />
              <div className="flex-1">
                <Label htmlFor="print-a4" className="cursor-pointer flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Recibo A4
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Formato padrão para impressão tradicional
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
              <Checkbox
                id="print-termico"
                checked={printTermico}
                onCheckedChange={(checked) => setPrintTermico(checked as boolean)}
              />
              <div className="flex-1">
                <Label htmlFor="print-termico" className="cursor-pointer flex items-center gap-2">
                  <Printer className="h-4 w-4 text-primary" />
                  Recibo Térmico (80mm)
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Formato compacto para impressoras térmicas
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
              <Checkbox
                id="print-fatura"
                checked={printFatura}
                onCheckedChange={(checked) => setPrintFatura(checked as boolean)}
              />
              <div className="flex-1">
                <Label htmlFor="print-fatura" className="cursor-pointer flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Fatura A4
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Documento fiscal para faturação (mensalidade)
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleDownloadBoth}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            <Download className="h-4 w-4 mr-2" />
            Baixar Ambos
          </Button>
          <Button
            onClick={handlePrint}
            disabled={isLoading || (!printA4 && !printTermico && !printFatura)}
            className="w-full sm:w-auto"
          >
            {isLoading ? 'Gerando...' : 'Gerar Selecionados'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
