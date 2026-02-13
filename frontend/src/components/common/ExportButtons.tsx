import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText } from "lucide-react";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { useAuth } from "@/contexts/AuthContext";
import { exportarRelatorioPDF, exportarRelatorioExcel } from "@/utils/reportExporter";
import { toast } from "@/hooks/use-toast";

interface ExportButtonsProps {
  titulo: string;
  colunas: string[];
  dados: any[][];
  className?: string;
  pdfLabel?: string;
  excelLabel?: string;
}

export function ExportButtons({ titulo, colunas, dados, className = "", pdfLabel = "PDF", excelLabel = "Excel" }: ExportButtonsProps) {
  const { config } = useInstituicao();
  const { user } = useAuth();

  const handleExportPDF = async () => {
    try {
      await exportarRelatorioPDF({
        instituicao: {
          nome: config?.nome_instituicao || 'Instituição',
          logoUrl: config?.logo_url,
        },
        titulo,
        colunas,
        dados,
        emitidoPor: user?.nome_completo || user?.email || 'Sistema',
      });
      toast({
        title: "PDF exportado",
        description: "O relatório foi baixado com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao exportar",
        description: "Não foi possível gerar o PDF.",
        variant: "destructive",
      });
    }
  };

  const handleExportExcel = () => {
    try {
      exportarRelatorioExcel({
        instituicao: {
          nome: config?.nome_instituicao || 'Instituição',
          logoUrl: config?.logo_url,
        },
        titulo,
        colunas,
        dados,
        emitidoPor: user?.nome_completo || user?.email || 'Sistema',
      });
      toast({
        title: "Excel exportado",
        description: "O relatório foi baixado com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao exportar",
        description: "Não foi possível gerar o Excel.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <Button variant="outline" size="sm" onClick={handleExportPDF}>
        <FileText className="h-4 w-4 mr-2" />
        {pdfLabel}
      </Button>
      <Button variant="outline" size="sm" onClick={handleExportExcel}>
        <FileSpreadsheet className="h-4 w-4 mr-2" />
        {excelLabel}
      </Button>
    </div>
  );
}
