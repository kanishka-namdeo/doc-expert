'use client';

import { useDropzone } from 'react-dropzone';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Upload, FileText } from 'lucide-react';
import Link from 'next/link';
import { useLogger } from '@/hooks/use-logger';
import type { IngestProgress } from '@/lib/llamaindex/ingest';
import { Button } from '@/components/ui/button';

export function DocumentUpload() {
  const [uploading, setUploading] = useState(false);
  const logger = useLogger('document-upload');
  const [uploadedDocumentId, setUploadedDocumentId] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setUploading(true);
    setUploadedDocumentId(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Upload failed';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch {
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // Consume SSE stream for progress updates
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));
              
              if (data.success) {
                // Final result
                setUploadedDocumentId(data.documentId);
                toast.success(`Document ingested: ${data.chunkCount} ${data.chunkCount === 1 ? 'chunk' : 'chunks'}`);
              } else if (data.error) {
                // Error from stream
                throw new Error(data.error);
              } else {
                // Progress update
                const progress = data as IngestProgress;
                toast.info(`${progress.message} (${progress.progress}%)`, {
                  id: 'upload-progress',
                });
              }
            }
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Upload failed', { err: errorMessage, error });
      toast.error(errorMessage || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/markdown': ['.md'],
    },
    maxFiles: 1,
    disabled: uploading,
  });

  return (
    <>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50'
        } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        {uploading ? (
          <p className="text-sm text-muted-foreground">Processing document...</p>
        ) : isDragActive ? (
          <p className="text-sm text-primary">Drop the document here...</p>
        ) : (
          <>
            <p className="text-sm font-medium">Drag & drop a document here</p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, DOCX, or Markdown (max 50MB)
            </p>
          </>
        )}
      </div>

      {uploadedDocumentId && (
        <div className="mt-6 flex items-center justify-center">
          <Link href={`/documents/${uploadedDocumentId}`}>
            <Button variant="outline" size="sm">
              <FileText className="mr-2 h-4 w-4" />
              View Document
            </Button>
          </Link>
        </div>
      )}
    </>
  );
}