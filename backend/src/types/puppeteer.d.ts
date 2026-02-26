/**
 * Declaração mínima para o módulo opcional puppeteer.
 * Quando instalado (npm install puppeteer), permite gerar PDF a partir do HTML do certificado.
 */
declare module 'puppeteer' {
  interface LaunchOptions {
    headless?: boolean;
    args?: string[];
  }
  interface PDFOptions {
    format?: string;
    printBackground?: boolean;
    margin?: { top?: string; right?: string; bottom?: string; left?: string };
  }
  interface Browser {
    newPage(): Promise<Page>;
    close(): Promise<void>;
  }
  interface Page {
    setContent(html: string, opts?: { waitUntil?: string }): Promise<void>;
    pdf(opts?: PDFOptions): Promise<Buffer>;
  }
  function launch(options?: LaunchOptions): Promise<Browser>;
  const defaultExport: { launch: typeof launch };
  export default defaultExport;
}
