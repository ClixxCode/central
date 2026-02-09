# Component Architecture

## Component Hierarchy

```
App
├── Providers
│   ├── AuthProvider (Auth.js SessionProvider)
│   ├── QueryClientProvider (TanStack Query)
│   └── ThemeProvider (if dark mode needed)
│
├── (auth) - Unauthenticated routes
│   ├── LoginPage
│   │   ├── GoogleSignInButton
│   │   ├── EmailPasswordForm
│   │   └── SignUpLink
│   ├── SignUpPage
│   │   ├── InvitationCodeInput
│   │   └── RegistrationForm
│   └── InviteAcceptPage
│       └── AcceptInvitationForm
│
└── (dashboard) - Authenticated routes
    ├── DashboardLayout
    │   ├── Sidebar
    │   │   ├── Logo
    │   │   ├── NavLinks
    │   │   ├── ClientList
    │   │   │   └── ClientItem (expandable)
    │   │   │       └── BoardLink
    │   │   ├── RollupLinks
    │   │   └── UserMenu
    │   ├── Header
    │   │   ├── SearchBar
    │   │   ├── NotificationBell
    │   │   │   └── NotificationDropdown
    │   │   │       └── NotificationItem
    │   │   └── UserAvatar
    │   └── MobileNav (drawer)
    │
    ├── MyTasksPage (personal rollup)
    │   ├── PersonalRollupHeader
    │   │   ├── ColumnVisibilityToggle
    │   │   └── BoardFilterToggle
    │   └── PersonalRollupView
    │       └── ClientSwimlane (per client)
    │           └── TaskRow
    │
    ├── ClientPage
    │   ├── ClientHeader
    │   └── BoardGrid
    │       └── BoardCard
    │
    ├── BoardPage
    │   ├── BoardHeader
    │   │   ├── BoardTitle
    │   │   ├── ViewToggle (table/kanban)
    │   │   ├── FilterBar
    │   │   │   ├── StatusFilter
    │   │   │   ├── SectionFilter
    │   │   │   └── AssigneeFilter
    │   │   └── NewTaskButton
    │   │
    │   ├── BoardTableView (default)
    │   │   └── Swimlane (per status)
    │   │       ├── SwimlanHeader
    │   │       └── TaskTable
    │   │           ├── TableHeader
    │   │           └── TaskRow
    │   │               ├── TaskTitle (editable)
    │   │               ├── AssigneePicker
    │   │               ├── DatePicker
    │   │               ├── StatusSelect
    │   │               ├── SectionSelect
    │   │               └── FlexibilityBadge
    │   │
    │   └── BoardKanbanView
    │       └── KanbanColumn (per status)
    │           ├── ColumnHeader
    │           └── TaskCard
    │               ├── TaskTitle
    │               ├── AssigneeAvatars
    │               ├── DueDateBadge
    │               └── SectionBadge
    │
    ├── TaskModal (overlay)
    │   ├── TaskModalHeader
    │   │   ├── TaskTitle (editable)
    │   │   ├── StatusSelect
    │   │   └── CloseButton
    │   ├── TaskModalBody
    │   │   ├── TaskMetaSection
    │   │   │   ├── AssigneePicker
    │   │   │   ├── DatePicker
    │   │   │   │   └── RecurringPicker
    │   │   │   ├── SectionSelect
    │   │   │   └── FlexibilitySelect
    │   │   ├── TaskEditor (Tiptap WYSIWYG)
    │   │   └── AttachmentSection
    │   │       ├── FileUpload
    │   │       └── AttachmentList
    │   │           └── AttachmentItem
    │   └── TaskCommentsSection
    │       ├── CommentList
    │       │   └── CommentItem
    │       │       ├── AuthorInfo
    │       │       ├── CommentContent
    │       │       └── CommentActions
    │       └── CommentEditor
    │
    ├── RollupBoardPage
    │   ├── RollupHeader
    │   │   └── SourceBoardSelector
    │   └── RollupView (same as BoardTableView/KanbanView)
    │
    └── SettingsPages
        ├── UserSettingsPage
        │   ├── ProfileForm
        │   └── NotificationPreferences
        ├── TeamManagementPage (admin)
        │   ├── TeamList
        │   └── TeamEditor
        └── UserManagementPage (admin)
            ├── UserList
            └── InvitationForm
```

---

## Core Component Specifications

### Layout Components

#### Sidebar

```
┌─────────────────────┐
│ ┌─────────────────┐ │
│ │    CLIX PM      │ │  Logo + App Name
│ └─────────────────┘ │
├─────────────────────┤
│ ▶ My Tasks          │  Personal rollup link
│ ▶ Rollups           │  Custom rollups section
│   └─ Q1 Overview    │
├─────────────────────┤
│ CLIENTS             │  Section header
│ ▼ Acme Corp     ●   │  Expandable client (● = color dot)
│   ├─ Main Board     │
│   └─ Q1 Campaign    │
│ ▶ TechStart     ●   │  Collapsed client
│ ▶ BigCo         ●   │
├─────────────────────┤
│ ┌─────────────────┐ │
│ │ + New Client    │ │  Admin only
│ └─────────────────┘ │
├─────────────────────┤
│ ⚙ Settings          │
│ 👤 John Doe      ▼  │  User menu trigger
└─────────────────────┘
     [◀] Collapse
```

**Props:**
```typescript
interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}
```

**State (Zustand):**
- `sidebarOpen: boolean`
- `expandedClients: string[]` (client IDs)

---

#### Header

```
┌──────────────────────────────────────────────────────────────────┐
│ ☰  │  🔍 Search tasks...              │  🔔 3  │  👤 JD ▼      │
└──────────────────────────────────────────────────────────────────┘
     │                                      │         │
     │                                      │         └─ User menu dropdown
     │                                      └─ Notification bell with count
     └─ Mobile menu trigger (hidden on desktop)
```

**Components:**
- `SearchBar` - Global task search with keyboard shortcut (/)
- `NotificationBell` - Badge with unread count, dropdown on click
- `UserMenu` - Avatar with dropdown (settings, logout)

---

### Board View Components

#### BoardTableView (Swimlane)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ▼ To Do (5)                                                          [+]   │
├────────────────────────────────────────────────────────────────────────────┤
│ Title              │ Assignee    │ Due Date   │ Section  │ Flexibility    │
├────────────────────────────────────────────────────────────────────────────┤
│ Update homepage    │ 👤 JD       │ Feb 5      │ Web Dev  │ 🔴 Not Flex    │
│ Write blog post    │ 👤 JS 👤 JD │ Feb 7      │ Content  │ 🟡 Semi        │
│ Fix mobile nav     │ 👤 JS       │ Feb 3      │ Web Dev  │ 🟢 Flexible    │
├────────────────────────────────────────────────────────────────────────────┤
│ + Add task                                                                 │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│ ▼ In Progress (2)                                                    [+]   │
├────────────────────────────────────────────────────────────────────────────┤
│ SEO audit          │ 👤 JD       │ Feb 10     │ SEO      │ ⚪ Not Set     │
│ PPC campaign       │ 👤 JS       │ Feb 12     │ PPC      │ 🔴 Not Flex    │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│ ▶ Complete (15)                                               [collapsed]  │
└────────────────────────────────────────────────────────────────────────────┘
```

**Key Interactions:**
- Click swimlane header to collapse/expand
- Drag task row to reorder within swimlane
- Drag task row to different swimlane to change status
- Click task row to open TaskModal
- Inline edit by clicking on editable cells
- [+] button or "Add task" row to create new task

---

#### BoardKanbanView

```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│   To Do     │ In Progress │   Review    │  Complete   │
│    (5)      │    (2)      │    (1)      │    (15)     │
├─────────────┼─────────────┼─────────────┼─────────────┤
│ ┌─────────┐ │ ┌─────────┐ │ ┌─────────┐ │ ┌─────────┐ │
│ │ Update  │ │ │ SEO     │ │ │ Review  │ │ │ Logo    │ │
│ │ homepage│ │ │ audit   │ │ │ copy    │ │ │ design  │ │
│ │         │ │ │         │ │ │         │ │ │         │ │
│ │ 👤 Feb 5│ │ │ 👤Feb10 │ │ │ 👤Feb 8 │ │ │ 👤Jan30 │ │
│ │ [WebDev]│ │ │  [SEO]  │ │ │[Content]│ │ │ [Design]│ │
│ └─────────┘ │ └─────────┘ │ └─────────┘ │ └─────────┘ │
│ ┌─────────┐ │ ┌─────────┐ │             │ ┌─────────┐ │
│ │ Write   │ │ │ PPC     │ │             │ │  ...    │ │
│ │ blog    │ │ │campaign │ │             │ │         │ │
│ │         │ │ │         │ │             │ │         │ │
│ │👤👤Feb 7│ │ │ 👤Feb12 │ │             │ │         │ │
│ │[Content]│ │ │  [PPC]  │ │             │ │         │ │
│ └─────────┘ │ └─────────┘ │             │ └─────────┘ │
│    ...      │             │             │    ...      │
│             │             │             │ [+14 more]  │
│ [+ Add]     │ [+ Add]     │ [+ Add]     │ [+ Add]     │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

**Key Interactions:**
- Drag cards between columns to change status
- Drag cards within column to reorder
- Click card to open TaskModal
- [+ Add] at bottom of column to create task with that status
- Horizontal scroll if many columns

---

### TaskCard

```
┌───────────────────────────────┐
│ Update homepage copy          │  Title (truncated if long)
│                               │
│ 👤 JD  👤 JS     📅 Feb 5    │  Assignees + Due date
│                               │
│ [Web Dev]         🔴          │  Section badge + Flexibility indicator
└───────────────────────────────┘
```

**Variants:**
- Default: As shown above
- Compact: Title + avatars only (for collapsed lists)
- Expanded: Shows description preview

**Flexibility Indicators:**
- ⚪ Not Set (gray, hidden by default)
- 🟢 Flexible (green)
- 🟡 Semi Flexible (yellow)
- 🔴 Not Flexible (red)

---

### TaskModal

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Update homepage copy                               [To Do ▼]          [X] │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Assignees        Due Date              Section         Flexibility       │
│  ┌──────────┐    ┌──────────────────┐  ┌───────────┐   ┌─────────────┐   │
│  │ 👤 JD    │    │ Feb 5, 2024      │  │ Web Dev ▼ │   │ Not Flex ▼  │   │
│  │ 👤 JS    │    │ 🔄 Recurring     │  └───────────┘   └─────────────┘   │
│  │ + Add    │    └──────────────────┘                                     │
│  └──────────┘                                                             │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│ Description                                                                │
│ ┌────────────────────────────────────────────────────────────────────────┐│
│ │ B I U  │ H1 H2 │ • 1. │ 🔗 📷 │ @ │                                   ││
│ ├────────────────────────────────────────────────────────────────────────┤│
│ │                                                                        ││
│ │ We need to update the homepage copy to reflect the new Q1 messaging.  ││
│ │                                                                        ││
│ │ Key points to address:                                                 ││
│ │ • New product features                                                 ││
│ │ • Updated pricing                                                      ││
│ │ • Customer testimonials                                                ││
│ │                                                                        ││
│ │ @John Doe please review the current analytics before starting.        ││
│ │                                                                        ││
│ └────────────────────────────────────────────────────────────────────────┘│
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│ Attachments                                                                │
│ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐                  │
│ │ 📄 brief.pdf   │ │ 🖼 mockup.png  │ │ + Upload      │                  │
│ │ 245 KB         │ │ 1.2 MB         │ │               │                  │
│ └────────────────┘ └────────────────┘ └────────────────┘                  │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│ Updates                                                              [23] │
├────────────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────────────────┐│
│ │ 👤 Jane Smith                                          Feb 3, 10:30 AM ││
│ │                                                                        ││
│ │ I've reviewed the current copy. Here are my suggestions:               ││
│ │ • Shorten the hero section                                             ││
│ │ • Add more social proof                                                ││
│ │                                                                 [Edit] ││
│ └────────────────────────────────────────────────────────────────────────┘│
│ ┌────────────────────────────────────────────────────────────────────────┐│
│ │ 👤 John Doe                                            Feb 3, 11:15 AM ││
│ │                                                                        ││
│ │ @Jane Smith great suggestions! I'll incorporate those.                 ││
│ └────────────────────────────────────────────────────────────────────────┘│
│                                                                            │
│ ┌────────────────────────────────────────────────────────────────────────┐│
│ │ Write an update...                                   [@] [📎] [Send]   ││
│ └────────────────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────────────┘
```

---

### Personal Rollup View

```
┌────────────────────────────────────────────────────────────────────────────┐
│ My Tasks                                    [Columns ▼] [Hide Boards ▼]   │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ▼ Acme Corporation                                                    (8) │
├────────────────────────────────────────────────────────────────────────────┤
│ Task                │ Board        │ Due Date   │ Status      │ Section   │
├────────────────────────────────────────────────────────────────────────────┤
│ Update homepage     │ Main Board   │ Feb 5      │ To Do       │ Web Dev   │
│ Write blog post     │ Q1 Campaign  │ Feb 7      │ To Do       │ Content   │
│ Review SEO report   │ Main Board   │ Feb 10     │ In Progress │ SEO       │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ▼ TechStart Inc                                                       (3) │
├────────────────────────────────────────────────────────────────────────────┤
│ Fix login bug       │ Dev Board    │ Feb 4      │ In Progress │ Web Dev   │
│ API documentation   │ Dev Board    │ Feb 15     │ To Do       │ Content   │
│ Security audit      │ Main Board   │ Feb 20     │ To Do       │ Web Dev   │
└────────────────────────────────────────────────────────────────────────────┘
```

**Customization:**
- [Columns ▼] - Toggle visibility of columns
- [Hide Boards ▼] - Select boards to exclude from view

---

### RecurringPicker

```
┌─────────────────────────────────────────┐
│ Recurring Task                          │
├─────────────────────────────────────────┤
│ Frequency: [Weekly           ▼]         │
│                                         │
│ Every [ 1 ] week(s) on:                 │
│                                         │
│ [S] [M] [T] [W] [T] [F] [S]             │
│  ○   ●   ○   ●   ○   ●   ○              │
│                                         │
│ Ends:                                   │
│ ○ Never                                 │
│ ● On date    [Mar 31, 2024    📅]       │
│ ○ After [ 10 ] occurrences              │
│                                         │
│              [Cancel] [Save]            │
└─────────────────────────────────────────┘
```

**Frequency Options:**
- Daily
- Weekly (show day picker)
- Biweekly (show day picker)
- Monthly (show day of month picker)
- Quarterly
- Yearly

---

## shadcn/ui Components to Install

```bash
npx shadcn@latest add \
  button \
  input \
  textarea \
  select \
  checkbox \
  radio-group \
  switch \
  dialog \
  sheet \
  dropdown-menu \
  popover \
  calendar \
  avatar \
  badge \
  card \
  separator \
  skeleton \
  toast \
  tooltip \
  command \
  tabs \
  table \
  scroll-area \
  collapsible
```

---

## Component File Structure

```
/components
  /layout
    Sidebar.tsx
    SidebarClientList.tsx
    Header.tsx
    SearchBar.tsx
    NotificationBell.tsx
    NotificationDropdown.tsx
    UserMenu.tsx
    MobileNav.tsx

  /board
    BoardHeader.tsx
    BoardTableView.tsx
    BoardKanbanView.tsx
    Swimlane.tsx
    SwimlanHeader.tsx
    KanbanColumn.tsx
    ColumnHeader.tsx
    ViewToggle.tsx
    FilterBar.tsx
    NewTaskRow.tsx

  /task
    TaskRow.tsx
    TaskCard.tsx
    TaskModal.tsx
    TaskMetaSection.tsx
    TaskEditor.tsx           # Tiptap wrapper
    AssigneePicker.tsx
    DatePicker.tsx
    RecurringPicker.tsx
    StatusSelect.tsx
    SectionSelect.tsx
    FlexibilitySelect.tsx
    FlexibilityBadge.tsx

  /comment
    CommentList.tsx
    CommentItem.tsx
    CommentEditor.tsx

  /attachment
    AttachmentSection.tsx
    AttachmentList.tsx
    AttachmentItem.tsx
    FileUpload.tsx

  /rollup
    PersonalRollupView.tsx
    PersonalRollupHeader.tsx
    ClientSwimlane.tsx
    RollupView.tsx
    RollupSourceSelector.tsx

  /settings
    ProfileForm.tsx
    NotificationPreferences.tsx
    TeamList.tsx
    TeamEditor.tsx
    UserList.tsx
    InvitationForm.tsx

  /auth
    GoogleSignInButton.tsx
    EmailPasswordForm.tsx
    RegistrationForm.tsx
    AcceptInvitationForm.tsx

  /shared
    EmptyState.tsx
    LoadingSkeleton.tsx
    ErrorBoundary.tsx
    ConfirmDialog.tsx
    ColorPicker.tsx
    UserAvatar.tsx
    ClientColorDot.tsx

  /ui                        # shadcn/ui components
    button.tsx
    input.tsx
    ...
```

---

## Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| Mobile | < 640px | Sidebar hidden (drawer), single column, stacked cards |
| Tablet | 640-1024px | Sidebar collapsible, 2-column kanban |
| Desktop | > 1024px | Full sidebar, multi-column kanban, table view |

**Key Mobile Adaptations:**
- Sidebar becomes slide-out drawer
- Kanban scrolls horizontally with one visible column
- Task modal becomes full-screen
- Table view becomes card list view
- Filters in dropdown sheet instead of inline
