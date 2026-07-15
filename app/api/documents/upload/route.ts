import { NextRequest, NextResponse } from 'next/server';
import { ingestDocument } from '@/lib/llamaindex/ingest';
import { logAuditEvent } from '@/lib/audit';
import { auth } from '@/lib/auth';

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown',
];

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Allowed: PDF, DOCX, Markdown` },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size: 50MB` },
        { status: 400 }
      );
    }

    const result = await ingestDocument(file);
    
    // Log audit event
    const session = await auth();
    if (session?.user) {
      await logAuditEvent(
        session.user.id,
        'document.upload',
        `file:${file.name}`,
        { documentId: result.documentId, chunkCount: result.chunkCount }
      );
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process document' },
      { status: 500 }
    );
  }
}
