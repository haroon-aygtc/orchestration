declare module 'pdf-parse' {
  interface PDFParseResult {
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    text: string;
    version: string;
  }

  interface PDFParseOptions {
    max?: number;
    version?: string;
  }

  function pdfParse(buffer: Buffer, options?: PDFParseOptions): Promise<PDFParseResult>;
  
  export = pdfParse;
}
