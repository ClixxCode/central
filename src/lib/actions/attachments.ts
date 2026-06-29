'use server';

import { db } from '@/lib/db';
import { attachments, comments } from '@/lib/db/schema';
import { getSession } from '@/lib/auth/session';
import { eq, and, isNull } from 'drizzle-orm';
import { del } from '@vercel/blob';
import { canAccessTask } from './board-access';

export interface Attachment {
  id: string;
  filename: string;
  url: string;
  size: number | null;
  mimeType: string | null;
  uploadedBy: string | null;
  createdAt: Date;
}

export async function getTaskAttachments(taskId: string): Promise<Attachment[]> {
  const session = await getSession();
  if (!session) return [];

  const access = await canAccessTask(session.user.id, taskId, session.user.role === 'admin');
  if (!access.canAccess) return [];

  const result = await db
    .select()
    .from(attachments)
    .where(and(eq(attachments.taskId, taskId), isNull(attachments.commentId)));

  return result.map((a) => ({
    id: a.id,
    filename: a.filename,
    url: a.url,
    size: a.size,
    mimeType: a.mimeType,
    uploadedBy: a.uploadedBy,
    createdAt: a.createdAt,
  }));
}

export async function createTaskAttachment(input: {
  taskId: string;
  filename: string;
  url: string;
  size?: number;
  mimeType?: string;
}): Promise<{ success: boolean; attachment?: Attachment; error?: string }> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const access = await canAccessTask(session.user.id, input.taskId, session.user.role === 'admin');
    if (!access.canAccess) {
      return { success: false, error: 'Access denied to this task' };
    }

    const [attachment] = await db
      .insert(attachments)
      .values({
        taskId: input.taskId,
        filename: input.filename,
        url: input.url,
        size: input.size,
        mimeType: input.mimeType,
        uploadedBy: session.user.id,
      })
      .returning();

    return {
      success: true,
      attachment: {
        id: attachment.id,
        filename: attachment.filename,
        url: attachment.url,
        size: attachment.size,
        mimeType: attachment.mimeType,
        uploadedBy: attachment.uploadedBy,
        createdAt: attachment.createdAt,
      },
    };
  } catch (error) {
    console.error('Failed to create attachment:', error);
    return { success: false, error: 'Failed to create attachment' };
  }
}

export async function deleteTaskAttachment(
  attachmentId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    // Get the attachment to find the blob URL
    const [attachment] = await db
      .select()
      .from(attachments)
      .where(eq(attachments.id, attachmentId));

    if (!attachment) {
      return { success: false, error: 'Attachment not found' };
    }

    const taskId = attachment.taskId ?? (
      attachment.commentId
        ? (await db.query.comments.findFirst({
            where: eq(comments.id, attachment.commentId),
            columns: { taskId: true },
          }))?.taskId
        : null
    );

    if (!taskId) {
      return { success: false, error: 'Attachment task not found' };
    }

    const access = await canAccessTask(session.user.id, taskId, session.user.role === 'admin');
    if (!access.canAccess) {
      return { success: false, error: 'Access denied to this task' };
    }

    // Delete from Vercel Blob
    try {
      await del(attachment.url);
    } catch (blobError) {
      console.error('Failed to delete blob:', blobError);
      // Continue with DB deletion even if blob deletion fails
    }

    // Delete from database
    await db.delete(attachments).where(eq(attachments.id, attachmentId));

    return { success: true };
  } catch (error) {
    console.error('Failed to delete attachment:', error);
    return { success: false, error: 'Failed to delete attachment' };
  }
}
