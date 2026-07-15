import { VectorStoreIndex, Settings, MetadataMode } from 'llamaindex';
import { getEmbedModel, getVectorStore } from './config';

export interface Source {
  text: string;
  fileName: string;
  score: number;
  nodeId: string;
}

export async function retrieveContext(
  query: string,
  topK: number = 5
): Promise<{ context: string; sources: Source[] }> {
  Settings.embedModel = getEmbedModel();
  const vectorStore = getVectorStore();
  const index = await VectorStoreIndex.init({
    vectorStores: { TEXT: vectorStore },
  });

  const retriever = index.asRetriever({ similarityTopK: topK });
  const nodes = await retriever.retrieve(query);

  const sources: Source[] = nodes
    .filter((node) => (node.score ?? 0) >= 0.7)
    .map((node, idx) => {
      const metadata = node.node.metadata;
      const fileName = metadata && typeof metadata === 'object' && 'fileName' in metadata && typeof metadata.fileName === 'string'
        ? metadata.fileName
        : 'Unknown';
      
      return {
        text: node.node.getContent(MetadataMode.NONE),
        fileName,
        score: node.score ?? 0,
        nodeId: node.node.id_,
      };
    });

  const context = sources
    .map((s, idx) => `[${idx + 1}] ${s.text} — ${s.fileName}`)
    .join('\n\n');

  return { context, sources };
}
