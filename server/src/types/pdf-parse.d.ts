// pdf-parse não publica tipos. Importamos o módulo interno (lib/pdf-parse.js) para
// evitar o runner de teste do index.js do pacote.
declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfParseResult {
    text: string;
    numpages: number;
    info: unknown;
    metadata: unknown;
    version: string;
  }
  function pdfParse(dataBuffer: Buffer, options?: unknown): Promise<PdfParseResult>;
  export default pdfParse;
}
