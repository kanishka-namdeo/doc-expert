import { Document, SentenceSplitter, VectorStoreIndex, Settings } from 'llamaindex';
import { getEmbedModel, getVectorStore } from './config';
import { randomUUID } from 'node:crypto';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

export class DocumentParseError extends Error {
  constructor(fileName: string, cause?: unknown) {
    super(`Failed to parse document: ${fileName}`, { cause });
    this.name = 'DocumentParseError';
  }
}

async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === 'text/markdown') {
    return buffer.toString('utf-8');
  }
  if (mimeType === 'application/pdf') {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text;
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  throw new Error(`Unsupported MIME type: ${mimeType}`);
}
export async function ingestDocument(file: File): Promise<{ documentId: string; chunkCount: number }> {
  const documentId = randomUUID();

  try {
    Settings.embedModel = getEmbedModel();

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractText(buffer, file.type);

    const doc = new Document({
      text,
      metadata: {
        documentId,
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
        mimeType: file.type,
      },
    });

    const splitter = new SentenceSplitter({
      chunkSize: 512,
      chunkOverlap: 50,
    });

    const nodes = await splitter.getNodesFromDocuments([doc]);

    for (const node of nodes) {
      node.metadata = {
        ...node.metadata,
        documentId,
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
      };
    }

    await VectorStoreIndex.fromDocuments(nodes as Document[], {
      vectorStores: { TEXT: getVectorStore() },
    });

    return { documentId, chunkCount: nodes.length };
  } catch (error) {
    if (error instanceof DocumentParseError) throw error;
    throw new DocumentParseError(file.name, error);
  }
}
