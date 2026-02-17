'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listComments,
  createComment,
  updateComment,
  deleteComment,
  CommentWithAuthor,
  CreateCommentInput,
  UpdateCommentInput,
} from '@/lib/actions/comments';
import { trackEvent } from '@/lib/analytics';

// Types
export interface CommentThread {
  comment: CommentWithAuthor;
  replies: CommentWithAuthor[];
}

/**
 * Group a flat list of comments into threads (top-level comments with their replies)
 */
export function groupCommentsIntoThreads(comments: CommentWithAuthor[]): CommentThread[] {
  const topLevel: CommentWithAuthor[] = [];
  const repliesByParent = new Map<string, CommentWithAuthor[]>();

  for (const comment of comments) {
    if (comment.parentCommentId) {
      const existing = repliesByParent.get(comment.parentCommentId) ?? [];
      existing.push(comment);
      repliesByParent.set(comment.parentCommentId, existing);
    } else {
      topLevel.push(comment);
    }
  }

  return topLevel.map((comment) => ({
    comment,
    replies: (repliesByParent.get(comment.id) ?? []).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    ),
  }));
}

// Query key factory
export const commentKeys = {
  all: ['comments'] as const,
  lists: () => [...commentKeys.all, 'list'] as const,
  list: (taskId: string) => [...commentKeys.lists(), taskId] as const,
};

/**
 * Hook to fetch comments for a task
 */
export function useComments(taskId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: commentKeys.list(taskId),
    queryFn: async () => {
      const result = await listComments(taskId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to fetch comments');
      }
      return result.comments!;
    },
    enabled: options?.enabled ?? !!taskId,
  });
}

/**
 * Hook to fetch comments for a task, grouped into threads
 */
export function useCommentThreads(taskId: string, options?: { enabled?: boolean }) {
  const query = useComments(taskId, options);
  const threads = query.data ? groupCommentsIntoThreads(query.data) : [];
  return { ...query, threads, isLoading: query.isLoading };
}

/**
 * Hook to create a comment with optimistic updates
 */
export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCommentInput) => {
      const result = await createComment(input);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to create comment');
      }
      return result.comment!;
    },
    onMutate: async (newComment) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: commentKeys.list(newComment.taskId),
      });

      // Snapshot the previous value
      const previousComments = queryClient.getQueryData<CommentWithAuthor[]>(
        commentKeys.list(newComment.taskId)
      );

      // Parse content from JSON string
      const content = newComment.contentJson 
        ? JSON.parse(newComment.contentJson) 
        : newComment.content;

      // Optimistically add the new comment at the beginning (newest first)
      queryClient.setQueryData<CommentWithAuthor[]>(
        commentKeys.list(newComment.taskId),
        (old) => {
          if (!old) return old;
          const optimisticComment: CommentWithAuthor = {
            id: `temp-${Date.now()}`,
            taskId: newComment.taskId,
            authorId: '', // Will be filled by server
            parentCommentId: newComment.parentCommentId ?? null,
            content: content ?? { type: 'doc', content: [] },
            createdAt: new Date(),
            updatedAt: null,
            author: {
              id: '',
              email: '',
              name: 'You',
              avatarUrl: null,
              deactivatedAt: null,
            },
            attachments: [],
          };
          return [...old, optimisticComment];
        }
      );

      return { previousComments };
    },
    onError: (err, newComment, context) => {
      // Rollback on error
      if (context?.previousComments) {
        queryClient.setQueryData(
          commentKeys.list(newComment.taskId),
          context.previousComments
        );
      }
    },
    onSuccess: (_data, variables) => {
      trackEvent('comment_created', {
        is_reply: !!variables.parentCommentId,
        has_attachments: (variables.attachments?.length ?? 0) > 0,
      });
    },
    onSettled: (data, error, variables) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: commentKeys.list(variables.taskId),
      });
    },
  });
}

/**
 * Hook to update a comment with optimistic updates
 */
export function useUpdateComment(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateCommentInput) => {
      const result = await updateComment(input);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to update comment');
      }
      return result.comment!;
    },
    onMutate: async (updatedComment) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: commentKeys.list(taskId),
      });

      // Snapshot the previous value
      const previousComments = queryClient.getQueryData<CommentWithAuthor[]>(
        commentKeys.list(taskId)
      );

      // Parse content from JSON string
      const content = updatedComment.contentJson 
        ? JSON.parse(updatedComment.contentJson) 
        : updatedComment.content;

      // Optimistically update the comment
      queryClient.setQueryData<CommentWithAuthor[]>(
        commentKeys.list(taskId),
        (old) => {
          if (!old) return old;
          return old.map((comment) =>
            comment.id === updatedComment.id
              ? { ...comment, content: content ?? comment.content, updatedAt: new Date() }
              : comment
          );
        }
      );

      return { previousComments };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousComments) {
        queryClient.setQueryData(commentKeys.list(taskId), context.previousComments);
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: commentKeys.list(taskId) });
    },
  });
}

/**
 * Hook to delete a comment with optimistic updates
 */
export function useDeleteComment(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (commentId: string) => {
      const result = await deleteComment(commentId);
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to delete comment');
      }
      return commentId;
    },
    onMutate: async (commentId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: commentKeys.list(taskId),
      });

      // Snapshot the previous value
      const previousComments = queryClient.getQueryData<CommentWithAuthor[]>(
        commentKeys.list(taskId)
      );

      // Optimistically remove the comment
      queryClient.setQueryData<CommentWithAuthor[]>(
        commentKeys.list(taskId),
        (old) => {
          if (!old) return old;
          return old.filter((comment) => comment.id !== commentId);
        }
      );

      return { previousComments };
    },
    onError: (err, commentId, context) => {
      // Rollback on error
      if (context?.previousComments) {
        queryClient.setQueryData(commentKeys.list(taskId), context.previousComments);
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: commentKeys.list(taskId) });
    },
  });
}
