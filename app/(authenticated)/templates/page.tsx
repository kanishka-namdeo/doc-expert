'use client';

import { TemplateList } from '@/components/template-list';
import { PageHeader } from '@/components/page-header';

export default function TemplatesPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Templates"
        description="Manage prompt templates for quick access in chat"
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl">
          <TemplateList />
        </div>
      </div>
    </div>
  );
}
