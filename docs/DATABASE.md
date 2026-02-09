# Database Schema & ERD

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    ENTITY RELATIONSHIPS                                  │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐       ┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    users     │       │    teams     │       │   clients    │       │    boards    │
├──────────────┤       ├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK)      │       │ id (PK)      │       │ id (PK)      │       │ id (PK)      │
│ email        │       │ name         │       │ name         │       │ client_id(FK)│───┐
│ name         │       │ created_at   │       │ slug         │       │ name         │   │
│ avatar_url   │       └──────┬───────┘       │ color        │       │ type         │   │
│ role         │              │               │ created_by   │───┐   │ status_opts  │   │
│ auth_provider│              │               │ created_at   │   │   │ section_opts │   │
│ password_hash│              │               └──────┬───────┘   │   │ created_by   │───┤
│ preferences  │              │                      │           │   │ created_at   │   │
│ created_at   │              │                      │           │   └──────┬───────┘   │
└──────┬───────┘              │                      │           │          │           │
       │                      │               ┌──────┴───────────┴──────────┘           │
       │               ┌──────┴───────┐       │                                         │
       │               │ team_members │       │    ┌──────────────┐                     │
       │               ├──────────────┤       │    │ board_access │                     │
       │               │ team_id (FK) │       │    ├──────────────┤                     │
       └───────────────│ user_id (FK) │       │    │ id (PK)      │                     │
       │               └──────────────┘       │    │ board_id(FK) │─────────────────────┘
       │                                      │    │ user_id (FK) │─────┐
       │                                      │    │ team_id (FK) │─────┤
       │                                      │    │ access_level │     │
       │                                      │    │ created_at   │     │
       │                                      │    └──────────────┘     │
       │                                      │                         │
       │    ┌─────────────────────────────────┴─────────────────────────┘
       │    │
       │    │         ┌──────────────┐       ┌──────────────┐
       │    │         │    tasks     │       │  task_assign │
       │    │         ├──────────────┤       ├──────────────┤
       │    │         │ id (PK)      │       │ task_id (FK) │───┐
       │    │         │ board_id(FK) │───────│ user_id (FK) │───┤
       │    │         │ title        │       │ assigned_at  │   │
       │    │         │ description  │       └──────────────┘   │
       │    │         │ status       │                          │
       │    │         │ section      │       ┌──────────────┐   │
       │    │         │ due_date     │       │   comments   │   │
       │    │         │ date_flex    │       ├──────────────┤   │
       │    │         │ recurring    │       │ id (PK)      │   │
       │    │         │ recur_grp_id │       │ task_id (FK) │───┤
       │    │         │ position     │       │ author_id(FK)│───┤
       │    │         │ created_by   │───────│ content      │   │
       │    │         │ created_at   │   │   │ created_at   │   │
       │    │         │ updated_at   │   │   │ updated_at   │   │
       │    │         └──────┬───────┘   │   └──────┬───────┘   │
       │    │                │           │          │           │
       │    │                │           │          │           │
       │    │         ┌──────┴───────────┴──────────┴───────────┘
       │    │         │
       │    │         │    ┌──────────────┐
       │    │         │    │ attachments  │
       │    │         │    ├──────────────┤
       │    │         │    │ id (PK)      │
       │    │         └────│ task_id (FK) │
       │    │              │ comment_id   │
       │    │              │ filename     │
       │    │              │ url          │
       │    │              │ size         │
       │    │              │ mime_type    │
       │    │              │ uploaded_by  │───┐
       │    │              │ created_at   │   │
       │    │              └──────────────┘   │
       │    │                                 │
       │    │    ┌──────────────┐             │
       │    │    │notifications │             │
       │    │    ├──────────────┤             │
       │    │    │ id (PK)      │             │
       │    └────│ user_id (FK) │─────────────┤
       │         │ type         │             │
       │         │ task_id (FK) │             │
       │         │ comment_id   │             │
       │         │ title        │             │
       │         │ body         │             │
       │         │ read_at      │             │
       │         │ email_sent   │             │
       │         │ slack_sent   │             │
       │         │ created_at   │             │
       │         └──────────────┘             │
       │                                      │
       │         ┌──────────────┐             │
       │         │ invitations  │             │
       │         ├──────────────┤             │
       │         │ id (PK)      │             │
       │         │ email        │             │
       └─────────│ invited_by   │─────────────┘
                 │ role         │
                 │ team_id (FK) │
                 │ expires_at   │
                 │ accepted_at  │
                 │ created_at   │
                 └──────────────┘


┌──────────────┐       ┌──────────────┐
│rollup_sources│       │   (boards)   │
├──────────────┤       │  type=rollup │
│rollup_id(FK) │───────│              │
│source_id(FK) │───────│              │
└──────────────┘       └──────────────┘
```

---

## Table Specifications

### users

Primary table for all authenticated users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() | Unique identifier |
| email | VARCHAR(255) | NOT NULL, UNIQUE | Email address |
| name | VARCHAR(255) | | Display name |
| avatar_url | TEXT | | Profile picture URL |
| role | ENUM('admin', 'user') | NOT NULL, DEFAULT 'user' | Permission level |
| auth_provider | ENUM('google', 'credentials') | | How user authenticates |
| password_hash | TEXT | | Hashed password (null for OAuth users) |
| preferences | JSONB | DEFAULT '{}' | User preferences (see below) |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Preferences JSONB Structure:**
```typescript
{
  hiddenBoards: string[];      // Board IDs hidden from personal rollup
  hiddenColumns: string[];     // Column keys hidden in table view
  defaultView: 'table' | 'kanban';
  notifications: {
    email: {
      enabled: boolean;
      mentions: boolean;
      assignments: boolean;
      dueDates: boolean;
      digest: 'instant' | 'daily' | 'weekly' | 'none';
    };
    slack: {
      enabled: boolean;
      webhookUrl?: string;
      mentions: boolean;
      assignments: boolean;
      dueDates: boolean;
    };
    inApp: {
      enabled: boolean;
    };
  };
}
```

**Indexes:**
- `idx_users_email` on (email)

---

### teams

Groups of users for bulk permission assignment.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| name | VARCHAR(255) | NOT NULL | Team name |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

---

### team_members

Junction table for user-team relationships.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| team_id | UUID | FK → teams.id, ON DELETE CASCADE | Team reference |
| user_id | UUID | FK → users.id, ON DELETE CASCADE | User reference |
| joined_at | TIMESTAMP | DEFAULT NOW() | When user joined team |

**Primary Key:** (team_id, user_id)

**Indexes:**
- `idx_team_members_user` on (user_id)

---

### clients

Top-level organizational unit (agency clients).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| name | VARCHAR(255) | NOT NULL | Client name |
| slug | VARCHAR(255) | NOT NULL, UNIQUE | URL-friendly identifier |
| color | VARCHAR(7) | | Hex color for UI (#RRGGBB) |
| created_by | UUID | FK → users.id | Admin who created |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

**Indexes:**
- `idx_clients_slug` on (slug)

---

### boards

Task containers within clients.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| client_id | UUID | FK → clients.id, ON DELETE CASCADE | Parent client (null for rollups) |
| name | VARCHAR(255) | NOT NULL | Board name |
| type | ENUM('standard', 'rollup') | DEFAULT 'standard' | Board type |
| status_options | JSONB | NOT NULL | Available status values |
| section_options | JSONB | | Available section values |
| created_by | UUID | FK → users.id | Admin who created |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

**status_options JSONB Structure:**
```typescript
[
  { id: "todo", label: "To Do", color: "#6B7280", position: 0 },
  { id: "in-progress", label: "In Progress", color: "#3B82F6", position: 1 },
  { id: "review", label: "Review", color: "#F59E0B", position: 2 },
  { id: "complete", label: "Complete", color: "#10B981", position: 3 }
]
```

**section_options JSONB Structure:**
```typescript
[
  { id: "seo", label: "SEO", color: "#8B5CF6", position: 0 },
  { id: "web-dev", label: "Web Dev", color: "#EC4899", position: 1 },
  { id: "ppc", label: "PPC", color: "#F97316", position: 2 },
  { id: "content", label: "Content", color: "#14B8A6", position: 3 }
]
```

**Indexes:**
- `idx_boards_client` on (client_id)

---

### board_access

Permission grants for users/teams to access boards.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| board_id | UUID | FK → boards.id, ON DELETE CASCADE | Board reference |
| user_id | UUID | FK → users.id, ON DELETE CASCADE | User (if direct access) |
| team_id | UUID | FK → teams.id, ON DELETE CASCADE | Team (if team access) |
| access_level | ENUM('full', 'assigned_only') | NOT NULL, DEFAULT 'full' | Permission level |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

**Check Constraint:**
```sql
CHECK (
  (user_id IS NOT NULL AND team_id IS NULL) OR
  (user_id IS NULL AND team_id IS NOT NULL)
)
```

**Indexes:**
- `idx_board_access_board` on (board_id)
- `idx_board_access_user` on (user_id)
- `idx_board_access_team` on (team_id)

---

### tasks

Individual work items.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| board_id | UUID | FK → boards.id, ON DELETE CASCADE | Parent board |
| title | VARCHAR(500) | NOT NULL | Task title |
| description | JSONB | | Rich text content (Tiptap JSON) |
| status | VARCHAR(100) | NOT NULL | Current status (matches board options) |
| section | VARCHAR(100) | | Section/category |
| due_date | DATE | | When task is due |
| date_flexibility | ENUM('not_set', 'flexible', 'semi_flexible', 'not_flexible') | DEFAULT 'not_set' | How firm the due date is |
| recurring_config | JSONB | | Recurrence settings |
| recurring_group_id | UUID | | Links recurring task instances |
| position | INTEGER | NOT NULL, DEFAULT 0 | Sort order within status |
| created_by | UUID | FK → users.id | Task creator |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**recurring_config JSONB Structure:**
```typescript
{
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  interval: number;           // Every N periods
  daysOfWeek?: number[];      // For weekly: [1,3,5] = Mon,Wed,Fri (0=Sun)
  dayOfMonth?: number;        // For monthly: 1-31
  endDate?: string;           // ISO date string
  endAfterOccurrences?: number;
}
```

**description JSONB Structure (Tiptap):**
```typescript
{
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Task description here..." },
        { type: "mention", attrs: { id: "user-uuid", label: "John Doe" } }
      ]
    }
  ]
}
```

**Indexes:**
- `idx_tasks_board` on (board_id)
- `idx_tasks_board_status` on (board_id, status)
- `idx_tasks_due_date` on (due_date) WHERE due_date IS NOT NULL
- `idx_tasks_recurring_group` on (recurring_group_id) WHERE recurring_group_id IS NOT NULL

---

### task_assignees

Junction table for task-user assignments.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| task_id | UUID | FK → tasks.id, ON DELETE CASCADE | Task reference |
| user_id | UUID | FK → users.id, ON DELETE CASCADE | Assigned user |
| assigned_at | TIMESTAMP | DEFAULT NOW() | When assigned |

**Primary Key:** (task_id, user_id)

**Indexes:**
- `idx_task_assignees_user` on (user_id)

---

### comments

Discussion thread on tasks.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| task_id | UUID | FK → tasks.id, ON DELETE CASCADE | Parent task |
| author_id | UUID | FK → users.id | Comment author |
| content | JSONB | NOT NULL | Rich text content (Tiptap JSON) |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | | Last edit timestamp |

**Indexes:**
- `idx_comments_task` on (task_id)
- `idx_comments_task_created` on (task_id, created_at)

---

### attachments

Files attached to tasks or comments.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| task_id | UUID | FK → tasks.id, ON DELETE CASCADE | Parent task (if task attachment) |
| comment_id | UUID | FK → comments.id, ON DELETE CASCADE | Parent comment (if comment attachment) |
| filename | VARCHAR(255) | NOT NULL | Original filename |
| url | TEXT | NOT NULL | Storage URL |
| size | INTEGER | | File size in bytes |
| mime_type | VARCHAR(100) | | MIME type |
| uploaded_by | UUID | FK → users.id | Who uploaded |
| created_at | TIMESTAMP | DEFAULT NOW() | Upload timestamp |

**Check Constraint:**
```sql
CHECK (
  (task_id IS NOT NULL AND comment_id IS NULL) OR
  (task_id IS NULL AND comment_id IS NOT NULL)
)
```

**Indexes:**
- `idx_attachments_task` on (task_id) WHERE task_id IS NOT NULL
- `idx_attachments_comment` on (comment_id) WHERE comment_id IS NOT NULL

---

### notifications

User notification records.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| user_id | UUID | FK → users.id, ON DELETE CASCADE | Recipient |
| type | ENUM('mention', 'task_assigned', 'task_due_soon', 'task_overdue', 'comment_added') | NOT NULL | Notification type |
| task_id | UUID | FK → tasks.id, ON DELETE SET NULL | Related task |
| comment_id | UUID | FK → comments.id, ON DELETE SET NULL | Related comment |
| title | VARCHAR(255) | NOT NULL | Notification title |
| body | TEXT | | Notification body |
| read_at | TIMESTAMP | | When user read it |
| email_sent_at | TIMESTAMP | | When email was sent |
| slack_sent_at | TIMESTAMP | | When Slack message was sent |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

**Indexes:**
- `idx_notifications_user` on (user_id)
- `idx_notifications_user_unread` on (user_id) WHERE read_at IS NULL
- `idx_notifications_created` on (created_at)

---

### invitations

Pending user invitations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier / token |
| email | VARCHAR(255) | NOT NULL | Invited email |
| invited_by | UUID | FK → users.id | Admin who sent invite |
| role | ENUM('admin', 'user') | NOT NULL, DEFAULT 'user' | Role to assign |
| team_id | UUID | FK → teams.id | Default team to add to |
| expires_at | TIMESTAMP | NOT NULL | Invitation expiry |
| accepted_at | TIMESTAMP | | When accepted |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

**Indexes:**
- `idx_invitations_email` on (email)
- `idx_invitations_expires` on (expires_at) WHERE accepted_at IS NULL

---

### rollup_sources

Links rollup boards to their source boards.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| rollup_board_id | UUID | FK → boards.id, ON DELETE CASCADE | The rollup board |
| source_board_id | UUID | FK → boards.id, ON DELETE CASCADE | Source board to aggregate |

**Primary Key:** (rollup_board_id, source_board_id)

**Indexes:**
- `idx_rollup_sources_source` on (source_board_id)

---

## Common Queries

### Get user's accessible boards

```sql
SELECT DISTINCT b.*
FROM boards b
LEFT JOIN board_access ba ON ba.board_id = b.id
LEFT JOIN team_members tm ON tm.team_id = ba.team_id
WHERE
  -- User has direct access
  ba.user_id = :userId
  OR
  -- User has team-based access
  tm.user_id = :userId
  OR
  -- User is admin (sees everything)
  EXISTS (SELECT 1 FROM users WHERE id = :userId AND role = 'admin');
```

### Get tasks for board (with permission filtering)

```sql
WITH user_access AS (
  SELECT access_level
  FROM board_access
  WHERE board_id = :boardId
    AND (
      user_id = :userId
      OR team_id IN (SELECT team_id FROM team_members WHERE user_id = :userId)
    )
  LIMIT 1
)
SELECT t.*
FROM tasks t
WHERE t.board_id = :boardId
  AND (
    -- Full access: see all tasks
    (SELECT access_level FROM user_access) = 'full'
    OR
    -- Assigned only: see only assigned tasks
    EXISTS (SELECT 1 FROM task_assignees WHERE task_id = t.id AND user_id = :userId)
    OR
    -- User is admin
    EXISTS (SELECT 1 FROM users WHERE id = :userId AND role = 'admin')
  )
ORDER BY t.status, t.position;
```

### Get user's tasks across all boards (personal rollup)

```sql
SELECT
  t.*,
  b.name as board_name,
  c.name as client_name,
  c.color as client_color
FROM tasks t
JOIN boards b ON b.id = t.board_id
JOIN clients c ON c.id = b.client_id
JOIN task_assignees ta ON ta.task_id = t.id
WHERE ta.user_id = :userId
  AND b.id NOT IN (:hiddenBoardIds)
ORDER BY c.name, t.due_date NULLS LAST, t.position;
```

### Get rollup board tasks

```sql
SELECT
  t.*,
  b.name as board_name,
  c.name as client_name
FROM tasks t
JOIN boards b ON b.id = t.board_id
JOIN clients c ON c.id = b.client_id
JOIN rollup_sources rs ON rs.source_board_id = t.board_id
WHERE rs.rollup_board_id = :rollupBoardId
  -- Apply user's permission filter for each source board
  AND (
    EXISTS (
      SELECT 1 FROM board_access ba
      LEFT JOIN team_members tm ON tm.team_id = ba.team_id
      WHERE ba.board_id = b.id
        AND (ba.user_id = :userId OR tm.user_id = :userId)
        AND (
          ba.access_level = 'full'
          OR EXISTS (SELECT 1 FROM task_assignees WHERE task_id = t.id AND user_id = :userId)
        )
    )
    OR EXISTS (SELECT 1 FROM users WHERE id = :userId AND role = 'admin')
  )
ORDER BY c.name, t.status, t.position;
```

---

## Migration Strategy

### Initial Migration Order

1. Create enums
2. users table
3. teams table
4. team_members table
5. clients table
6. boards table
7. board_access table
8. tasks table
9. task_assignees table
10. comments table
11. attachments table
12. notifications table
13. invitations table
14. rollup_sources table
15. Create indexes

### Seed Data for Development

```typescript
// scripts/seed.ts
const seedData = {
  users: [
    { email: 'admin@clix.co', name: 'Admin User', role: 'admin' },
    { email: 'john@clix.co', name: 'John Doe', role: 'user' },
    { email: 'jane@clix.co', name: 'Jane Smith', role: 'user' },
    { email: 'contractor@example.com', name: 'External Contractor', role: 'user' },
  ],
  teams: [
    { name: 'SEO Team', members: ['john@clix.co'] },
    { name: 'Dev Team', members: ['jane@clix.co'] },
  ],
  clients: [
    { name: 'Acme Corporation', slug: 'acme', color: '#3B82F6' },
    { name: 'TechStart Inc', slug: 'techstart', color: '#10B981' },
  ],
  // ... boards and tasks per client
};
```
