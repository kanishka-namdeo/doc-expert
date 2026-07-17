export interface DefaultTemplate {
  id: string;
  title: string;
  prompt: string;
  category: string;
}

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    id: 'sys-summary',
    title: 'Summarize this document',
    prompt: 'Summarize the key points of the uploaded document.',
    category: 'summary',
  },
  {
    id: 'sys-compare',
    title: 'Compare the key points',
    prompt: 'Compare and contrast the key points in the documents.',
    category: 'analysis',
  },
  {
    id: 'sys-find',
    title: 'Find information about a topic',
    prompt: 'Find all information about: ',
    category: 'search',
  },
  {
    id: 'sys-risks',
    title: 'What are the risks?',
    prompt: 'What are the risks and limitations mentioned in the documents?',
    category: 'analysis',
  },
  {
    id: 'sys-actions',
    title: 'Extract action items',
    prompt: 'Extract all action items and recommendations from the documents.',
    category: 'summary',
  },
];
