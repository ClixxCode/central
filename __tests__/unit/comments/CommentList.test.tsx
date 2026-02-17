import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CommentList } from '@/components/comments/CommentList';
import type { CommentWithAuthor } from '@/lib/actions/comments';
import type { CommentThread } from '@/lib/hooks/useComments';
import type { TiptapContent } from '@/lib/db/schema/tasks';

const createMockContent = (text: string): TiptapContent => ({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text }],
    },
  ],
});

const mockCurrentUser = {
  id: 'user-1',
  name: 'Alice Smith',
  email: 'alice@example.com',
  avatarUrl: null,
};

const mockComments: CommentWithAuthor[] = [
  {
    id: 'comment-1',
    shortId: 'abc12345',
    taskId: 'task-1',
    authorId: 'user-1',
    parentCommentId: null,
    content: createMockContent('First comment'),
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: null,
    author: {
      id: 'user-1',
      email: 'alice@example.com',
      name: 'Alice Smith',
      avatarUrl: null,
      deactivatedAt: null,
    },
    attachments: [],
  },
  {
    id: 'comment-2',
    shortId: 'def67890',
    taskId: 'task-1',
    authorId: 'user-2',
    parentCommentId: null,
    content: createMockContent('Second comment'),
    createdAt: new Date('2024-01-15T11:00:00Z'),
    updatedAt: new Date('2024-01-15T12:00:00Z'),
    author: {
      id: 'user-2',
      email: 'bob@example.com',
      name: 'Bob Jones',
      avatarUrl: 'https://example.com/bob.jpg',
      deactivatedAt: null,
    },
    attachments: [],
  },
];

const mockThreads: CommentThread[] = mockComments.map((comment) => ({
  comment,
  replies: [],
}));

describe('CommentList', () => {
  it('renders all comments', () => {
    render(
      <CommentList
        threads={mockThreads}
        currentUserId="user-1"
        currentUser={mockCurrentUser}
      />
    );
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
  });

  it('renders empty state when no comments', () => {
    render(
      <CommentList
        threads={[]}
        currentUserId="user-1"
        currentUser={mockCurrentUser}
      />
    );
    expect(screen.getByText('No comments yet. Be the first to add one!')).toBeInTheDocument();
  });

  it('shows loading skeletons when isLoading is true', () => {
    const { container } = render(
      <CommentList
        threads={[]}
        currentUserId="user-1"
        currentUser={mockCurrentUser}
        isLoading
      />
    );
    // Should show 3 skeleton loaders
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows edited indicator for updated comments', () => {
    render(
      <CommentList
        threads={mockThreads}
        currentUserId="user-1"
        currentUser={mockCurrentUser}
      />
    );
    // The second comment was edited
    expect(screen.getByText('(edited)')).toBeInTheDocument();
  });
});
