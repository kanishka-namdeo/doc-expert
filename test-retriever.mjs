import { retrieveContext } from './lib/llamaindex/retriever';

async function testRetriever() {
  const query = 'What are the hardware requirements for running the embedding model, and what embedding dimension does it produce?';
  
  console.log('Testing retriever with query:', query);
  console.log('---');
  
  const result = await retrieveContext(query, 5, 'dev-user');
  
  console.log('Sources found:', result.sources.length);
  console.log('---');
  
  result.sources.forEach((source, idx) => {
    console.log(`\n[${idx + 1}] ${source.fileName} (score: ${source.score})`);
    console.log('Text preview:', source.text.substring(0, 200) + '...');
  });
  
  console.log('\n---');
  console.log('Context length:', result.context.length);
  console.log('Context preview:');
  console.log(result.context.substring(0, 1000));
}

testRetriever().catch(console.error);
