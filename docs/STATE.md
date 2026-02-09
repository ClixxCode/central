# State Management Architecture

## Overview

This application uses a hybrid state management approach:

| State Type | Technology | Persistence | Use Case |
|------------|------------|-------------|----------|
| **Server State** | TanStack Query | Server (Neon) | Tasks, boards, comments, users |
| **UI State** | Zustand | localStorage | Sidebar, view preferences, filters |
| **Form State** | React Hook Form | Memory | Forms, inline editing |
| **URL State** | Next.js Router | URL | Active board, filters, search |

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           State Architecture                             │
└─────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────┐
                    │    Neon Postgres    │
                    │   (Source of Truth) │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Server Actions    │
                    │   (Mutations)       │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
┌─────────▼─────────┐ ┌────────▼────────┐ ┌────────▼────────┐
│   TanStack Query  │ │     Zustand     │ │   URL State     │
│                   │ │                 │ │                 │
│ • Tasks           │ │ • Sidebar open  │ │ • Board ID      │
│ • Boards          │ │ • View mode     │ │ • Filters       │
│ • Comments        │ │ • Hidden cols   │ │ • Search query  │
│ • Notifications   │ │ • Collapsed     │ │ • Sort order    │
│                   │ │   swimlanes     │ │                 │
│ [Optimistic]      │ │ [localStorage]  │ │ [Shareable]     │
└─────────┬─────────┘ └────────┬────────┘ └────────┬────────┘
          │                    │                    │
          └────────────────────┼────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │      React UI       │
                    │   (Components)      │
                    └─────────────────────┘
```

---

## TanStack Query Configuration

### Query Client Setup

```typescript
// lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 30 seconds
        staleTime: 30 * 1000,
        // Keep unused data in cache for 5 minutes
        gcTime: 5 * 60 * 1000,
        // Retry failed requests 3 times
        retry: 3,
        // Refetch on window focus
        refetchOnWindowFocus: true,
      },
      mutations: {
        // Retry mutations once
        retry: 1,
      },
    },
  });
}
```

### Provider Setup

```typescript
// app/providers.tsx
'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import { makeQueryClient } from '@/lib/query-client';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

---

## Query Keys

Consistent query key structure for cache management:

```typescript
// lib/query-keys.ts

export const queryKeys = {
  // Users
  users: {
    all: ['users'] as const,
    detail: (id: string) => ['users', id] as const,
    me: ['users', 'me'] as const,
  },

  // Clients
  clients: {
    all: ['clients'] as const,
    detail: (slug: string) => ['clients', slug] as const,
  },

  // Boards
  boards: {
    all: ['boards'] as const,
    forClient: (clientId: string) => ['boards', 'client', clientId] as const,
    detail: (id: string) => ['boards', id] as const,
    access: (id: string) => ['boards', id, 'access'] as const,
  },

  // Tasks
  tasks: {
    all: ['tasks'] as const,
    forBoard: (boardId: string) => ['tasks', 'board', boardId] as const,
    detail: (id: string) => ['tasks', id] as const,
    my: ['tasks', 'my'] as const,
    rollup: (rollupId: string) => ['tasks', 'rollup', rollupId] as const,
  },

  // Comments
  comments: {
    forTask: (taskId: string) => ['comments', 'task', taskId] as const,
  },

  // Notifications
  notifications: {
    all: ['notifications'] as const,
    unreadCount: ['notifications', 'unread-count'] as const,
  },

  // Teams
  teams: {
    all: ['teams'] as const,
    detail: (id: string) => ['teams', id] as const,
  },
};
```

---

## Custom Hooks

### Tasks

```typescript
// lib/hooks/useTasks.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import {
  getTasksForBoard,
  createTask,
  updateTask,
  deleteTask,
  reorderTasks,
} from '@/lib/actions/tasks';

/**
 * Fetch tasks for a board
 */
export function useTasks(boardId: string) {
  return useQuery({
    queryKey: queryKeys.tasks.forBoard(boardId),
    queryFn: () => getTasksForBoard(boardId),
    // Poll every 10 seconds for updates
    refetchInterval: 10 * 1000,
  });
}

/**
 * Create task with optimistic update
 */
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTask,
    onMutate: async (newTask) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.tasks.forBoard(newTask.boardId),
      });

      // Snapshot previous value
      const previous = queryClient.getQueryData<Task[]>(
        queryKeys.tasks.forBoard(newTask.boardId)
      );

      // Optimistically add the new task
      if (previous) {
        const optimisticTask: Task = {
          id: `temp-${Date.now()}`,
          ...newTask,
          position: previous.filter(t => t.status === newTask.status).length,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        queryClient.setQueryData<Task[]>(
          queryKeys.tasks.forBoard(newTask.boardId),
          [...previous, optimisticTask]
        );
      }

      return { previous };
    },
    onError: (err, newTask, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.tasks.forBoard(newTask.boardId),
          context.previous
        );
      }
    },
    onSettled: (data, error, variables) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: queryKeys.tasks.forBoard(variables.boardId),
      });
      // Also invalidate personal rollup
      queryClient.invalidateQueries({
        queryKey: queryKeys.tasks.my,
      });
    },
  });
}

/**
 * Update task with optimistic update
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTask,
    onMutate: async (updatedTask) => {
      // Get task to find its board
      const allQueries = queryClient.getQueriesData<Task[]>({
        queryKey: ['tasks', 'board'],
      });

      let boardId: string | null = null;
      let previous: Task[] | undefined;

      // Find the board this task belongs to
      for (const [key, tasks] of allQueries) {
        if (tasks?.some(t => t.id === updatedTask.id)) {
          boardId = key[2] as string;
          previous = tasks;
          break;
        }
      }

      if (boardId && previous) {
        await queryClient.cancelQueries({
          queryKey: queryKeys.tasks.forBoard(boardId),
        });

        // Apply optimistic update
        queryClient.setQueryData<Task[]>(
          queryKeys.tasks.forBoard(boardId),
          previous.map(task =>
            task.id === updatedTask.id
              ? { ...task, ...updatedTask, updatedAt: new Date().toISOString() }
              : task
          )
        );
      }

      return { previous, boardId };
    },
    onError: (err, updatedTask, context) => {
      if (context?.boardId && context.previous) {
        queryClient.setQueryData(
          queryKeys.tasks.forBoard(context.boardId),
          context.previous
        );
      }
    },
    onSettled: (data, error, variables, context) => {
      if (context?.boardId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.tasks.forBoard(context.boardId),
        });
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.tasks.my,
      });
    },
  });
}

/**
 * Reorder tasks (drag and drop)
 */
export function useReorderTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reorderTasks,
    onMutate: async ({ boardId, status, taskIds }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.tasks.forBoard(boardId),
      });

      const previous = queryClient.getQueryData<Task[]>(
        queryKeys.tasks.forBoard(boardId)
      );

      if (previous) {
        // Create new ordered list
        const tasksInStatus = taskIds.map((id, index) => {
          const task = previous.find(t => t.id === id);
          return task ? { ...task, status, position: index } : null;
        }).filter(Boolean) as Task[];

        const otherTasks = previous.filter(
          t => !taskIds.includes(t.id)
        );

        queryClient.setQueryData<Task[]>(
          queryKeys.tasks.forBoard(boardId),
          [...otherTasks, ...tasksInStatus]
        );
      }

      return { previous };
    },
    onError: (err, { boardId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.tasks.forBoard(boardId),
          context.previous
        );
      }
    },
    onSettled: (data, error, { boardId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.tasks.forBoard(boardId),
      });
    },
  });
}

/**
 * Personal rollup - all tasks assigned to current user
 */
export function useMyTasks(excludeBoardIds?: string[]) {
  return useQuery({
    queryKey: [...queryKeys.tasks.my, { excludeBoardIds }],
    queryFn: () => getMyTasks({ excludeBoardIds }),
    refetchInterval: 10 * 1000,
  });
}
```

### Notifications

```typescript
// lib/hooks/useNotifications.ts

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications.all,
    queryFn: () => getMyNotifications(),
    refetchInterval: 30 * 1000, // Poll every 30 seconds
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: async () => {
      const result = await getMyNotifications({ unreadOnly: true, limit: 0 });
      return result.unreadCount;
    },
    refetchInterval: 15 * 1000, // Poll more frequently for badge
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markNotificationRead,
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.notifications.all,
      });

      const previous = queryClient.getQueryData<NotificationResult>(
        queryKeys.notifications.all
      );

      if (previous) {
        queryClient.setQueryData<NotificationResult>(
          queryKeys.notifications.all,
          {
            notifications: previous.notifications.map(n =>
              n.id === notificationId
                ? { ...n, readAt: new Date().toISOString() }
                : n
            ),
            unreadCount: Math.max(0, previous.unreadCount - 1),
          }
        );
      }

      return { previous };
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.unreadCount,
      });
    },
  });
}
```

---

## Zustand Stores

### UI Store

```typescript
// lib/stores/uiStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UIState {
  // Sidebar
  sidebarOpen: boolean;
  sidebarCollapsed: boolean; // Minimized to icons only
  expandedClients: string[]; // Client IDs that are expanded

  // Actions
  toggleSidebar: () => void;
  toggleSidebarCollapse: () => void;
  toggleClientExpanded: (clientId: string) => void;
  setExpandedClients: (clientIds: string[]) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Initial state
      sidebarOpen: true,
      sidebarCollapsed: false,
      expandedClients: [],

      // Actions
      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      toggleSidebarCollapse: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      toggleClientExpanded: (clientId) =>
        set((state) => ({
          expandedClients: state.expandedClients.includes(clientId)
            ? state.expandedClients.filter((id) => id !== clientId)
            : [...state.expandedClients, clientId],
        })),

      setExpandedClients: (clientIds) =>
        set({ expandedClients: clientIds }),
    }),
    {
      name: 'clix-pm-ui',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
```

### Board View Store

```typescript
// lib/stores/boardViewStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type ViewMode = 'table' | 'kanban';

interface BoardViewState {
  // Per-board view preferences
  boardViews: Record<string, ViewMode>;
  collapsedSwimlanes: Record<string, string[]>; // boardId -> status[]

  // Actions
  setBoardView: (boardId: string, view: ViewMode) => void;
  toggleSwimlane: (boardId: string, status: string) => void;
  isSwimlaneCollapsed: (boardId: string, status: string) => boolean;
}

export const useBoardViewStore = create<BoardViewState>()(
  persist(
    (set, get) => ({
      boardViews: {},
      collapsedSwimlanes: {},

      setBoardView: (boardId, view) =>
        set((state) => ({
          boardViews: { ...state.boardViews, [boardId]: view },
        })),

      toggleSwimlane: (boardId, status) =>
        set((state) => {
          const current = state.collapsedSwimlanes[boardId] ?? [];
          const isCollapsed = current.includes(status);

          return {
            collapsedSwimlanes: {
              ...state.collapsedSwimlanes,
              [boardId]: isCollapsed
                ? current.filter((s) => s !== status)
                : [...current, status],
            },
          };
        }),

      isSwimlaneCollapsed: (boardId, status) => {
        const collapsed = get().collapsedSwimlanes[boardId] ?? [];
        return collapsed.includes(status);
      },
    }),
    {
      name: 'clix-pm-board-views',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
```

### Personal Rollup Store

```typescript
// lib/stores/personalRollupStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface PersonalRollupState {
  // Columns to hide in personal view
  hiddenColumns: string[];
  // Boards to hide in personal view
  hiddenBoards: string[];
  // Collapsed clients in personal view
  collapsedClients: string[];

  // Actions
  toggleColumn: (column: string) => void;
  toggleBoard: (boardId: string) => void;
  toggleClient: (clientId: string) => void;
  isColumnHidden: (column: string) => boolean;
  isBoardHidden: (boardId: string) => boolean;
  isClientCollapsed: (clientId: string) => boolean;
}

export const usePersonalRollupStore = create<PersonalRollupState>()(
  persist(
    (set, get) => ({
      hiddenColumns: [],
      hiddenBoards: [],
      collapsedClients: [],

      toggleColumn: (column) =>
        set((state) => ({
          hiddenColumns: state.hiddenColumns.includes(column)
            ? state.hiddenColumns.filter((c) => c !== column)
            : [...state.hiddenColumns, column],
        })),

      toggleBoard: (boardId) =>
        set((state) => ({
          hiddenBoards: state.hiddenBoards.includes(boardId)
            ? state.hiddenBoards.filter((b) => b !== boardId)
            : [...state.hiddenBoards, boardId],
        })),

      toggleClient: (clientId) =>
        set((state) => ({
          collapsedClients: state.collapsedClients.includes(clientId)
            ? state.collapsedClients.filter((c) => c !== clientId)
            : [...state.collapsedClients, clientId],
        })),

      isColumnHidden: (column) => get().hiddenColumns.includes(column),
      isBoardHidden: (boardId) => get().hiddenBoards.includes(boardId),
      isClientCollapsed: (clientId) => get().collapsedClients.includes(clientId),
    }),
    {
      name: 'clix-pm-personal-rollup',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
```

### Task Modal Store

```typescript
// lib/stores/taskModalStore.ts
import { create } from 'zustand';

interface TaskModalState {
  // Currently open task (null if closed)
  openTaskId: string | null;
  // For creating new task
  newTaskBoardId: string | null;
  newTaskStatus: string | null;

  // Actions
  openTask: (taskId: string) => void;
  openNewTask: (boardId: string, status?: string) => void;
  closeModal: () => void;
}

export const useTaskModalStore = create<TaskModalState>((set) => ({
  openTaskId: null,
  newTaskBoardId: null,
  newTaskStatus: null,

  openTask: (taskId) =>
    set({
      openTaskId: taskId,
      newTaskBoardId: null,
      newTaskStatus: null,
    }),

  openNewTask: (boardId, status = 'todo') =>
    set({
      openTaskId: null,
      newTaskBoardId: boardId,
      newTaskStatus: status,
    }),

  closeModal: () =>
    set({
      openTaskId: null,
      newTaskBoardId: null,
      newTaskStatus: null,
    }),
}));
```

---

## URL State Management

Use Next.js `useSearchParams` for shareable filter state:

```typescript
// lib/hooks/useBoardFilters.ts
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';

interface BoardFilters {
  status?: string[];
  section?: string[];
  assignee?: string[];
  search?: string;
  sort?: 'dueDate' | 'created' | 'position';
  sortDir?: 'asc' | 'desc';
}

export function useBoardFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters: BoardFilters = {
    status: searchParams.getAll('status'),
    section: searchParams.getAll('section'),
    assignee: searchParams.getAll('assignee'),
    search: searchParams.get('search') ?? undefined,
    sort: searchParams.get('sort') as BoardFilters['sort'],
    sortDir: searchParams.get('sortDir') as BoardFilters['sortDir'],
  };

  const setFilters = useCallback(
    (newFilters: Partial<BoardFilters>) => {
      const params = new URLSearchParams(searchParams);

      // Handle array params
      if (newFilters.status !== undefined) {
        params.delete('status');
        newFilters.status.forEach((s) => params.append('status', s));
      }
      if (newFilters.section !== undefined) {
        params.delete('section');
        newFilters.section.forEach((s) => params.append('section', s));
      }
      if (newFilters.assignee !== undefined) {
        params.delete('assignee');
        newFilters.assignee.forEach((a) => params.append('assignee', a));
      }

      // Handle single params
      if (newFilters.search !== undefined) {
        if (newFilters.search) {
          params.set('search', newFilters.search);
        } else {
          params.delete('search');
        }
      }
      if (newFilters.sort !== undefined) {
        if (newFilters.sort) {
          params.set('sort', newFilters.sort);
        } else {
          params.delete('sort');
        }
      }
      if (newFilters.sortDir !== undefined) {
        if (newFilters.sortDir) {
          params.set('sortDir', newFilters.sortDir);
        } else {
          params.delete('sortDir');
        }
      }

      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname]
  );

  const clearFilters = useCallback(() => {
    router.push(pathname);
  }, [router, pathname]);

  const hasActiveFilters =
    filters.status?.length ||
    filters.section?.length ||
    filters.assignee?.length ||
    filters.search;

  return {
    filters,
    setFilters,
    clearFilters,
    hasActiveFilters,
  };
}
```

---

## State Synchronization

### Optimistic Updates Flow

```
User Action (e.g., drag task)
         │
         ▼
┌─────────────────────┐
│ 1. Cancel pending   │
│    queries          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 2. Snapshot current │
│    cache state      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 3. Apply optimistic │
│    update to cache  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 4. UI updates       │
│    immediately      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 5. Send mutation    │
│    to server        │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │           │
  Success     Failure
     │           │
     ▼           ▼
┌─────────┐ ┌─────────────┐
│Invalidate│ │Rollback to  │
│ query   │ │ snapshot    │
└─────────┘ │ Show error  │
            └─────────────┘
```

### Cross-Tab Synchronization

For cases where user has multiple tabs open:

```typescript
// lib/hooks/useCrossTabSync.ts
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

export function useCrossTabSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = new BroadcastChannel('clix-pm-sync');

    channel.onmessage = (event) => {
      const { type, queryKey } = event.data;

      if (type === 'invalidate') {
        queryClient.invalidateQueries({ queryKey });
      }
    };

    return () => channel.close();
  }, [queryClient]);
}

// Use when making mutations
export function broadcastInvalidation(queryKey: unknown[]) {
  const channel = new BroadcastChannel('clix-pm-sync');
  channel.postMessage({ type: 'invalidate', queryKey });
  channel.close();
}
```

---

## Performance Considerations

### Selective Subscriptions

```typescript
// Only re-render when specific data changes
const taskCount = useTasks(boardId, {
  select: (tasks) => tasks.length,
});

// Only get tasks for specific status
const todoTasks = useTasks(boardId, {
  select: (tasks) => tasks.filter(t => t.status === 'todo'),
});
```

### Prefetching

```typescript
// Prefetch board data on hover
function ClientItem({ client }: { client: Client }) {
  const queryClient = useQueryClient();

  const prefetchBoards = () => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.boards.forClient(client.id),
      queryFn: () => getBoardsForClient(client.id),
      staleTime: 60 * 1000,
    });
  };

  return (
    <div onMouseEnter={prefetchBoards}>
      {client.name}
    </div>
  );
}
```

### Deferred Updates

For expensive operations like search:

```typescript
import { useDeferredValue } from 'react';

function TaskSearch() {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  // Query uses deferred value, so typing feels instant
  const { data: results } = useSearchTasks(deferredSearch);

  return (
    <>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <SearchResults results={results} />
    </>
  );
}
```
