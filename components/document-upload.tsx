'use client';

import { useDropzone } from 'react-dropzone';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';

export function DocumentUpload() {
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const result = await response.json();
      toast.success(`Document ingested: ${result.chunkCount} chunks`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Upload failed');
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
  );
}
