export interface PinnedItem {
  id: string;
  type: 'document' | 'collection' | 'template' | 'saved-search';
  title: string;
  pinnedAt: string; // ISO timestamp
  order: number; // user-defined order
}
