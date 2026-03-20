import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { excelBase64ToPreviewHtmlDocument } from "@/utils/excelPreviewHtml";

/**
 * Pré-visualização da primeira folha do .xlsx com alinhamento, merges e estilos (ExcelJS).
 */
export function ExcelStyledPreview({
  base64,
  className = "h-full w-full min-h-[280px] border-0",
}: {
  base64: string;
  className?: string;
}) {
  const [srcDoc, setSrcDoc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setSrcDoc(null);
    setFailed(false);
    excelBase64ToPreviewHtmlDocument(base64).then((doc) => {
      if (!alive) return;
      if (doc) setSrcDoc(doc);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [base64]);

  if (failed) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-8 text-center text-sm text-muted-foreground">
        Não foi possível gerar a pré-visualização com formatação. Use &quot;Descarregar Excel&quot; para ver o
        ficheiro original no Excel.
      </div>
    );
  }

  if (!srcDoc) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="text-sm">A carregar pré-visualização…</span>
      </div>
    );
  }

  return <iframe title="Pré-visualização Excel" className={className} srcDoc={srcDoc} sandbox="allow-same-origin" />;
}
