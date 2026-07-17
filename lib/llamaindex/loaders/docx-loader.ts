import { Document } from 'llamaindex';
import mammoth from 'mammoth';

export class DocxBufferReader {
  async loadDataFromBuffer(buffer: Buffer, fileName: string): Promise<Document[]> {
    const result = await mammoth.extractRawText({ buffer });
    const text = typeof result === 'object' && result !== null && 'value' in result 
      ? String(result.value) 
      : '';
    
    return [
      new Document({
        text,
        metadata: {
          source: fileName,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
      }),
    ];
  }
}
