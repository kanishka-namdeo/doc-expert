'use client';

import { CollectionList } from '@/components/collection-list';
import { PageHeader } from '@/components/page-header';
import { FolderOpen } from 'lucide-react';

export default function CollectionsPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Collections"
        description="Organize documents into collections for scoped Q&A sessions"
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl">
          <CollectionList standalone />
        </div>
      </div>
    </div>
  );
}
