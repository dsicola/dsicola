/**
 * Injeta CSS no HTML da pré-visualização de certificados/declarações (iframe / nova aba).
 *
 * Antes: `max-width: 150px` em todas as imagens — destruía brasões, marcas d'água e grelhas do Word
 * após conversão Mammoth, fazendo o documento parecer "desorganizado" face ao .docx original.
 *
 * Agora: página tipo A4, tipografia sérifo, tabelas estáveis e imagens só limitadas ao conteúdo
 * (sem cap fixo agressivo), mantendo estilos inline do Mammoth sempre que possível.
 */
const PREVIEW_DOCUMENT_CSS = `
  html {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  *, *::before, *::after {
    box-sizing: border-box;
  }
  body {
    margin: 0 auto;
    padding: 10mm 12mm 14mm;
    max-width: 210mm;
    min-width: min(100%, 210mm);
    min-height: 100vh;
    background: #fff;
    color: #000;
    font-family: "Times New Roman", Times, "Liberation Serif", Georgia, serif;
    font-size: 12pt;
    line-height: 1.4;
    overflow-x: auto;
    word-wrap: break-word;
  }
  /* Não esmagar figuras: só evitar overflow fora da "folha". Estilos inline do Word/Mammoth prevalecem. */
  img {
    max-width: 100%;
    height: auto;
    object-fit: contain;
    vertical-align: middle;
  }
  table {
    border-collapse: collapse;
    border-spacing: 0;
    max-width: 100%;
    table-layout: auto;
  }
  td, th {
    vertical-align: top;
  }
  p {
    margin: 0.2em 0;
  }
  ul, ol {
    margin: 0.35em 0;
    padding-left: 1.4em;
  }
`;

export function injectCertificatePreviewStyles(html: string): string {
  if (!html?.trim()) return html;
  const style = `<style>${PREVIEW_DOCUMENT_CSS}</style>`;
  if (html.includes("</head>")) return html.replace("</head>", style + "</head>");
  if (/<head[\s>]/i.test(html)) return html.replace(/<head([^>]*)>/i, `<head$1>${style}`);
  if (html.includes("<body")) return html.replace("<body", "<head>" + style + "</head><body");
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${style}</head><body>${html}</body></html>`;
}
