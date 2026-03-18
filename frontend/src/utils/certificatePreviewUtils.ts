/**
 * Injeta CSS no HTML da pré-visualização de certificados/declarações
 * para evitar imagens gigantes (ex: brasão) que desalinham o layout.
 */
export function injectCertificatePreviewStyles(html: string): string {
  if (!html?.trim()) return html;
  const style =
    "<style>img{max-width:100%;height:auto;max-height:120px;object-fit:contain}.header img,.logo,.header .logo{max-height:100px}</style>";
  if (html.includes("</head>")) return html.replace("</head>", style + "</head>");
  if (html.includes("<body")) return html.replace("<body", "<head>" + style + "</head><body");
  return style + html;
}
