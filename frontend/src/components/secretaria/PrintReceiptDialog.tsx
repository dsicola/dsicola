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
  const [isLoading, setIsLoading] = useState(false);

  const handlePrint = async () => {
    if (!reciboData) return;

    setIsLoading(true);
    try {
      if (printA4 && printTermico) {
        await downloadAmbosRecibos(reciboData);
        toast({
          title: 'Recibos gerados',
          description: 'Ambos os formatos foram baixados.',
        });
      } else if (printA4) {
        await downloadReciboA4(reciboData);
        toast({
          title: 'Recibo A4 gerado',
          description: 'O recibo em formato A4 foi baixado.',
        });
      } else if (printTermico) {
        await downloadReciboTermico(reciboData);
        toast({
          title: 'Recibo térmico gerado',
          description: 'O recibo para impressora térmica foi baixado.',
        });
      } else {
        toast({
          title: 'Selecione um formato',
          description: 'Por favor, selecione pelo menos um formato de recibo.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Erro ao gerar recibo',
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
            disabled={isLoading || (!printA4 && !printTermico)}
            className="w-full sm:w-auto"
          >
            {isLoading ? 'Gerando...' : 'Gerar Selecionados'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
