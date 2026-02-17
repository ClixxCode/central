'use server';

import { db } from '@/lib/db';
import {
  comments,
  tasks,
  taskAssignees,
  users,
  attachments,
  boardAccess,
  teamMembers,
} from '@/lib/db/schema';
import type { TiptapContent } from '@/lib/db/schema/tasks';
import { eq, and, inArray } from 'drizzle-orm';
import { del } from '@vercel/blob';
import { requireAuth } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import { logBoardActivity } from './board-activity';

// Types
export interface CommentAuthor {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  deactivatedAt: Date | null;
}

export interface CommentAttachment {
  id: string;
  filename: string;
  url: string;
  size: number | null;
  mimeType: string | null;
}

export interface CommentWithAuthor {
  id: string;
  taskId: string;
  authorId: string | null;
  parentCommentId: string | null;
  content: TiptapContent;
  createdAt: Date;
  updatedAt: Date | null;
  author: CommentAuthor | null;
  attachments: CommentAttachment[];
}

export interface CreateCommentInput {
  taskId: string;
  /** Content as JSON string to preserve nested attrs during Server Action serialization */
  contentJson: string;
  /** @deprecated Use contentJson instead */
  content?: TiptapContent;
  /** Attachment file metadata to create records for */
  attachments?: { filename: string; url: string; size: number; mimeType: string }[];
  /** If set, this comment is a reply to the specified parent comment */
  parentCommentId?: string;
}

export interface UpdateCommentInput {
  id: string;
  /** Content as JSON string to preserve nested attrs during Server Action serialization */
  contentJson: string;
  /** @deprecated Use contentJson instead */
  content?: TiptapContent;
}

type AccessLevel = 'full' | 'assigned_only' | null;

/**
 * Check if user is in a contractor team (excludeFromPublic = true)
 * Contractor teams need explicit board_access entries to see boards
 */
async function isUserInContractorTeam(userId: string): Promise<boolean> {
  const userTeamsWithDetails = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, userId),
    with: {
      team: {
        columns: { excludeFromPublic: true },
      },
    },
  });

  return userTeamsWithDetails.some((tm) => tm.team.excludeFromPublic);
}

/**
 * Get user's access level for a task's board
 * Boards are PUBLIC by default - non-contractors get 'full' access
 * Contractors need explicit board_access entries
 */
async function getTaskAccessLevel(
  userId: string,
  taskId: string,
  isAdmin: boolean
): Promise<{ accessLevel: AccessLevel; task?: typeof tasks.$inferSelect }> {
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  });

  if (!task) {
    return { accessLevel: null };
  }

  // Admins have full access to all boards
  if (isAdmin) {
    return { accessLevel: 'full', task };
  }

  // Check if user is in a contractor team
  const isContractor = await isUserInContractorTeam(userId);

  // Non-contractors have full access to all boards (public by default)
  if (!isContractor) {
    return { accessLevel: 'full', task };
  }

  // Contractors need explicit access entries
  // Check direct board access
  const boardAccessResult = await db.query.boardAccess.findFirst({
    where: and(
      eq(boardAccess.boardId, task.boardId),
      eq(boardAccess.userId, userId)
    ),
  });

  if (boardAccessResult) {
    if (boardAccessResult.accessLevel === 'full') {
      return { accessLevel: 'full', task };
    }
    // assigned_only - check if user is assigned to task
    const assignment = await db.query.taskAssignees.findFirst({
      where: and(
        eq(taskAssignees.taskId, taskId),
        eq(taskAssignees.userId, userId)
      ),
    });
    return { accessLevel: assignment ? 'assigned_only' : null, task: assignment ? task : undefined };
  }

  // Check team access
  const userTeams = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, userId),
    columns: { teamId: true },
  });

  if (userTeams.length > 0) {
    const teamIds = userTeams.map((t) => t.teamId);
    const teamAccess = await db.query.boardAccess.findFirst({
      where: and(
        eq(boardAccess.boardId, task.boardId),
        inArray(boardAccess.teamId, teamIds)
      ),
    });

    if (teamAccess) {
      if (teamAccess.accessLevel === 'full') {
        return { accessLevel: 'full', task };
      }
      // assigned_only via team
      const assignment = await db.query.taskAssignees.findFirst({
        where: and(
          eq(taskAssignees.taskId, taskId),
          eq(taskAssignees.userId, userId)
        ),
      });
      return { accessLevel: assignment ? 'assigned_only' : null, task: assignment ? task : undefined };
    }
  }

  // Contractors with no explicit access
  return { accessLevel: null };
}

/**
 * List comments for a task
 */
export async function listComments(taskId: string): Promise<{
  success: boolean;
  comments?: CommentWithAuthor[];
  error?: string;
}> {
  const user = await requireAuth();
  const isAdmin = user.role === 'admin';

  // Check access to the task
  const { accessLevel } = await getTaskAccessLevel(user.id, taskId, isAdmin);

  if (!accessLevel) {
    return { success: false, error: 'Access denied to this task' };
  }

  // Get comments with authors
  const commentList = await db
    .select({
      id: comments.id,
      taskId: comments.taskId,
      authorId: comments.authorId,
      parentCommentId: comments.parentCommentId,
      content: comments.content,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      authorEmail: users.email,
      authorName: users.name,
      authorAvatarUrl: users.avatarUrl,
      authorDeactivatedAt: users.deactivatedAt,
    })
    .from(comments)
    .leftJoin(users, eq(users.id, comments.authorId))
    .where(eq(comments.taskId, taskId))
    .orderBy(comments.createdAt);

  // Get attachments for all comments
  const commentIds = commentList.map((c) => c.id);
  const attachmentsList =
    commentIds.length > 0
      ? await db
          .select({
            id: attachments.id,
            commentId: attachments.commentId,
            filename: attachments.filename,
            url: attachments.url,
            size: attachments.size,
            mimeType: attachments.mimeType,
          })
          .from(attachments)
          .where(inArray(attachments.commentId, commentIds))
      : [];

  // Group attachments by comment
  const attachmentsByComment = new Map<string, CommentAttachment[]>();
  for (const a of attachmentsList) {
    if (!a.commentId) continue;
    if (!attachmentsByComment.has(a.commentId)) {
      attachmentsByComment.set(a.commentId, []);
    }
    attachmentsByComment.get(a.commentId)!.push({
      id: a.id,
      filename: a.filename,
      url: a.url,
      size: a.size,
      mimeType: a.mimeType,
    });
  }

  // Build response
  const commentsWithAuthors: CommentWithAuthor[] = commentList.map((c) => ({
    id: c.id,
    taskId: c.taskId,
    authorId: c.authorId,
    parentCommentId: c.parentCommentId,
    content: c.content,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    author: c.authorEmail
      ? {
          id: c.authorId!,
          email: c.authorEmail,
          name: c.authorName,
          avatarUrl: c.authorAvatarUrl,
          deactivatedAt: c.authorDeactivatedAt,
        }
      : null,
    attachments: attachmentsByComment.get(c.id) ?? [],
  }));

  return { success: true, comments: commentsWithAuthors };
}

/**
 * Create a new comment
 */
export async function createComment(input: CreateCommentInput): Promise<{
  success: boolean;
  comment?: CommentWithAuthor;
  error?: string;
}> {
  const user = await requireAuth();
  const isAdmin = user.role === 'admin';

  // Check access to the task
  const { accessLevel, task } = await getTaskAccessLevel(user.id, input.taskId, isAdmin);

  if (!accessLevel || !task) {
    return { success: false, error: 'Access denied to this task' };
  }

  // Parse content from JSON string to preserve nested attrs
  const content = input.contentJson
    ? JSON.parse(input.contentJson)
    : input.content;

  // Validate parent comment if this is a reply
  let parentCommentAuthorId: string | undefined;
  if (input.parentCommentId) {
    const parentComment = await db.query.comments.findFirst({
      where: eq(comments.id, input.parentCommentId),
      columns: { id: true, taskId: true, parentCommentId: true, authorId: true },
    });
    if (!parentComment) {
      return { success: false, error: 'Parent comment not found' };
    }
    if (parentComment.taskId !== input.taskId) {
      return { success: false, error: 'Parent comment belongs to a different task' };
    }
    if (parentComment.parentCommentId !== null) {
      return { success: false, error: 'Cannot reply to a reply (only one level of nesting allowed)' };
    }
    parentCommentAuthorId = parentComment.authorId ?? undefined;
  }

  // Create the comment
  const [newComment] = await db
    .insert(comments)
    .values({
      taskId: input.taskId,
      authorId: user.id,
      parentCommentId: input.parentCommentId ?? null,
      content,
    })
    .returning();

  // Log board activity (fire-and-forget)
  if (task) {
    logBoardActivity({
      boardId: task.boardId,
      taskId: task.id,
      taskTitle: task.title,
      userId: user.id,
      action: 'comment_added',
    }).catch((err) => console.error('Failed to log board activity:', err));
  }

  // Create attachment records if provided
  let commentAttachments: CommentAttachment[] = [];
  if (input.attachments && input.attachments.length > 0) {
    const inserted = await db
      .insert(attachments)
      .values(
        input.attachments.map((a) => ({
          commentId: newComment.id,
          filename: a.filename,
          url: a.url,
          size: a.size,
          mimeType: a.mimeType,
          uploadedBy: user.id,
        }))
      )
      .returning({
        id: attachments.id,
        filename: attachments.filename,
        url: attachments.url,
        size: attachments.size,
        mimeType: attachments.mimeType,
      });
    commentAttachments = inserted;
  }

  // Get author info
  const author = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      deactivatedAt: true,
    },
  });

  const commentWithAuthor: CommentWithAuthor = {
    id: newComment.id,
    taskId: newComment.taskId,
    authorId: newComment.authorId,
    parentCommentId: newComment.parentCommentId,
    content: newComment.content,
    createdAt: newComment.createdAt,
    updatedAt: newComment.updatedAt,
    author: {
      id: author!.id,
      email: author!.email,
      name: author!.name,
      avatarUrl: author!.avatarUrl,
      deactivatedAt: author!.deactivatedAt,
    },
    attachments: commentAttachments,
  };

  // Send mention notifications (fire and forget)
  const mentionedUserIds = extractMentionedUserIds(content);
  for (const mentionedUserId of mentionedUserIds) {
    // Don't notify yourself
    if (mentionedUserId === user.id) continue;

    createMentionNotification({
      mentionedUserId,
      mentionerUserId: user.id,
      taskId: input.taskId,
      commentId: newComment.id,
      commentContent: content,
    }).catch((err) => console.error('Failed to create mention notification:', err));
  }

  // Send comment_added notifications to assignees, previous commenters, and previously mentioned users
  // Exclude users who already received a mention notification above to avoid duplicates
  createCommentAddedNotification({
    commenterId: user.id,
    taskId: input.taskId,
    commentId: newComment.id,
    commentContent: content,
    excludeUserIds: mentionedUserIds,
    parentCommentAuthorId,
  }).catch((err) => console.error('Failed to create comment_added notifications:', err));

  revalidatePath(`/clients/[clientSlug]/boards/[boardId]`, 'page');

  return { success: true, comment: commentWithAuthor };
}

/**
 * Update a comment (only the author can update)
 */
export async function updateComment(input: UpdateCommentInput): Promise<{
  success: boolean;
  comment?: CommentWithAuthor;
  error?: string;
}> {
  const user = await requireAuth();

  // Get the comment
  const existingComment = await db.query.comments.findFirst({
    where: eq(comments.id, input.id),
  });

  if (!existingComment) {
    return { success: false, error: 'Comment not found' };
  }

  // Only the author can update
  if (existingComment.authorId !== user.id) {
    return { success: false, error: 'You can only edit your own comments' };
  }

  // Parse content from JSON string to preserve nested attrs
  const content = input.contentJson 
    ? JSON.parse(input.contentJson) 
    : input.content;

  // Update the comment
  const [updatedComment] = await db
    .update(comments)
    .set({
      content,
      updatedAt: new Date(),
    })
    .where(eq(comments.id, input.id))
    .returning();

  // Get attachments
  const commentAttachments = await db
    .select({
      id: attachments.id,
      filename: attachments.filename,
      url: attachments.url,
      size: attachments.size,
      mimeType: attachments.mimeType,
    })
    .from(attachments)
    .where(eq(attachments.commentId, input.id));

  // Get author info
  const author = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      deactivatedAt: true,
    },
  });

  const commentWithAuthor: CommentWithAuthor = {
    id: updatedComment.id,
    taskId: updatedComment.taskId,
    authorId: updatedComment.authorId,
    parentCommentId: updatedComment.parentCommentId,
    content: updatedComment.content,
    createdAt: updatedComment.createdAt,
    updatedAt: updatedComment.updatedAt,
    author: {
      id: author!.id,
      email: author!.email,
      name: author!.name,
      avatarUrl: author!.avatarUrl,
      deactivatedAt: author!.deactivatedAt,
    },
    attachments: commentAttachments,
  };

  revalidatePath(`/clients/[clientSlug]/boards/[boardId]`, 'page');

  return { success: true, comment: commentWithAuthor };
}

/**
 * Delete a comment (only the author or admin can delete)
 */
export async function deleteComment(commentId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const user = await requireAuth();
  const isAdmin = user.role === 'admin';

  // Get the comment
  const existingComment = await db.query.comments.findFirst({
    where: eq(comments.id, commentId),
  });

  if (!existingComment) {
    return { success: false, error: 'Comment not found' };
  }

  // Only the author or admin can delete
  if (existingComment.authorId !== user.id && !isAdmin) {
    return { success: false, error: 'You can only delete your own comments' };
  }

  // Find child comments (replies) if this is a top-level comment
  const childComments = await db.query.comments.findMany({
    where: eq(comments.parentCommentId, commentId),
    columns: { id: true },
  });
  const childIds = childComments.map((c) => c.id);

  // Collect all attachment URLs for blob deletion
  const allCommentIds = [commentId, ...childIds];
  const attachmentRows = await db
    .select({ id: attachments.id, url: attachments.url })
    .from(attachments)
    .where(inArray(attachments.commentId, allCommentIds));

  // Delete blobs
  for (const row of attachmentRows) {
    try {
      await del(row.url);
    } catch (err) {
      console.error('Failed to delete blob:', err);
    }
  }

  // Delete child comment attachments
  if (childIds.length > 0) {
    await db.delete(attachments).where(inArray(attachments.commentId, childIds));
  }

  // Delete this comment's attachments
  await db.delete(attachments).where(eq(attachments.commentId, commentId));

  // Delete the comment (FK cascade handles child comment rows)
  await db.delete(comments).where(eq(comments.id, commentId));

  revalidatePath(`/clients/[clientSlug]/boards/[boardId]`, 'page');

  return { success: true };
}

// Import for notification integration
import { extractMentionedUserIds } from '@/lib/editor/mentions';
import { createMentionNotification, createCommentAddedNotification } from './notifications';
