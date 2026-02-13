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
import { Printer, FileText, Download, GraduationCap } from 'lucide-react';
import {
  MatriculaReciboData,
  downloadMatriculaReciboA4,
  downloadMatriculaReciboTermico,
  downloadAmbosMatriculaRecibos,
} from '@/utils/pdfGenerator';

interface PrintMatriculaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matriculaData: MatriculaReciboData | null;
}

export const PrintMatriculaDialog: React.FC<PrintMatriculaDialogProps> = ({
  open,
  onOpenChange,
  matriculaData,
}) => {
  const [printA4, setPrintA4] = useState(true);
  const [printTermico, setPrintTermico] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handlePrint = async () => {
    if (!matriculaData) return;

    setIsLoading(true);
    try {
      if (printA4 && printTermico) {
        await downloadAmbosMatriculaRecibos(matriculaData);
        toast({
          title: 'Comprovantes gerados',
          description: 'Ambos os formatos foram baixados.',
        });
      } else if (printA4) {
        await downloadMatriculaReciboA4(matriculaData);
        toast({
          title: 'Comprovante A4 gerado',
          description: 'O comprovante em formato A4 foi baixado.',
        });
      } else if (printTermico) {
        await downloadMatriculaReciboTermico(matriculaData);
        toast({
          title: 'Comprovante térmico gerado',
          description: 'O comprovante para impressora térmica foi baixado.',
        });
      } else {
        toast({
          title: 'Selecione um formato',
          description: 'Por favor, selecione pelo menos um formato de comprovante.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }
      onOpenChange(false);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : (error as { message?: string })?.message ?? 'Ocorreu um erro ao gerar o PDF.';
      toast({
        title: 'Erro ao gerar comprovante',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadBoth = async () => {
    if (!matriculaData) return;

    setIsLoading(true);
    try {
      await downloadAmbosMatriculaRecibos(matriculaData);
      toast({
        title: 'Comprovantes gerados',
        description: 'Ambos os formatos foram baixados com sucesso.',
      });
      onOpenChange(false);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : (error as { message?: string })?.message ?? 'Ocorreu um erro ao gerar os PDFs.';
      toast({
        title: 'Erro ao gerar comprovantes',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!matriculaData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-green-600" />
            Imprimir Comprovante de Matrícula
          </DialogTitle>
          <DialogDescription>
            Selecione o formato do comprovante para impressão ou download
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 space-y-1 border border-green-200 dark:border-green-800">
            <p className="font-medium text-green-800 dark:text-green-300">{matriculaData.aluno.nome}</p>
            <p className="text-sm text-green-700 dark:text-green-400">
              Comprovante: {matriculaData.matricula.reciboNumero}
            </p>
            <p className="text-sm text-green-700 dark:text-green-400">
              {matriculaData.matricula.curso} - {matriculaData.matricula.disciplina || (matriculaData.matricula.disciplinas?.length ? matriculaData.matricula.disciplinas.join(', ') : '') || '-'}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
              <Checkbox
                id="print-a4-matricula"
                checked={printA4}
                onCheckedChange={(checked) => setPrintA4(checked as boolean)}
              />
              <div className="flex-1">
                <Label htmlFor="print-a4-matricula" className="cursor-pointer flex items-center gap-2">
                  <FileText className="h-4 w-4 text-green-600" />
                  Comprovante A4
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Formato padrão para impressão tradicional
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
              <Checkbox
                id="print-termico-matricula"
                checked={printTermico}
                onCheckedChange={(checked) => setPrintTermico(checked as boolean)}
              />
              <div className="flex-1">
                <Label htmlFor="print-termico-matricula" className="cursor-pointer flex items-center gap-2">
                  <Printer className="h-4 w-4 text-green-600" />
                  Comprovante Térmico (80mm)
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
            className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
          >
            {isLoading ? 'Gerando...' : 'Gerar Selecionados'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
