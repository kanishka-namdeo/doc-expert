import { Document } from 'llamaindex';
import 'pdf-parse/worker';
import { PDFParse } from 'pdf-parse';

export class PdfBufferReader {
  async loadDataFromBuffer(buffer: Buffer, fileName: string): Promise<Document[]> {
    const parser = new PDFParse({ data: buffer, verbosity: 0 });
    const result = await parser.getText();
    const text = result.text;
    
    if (!text || !text.trim()) {
      throw new Error(`No text content extracted from PDF: ${fileName}`);
    }
    
    return [new Document({ text, metadata: { source: fileName, mimeType: 'application/pdf' } })];
  }
}
