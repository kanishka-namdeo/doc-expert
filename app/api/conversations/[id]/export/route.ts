import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { conversation, message } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getLogger } from '@/lib/logger';

const logger = getLogger('api/conversations/[id]/export');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const userId = session.user.id;

    // Get conversation
    const [conv] = await db
      .select()
      .from(conversation)
      .where(eq(conversation.id, id));

    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Verify ownership
    if (conv.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get messages
    const messages = await db
      .select()
      .from(message)
      .where(eq(message.conversationId, id))
      .orderBy(message.createdAt);

    // Format as Markdown
    let markdown = `# ${conv.title || 'Untitled Conversation'}\n\n`;
    markdown += `**Exported:** ${new Date().toISOString()}\n\n`;
    markdown += `**Created:** ${new Date(conv.createdAt).toISOString()}\n\n`;
    markdown += `---\n\n`;

    for (const msg of messages) {
      const timestamp = new Date(msg.createdAt).toISOString();
      const role = msg.role === 'user' ? 'User' : 'Assistant';

      let content = '';
      try {
        const parts = JSON.parse(msg.content as string);
        if (Array.isArray(parts)) {
          for (const part of parts) {
            if (part.type === 'text' && part.text) {
              content += part.text + '\n\n';
            }
          }
        } else if (typeof msg.content === 'string') {
          content = msg.content;
        }
      } catch {
        content = msg.content as string;
      }

      markdown += `### ${role} — ${timestamp}\n\n`;
      markdown += content;
      markdown += `\n\n---\n\n`;
    }

    return new NextResponse(markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${(conv.title || 'conversation').replace(/[^a-z0-9]/gi, '_')}.md"`,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to export conversation');
    return NextResponse.json({ error: 'Failed to export conversation' }, { status: 500 });
  }
}
