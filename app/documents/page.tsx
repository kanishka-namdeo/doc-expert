'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/app-header';
import { DocumentList } from '@/components/document-list';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { DocumentUpload } from '@/components/document-upload';
import { Plus, Upload } from 'lucide-react';

export default function DocumentsPage() {
  const router = useRouter();
  const [showUpload, setShowUpload] = useState(false);
  const [selectedModel] = useState('');
  const [currentConversationId] = useState<string | null>(null);
  const setCurrentConversationId = () => {};
  const setSelectedModel = () => {};
  const setShowUploadHeader = () => {};

  return (
    <div className="flex h-screen flex-col">
      <AppHeader
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        showUpload={showUpload}
        setShowUpload={setShowUpload}
        currentConversationId={currentConversationId}
        setCurrentConversationId={setCurrentConversationId}
        selectedCollectionId={null}
        setSelectedCollectionId={() => {}}
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Documents</h1>
              <p className="text-sm text-muted-foreground">
                Manage your uploaded documents
              </p>
            </div>
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
          </div>

          <DocumentList standalone />
        </div>
      </div>
    </div>
  );
}
