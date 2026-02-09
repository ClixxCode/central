# Clix Project Management Tool

## Project Overview

A Monday.com-style project management tool for a ~20 person digital marketing agency. Features task management with swimlane/kanban views, client-based board organization, rollup views, and team collaboration.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router) |
| Frontend | React 19, Tailwind CSS 4, @dnd-kit |
| UI Components | shadcn/ui |
| Rich Text | Tiptap |
| State | Zustand 5 (UI/preferences), TanStack Query 5 (server state) |
| Database | PostgreSQL (Neon serverless) |
| ORM | Drizzle ORM |
| Auth | Auth.js v5 (NextAuth) |
| File Upload | Uploadthing |
| Email | Resend |
| Job Queue | Inngest |
| PWA | next-pwa |
| Deployment | Vercel |
| Testing | Vitest (unit/integration), Playwright (E2E) |

## Key Architectural Decisions

### Data Flow
```
Neon Postgres → Server Actions/API → TanStack Query (server state) → React UI
                                   → Zustand (UI state, persisted to localStorage)
```

### Optimistic Updates
- All mutations use TanStack Query's optimistic updates for instant UI feedback
- Rollback on server error
- Background polling (10s interval) keeps data fresh

### Permissions Model
- **Admins**: Full access to everything, can create clients/boards
- **Users**: Access only to boards they have permission for (direct or via team)
- **Board Access Levels**:
  - `full`: See all tasks, can create tasks
  - `assigned_only`: Only see tasks assigned to them, can still create tasks (for contractors)

### Authentication
- Google OAuth for @clix.co emails (auto-approved)
- Email/password with invitation system for external users
- Invitations required for non-@clix.co emails

---

## Parallel Development Strategy (Git Worktrees)

This project is designed to be built by multiple Claude instances working in parallel using git worktrees. Each worktree works on an independent feature branch that gets merged into `main` after completion.

### Worktree Setup Commands

```bash
# From the main repo directory, create worktrees for parallel development
git worktree add ../pm-tool-auth feature/auth
git worktree add ../pm-tool-db feature/database
git worktree add ../pm-tool-ui feature/ui-foundation
# ... add more as needed per phase
```

### Branch Naming Convention
- `feature/<area>` - Feature development
- `test/<area>` - Test development (can parallel feature work)
- `fix/<issue>` - Bug fixes

### Merge Strategy
1. Each worktree completes its feature with tests
2. Create PR to `main`
3. Run full test suite before merge
4. Squash merge to keep history clean

---

## Development Phases

### Phase 0: Project Initialization
**Single worktree - must complete before parallel work**

- [ ] **0.1** Initialize Next.js 15 with App Router
  ```bash
  npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
  ```
- [ ] **0.2** Install core dependencies
  ```bash
  npm install drizzle-orm @neondatabase/serverless
  npm install -D drizzle-kit
  npm install @tanstack/react-query zustand
  npm install next-auth@beta @auth/drizzle-adapter
  npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-mention
  npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
  npm install uploadthing @uploadthing/react
  npm install resend
  npm install inngest
  npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom
  npm install -D playwright @playwright/test
  ```
- [ ] **0.3** Initialize shadcn/ui
  ```bash
  npx shadcn@latest init
  ```
- [ ] **0.4** Set up project structure (empty directories)
- [ ] **0.5** Configure environment variables template (.env.example)
- [ ] **0.6** Set up Vitest configuration
- [ ] **0.7** Set up Playwright configuration
- [ ] **0.8** Create initial CI workflow (.github/workflows/ci.yml)

**Tests for Phase 0:**
- Verify Next.js app runs
- Verify test frameworks are configured correctly

---

### Phase 1: Foundation (Parallel Development)

**Can be developed in parallel across 3 worktrees after Phase 0**

#### Worktree A: Database & Schema (`feature/database`)

- [ ] **1.A.1** Set up Neon database connection
- [ ] **1.A.2** Create Drizzle configuration (drizzle.config.ts)
- [ ] **1.A.3** Implement User schema
  - id, email, name, avatarUrl, role, authProvider, passwordHash, preferences, timestamps
- [ ] **1.A.4** Implement Team schema
  - id, name, timestamps
  - teamMembers junction table
- [ ] **1.A.5** Implement Client schema
  - id, name, slug, color, createdBy, timestamps
- [ ] **1.A.6** Implement Board schema
  - id, clientId, name, type, statusOptions (jsonb), sectionOptions (jsonb), timestamps
- [ ] **1.A.7** Implement BoardAccess schema
  - id, boardId, userId (nullable), teamId (nullable), accessLevel, timestamps
  - Check constraint: either userId OR teamId, not both
- [ ] **1.A.8** Implement Task schema
  - id, boardId, title, description (jsonb), status, section, dueDate, dateFlexibility, recurringConfig, recurringGroupId, position, timestamps
- [ ] **1.A.9** Implement TaskAssignees junction table
- [ ] **1.A.10** Implement Comment schema
  - id, taskId, authorId, content (jsonb), timestamps
- [ ] **1.A.11** Implement Attachment schema
  - id, taskId (nullable), commentId (nullable), filename, url, size, mimeType, uploadedBy, timestamps
- [ ] **1.A.12** Implement Notification schema
  - id, userId, type, taskId, commentId, title, body, readAt, emailSentAt, slackSentAt, timestamps
- [ ] **1.A.13** Implement Invitation schema
  - id, email, invitedBy, role, teamId, expiresAt, acceptedAt, timestamps
- [ ] **1.A.14** Implement RollupSources junction table
- [ ] **1.A.15** Create database seed script for development
- [ ] **1.A.16** Create migration scripts

**Tests for Worktree A:**
- [ ] Schema validation tests (all tables create correctly)
- [ ] Seed script runs without errors
- [ ] Basic CRUD operations work for each table

#### Worktree B: Authentication (`feature/auth`)

- [ ] **1.B.1** Configure Auth.js v5 with Drizzle adapter
- [ ] **1.B.2** Implement Google OAuth provider
- [ ] **1.B.3** Implement Credentials provider (email/password)
- [ ] **1.B.4** Implement signIn callback with domain restriction
  - Auto-approve @clix.co emails
  - Check invitation table for other emails
- [ ] **1.B.5** Create login page (/login)
- [ ] **1.B.6** Create signup page (/signup) - invitation-only flow
- [ ] **1.B.7** Create invitation acceptance page (/invite/[token])
- [ ] **1.B.8** Implement password hashing utilities (bcrypt)
- [ ] **1.B.9** Create auth middleware for protected routes
- [ ] **1.B.10** Implement session management
- [ ] **1.B.11** Create useCurrentUser hook
- [ ] **1.B.12** Implement invitation creation (admin only)
- [ ] **1.B.13** Implement invitation email sending (Resend)

**Tests for Worktree B:**
- [ ] Google OAuth flow (mock)
- [ ] Email/password registration with valid invitation
- [ ] Email/password registration rejected without invitation
- [ ] @clix.co auto-approval works
- [ ] Password hashing and verification
- [ ] Session creation and validation
- [ ] Protected route middleware blocks unauthenticated users

#### Worktree C: UI Foundation (`feature/ui-foundation`)

- [ ] **1.C.1** Install shadcn/ui components: button, input, dialog, dropdown-menu, select, popover, calendar, avatar, badge, card, separator, skeleton, toast, tooltip
- [ ] **1.C.2** Create color palette and theme configuration
- [ ] **1.C.3** Create app layout component (/(dashboard)/layout.tsx)
- [ ] **1.C.4** Implement Sidebar component
  - Logo, navigation links, client list, collapse toggle
- [ ] **1.C.5** Implement Header component
  - Search, notifications bell, user menu
- [ ] **1.C.6** Implement MobileNav component (responsive drawer)
- [ ] **1.C.7** Create Zustand UI store
  - sidebarOpen, boardViews, hiddenColumns, hiddenBoardsInRollup
  - Persist to localStorage
- [ ] **1.C.8** Configure TanStack Query provider
- [ ] **1.C.9** Create loading skeletons for common patterns
- [ ] **1.C.10** Create empty state components
- [ ] **1.C.11** Create error boundary component
- [ ] **1.C.12** Set up toast notifications (sonner)

**Tests for Worktree C:**
- [ ] Sidebar renders and toggles correctly
- [ ] Mobile nav opens/closes
- [ ] Zustand store persists to localStorage
- [ ] Theme switching works
- [ ] Responsive breakpoints behave correctly

---

### Phase 2: Core CRUD Operations (Parallel Development)

**Depends on: Phase 1 complete (all worktrees merged)**

#### Worktree A: Client & Board Management (`feature/client-board-crud`)

- [ ] **2.A.1** Create clients API routes (Server Actions)
  - listClients, getClient, createClient, updateClient, deleteClient
- [ ] **2.A.2** Create boards API routes (Server Actions)
  - listBoards, getBoard, createBoard, updateBoard, deleteBoard
- [ ] **2.A.3** Implement permission checks in all routes
- [ ] **2.A.4** Create useClients hook (TanStack Query)
- [ ] **2.A.5** Create useBoards hook (TanStack Query)
- [ ] **2.A.6** Create clients list page (/clients) - admin only
- [ ] **2.A.7** Create client detail page (/clients/[clientSlug])
- [ ] **2.A.8** Create board settings page (/clients/[clientSlug]/boards/[boardId]/settings)
  - Status options management
  - Section options management
  - Access control management
- [ ] **2.A.9** Create "New Client" modal
- [ ] **2.A.10** Create "New Board" modal
- [ ] **2.A.11** Implement board access management UI
  - Add/remove user access
  - Add/remove team access
  - Toggle full/assigned_only

**Tests for Worktree A:**
- [ ] Client CRUD operations
- [ ] Board CRUD operations
- [ ] Permission checks (admin vs user)
- [ ] Board access filtering works correctly

#### Worktree B: Task CRUD & Table View (`feature/task-crud`)

- [ ] **2.B.1** Create tasks API routes (Server Actions)
  - listTasks, getTask, createTask, updateTask, deleteTask
  - Include permission filtering (assigned_only support)
- [ ] **2.B.2** Implement optimistic updates for task mutations
- [ ] **2.B.3** Create useTasks hook with optimistic updates
- [ ] **2.B.4** Create useTask hook (single task)
- [ ] **2.B.5** Create BoardTable component
  - Column headers with sorting
  - Responsive column widths
- [ ] **2.B.6** Create TaskRow component
  - Inline editing for simple fields
  - Click to open modal for full editing
- [ ] **2.B.7** Create StatusSelect component (colored badges)
- [ ] **2.B.8** Create SectionSelect component
- [ ] **2.B.9** Create AssigneePicker component (multi-select with avatars)
- [ ] **2.B.10** Create DatePicker component with flexibility indicator
- [ ] **2.B.11** Create FlexibilitySelect component
- [ ] **2.B.12** Create "New Task" inline row / modal
- [ ] **2.B.13** Implement task filtering (by status, section, assignee)
- [ ] **2.B.14** Implement task sorting

**Tests for Worktree B:**
- [ ] Task CRUD operations
- [ ] Optimistic updates apply and rollback correctly
- [ ] Permission filtering (assigned_only users only see their tasks)
- [ ] Table sorting works
- [ ] Table filtering works
- [ ] Inline editing saves correctly

#### Worktree C: Rich Text Editor & Attachments (`feature/editor-attachments`)

- [ ] **2.C.1** Configure Tiptap with StarterKit
- [ ] **2.C.2** Add Tiptap extensions: Link, Image, Placeholder, Mention
- [ ] **2.C.3** Create TaskEditor component (Tiptap wrapper)
- [ ] **2.C.4** Implement @mention functionality
  - User search/autocomplete
  - Mention node rendering
- [ ] **2.C.5** Configure Uploadthing for file uploads
- [ ] **2.C.6** Create FileUpload component (drag & drop)
- [ ] **2.C.7** Create AttachmentList component
- [ ] **2.C.8** Create AttachmentPreview component (images, PDFs, etc.)
- [ ] **2.C.9** Implement attachment deletion
- [ ] **2.C.10** Create TaskModal component
  - Full task editor with description
  - Attachment management
  - All field editors
- [ ] **2.C.11** Extract mentions from content for notification triggers

**Tests for Worktree C:**
- [ ] Tiptap renders and saves content correctly
- [ ] @mentions autocomplete works
- [ ] File upload succeeds
- [ ] Attachment deletion works
- [ ] Mention extraction identifies all mentioned users

---

### Phase 3: Views & Drag-and-Drop (Parallel Development)

**Depends on: Phase 2 complete**

#### Worktree A: Swimlane View (`feature/swimlane-view`)

- [ ] **3.A.1** Create Swimlane component
  - Collapsible header with task count
  - Task list within lane
- [ ] **3.A.2** Create SwimlaneBoardView component
  - Groups tasks by status
  - Renders Swimlane for each status
- [ ] **3.A.3** Implement swimlane collapse/expand (persisted)
- [ ] **3.A.4** Add task count badges per swimlane
- [ ] **3.A.5** Implement empty swimlane state
- [ ] **3.A.6** Ensure table rows render within swimlanes
- [ ] **3.A.7** Create board page with swimlane as default (/clients/[slug]/boards/[id])

**Tests for Worktree A:**
- [ ] Tasks grouped correctly by status
- [ ] Swimlane collapse persists
- [ ] Empty swimlanes render correctly

#### Worktree B: Kanban View (`feature/kanban-view`)

- [ ] **3.B.1** Create KanbanColumn component
  - Column header with status name and color
  - Scrollable task card list
- [ ] **3.B.2** Create TaskCard component (kanban card variant)
  - Compact view: title, assignees, due date, section badge
- [ ] **3.B.3** Create KanbanBoardView component
  - Horizontal scroll for columns
  - Responsive column widths
- [ ] **3.B.4** Create ViewToggle component (table/kanban switch)
- [ ] **3.B.5** Create kanban page (/clients/[slug]/boards/[id]/kanban)
- [ ] **3.B.6** Persist view preference per board (Zustand)

**Tests for Worktree B:**
- [ ] Kanban columns render with correct tasks
- [ ] View toggle switches between table and kanban
- [ ] View preference persists per board

#### Worktree C: Drag-and-Drop (`feature/dnd`)

- [ ] **3.C.1** Set up @dnd-kit DndContext provider
- [ ] **3.C.2** Implement drag-and-drop for swimlane view
  - Reorder within same swimlane
  - Move between swimlanes (changes status)
- [ ] **3.C.3** Implement drag-and-drop for kanban view
  - Reorder within column
  - Move between columns (changes status)
- [ ] **3.C.4** Create drag overlay (ghost card while dragging)
- [ ] **3.C.5** Implement position persistence
  - Update task positions on drop
  - Optimistic update with rollback
- [ ] **3.C.6** Handle edge cases
  - Scrolling while dragging
  - Touch device support
- [ ] **3.C.7** Add drop indicators/placeholders

**Tests for Worktree C:**
- [ ] Drag within swimlane reorders correctly
- [ ] Drag between swimlanes updates status
- [ ] Drag within kanban column reorders correctly
- [ ] Drag between kanban columns updates status
- [ ] Position persists after page reload
- [ ] Optimistic update rolls back on error

---

### Phase 4: Comments & Rollups (Parallel Development)

**Depends on: Phase 3 complete**

#### Worktree A: Comments System (`feature/comments`)

- [ ] **4.A.1** Create comments API routes (Server Actions)
  - listComments, createComment, updateComment, deleteComment
- [ ] **4.A.2** Create useComments hook
- [ ] **4.A.3** Create CommentList component
- [ ] **4.A.4** Create CommentItem component
  - Author avatar, name, timestamp
  - Rich text content (Tiptap read-only)
  - Edit/delete actions (own comments only)
  - Attachment display
- [ ] **4.A.5** Create CommentEditor component
  - Tiptap with @mention support
  - File attachment support
  - Submit button
- [ ] **4.A.6** Integrate comments into TaskModal
- [ ] **4.A.7** Create "Updates" tab/section in task modal
- [ ] **4.A.8** Implement comment notification triggers

**Tests for Worktree A:**
- [ ] Comment CRUD operations
- [ ] @mentions in comments work
- [ ] File attachments in comments work
- [ ] Only comment author can edit/delete
- [ ] Comment list updates in real-time

#### Worktree B: Rollup Boards (`feature/rollup-boards`)

- [ ] **4.B.1** Create rollup board API routes
  - createRollupBoard, updateRollupSources, getRollupTasks
- [ ] **4.B.2** Create useRollupBoard hook
- [ ] **4.B.3** Create RollupBoardView component
  - Aggregates tasks from multiple source boards
  - Swimlane view (grouped by status)
  - Kanban view
- [ ] **4.B.4** Create RollupSourceSelector component
  - Multi-select boards to include
- [ ] **4.B.5** Create rollup board page (/rollups/[rollupId])
- [ ] **4.B.6** Create "New Rollup" page (/rollups/new)
- [ ] **4.B.7** Add client name column/badge to rollup views
- [ ] **4.B.8** Handle task navigation from rollup to source board

**Tests for Worktree B:**
- [ ] Rollup aggregates tasks from selected boards
- [ ] Swimlane groups tasks correctly across boards
- [ ] Task click navigates to source board
- [ ] Rollup respects user permissions on source boards

#### Worktree C: Personal Rollup View (`feature/personal-rollup`)

- [ ] **4.C.1** Create my tasks API route
  - Get all tasks assigned to current user across all accessible boards
- [ ] **4.C.2** Create useMyTasks hook
- [ ] **4.C.3** Create PersonalRollupView component
  - Swimlanes grouped by client
  - Within each client: tasks from all boards
- [ ] **4.C.4** Implement column visibility toggle
  - Dropdown to show/hide columns
  - Persist to Zustand/localStorage
- [ ] **4.C.5** Implement board visibility toggle
  - Hide specific boards from personal view
  - Persist to Zustand/localStorage
- [ ] **4.C.6** Create my tasks page (/my-tasks)
- [ ] **4.C.7** Make /my-tasks the default dashboard route

**Tests for Worktree C:**
- [ ] Personal rollup shows only assigned tasks
- [ ] Tasks grouped by client correctly
- [ ] Hidden columns persist
- [ ] Hidden boards persist
- [ ] Respects board access permissions

---

### Phase 5: Notifications (Parallel Development)

**Depends on: Phase 4 complete**

#### Worktree A: In-App Notifications (`feature/notifications-inapp`)

- [ ] **5.A.1** Create notifications API routes
  - listNotifications, markAsRead, markAllAsRead
- [ ] **5.A.2** Create useNotifications hook (with polling)
- [ ] **5.A.3** Create NotificationBell component
  - Unread count badge
  - Dropdown with notification list
- [ ] **5.A.4** Create NotificationItem component
  - Icon by type, title, timestamp, read state
  - Click to navigate to relevant task
- [ ] **5.A.5** Create notifications page (/settings/notifications)
  - Full notification history
  - Bulk mark as read
- [ ] **5.A.6** Implement notification preferences UI
  - Toggle in-app notifications on/off

**Tests for Worktree A:**
- [ ] Notifications appear when triggered
- [ ] Unread count updates correctly
- [ ] Mark as read works
- [ ] Click navigates to correct task

#### Worktree B: Email Notifications (`feature/notifications-email`)

- [ ] **5.B.1** Configure Resend client
- [ ] **5.B.2** Create email templates
  - Mention notification
  - Task assigned
  - Task due soon
  - Task overdue
  - Daily digest
- [ ] **5.B.3** Set up Inngest functions for email sending
  - send-mention-email
  - send-assignment-email
  - send-due-reminder
- [ ] **5.B.4** Set up Vercel Cron for daily digest
- [ ] **5.B.5** Create email preference settings UI
  - Enable/disable email
  - Choose digest frequency (instant, daily, weekly, none)
  - Toggle by notification type

**Tests for Worktree B:**
- [ ] Email sends correctly (mock Resend)
- [ ] Email templates render correctly
- [ ] Digest aggregates notifications correctly
- [ ] User preferences respected

#### Worktree C: Slack Notifications (`feature/notifications-slack`)

- [ ] **5.C.1** Create Slack webhook integration
- [ ] **5.C.2** Create Slack message formatters
  - Mention notification
  - Task assigned
  - Due date reminder
- [ ] **5.C.3** Set up Inngest function for Slack sending
- [ ] **5.C.4** Create Slack settings UI
  - Enable/disable Slack
  - Webhook URL input
  - Test connection button
  - Toggle by notification type
- [ ] **5.C.5** Handle Slack webhook errors gracefully

**Tests for Worktree C:**
- [ ] Slack webhook called correctly (mock)
- [ ] Message format is correct
- [ ] Invalid webhook handled gracefully
- [ ] User preferences respected

---

### Phase 6: Recurring Tasks & Polish (Parallel Development)

**Depends on: Phase 5 complete**

#### Worktree A: Recurring Tasks (`feature/recurring-tasks`)

- [ ] **6.A.1** Create RecurringConfig type and validation
- [ ] **6.A.2** Create RecurringPicker component
  - Frequency selection (daily, weekly, biweekly, monthly, quarterly, yearly)
  - Day selection for weekly
  - End date / occurrence limit
- [ ] **6.A.3** Integrate RecurringPicker into DatePicker
- [ ] **6.A.4** Create recurring task generation logic
  - On task completion, generate next instance
  - Copy all fields except dates
  - Calculate next due date
- [ ] **6.A.5** Set up Inngest function: create-next-recurring-task
- [ ] **6.A.6** Create recurring task indicator in UI
- [ ] **6.A.7** Add "Edit all future" option for recurring tasks
- [ ] **6.A.8** Handle recurring task deletion (delete series option)

**Tests for Worktree A:**
- [ ] RecurringConfig validates correctly
- [ ] Next occurrence calculated correctly for all frequencies
- [ ] Completing task creates next instance
- [ ] "Edit all future" updates recurringConfig
- [ ] "Delete series" removes all linked tasks

#### Worktree B: PWA & Mobile (`feature/pwa`)

- [ ] **6.B.1** Configure next-pwa
- [ ] **6.B.2** Create manifest.json with app metadata
- [ ] **6.B.3** Create app icons (192px, 512px)
- [ ] **6.B.4** Implement service worker for offline caching
- [ ] **6.B.5** Create offline fallback page
- [ ] **6.B.6** Implement push notification support (optional)
- [ ] **6.B.7** Test and optimize mobile layouts
  - Sidebar as drawer
  - Touch-friendly tap targets
  - Swipe gestures for common actions
- [ ] **6.B.8** Test PWA install flow on iOS and Android

**Tests for Worktree B:**
- [ ] Service worker registers
- [ ] App installable on mobile
- [ ] Offline fallback displays
- [ ] Mobile responsive layouts work

#### Worktree C: Performance & Polish (`feature/performance`)

- [ ] **6.C.1** Implement virtual scrolling for large task lists (TanStack Virtual)
- [ ] **6.C.2** Add loading states and skeletons throughout
- [ ] **6.C.3** Implement error boundaries with recovery
- [ ] **6.C.4** Audit and optimize bundle size
- [ ] **6.C.5** Add keyboard shortcuts
  - n: New task
  - /: Focus search
  - ?: Show shortcuts help
- [ ] **6.C.6** Implement search functionality
  - Global task search
  - Search within board
- [ ] **6.C.7** Add activity log / audit trail (optional)
- [ ] **6.C.8** Final accessibility audit (a11y)
- [ ] **6.C.9** Performance testing and optimization

**Tests for Worktree C:**
- [ ] Virtual scroll handles 1000+ tasks
- [ ] Keyboard shortcuts work
- [ ] Search returns correct results
- [ ] Lighthouse score > 90

---

## Testing Strategy

### Test Pyramid

```
        /\
       /  \      E2E Tests (Playwright)
      /    \     - Critical user journeys
     /------\    - ~20 tests
    /        \
   /  Integr. \  Integration Tests (Vitest)
  /    Tests   \ - API routes, hooks with mocked DB
 /--------------\- ~100 tests
/                \
/   Unit Tests    \ Unit Tests (Vitest)
/                  \- Utils, components, stores
/____________________\- ~200 tests
```

### Unit Tests (Vitest)

Location: `__tests__/unit/` or co-located `*.test.ts`

Cover:
- Utility functions (date calculations, mention parsing, etc.)
- Zustand stores (state transitions)
- React components (render, interactions)
- Validation schemas

```typescript
// Example: lib/utils/recurring.test.ts
import { calculateNextOccurrence } from './recurring';

describe('calculateNextOccurrence', () => {
  it('calculates next daily occurrence', () => {
    const config = { frequency: 'daily', interval: 1 };
    const current = new Date('2024-01-15');
    const next = calculateNextOccurrence(config, current);
    expect(next).toEqual(new Date('2024-01-16'));
  });
  // ... more tests
});
```

### Integration Tests (Vitest)

Location: `__tests__/integration/`

Cover:
- API routes / Server Actions with mocked database
- TanStack Query hooks with mocked API
- Permission checks
- Complex multi-step operations

```typescript
// Example: __tests__/integration/tasks.test.ts
import { createTask, listTasks } from '@/lib/db/queries/tasks';

describe('Task API', () => {
  it('filters tasks for assigned_only users', async () => {
    // Setup: user with assigned_only access
    // Create tasks assigned to user and others
    // Verify only assigned tasks returned
  });
});
```

### E2E Tests (Playwright)

Location: `e2e/`

Cover critical user journeys:
- [ ] Login flow (Google OAuth, email/password)
- [ ] Create client and board (admin)
- [ ] Create and edit task
- [ ] Drag task between swimlanes
- [ ] Drag task between kanban columns
- [ ] Add comment with @mention
- [ ] Upload file attachment
- [ ] View personal rollup
- [ ] Create custom rollup board
- [ ] Receive and view notification
- [ ] Mobile responsive layout

```typescript
// Example: e2e/task-management.spec.ts
import { test, expect } from '@playwright/test';

test('create and complete a task', async ({ page }) => {
  await page.goto('/clients/acme/boards/main');

  // Create task
  await page.click('[data-testid="new-task-button"]');
  await page.fill('[data-testid="task-title"]', 'Test Task');
  await page.click('[data-testid="save-task"]');

  // Verify task appears
  await expect(page.locator('text=Test Task')).toBeVisible();

  // Complete task
  await page.click('[data-testid="task-status-select"]');
  await page.click('text=Complete');

  // Verify in complete swimlane
  await expect(
    page.locator('[data-testid="swimlane-complete"] >> text=Test Task')
  ).toBeVisible();
});
```

### Test Database

Use a separate Neon database branch for testing:
- Create branch: `test` from `main`
- Reset before each test run
- Seed with consistent test data

```bash
# In CI
npm run db:reset:test
npm run test
```

### CI Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-results
          path: test-results/
```

---

## NPM Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:seed": "tsx scripts/seed.ts",
    "db:reset:test": "tsx scripts/reset-test-db.ts",
    "test": "npm run test:unit && npm run test:integration",
    "test:unit": "vitest run --config vitest.config.unit.ts",
    "test:integration": "vitest run --config vitest.config.integration.ts",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:watch": "vitest --config vitest.config.unit.ts"
  }
}
```

---

## Environment Variables

```bash
# .env.example

# Database (Neon)
DATABASE_URL="postgresql://..."

# Auth.js
AUTH_SECRET="generate-with-openssl-rand-base64-32"
AUTH_GOOGLE_ID="..."
AUTH_GOOGLE_SECRET="..."

# Uploadthing
UPLOADTHING_SECRET="..."
UPLOADTHING_APP_ID="..."

# Resend (Email)
RESEND_API_KEY="..."

# Slack (optional)
SLACK_WEBHOOK_URL="..."

# Inngest
INNGEST_EVENT_KEY="..."
INNGEST_SIGNING_KEY="..."

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## Conventions

### Code Style
- Use TypeScript strict mode
- Prefer Server Components; use 'use client' only when necessary
- Use Server Actions for mutations
- Co-locate tests with source files for unit tests
- Use absolute imports (@/...)

### Naming
- Components: PascalCase (TaskCard.tsx)
- Hooks: camelCase with use prefix (useTasks.ts)
- Utils: camelCase (formatDate.ts)
- API routes: kebab-case folders
- Database tables: snake_case
- TypeScript types: PascalCase

### Git
- Commit messages: conventional commits (feat:, fix:, test:, etc.)
- Branch names: feature/, fix/, test/
- PRs require passing CI before merge
- Squash merge to main

---

## Quick Reference: Parallel Work Dependencies

```
Phase 0 (Sequential)
    │
    ▼
Phase 1 ──┬── Worktree A: Database
          ├── Worktree B: Auth
          └── Worktree C: UI Foundation
    │
    ▼ (merge all)
Phase 2 ──┬── Worktree A: Client/Board CRUD
          ├── Worktree B: Task CRUD
          └── Worktree C: Editor/Attachments
    │
    ▼ (merge all)
Phase 3 ──┬── Worktree A: Swimlane View
          ├── Worktree B: Kanban View
          └── Worktree C: Drag-and-Drop
    │
    ▼ (merge all)
Phase 4 ──┬── Worktree A: Comments
          ├── Worktree B: Rollup Boards
          └── Worktree C: Personal Rollup
    │
    ▼ (merge all)
Phase 5 ──┬── Worktree A: In-App Notifications
          ├── Worktree B: Email Notifications
          └── Worktree C: Slack Notifications
    │
    ▼ (merge all)
Phase 6 ──┬── Worktree A: Recurring Tasks
          ├── Worktree B: PWA/Mobile
          └── Worktree C: Performance/Polish
    │
    ▼ (merge all)
Done!
```

---

## Getting Started

1. Complete Phase 0 (project initialization)
2. Create worktrees for Phase 1:
   ```bash
   git worktree add ../pm-tool-db feature/database
   git worktree add ../pm-tool-auth feature/auth
   git worktree add ../pm-tool-ui feature/ui-foundation
   ```
3. Work on each worktree independently
4. Create PRs when features are complete with tests
5. Merge to main and proceed to next phase