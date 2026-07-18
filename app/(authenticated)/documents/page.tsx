'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DocumentList } from '@/components/document-list';
import { Button } from '@/components/ui/button';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { DocumentUpload } from '@/components/document-upload';
import { PageHeader } from '@/components/page-header';
import { Upload, Globe, FileText } from 'lucide-react';

type DocumentFilter = 'owned' | 'shared-with-me' | 'shared-by-me' | 'pending';
type DocumentSource = 'all' | 'upload' | 'google-drive' | 'microsoft-365';

export default function DocumentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showUpload, setShowUpload] = useState(false);

  const filterParam = (searchParams.get('filter') as DocumentFilter) || 'owned';
  const [activeFilter, setActiveFilter] = useState<DocumentFilter>(filterParam);
  const [activeSource, setActiveSource] = useState<DocumentSource>('all');

  // Sync filter state with URL
  useEffect(() => {
    const filter = (searchParams.get('filter') as DocumentFilter) || 'owned';
    setActiveFilter(filter);
  }, [searchParams]);

  const handleFilterChange = (value: string) => {
    const filter = value as DocumentFilter;
    router.push(`/documents?filter=${filter}&source=${activeSource}`, { scroll: false });
  };

  const handleSourceChange = (value: string) => {
    const source = value as DocumentSource;
    router.push(`/documents?filter=${activeFilter}&source=${source}`, { scroll: false });
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Documents"
        description="Manage your uploaded documents"
        actions={
          <Dialog open={showUpload} onOpenChange={setShowUpload}>
            <DialogTrigger render={(props) => (
              <Button {...props}>
                <Upload className="mr-2 h-4 w-4" />
                Upload Document
              </Button>
            )} />
            <DialogContent className="max-w-lg">
              <DocumentUpload />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl">
          {/* Filter Tabs */}
          <Tabs value={activeFilter} onValueChange={handleFilterChange} className="mb-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="owned">Owned by me</TabsTrigger>
              <TabsTrigger value="shared-with-me">Shared with me</TabsTrigger>
              <TabsTrigger value="shared-by-me">Shared by me</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Source Filter */}
          <div className="flex gap-2 mb-6">
            <Button
              variant={activeSource === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSourceChange('all')}
            >
              All
            </Button>
            <Button
              variant={activeSource === 'upload' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSourceChange('upload')}
            >
              <FileText className="mr-1 h-3 w-3" />
              Upload
            </Button>
            <Button
              variant={activeSource === 'google-drive' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSourceChange('google-drive')}
            >
              <Globe className="mr-1 h-3 w-3" />
              Google Drive
            </Button>
            <Button
              variant={activeSource === 'microsoft-365' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSourceChange('microsoft-365')}
            >
              <Globe className="mr-1 h-3 w-3" />
              Microsoft 365
            </Button>
          </div>

          <DocumentList standalone filter={activeFilter} source={activeSource === 'all' ? undefined : activeSource} enableBatchOperations={activeFilter === 'owned'} />
        </div>
      </div>
    </div>
  );
}
