import { NextRequest, NextResponse } from 'next/server';
import { ingestDocument } from '@/lib/llamaindex/ingest';
import { logAuditEvent } from '@/lib/audit';
import { auth } from '@/lib/auth';
import { getLogger } from '@/lib/logger';
import { db } from '@/lib/db';
import { document } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthSession } from '@/lib/auth/session';

const logger = getLogger('api/documents/upload');
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/markdown',
];

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(request: NextRequest) {
  const session = await getAuthSession({ headers: request.headers });
  if (session.error) return session.error;

  const { userId, orgId } = session;

  let file: File | null = null;
  try {
    const formData = await request.formData();
    file = formData.get('file') as File | null;

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

    // Check if document with same filename already exists for this user (org-scoped)
    const existingDoc = await db.query.document.findFirst({
      where: and(
        eq(document.fileName, file.name),
        eq(document.userId, userId),
        eq(document.orgId, orgId)
      ),
    });

    // Create SSE stream for progress updates
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const result = await ingestDocument(
            file!,
            userId,
            orgId,
            (progress) => {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(progress)}\n\n`));
            },
            undefined,
            existingDoc?.id
          );

          // Update existing document or create new one
          // Documents are auto-approved for immediate retrieval
          if (existingDoc) {
            await db
              .update(document)
              .set({
                mediaType: file!.type,
                fileSize: file!.size,
                status: 'approved',
                updatedAt: new Date(),
              })
              .where(eq(document.id, existingDoc.id));
          } else {
            await db.insert(document).values({
              id: result.documentId,
              userId,
              orgId,
              fileName: file!.name,
              mediaType: file!.type,
              fileSize: file!.size,
              status: 'approved',
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          // Log audit event
          await logAuditEvent(
            userId,
            existingDoc ? 'document.update' : 'document.upload',
            `file:${file!.name}`,
            { documentId: result.documentId, chunkCount: result.chunkCount, orgId }
          );
          logger.info({
            fileName: file!.name,
            documentId: result.documentId,
            chunkCount: result.chunkCount,
            userId,
            orgId,
            updated: !!existingDoc
          }, existingDoc ? 'Document updated successfully' : 'Document uploaded successfully');

          // Send final result
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ ...result, success: true, updated: !!existingDoc })}\n\n`));
          controller.close();
        } catch (error) {
          let errorMessage = error instanceof Error ? error.message : String(error);
          // Try to get the cause if it's a DocumentParseError
          if (error instanceof Error && 'cause' in error && error.cause instanceof Error) {
            errorMessage += ` (Cause: ${error.cause.message})`;
          }
          logger.error({ err: error, fileName: file?.name }, 'Document upload failed');
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: 'Failed to process document', details: errorMessage })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    logger.error({ err: error, fileName: file?.name }, 'Document upload failed');
    return NextResponse.json(
      { error: 'Failed to process document' },
      { status: 500 }
    );
  }
}
