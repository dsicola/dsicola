/**
 * Injeta CSS no HTML da pré-visualização de certificados/declarações
 * para evitar imagens gigantes ou distorcidas (ex: brasão) no layout.
 * Usa !important para anular estilos inline do template que causam deformação.
 */
export function injectCertificatePreviewStyles(html: string): string {
  if (!html?.trim()) return html;
  const style = `<style>
    img, td img, th img {
      max-width: 150px !important;
      max-height: 150px !important;
      width: auto !important;
      height: auto !important;
      object-fit: contain !important;
    }
    .header img, .logo, .header .logo { max-height: 100px !important; }
  </style>`;
  if (html.includes("</head>")) return html.replace("</head>", style + "</head>");
  if (html.includes("<body")) return html.replace("<body", "<head>" + style + "</head><body");
  return style + html;
}
