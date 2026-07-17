import { Document } from 'llamaindex';

export class MarkdownBufferReader {
  async loadDataFromBuffer(buffer: Buffer, fileName: string): Promise<Document[]> {
    const text = buffer.toString('utf-8');
    
    return [
      new Document({
        text,
        metadata: {
          source: fileName,
          mimeType: 'text/markdown',
        },
      }),
    ];
  }
}
