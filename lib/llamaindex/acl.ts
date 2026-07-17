import { db } from '@/lib/db';
import { documentPermission, groupMember, groupTable, document as documentTable } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getLogger } from '@/lib/logger';

const logger = getLogger('llamaindex/acl');

/**
 * Build the full access control list for a document.
 * Includes the owner (from document table), users with direct permissions,
 * and members of groups with permissions on the document.
 */
export async function buildDocumentAcl(documentId: string, orgId: string): Promise<string[]> {
  const acl = new Set<string>();

  try {
    // Get document owner
    const documentRecord = await db.query.document.findFirst({
      where: eq(documentTable.id, documentId),
      columns: { userId: true },
    });
    if (documentRecord?.userId) {
      acl.add(documentRecord.userId);
    }

    // Get direct user permissions and group permissions
    const permissions = await db
      .select({
        userId: documentPermission.userId,
        groupId: documentPermission.groupId,
      })
      .from(documentPermission)
      .where(eq(documentPermission.documentId, documentId));

    for (const perm of permissions) {
      if (perm.userId) {
        acl.add(perm.userId);
      }
      if (perm.groupId) {
        // Get all members of this group
        const members = await db
          .select({ userId: groupMember.userId })
          .from(groupMember)
          .where(eq(groupMember.groupId, perm.groupId));
        for (const member of members) {
          if (member.userId) {
            acl.add(member.userId);
          }
        }
      }
    }
  } catch (error) {
    logger.error({ err: error, documentId, orgId }, 'Failed to build document ACL');
  }

  return Array.from(acl);
}

/**
 * Re-index all Qdrant points for a document with an updated ACL.
 * Call this after granting or revoking permissions.
 */
export async function updateDocumentAcl(documentId: string, orgId: string): Promise<void> {
  const acl = await buildDocumentAcl(documentId, orgId);
  logger.info({ documentId, orgId, aclLength: acl.length }, 'Updating document ACL in Qdrant');

  const { QdrantVectorStore } = await import('./qdrant-store');
  const qdrantUrl = process.env.QDRANT_URL ?? 'http://localhost:6333';
  const vectorStore = new QdrantVectorStore({ url: qdrantUrl, collectionName: 'documents' });
  const client = vectorStore.getClient();

  // Scroll all points for this document
  let offset: string | number | null = null;
  let hasMore = true;

  while (hasMore) {
    const result = await client.scroll('documents', {
      filter: {
        must: [{ key: 'documentId', match: { value: documentId } }],
      },
      limit: 100,
      with_payload: true,
      with_vector: true,
      offset: offset ?? undefined,
    });

    const points = result.points || [];
    for (const point of points) {
      const payload = point.payload as Record<string, unknown>;
      payload.accessControlList = acl;
      await client.upsert('documents', {
        wait: true,
        points: [
          {
            id: point.id,
            vector: point.vector as number[],
            payload,
          },
        ],
      });
    }

    offset = (result.next_page_offset as string | number | null) ?? null;
    hasMore = offset !== null && offset !== undefined;
  }

  logger.info({ documentId, aclLength: acl.length }, 'Document ACL updated in Qdrant');
}
