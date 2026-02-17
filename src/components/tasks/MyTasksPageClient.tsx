'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { TodaysEvents } from '@/components/calendar/TodaysEvents';
import { PersonalRollupView } from './PersonalRollupView';
import { PersonalRollupToolbar } from './PersonalRollupToolbar';
import { PersonalListTab } from './PersonalListTab';
import { useMyTasks, myTasksKeys } from '@/lib/hooks/useMyTasks';
import { useQuery } from '@tanstack/react-query';
import { getUserPreferences } from '@/lib/actions/user-preferences';
import { useRealtimeInvalidation } from '@/lib/hooks/useRealtimeInvalidation';
import {
  useMentions,
  useReplies,
  useMarkNotificationAsRead,
  useMarkNotificationAsUnread,
  useMarkAllNotificationsAsRead,
  useMarkNotificationsByTypeAsRead,
} from '@/lib/hooks';
import { TaskFilterBar } from './TaskFilterBar';
import { PriorityButton } from './PriorityButton';
import { PersonalRollupSkeleton } from '@/components/shared';
import {
  AlertCircle,
  RefreshCw,
  AtSign,
  MessageSquare,
  CheckSquare,
  CalendarDays,
  LayoutList,
  ListTodo,
  TableRowsSplit,
  Bell,
  Check,
  Circle,
  ExternalLink,
  X,
  Loader2,
  ChevronsUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { TaskFilters, MyTasksByClient } from '@/lib/actions/tasks';
import type { StatusOption, SectionOption } from '@/lib/db/schema';
import type { AssigneeUser } from './AssigneePicker';
import type { NotificationWithTask } from '@/lib/actions/notifications';
import { useTask, useAssignableUsers } from '@/lib/hooks/useTasks';
import { usePersonalRollupStore } from '@/lib/stores/personalRollupStore';
import { useMyWorkPreferences } from '@/lib/hooks/useMyWorkPreferences';
import { useMentionableUsers } from '@/lib/hooks/useQuickAdd';
import { CommentsSection } from '@/components/comments';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';

interface NotificationItemProps {
  notification: NotificationWithTask;
  onMarkAsRead: (id: string) => void;
  onMarkAsUnread: (id: string) => void;
  onOpenSheet: (notification: NotificationWithTask) => void;
  isMarkingRead?: boolean;
  isMarkingUnread?: boolean;
}

function NotificationItem({
  notification,
  onMarkAsRead,
  onMarkAsUnread,
  onOpenSheet,
  isMarkingRead,
  isMarkingUnread,
}: NotificationItemProps) {
  const task = notification.task;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onOpenSheet(notification);
  };

  const handleMarkAsRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!notification.readAt) {
      onMarkAsRead(notification.id);
    }
  };

  const handleMarkAsUnread = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (notification.readAt) {
      onMarkAsUnread(notification.id);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'flex items-start gap-3 p-4 border-b last:border-b-0 hover:bg-muted/50 transition-colors cursor-pointer',
        !notification.readAt && 'bg-primary/5'
      )}
    >
      <div
        className={cn(
          'mt-1 rounded-full p-1.5 shrink-0',
          notification.type === 'mention' ? 'bg-blue-100 dark:bg-blue-500/20' : 'bg-green-100 dark:bg-green-500/20'
        )}
      >
        {notification.type === 'mention' ? (
          <AtSign className="size-3.5 text-blue-600 dark:text-blue-400" />
        ) : (
          <MessageSquare className="size-3.5 text-green-600 dark:text-green-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground line-clamp-1">
          {notification.title}
        </p>
        {notification.body && (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
            {notification.body}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1">
          {task && (
            <span className="text-xs text-muted-foreground">
              {task.board.client.name} → {task.board.name}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
          </span>
        </div>
      </div>
      {!notification.readAt ? (
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 h-8 px-2 text-xs"
          onClick={handleMarkAsRead}
          disabled={isMarkingRead}
        >
          {isMarkingRead ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <>
              <Check className="size-3.5 mr-1" />
              Mark read
            </>
          )}
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 h-8 px-2 text-xs"
          onClick={handleMarkAsUnread}
          disabled={isMarkingUnread}
        >
          {isMarkingUnread ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <>
              <Circle className="size-3.5 mr-1" />
              Mark unread
            </>
          )}
        </Button>
      )}
    </div>
  );
}

function EmptyState({ type }: { type: 'mentions' | 'replies' | 'notifications' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        {type === 'mentions' ? (
          <AtSign className="size-8 text-muted-foreground" />
        ) : type === 'replies' ? (
          <MessageSquare className="size-8 text-muted-foreground" />
        ) : (
          <Bell className="size-8 text-muted-foreground" />
        )}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">
        No {type} yet
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        {type === 'mentions'
          ? 'When someone mentions you in a comment, it will appear here.'
          : type === 'replies'
          ? 'When someone replies to your comments, it will appear here.'
          : 'When someone mentions you or replies to your comments, it will appear here.'}
      </p>
    </div>
  );
}

interface TaskQuickViewSheetProps {
  notification: NotificationWithTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkAsRead: (id: string) => void;
}

function TaskQuickViewSheet({
  notification,
  open,
  onOpenChange,
  onMarkAsRead,
}: TaskQuickViewSheetProps) {
  const task = notification?.task;
  const { user: currentUser, isAdmin } = useCurrentUser();
  const markedAsReadRef = React.useRef<string | null>(null);

  // Fetch full task data
  const { data: fullTask } = useTask(task?.id ?? '', { enabled: !!task?.id && open });

  // Fetch assignable users for mentions
  const { data: assignableUsers = [] } = useAssignableUsers(task?.boardId ?? '', {
    enabled: !!task?.boardId && open,
  });

  // Fetch all users for mention suggestions (anyone can be mentioned)
  const { data: allMentionUsers = [] } = useMentionableUsers();

  // Mark as read when opening (only once per notification)
  React.useEffect(() => {
    if (open && notification && !notification.readAt && markedAsReadRef.current !== notification.id) {
      markedAsReadRef.current = notification.id;
      onMarkAsRead(notification.id);
    }
    // Reset ref when sheet closes
    if (!open) {
      markedAsReadRef.current = null;
    }
  }, [open, notification?.id, notification?.readAt, onMarkAsRead]);

  if (!notification || !task) {
    return null;
  }

  const boardUrl = `/clients/${task.board.client.slug}/boards/${task.boardId}?task=${task.id}${notification.commentId ? `&comment=${notification.commentId}` : ''}`;

  const mentionUsers = (allMentionUsers.length > 0 ? allMentionUsers : assignableUsers).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatarUrl,
  }));

  // Map currentUser to CommentsSection format
  const commentUser = currentUser
    ? {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        avatarUrl: currentUser.image,
      }
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="!w-full sm:!w-[80vw] lg:!w-[66vw] !max-w-none p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <SheetTitle className="text-lg font-semibold line-clamp-2">
                {task.title}
              </SheetTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {task.board.client.name} → {task.board.name}
              </p>
            </div>
            <Link
              href={boardUrl}
              className="shrink-0 inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80"
            >
              <ExternalLink className="size-4" />
              Open in board
            </Link>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6">
            {/* Comments section with highlighted comment */}
            <div>
              <h3 className="text-sm font-semibold mb-4">Comments</h3>
              {commentUser && (
                <CommentsSection
                  taskId={task.id}
                  currentUser={commentUser}
                  isAdmin={isAdmin}
                  mentionUsers={mentionUsers}
                  highlightedCommentId={notification.commentId ?? undefined}
                />
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

type NotificationFilter = 'all' | 'mentions' | 'replies';
type ReadFilter = 'unread' | 'all';

function NotificationsTab() {
  const { data: mentions = [], isLoading: mentionsLoading, error: mentionsError } = useMentions();
  const { data: replies = [], isLoading: repliesLoading, error: repliesError } = useReplies();
  const [filter, setFilter] = React.useState<NotificationFilter>('all');
  const [readFilter, setReadFilter] = React.useState<ReadFilter>('unread');
  const [selectedNotification, setSelectedNotification] = React.useState<NotificationWithTask | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const markAsRead = useMarkNotificationAsRead();
  const markAsUnread = useMarkNotificationAsUnread();
  const markAllAsRead = useMarkAllNotificationsAsRead();
  const markByTypeAsRead = useMarkNotificationsByTypeAsRead();

  const isLoading = mentionsLoading || repliesLoading;
  const error = mentionsError || repliesError;

  // Combine and sort by date
  const allNotifications = React.useMemo(() => {
    let filtered: NotificationWithTask[] = [];

    if (filter === 'all') {
      filtered = [...mentions, ...replies];
    } else if (filter === 'mentions') {
      filtered = mentions;
    } else {
      filtered = replies;
    }

    if (readFilter === 'unread') {
      filtered = filtered.filter((n) => !n.readAt);
    }

    return filtered.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [mentions, replies, filter, readFilter]);

  const unreadMentions = mentions.filter((m) => !m.readAt).length;
  const unreadReplies = replies.filter((r) => !r.readAt).length;
  const unreadInCurrentFilter = React.useMemo(() => {
    if (filter === 'all') return unreadMentions + unreadReplies;
    if (filter === 'mentions') return unreadMentions;
    return unreadReplies;
  }, [filter, unreadMentions, unreadReplies]);

  const handleMarkAsRead = React.useCallback(
    (id: string) => {
      markAsRead.mutate(id);
    },
    [markAsRead]
  );

  const handleMarkAsUnread = React.useCallback(
    (id: string) => {
      markAsUnread.mutate(id);
    },
    [markAsUnread]
  );

  const handleMarkAllAsRead = React.useCallback(() => {
    if (filter === 'all') {
      markAllAsRead.mutate();
    } else if (filter === 'mentions') {
      markByTypeAsRead.mutate('mention');
    } else {
      markByTypeAsRead.mutate('comment_added');
    }
  }, [filter, markAllAsRead, markByTypeAsRead]);

  const handleOpenSheet = React.useCallback((notification: NotificationWithTask) => {
    setSelectedNotification(notification);
    setSheetOpen(true);
  }, []);

  if (isLoading) {
    return <PersonalRollupSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-destructive/10 p-4 mb-4">
          <AlertCircle className="size-8 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">
          Failed to load notifications
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          {error instanceof Error ? error.message : 'An unexpected error occurred'}
        </p>
      </div>
    );
  }

  const isMarkingAll = markAllAsRead.isPending || markByTypeAsRead.isPending;

  return (
    <div>
      {/* Filter Toggle and Mark All Button */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-md border bg-muted p-0.5">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-3 py-1 text-sm transition-colors',
                filter === 'all' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
              )}
            >
              All
              {unreadMentions + unreadReplies > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs font-medium rounded-full bg-blue-500 text-white">
                  {unreadMentions + unreadReplies}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setFilter('mentions')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-3 py-1 text-sm transition-colors',
                filter === 'mentions' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
              )}
            >
              <AtSign className="size-3.5" />
              Mentions
              {unreadMentions > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs font-medium rounded-full bg-blue-500 text-white">
                  {unreadMentions}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setFilter('replies')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-3 py-1 text-sm transition-colors',
                filter === 'replies' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
              )}
            >
              <MessageSquare className="size-3.5" />
              Replies
              {unreadReplies > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs font-medium rounded-full bg-green-500 text-white">
                  {unreadReplies}
                </span>
              )}
            </button>
          </div>

          <div className="inline-flex rounded-md border bg-muted p-0.5">
            <button
              type="button"
              onClick={() => setReadFilter('unread')}
              className={cn(
                'inline-flex items-center rounded px-3 py-1 text-sm transition-colors',
                readFilter === 'unread' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
              )}
            >
              Unread
            </button>
            <button
              type="button"
              onClick={() => setReadFilter('all')}
              className={cn(
                'inline-flex items-center rounded px-3 py-1 text-sm transition-colors',
                readFilter === 'all' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
              )}
            >
              All
            </button>
          </div>
        </div>

        {unreadInCurrentFilter > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={isMarkingAll}
          >
            {isMarkingAll ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Check className="size-4 mr-2" />
            )}
            Mark all as read
          </Button>
        )}
      </div>

      {allNotifications.length === 0 ? (
        <EmptyState type={filter === 'all' ? 'notifications' : filter} />
      ) : (
        <div className="border rounded-lg bg-card">
          {allNotifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkAsRead={handleMarkAsRead}
              onMarkAsUnread={handleMarkAsUnread}
              onOpenSheet={handleOpenSheet}
              isMarkingRead={markAsRead.isPending && markAsRead.variables === notification.id}
              isMarkingUnread={markAsUnread.isPending && markAsUnread.variables === notification.id}
            />
          ))}
        </div>
      )}

      <TaskQuickViewSheet
        notification={selectedNotification}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onMarkAsRead={handleMarkAsRead}
      />
    </div>
  );
}

// Helper to aggregate filter options from My Tasks data
function useMyTasksFilterOptions(tasksByClient: MyTasksByClient[] | undefined) {
  return React.useMemo(() => {
    const statusMap = new Map<string, StatusOption>();
    const sectionMap = new Map<string, SectionOption>();
    const userMap = new Map<string, AssigneeUser>();

    if (!tasksByClient) return { statusOptions: [], sectionOptions: [], assignableUsers: [] };

    tasksByClient.forEach((clientGroup) => {
      clientGroup.boards.forEach((board) => {
        board.statusOptions.forEach((s) => statusMap.set(s.id, s));
        board.sectionOptions.forEach((s) => sectionMap.set(s.id, s));
      });
      clientGroup.tasks.forEach((task) => {
        task.assignees.forEach((a) => userMap.set(a.id, a));
      });
    });

    return {
      statusOptions: Array.from(statusMap.values()),
      sectionOptions: Array.from(sectionMap.values()),
      assignableUsers: Array.from(userMap.values()),
    };
  }, [tasksByClient]);
}

// Apply TaskFilters client-side to MyTasksByClient data
function applyMyTasksFilters(
  tasksByClient: MyTasksByClient[],
  filters: TaskFilters
): MyTasksByClient[] {
  const hasFilters =
    filters.status || filters.section || filters.assigneeId || filters.overdue;
  if (!hasFilters) return tasksByClient;

  const statuses = filters.status
    ? Array.isArray(filters.status) ? filters.status : [filters.status]
    : null;
  const statusIsNot = filters.statusMode === 'is_not';
  const sections = filters.section
    ? Array.isArray(filters.section) ? filters.section : [filters.section]
    : null;
  const sectionIsNot = filters.sectionMode === 'is_not';
  const assigneeIds = filters.assigneeId
    ? Array.isArray(filters.assigneeId) ? filters.assigneeId : [filters.assigneeId]
    : null;
  const assigneeIsNot = filters.assigneeMode === 'is_not';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  return tasksByClient
    .map((clientGroup) => ({
      ...clientGroup,
      tasks: clientGroup.tasks.filter((task) => {
        if (statuses) {
          const matches = statuses.includes(task.status);
          if (statusIsNot ? matches : !matches) return false;
        }
        if (sections) {
          const hasNoSection = sections.includes('__none__');
          const actualSections = sections.filter((s) => s !== '__none__');

          let matches: boolean;
          if (hasNoSection && actualSections.length > 0) {
            matches = task.section === null || actualSections.includes(task.section);
          } else if (hasNoSection) {
            matches = task.section === null;
          } else {
            matches = task.section !== null && actualSections.includes(task.section);
          }
          if (sectionIsNot ? matches : !matches) return false;
        }
        if (assigneeIds) {
          const taskAssigneeIds = task.assignees.map((a) => a.id);
          const hasMatch = assigneeIds.some((id) => taskAssigneeIds.includes(id));
          if (assigneeIsNot ? hasMatch : !hasMatch) return false;
        }
        if (filters.overdue) {
          if (!task.dueDate || task.dueDate >= todayStr) return false;
          // Exclude completed/done tasks from overdue filter
          const statusOption = task.board.statusOptions.find((s) => s.id === task.status);
          if (statusOption && (
            statusOption.id === 'complete' ||
            statusOption.id === 'done' ||
            statusOption.label.toLowerCase().includes('complete') ||
            statusOption.label.toLowerCase().includes('done')
          )) return false;
        }
        return true;
      }),
    }))
    .filter((clientGroup) => clientGroup.tasks.length > 0);
}

export function MyTasksPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user: currentSessionUser } = useCurrentUser();
  const userId = currentSessionUser?.id;
  const { data: tasksByClient, isLoading, error, refetch } = useMyTasks();

  // Realtime: invalidate my tasks when assignments change
  useRealtimeInvalidation({
    channel: `my-assignments-${userId ?? 'none'}`,
    table: 'task_assignees',
    filter: userId ? `user_id=eq.${userId}` : undefined,
    queryKeys: [myTasksKeys.list()],
    enabled: !!userId,
  });
  useRealtimeInvalidation({
    channel: `my-tasks-changes-${userId ?? 'none'}`,
    table: 'tasks',
    queryKeys: [myTasksKeys.list()],
    enabled: !!userId,
  });
  const { data: mentions = [] } = useMentions();
  const { data: replies = [] } = useReplies();
  const { viewMode, setViewMode, activeTab: storedTab, setActiveTab, areAllClientsCollapsed, setAllClientsCollapsed, prioritySelectionMode, setPrioritySelectionMode, priorityFilterActive, setPriorityFilterActive, togglePriorityFilter } = usePersonalRollupStore();
  const { isBoardHidden, hiddenBoards, hiddenColumns, setHiddenBoards, setHiddenColumns, myWorkFilters: filters, setMyWorkFilters: setFilters, priorityTaskIds, isPriority, togglePriority, clearPriorities } = useMyWorkPreferences();

  // Fetch user preferences for hidePersonalList
  const { data: userPrefs } = useQuery({
    queryKey: ['userPreferences'],
    queryFn: async () => {
      const result = await getUserPreferences();
      return result.success ? result.preferences : null;
    },
    staleTime: 5 * 60 * 1000,
  });
  const hidePersonalList = userPrefs?.hidePersonalList ?? false;
  const showCalendarEvents = userPrefs?.calendar?.showEventsInMyWork === true;

  // Derive active tab from URL param (reactive) or stored preference
  const urlTab = searchParams.get('tab');
  const activeTabValue = urlTab === 'notifications' ? 'notifications' : urlTab === 'personal' ? 'personal' : urlTab === 'tasks' ? 'tasks' : storedTab;

  const unreadMentions = mentions.filter((m) => !m.readAt).length;
  const unreadReplies = replies.filter((r) => !r.readAt).length;
  const totalUnread = unreadMentions + unreadReplies;

  // Aggregate filter options from all boards
  const { statusOptions, sectionOptions, assignableUsers } = useMyTasksFilterOptions(tasksByClient);

  // Apply filters client-side
  const filteredTasksByClient = React.useMemo(() => {
    let result = applyMyTasksFilters(tasksByClient ?? [], filters);
    // Apply priority filter
    if (priorityFilterActive && priorityTaskIds.length > 0) {
      const prioritySet = new Set(priorityTaskIds);
      result = result
        .map((cg) => ({
          ...cg,
          tasks: cg.tasks.filter((t) => prioritySet.has(t.id)),
        }))
        .filter((cg) => cg.tasks.length > 0);
    }
    return result;
  }, [tasksByClient, filters, priorityFilterActive, priorityTaskIds]);

  // Memoize priority IDs as a Set for efficient lookups
  const priorityTaskIdsSet = React.useMemo(
    () => new Set(priorityTaskIds),
    [priorityTaskIds]
  );

  // Collect visible board IDs for collapse/expand all
  const visibleBoardIds = React.useMemo(() => {
    if (!tasksByClient) return [];
    const ids = new Set<string>();
    tasksByClient.forEach((cg) =>
      cg.tasks.forEach((t) => {
        if (!isBoardHidden(t.board.id)) ids.add(t.board.id);
      })
    );
    return Array.from(ids);
  }, [tasksByClient, isBoardHidden]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">My Work</h1>
        <p className="text-muted-foreground">Tasks, mentions, and replies across all clients</p>
      </div>

      {showCalendarEvents && <TodaysEvents />}

      <Tabs value={activeTabValue} onValueChange={(v) => {
        setActiveTab(v as 'tasks' | 'notifications' | 'personal');
        // Keep URL in sync so sidebar favorites can detect active tab
        router.replace(`/my-tasks?tab=${v}`, { scroll: false });
      }} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="tasks" className="gap-2">
            <CheckSquare className="size-4" />
            Assigned Tasks
          </TabsTrigger>
          {!hidePersonalList && (
            <TabsTrigger value="personal" className="gap-2">
              <ListTodo className="size-4" />
              Personal Tasks
            </TabsTrigger>
          )}
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="size-4" />
            Replies & Mentions
            {totalUnread > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs font-medium rounded-full bg-blue-500 text-white">
                {totalUnread}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks">
          {isLoading ? (
            <PersonalRollupSkeleton />
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-destructive/10 p-4 mb-4">
                <AlertCircle className="size-8 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                Failed to load tasks
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-4">
                {error instanceof Error ? error.message : 'An unexpected error occurred'}
              </p>
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="size-4 mr-2" />
                Try again
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="inline-flex rounded-md border bg-muted p-0.5">
                    <button
                      type="button"
                      onClick={() => setViewMode('swimlane')}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded px-3 py-1 text-sm transition-colors',
                        viewMode === 'swimlane' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
                      )}
                    >
                      <TableRowsSplit className="h-4 w-4" />
                      By Board
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('date')}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded px-3 py-1 text-sm transition-colors',
                        viewMode === 'date' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
                      )}
                    >
                      <CalendarDays className="h-4 w-4" />
                      By Date
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('table')}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded px-3 py-1 text-sm transition-colors',
                        viewMode === 'table' ? 'bg-background shadow-sm' : 'hover:bg-background/50'
                      )}
                    >
                      <LayoutList className="h-4 w-4" />
                      Table
                    </button>
                  </div>
                  <PriorityButton
                    priorityCount={priorityTaskIds.length}
                    isSelectionMode={prioritySelectionMode}
                    isFilterActive={priorityFilterActive}
                    onEnterSelectionMode={() => setPrioritySelectionMode(true)}
                    onExitSelectionMode={() => {
                      setPrioritySelectionMode(false);
                      if (priorityTaskIds.length > 0) {
                        setPriorityFilterActive(true);
                      }
                    }}
                    onToggleFilter={togglePriorityFilter}
                    onClear={() => {
                      clearPriorities();
                      setPriorityFilterActive(false);
                    }}
                  />
                  {tasksByClient && <PersonalRollupToolbar tasksByClient={tasksByClient} viewMode={viewMode} />}
                  <TaskFilterBar
                    filters={filters}
                    onFiltersChange={setFilters}
                    statusOptions={statusOptions}
                    sectionOptions={sectionOptions}
                    assignableUsers={assignableUsers}
                    hideAssigneeFilter
                    additionalFilterCount={
                      (priorityFilterActive ? 1 : 0) +
                      hiddenBoards.length +
                      hiddenColumns.length
                    }
                    onClearAll={() => {
                      if (priorityFilterActive) {
                        clearPriorities();
                        setPriorityFilterActive(false);
                      }
                      if (hiddenBoards.length > 0) setHiddenBoards([]);
                      if (hiddenColumns.length > 0) setHiddenColumns([]);
                    }}
                  />
                </div>
                {(viewMode === 'swimlane' || viewMode === 'date') && (() => {
                  const collapseIds = viewMode === 'date'
                    ? ['overdue', 'today', 'tomorrow', 'this-week', 'next-week', 'later', 'no-date']
                    : visibleBoardIds;
                  if (collapseIds.length === 0) return null;
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        const allCollapsed = areAllClientsCollapsed(collapseIds);
                        setAllClientsCollapsed(collapseIds, !allCollapsed);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <ChevronsUpDown className="size-4" />
                      {areAllClientsCollapsed(collapseIds) ? 'Expand All' : 'Collapse All'}
                    </button>
                  );
                })()}
              </div>
              <PersonalRollupView
                tasksByClient={filteredTasksByClient}
                viewMode={viewMode}
                prioritySelectionMode={prioritySelectionMode}
                priorityFilterActive={priorityFilterActive}
                priorityTaskIds={priorityTaskIdsSet}
                onTogglePriority={togglePriority}
              />
            </>
          )}
        </TabsContent>

        {!hidePersonalList && (
          <TabsContent value="personal">
            <PersonalListTab />
          </TabsContent>
        )}

        <TabsContent value="notifications">
          <NotificationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
