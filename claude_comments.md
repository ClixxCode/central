# Nested Comments Feature - Implementation Plan

## Overview

Add 1-level threaded replies to the comment system. Top-level comments can have replies indented beneath them. Replies cannot be replied to (max depth = 1). Deleting a parent cascades to all its replies. Threads with 4+ replies collapse by default with a "N replies" expand link.

---

## New Files (2)

### 1. `src/components/comments/CommentThread.tsx`

Wrapper component that renders a top-level comment with its indented replies beneath it.

**Props:**
- `parent: CommentWithAuthor` — the top-level comment
- `replies: CommentWithAuthor[]` — sorted by createdAt ASC (oldest first)
- `currentUser: { id, name, email, avatarUrl }` — for ReplyEditor avatar
- `currentUserId: string` — for edit/delete permission checks
- `isAdmin?: boolean`
- `mentionUsers?: MentionUser[]`
- `onUpdate?: (id: string, content: TiptapContent) => Promise<void>`
- `onDelete?: (id: string) => Promise<void>`
- `onReply?: (parentCommentId: string, content: TiptapContent) => Promise<void>`
- `onFileMentionClick?: (attachmentId: string) => void`
- `highlightedCommentId?: string`
- `defaultExpanded?: boolean` — forces thread open (for notification deep-links)

**State:**
- `isExpanded: boolean` — default true if `replies.length <= 3` or `defaultExpanded`, false otherwise
- `showReplyEditor: boolean` — toggled by Reply button on parent CommentItem

**Layout:**
```
<div>
  <CommentItem
    comment={parent}
    showReplyButton={true}
    onReply={() => setShowReplyEditor(true)}
    isHighlighted={parent.id === highlightedCommentId}
    {/* ...other standard props */}
  />

  {replies.length > 0 && (
    <div className="ml-10 border-l-2 border-muted pl-4 space-y-1">
      {isExpanded ? (
        replies.map(reply => (
          <CommentItem
            key={reply.id}
            comment={reply}
            showReplyButton={false}  // 1-level max: no reply button on replies
            isReply={true}           // smaller avatar, reduced padding
            isHighlighted={reply.id === highlightedCommentId}
            {/* ...other standard props */}
          />
        ))
      ) : (
        <button
          onClick={() => setIsExpanded(true)}
          className="text-sm text-muted-foreground hover:text-foreground py-2 flex items-center gap-1"
        >
          <MessageSquare className="h-3 w-3" />
          {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
        </button>
      )}
    </div>
  )}

  {showReplyEditor && (
    <div className="ml-10 border-l-2 border-primary/30 pl-4 mt-1">
      <ReplyEditor
        currentUser={currentUser}
        mentionUsers={mentionUsers}
        onSubmit={async (content) => {
          await onReply?.(parent.id, content);
          setShowReplyEditor(false);
          setIsExpanded(true); // expand thread to show new reply
        }}
        onCancel={() => setShowReplyEditor(false)}
        autoFocus
      />
    </div>
  )}
</div>
```

The `ml-10` indent aligns reply content under the parent's text area (past the h-8 avatar + gap-3 spacing).

---

### 2. `src/components/comments/ReplyEditor.tsx`

Simplified inline editor for composing replies. No attachments, no file upload, no formatting toolbar — just a compact Tiptap editor with @mention support.

**Props:**
- `currentUser: { id, name, email, avatarUrl }` — for avatar display
- `mentionUsers?: MentionUser[]` — for @ autocomplete
- `onSubmit: (content: TiptapContent) => Promise<void>`
- `onCancel: () => void`
- `autoFocus?: boolean`

**Layout:**
```
<div className="flex gap-2 py-2">
  <Avatar className="h-6 w-6 shrink-0 mt-1">
    {/* currentUser avatar */}
  </Avatar>
  <div className="flex-1 space-y-1">
    <div className="rounded-md border bg-background focus-within:ring-1 focus-within:ring-ring">
      <TaskEditor
        ref={editorRef}
        content={content}
        onChange={setContent}
        users={mentionUsers}
        placeholder="Write a reply..."
        className="[&>div]:border-0 [&>div]:p-2 [&>div]:focus-within:ring-0"
        minHeight="60px"
      />
    </div>
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={handleSubmit} disabled={!hasContent || isSubmitting}>
        {isSubmitting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
        Reply
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
      <span className="text-xs text-muted-foreground ml-auto">
        {isMac ? '⌘' : 'Ctrl'} + Enter to send
      </span>
    </div>
  </div>
</div>
```

**Keyboard:** Register Cmd/Ctrl+Enter via the TaskEditor's onSubmit or a keydown handler to call handleSubmit.

**Content check:** `hasContent` checks that the Tiptap doc has actual text content (not just empty paragraphs), same pattern as CommentEditor.

---

## Modified Files (8)

### 1. `src/lib/db/schema/comments.ts`

**Add column to `comments` table:**
```ts
parentCommentId: uuid('parent_comment_id')
  .references(() => comments.id, { onDelete: 'cascade' }),
```

`onDelete: 'cascade'` means deleting a parent auto-deletes all its replies at the DB level. The column is nullable — existing comments remain valid as top-level (parentCommentId = NULL).

**Add to `commentsRelations`:**
```ts
parent: one(comments, {
  fields: [comments.parentCommentId],
  references: [comments.id],
  relationName: 'commentReplies',
}),
replies: many(comments, {
  relationName: 'commentReplies',
}),
```

**Migration:** Run `pnpm db:generate` then `pnpm db:push`. This creates a migration like:
```sql
ALTER TABLE "comments" ADD COLUMN "parent_comment_id" uuid REFERENCES "comments"("id") ON DELETE CASCADE;
```

---

### 2. `src/lib/actions/comments.ts`

#### Update `CommentWithAuthor` interface (line 34)
Add:
```ts
parentCommentId: string | null;
```

#### Update `CreateCommentInput` interface (line 45)
Add:
```ts
parentCommentId?: string;
```

#### Update `listComments` function (line 172-255)

Add to the select at line 189:
```ts
parentCommentId: comments.parentCommentId,
```

Add to the response mapping at line 239:
```ts
parentCommentId: c.parentCommentId,
```

The function continues to return a **flat list** — client handles grouping. This keeps optimistic updates simple (flat array operations).

#### Update `createComment` function (line 261-367)

**Add parent validation before insert (after line 279):**
```ts
if (input.parentCommentId) {
  const parentComment = await db.query.comments.findFirst({
    where: eq(comments.id, input.parentCommentId),
    columns: { id: true, taskId: true, parentCommentId: true },
  });
  if (!parentComment || parentComment.taskId !== input.taskId) {
    return { success: false, error: 'Parent comment not found' };
  }
  if (parentComment.parentCommentId) {
    return { success: false, error: 'Cannot reply to a reply' };
  }
}
```

**Add to insert values at line 284:**
```ts
parentCommentId: input.parentCommentId ?? null,
```

**Add to response object at line 325:**
```ts
parentCommentId: newComment.parentCommentId,
```

**Update notification call at line 357:**
```ts
createCommentAddedNotification({
  commenterId: user.id,
  taskId: input.taskId,
  commentId: newComment.id,
  commentContent: content,
  parentCommentId: input.parentCommentId,  // NEW
}).catch(...);
```

#### Update `updateComment` response (line 431)
Add:
```ts
parentCommentId: updatedComment.parentCommentId,
```

#### Update `deleteComment` function (line 455-485)

Before deleting attachments and the comment, also handle child reply attachments (since the code manually deletes attachments before comments):
```ts
// Delete attachments of child replies first (cascade will delete the reply rows)
const childReplies = await db
  .select({ id: comments.id })
  .from(comments)
  .where(eq(comments.parentCommentId, commentId));

if (childReplies.length > 0) {
  const childIds = childReplies.map(c => c.id);
  await db.delete(attachments).where(inArray(attachments.commentId, childIds));
}

// Then existing logic: delete own attachments, delete comment (cascades replies)
```

---

### 3. `src/lib/actions/notifications.ts`

#### Update `createCommentAddedNotification` input (line 387)
Add:
```ts
parentCommentId?: string;
```

#### Add parent author to recipients (after existing recipient collection ~line 456)
```ts
if (input.parentCommentId) {
  const parentComment = await db.query.comments.findFirst({
    where: eq(comments.id, input.parentCommentId),
    columns: { authorId: true },
  });
  if (parentComment) {
    recipientIds.add(parentComment.authorId);
  }
}
```

This ensures the parent comment author is always notified when someone replies to their comment, even if they aren't a task assignee or previous commenter.

#### Differentiate notification title
Where the notification title is set:
```ts
const isReply = !!input.parentCommentId;
const commenterName = commenter.name ?? commenter.email.split('@')[0];
const title = isReply
  ? `${commenterName} replied to a comment on "${taskDetails.title}"`
  : `${commenterName} commented on "${taskDetails.title}"`;
```

---

### 4. `src/lib/hooks/useComments.ts`

#### Update `useCreateComment` optimistic update (line 69-90)

Add `parentCommentId` to the optimistic comment object:
```ts
const optimisticComment: CommentWithAuthor = {
  id: `temp-${Date.now()}`,
  taskId: newComment.taskId,
  authorId: '',
  content: content ?? { type: 'doc', content: [] },
  createdAt: new Date(),
  updatedAt: null,
  parentCommentId: newComment.parentCommentId ?? null,  // NEW
  author: { id: '', email: '', name: 'You', avatarUrl: null },
  attachments: [],
};
```

Update the placement logic:
```ts
queryClient.setQueryData<CommentWithAuthor[]>(
  commentKeys.list(newComment.taskId),
  (old) => {
    if (!old) return old;

    if (!newComment.parentCommentId) {
      // Top-level comment: prepend (newest first)
      return [optimisticComment, ...old];
    }

    // Reply: insert after last existing reply of this parent
    const result = [...old];
    const parentIndex = result.findIndex(c => c.id === newComment.parentCommentId);
    if (parentIndex === -1) return [optimisticComment, ...old]; // fallback

    let insertAt = parentIndex + 1;
    while (insertAt < result.length && result[insertAt].parentCommentId === newComment.parentCommentId) {
      insertAt++;
    }
    result.splice(insertAt, 0, optimisticComment);
    return result;
  }
);
```

#### Update `useDeleteComment` optimistic update (line 196-202)

Handle cascade behavior for parent comments:
```ts
queryClient.setQueryData<CommentWithAuthor[]>(
  commentKeys.list(taskId),
  (old) => {
    if (!old) return old;
    const deletedComment = old.find(c => c.id === commentId);
    if (!deletedComment) return old.filter(c => c.id !== commentId);

    if (!deletedComment.parentCommentId) {
      // Deleting a top-level comment: remove it AND all its replies
      return old.filter(c => c.id !== commentId && c.parentCommentId !== commentId);
    }
    // Deleting a reply: just remove that one comment
    return old.filter(c => c.id !== commentId);
  }
);
```

---

### 5. `src/components/comments/CommentItem.tsx`

#### Add new props to interface (line 21)
```ts
showReplyButton?: boolean;
onReply?: () => void;
isReply?: boolean;
```

#### Conditionally size the avatar (line 113)
```tsx
<Avatar className={cn("shrink-0", isReply ? "h-6 w-6" : "h-8 w-8")}>
```

Update AvatarFallback text size accordingly:
```tsx
<AvatarFallback className={cn(isReply ? "text-[10px]" : "text-xs")}>
```

#### Add Reply button in the header (after line 130, after the (edited) span)
```tsx
{showReplyButton && (
  <button
    onClick={onReply}
    className="text-xs text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ml-1"
  >
    <MessageSquare className="h-3 w-3" />
    Reply
  </button>
)}
```

Import `MessageSquare` from lucide-react at the top.

#### Conditionally reduce padding for replies
```tsx
<div
  className={cn(
    'group relative flex gap-3 rounded-lg transition-colors hover:bg-muted/50',
    isReply ? 'p-2' : 'p-3',
    ...
  )}
>
```

---

### 6. `src/components/comments/CommentList.tsx`

#### Add new props (line 10)
```ts
onReply?: (parentCommentId: string, content: TiptapContent) => Promise<void>;
currentUser?: { id: string; name: string | null; email: string; avatarUrl: string | null };
```

#### Replace flat rendering with threaded grouping (line 56-71)

Add `useMemo` import and thread grouping:
```ts
import { useMemo } from 'react';
import { CommentThread } from './CommentThread';

// Inside the component, before the return:
const threads = useMemo(() => {
  const topLevel = comments.filter(c => !c.parentCommentId);
  const repliesByParent = new Map<string, CommentWithAuthor[]>();

  for (const c of comments) {
    if (c.parentCommentId) {
      const siblings = repliesByParent.get(c.parentCommentId) || [];
      siblings.push(c);
      repliesByParent.set(c.parentCommentId, siblings);
    }
  }

  // Sort replies oldest first within each thread
  for (const [, replies] of repliesByParent) {
    replies.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  return topLevel.map(parent => ({
    parent,
    replies: repliesByParent.get(parent.id) || [],
  }));
}, [comments]);

// Determine if a highlighted comment is a reply (need to auto-expand its thread)
const highlightedComment = useMemo(() => {
  if (!highlightedCommentId) return null;
  return comments.find(c => c.id === highlightedCommentId) ?? null;
}, [comments, highlightedCommentId]);
```

Replace the render block:
```tsx
<div className="space-y-1">
  {threads.map(({ parent, replies }) => (
    <CommentThread
      key={parent.id}
      parent={parent}
      replies={replies}
      currentUser={currentUser}
      currentUserId={currentUserId}
      isAdmin={isAdmin}
      mentionUsers={mentionUsers}
      onUpdate={onUpdate}
      onDelete={onDelete}
      onReply={onReply}
      onFileMentionClick={onFileMentionClick}
      highlightedCommentId={highlightedCommentId}
      defaultExpanded={
        highlightedComment?.parentCommentId === parent.id ||
        highlightedComment?.id === parent.id
      }
    />
  ))}
</div>
```

---

### 7. `src/components/comments/CommentsSection.tsx`

#### Add `handleReply` callback (after line 76)
```ts
const handleReply = useCallback(
  async (parentCommentId: string, content: TiptapContent) => {
    await createComment.mutateAsync({
      taskId,
      contentJson: JSON.stringify(content),
      parentCommentId,
    });
  },
  [taskId, createComment]
);
```

#### Pass new props to CommentList (line 94-104)
Add:
```tsx
<CommentList
  {/* ...existing props */}
  onReply={handleReply}
  currentUser={currentUser}
/>
```

---

### 8. `src/components/comments/index.ts`

Add export for new components:
```ts
export { CommentThread } from './CommentThread';
export { ReplyEditor } from './ReplyEditor';
```

---

## Implementation Order

1. **Schema + migration** — `src/lib/db/schema/comments.ts`, run `db:generate` + `db:push`
2. **Server actions** — `src/lib/actions/comments.ts` (interfaces, listComments, createComment validation, deleteComment cascade)
3. **Notifications** — `src/lib/actions/notifications.ts` (parent author recipient, reply title)
4. **Hooks** — `src/lib/hooks/useComments.ts` (optimistic create placement, delete cascade)
5. **CommentThread** — new `src/components/comments/CommentThread.tsx`
6. **ReplyEditor** — new `src/components/comments/ReplyEditor.tsx`
7. **CommentItem** — add Reply button, isReply styling
8. **CommentList** — thread grouping, render CommentThread
9. **CommentsSection** — wire handleReply, pass currentUser
10. **Barrel export** — `src/components/comments/index.ts`

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Server returns flat vs nested | **Flat list** with `parentCommentId` | Optimistic updates stay simple (flat array ops). Client groups via `useMemo`. |
| Thread depth | **1-level max** | Standard for PM tools (GitHub, Linear). Enforced server-side. |
| Delete behavior | **Cascade** | `ON DELETE CASCADE` on FK. No orphaned replies. |
| Collapse threshold | **4+ replies** | Threads with 1-3 replies always visible. 4+ collapsed with expand link. |
| Reply editor | **Lightweight** (no attachments/toolbar) | Keeps reply interaction fast and focused. |
| Sort order | Top-level: `createdAt DESC`, replies: `createdAt ASC` | Newest threads first, conversation order within threads. |

---

## Existing Code Reused

| What | Where | How |
|------|-------|-----|
| TaskEditor (Tiptap) | `src/components/editor/TaskEditor.tsx` | ReplyEditor wraps it for rich text + @mentions |
| MentionUser type | `src/components/editor/MentionList.tsx` | Passed through to ReplyEditor |
| Avatar component | `src/components/ui/avatar.tsx` | Used in ReplyEditor + isReply CommentItem |
| Button component | `src/components/ui/button.tsx` | Reply/Cancel buttons |
| cn utility | `src/lib/utils.ts` | Conditional classNames |
| CommentWithAuthor type | `src/lib/actions/comments.ts` | Extended with parentCommentId |

---

## Notification Deep-Linking (No Changes Needed)

The existing mechanism works for nested replies without modification:
1. Notification stores `commentId` pointing to the specific reply
2. URL includes `?task=<taskId>&comment=<commentId>`
3. TaskModal/MyTasksPageClient pass `highlightedCommentId`
4. CommentList detects if highlighted comment is a reply → sets `defaultExpanded=true` on its thread
5. CommentItem scrolls into view with ring highlight animation

No changes needed in: `BoardPageClient.tsx`, `TaskModal.tsx`, `MyTasksPageClient.tsx`, Slack formatters.

---

## Verification Checklist

1. Create a top-level comment — appears at top of list
2. Click "Reply" on a comment — inline editor appears indented with left border
3. Submit a reply — appears indented under parent, oldest-first order
4. Thread with 4+ replies — shows "N replies" collapsed link, click expands
5. Thread with 1-3 replies — always expanded
6. Delete a reply — only that reply removed
7. Delete a parent comment — parent AND all replies removed (cascade)
8. Edit a reply — inline edit works same as top-level
9. Reply button does NOT appear on reply comments (1-level max)
10. Attempt to reply to a reply via API — server returns error
11. Notification deep-link to a reply — thread auto-expands, reply highlighted with blue ring
12. Reply to a comment — parent comment author receives notification
13. Notification text shows "replied to a comment" for replies vs "commented on" for top-level
14. Cmd/Ctrl+Enter submits reply from ReplyEditor
15. Press Escape/Cancel — reply editor closes
16. Optimistic reply appears immediately, settles after server response
