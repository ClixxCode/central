'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { useIgnoreWeekends } from '@/lib/hooks/useIgnoreWeekends';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TaskEditor, type TaskEditorRef } from '@/components/editor/TaskEditor';
import type { FileMentionItem } from '@/components/editor/FileMentionList';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { FileUpload, type UploadedFile } from '@/components/attachments/FileUpload';
import { AttachmentList } from '@/components/attachments/AttachmentList';
import { CommentsSection } from '@/components/comments';
import type { Attachment } from '@/components/attachments/AttachmentPreview';
import type { TiptapContent, RecurringConfig } from '@/lib/db/schema/tasks';
import type { MentionUser } from '@/components/editor/MentionList';
import type { TaskWithAssignees, UpdateTaskInput, CreateTaskInput } from '@/lib/actions/tasks';
import type { StatusOption as SchemaStatusOption, SectionOption as SchemaSectionOption } from '@/lib/db/schema';
import type { AssigneeUser } from './AssigneePicker';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { useMentionableUsers } from '@/lib/hooks/useQuickAdd';
import {
  getTaskAttachments,
  createTaskAttachment,
  deleteTaskAttachment,
} from '@/lib/actions/attachments';
import { recordTaskView } from '@/lib/actions/task-views';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import {
  Archive,
  ArchiveRestore,
  CalendarIcon,
  Users,
  Paperclip,
  ListTodo,
  ListTree,
  CornerDownRight,
  Clock,
  X,
  Check,
  Loader2,
  Repeat,
  Link2,
  Hash,
  Pencil,
} from 'lucide-react';
import { RecurringPicker, RecurringIndicator } from './RecurringPicker';
import { SubtasksTab } from './SubtasksTab';
import { CompleteParentDialog } from './CompleteParentDialog';
import { DeleteTaskDialog } from './DeleteTaskDialog';
import { getRecurrenceDescription } from '@/lib/utils/recurring';
import { isCompleteStatus } from '@/lib/utils/status';
import { useArchiveTask, useUnarchiveTask } from '@/lib/hooks/useTasks';
import { useClient } from '@/lib/hooks/useClients';
import { useNotificationPreferences } from '@/lib/hooks/useNotifications';
import { useRealtimeInvalidation } from '@/lib/hooks/useRealtimeInvalidation';
import { commentKeys } from '@/lib/hooks/useComments';

// Re-export types for backwards compatibility
export interface StatusOption {
  value: string;
  label: string;
  color: string;
}

export interface SectionOption {
  value: string;
  label: string;
}

export interface TaskUser {
  id: string;
  name: string | null;
  email: string;
  avatarUrl?: string | null;
}

export type DateFlexibility = 'not_set' | 'flexible' | 'semi_flexible' | 'not_flexible';

const DATE_FLEXIBILITY_OPTIONS: { value: DateFlexibility; label: string; color: string; hex: string }[] = [
  { value: 'not_set', label: 'Not set', color: 'bg-muted', hex: '' },
  { value: 'flexible', label: 'Flexible', color: 'bg-green-500', hex: '#22c55e' },
  { value: 'semi_flexible', label: 'Semi-flexible', color: 'bg-yellow-500', hex: '#eab308' },
  { value: 'not_flexible', label: 'Not flexible', color: 'bg-red-500', hex: '#ef4444' },
];

function hexToSubtleBg(hex: string, opacity = 0.08): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// Legacy TaskData interface for backwards compatibility
export interface TaskData {
  id?: string;
  title: string;
  description: TiptapContent | null;
  status: string;
  section: string | null;
  dueDate: string | null;
  dateFlexibility: DateFlexibility;
  assigneeIds: string[];
  attachments: Attachment[];
}

interface TaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // New interface - using schema types directly
  task?: TaskWithAssignees;
  statusOptions: SchemaStatusOption[];
  sectionOptions: SchemaSectionOption[];
  assignableUsers: AssigneeUser[];
  onUpdate?: (input: UpdateTaskInput) => void;
  onCreate?: (input: Omit<CreateTaskInput, 'boardId'>) => void;
  onDelete?: (taskId: string) => void;
  mode: 'view' | 'create';
  /** Optional comment ID to highlight (from notification links) */
  highlightedCommentId?: string;
  /** Canonical URL path for this task (e.g. /clients/slug/boards/id) — used for copy link */
  taskBasePath?: string;
  /** Called when a subtask is clicked in the Subtasks tab */
  onOpenSubtask?: (taskId: string) => void;
}

export function TaskModal({
  open,
  onOpenChange,
  task,
  statusOptions,
  sectionOptions,
  assignableUsers,
  onUpdate,
  onCreate,
  onDelete,
  mode,
  highlightedCommentId,
  taskBasePath,
  onOpenSubtask,
}: TaskModalProps) {
  const ignoreWeekends = useIgnoreWeekends();
  const editorRef = useRef<TaskEditorRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadResolverRef = useRef<((file: File | null) => void) | null>(null);
  const isNew = mode === 'create';
  const { user: currentUser, isAdmin } = useCurrentUser();

  // Look up client for Slack channel URL + user/site preferences for link type
  const clientSlug = taskBasePath?.match(/\/clients\/([^/]+)/)?.[1] ?? '';
  const { data: clientData } = useClient(clientSlug);
  const slackChannelUrl = clientData?.metadata?.slackChannelUrl;
  const { data: notifPrefs } = useNotificationPreferences();
  const slackLinkType = notifPrefs?.notifications?.slack?.slackLinkType ?? 'web';
  const slackTeamId = process.env.NEXT_PUBLIC_SLACK_WORKSPACE_ID;

  // Realtime: live comment updates when modal is open
  useRealtimeInvalidation({
    channel: `task-comments-${task?.id ?? 'none'}`,
    table: 'comments',
    filter: task?.id ? `task_id=eq.${task.id}` : undefined,
    queryKeys: task?.id ? [commentKeys.list(task.id)] : [],
    enabled: !isNew && !!task?.id,
  });

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState<TiptapContent | null>(null);
  const [descriptionFocused, setDescriptionFocused] = useState(false);
  const [status, setStatus] = useState('');
  const [section, setSection] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [dateFlexibility, setDateFlexibility] = useState<DateFlexibility>('not_set');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [recurringConfig, setRecurringConfig] = useState<RecurringConfig | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isAssigneePickerOpen, setIsAssigneePickerOpen] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [assigneeHighlight, setAssigneeHighlight] = useState(0);
  const [activeTab, setActiveTab] = useState('details');
  const [isSaving, setIsSaving] = useState(false);
  const [highlightedAttachmentId, setHighlightedAttachmentId] = useState<string | null>(null);
  const [completeParentOpen, setCompleteParentOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  // Archive hooks
  const archiveTaskMutation = useArchiveTask();
  const unarchiveTaskMutation = useUnarchiveTask();
  const prevOpenRef = useRef(false);
  const prevTaskIdRef = useRef<string | null>(null);
  const titleFocusedRef = useRef(false);
  const assigneePickerOpenRef = useRef(false);

  // For existing tasks, always in edit mode (click-to-edit with auto-save)
  // For new tasks, we need to collect all data before create
  const isAutoSaveEnabled = !isNew && task?.id;

  // Handle file mention click - switch to attachments tab and highlight
  const handleFileMentionClick = useCallback((attachmentId: string) => {
    setActiveTab('attachments');
    setHighlightedAttachmentId(attachmentId);
    // Clear highlight after animation
    setTimeout(() => setHighlightedAttachmentId(null), 2000);
  }, []);

  // Build shareable task URL (prefer short URL when available)
  const getShareableTaskUrl = useCallback(() => {
    if (task?.shortId) {
      return `${window.location.origin}/t/${task.shortId}`;
    }
    if (taskBasePath && task?.id) {
      return `${window.location.origin}${taskBasePath}?task=${task.id}`;
    }
    return null;
  }, [task?.shortId, task?.id, taskBasePath]);

  // Copy task link to clipboard
  const handleCopyLink = useCallback(() => {
    const url = getShareableTaskUrl();
    if (!url) return;
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard');
  }, [getShareableTaskUrl]);

  // Copy task link and open Slack channel
  const handleSendToSlack = useCallback(() => {
    if (!task?.id || !slackChannelUrl) return;
    const url = getShareableTaskUrl();
    if (!url) return;
    navigator.clipboard.writeText(url);

    // Build Slack URL based on user preference
    let slackUrl = slackChannelUrl;
    if (slackLinkType === 'app' && slackTeamId) {
      const channelId = slackChannelUrl.match(/\/archives\/([A-Z0-9]+)/)?.[1];
      if (channelId) {
        slackUrl = `slack://channel?team=${slackTeamId}&id=${channelId}`;
      }
    }

    if (slackUrl.startsWith('slack://')) {
      window.location.href = slackUrl;
    } else {
      window.open(slackUrl, '_blank');
    }
    const toastId = toast('We\u2019ve sent you to the Slack channel and copied the task URL to the clipboard.', {
      duration: 5000,
    });
    const dismiss = () => {
      toast.dismiss(toastId);
      document.removeEventListener('click', dismiss);
    };
    // Dismiss on next click anywhere
    setTimeout(() => document.addEventListener('click', dismiss, { once: true }), 100);
  }, [task?.id, getShareableTaskUrl, slackChannelUrl, slackLinkType, slackTeamId]);

  // Fetch attachments and record view when task changes
  useEffect(() => {
    if (open && task?.id) {
      getTaskAttachments(task.id).then(setAttachments);
      // Record that user viewed this task (for "new" badge)
      recordTaskView(task.id).catch(console.error);
    } else {
      setAttachments([]);
    }
  }, [open, task?.id]);

  // Auto-save function for existing tasks
  const autoSave = useCallback(
    (updates: Partial<UpdateTaskInput>) => {
      if (!isAutoSaveEnabled || !task?.id || !onUpdate) return;
      setIsSaving(true);
      const input: UpdateTaskInput = {
        id: task.id,
        ...updates,
      };
      onUpdate(input);
      // Clear saving indicator after a short delay
      setTimeout(() => setIsSaving(false), 500);
    },
    [isAutoSaveEnabled, task?.id, onUpdate]
  );

  // Debounced auto-save for title (500ms delay)
  const debouncedSaveTitle = useDebouncedCallback(
    (newTitle: string) => {
      if (newTitle.trim()) {
        autoSave({ title: newTitle.trim() });
      }
    },
    500
  );

  // Debounced auto-save for description (500ms delay)
  const debouncedSaveDescription = useDebouncedCallback(
    (newDescription: TiptapContent | null) => {
      const json = newDescription ? JSON.stringify(newDescription) : null;
      if (json && json.length > 500_000) {
        console.warn('[TaskModal] Large description payload:', json.length, 'bytes');
      }
      autoSave({ descriptionJson: json });
    },
    500
  );

  // Flush pending saves on unmount (e.g. client-side navigation)
  useEffect(() => {
    return () => {
      debouncedSaveTitle.flush();
      debouncedSaveDescription.flush();
    };
  }, [debouncedSaveTitle, debouncedSaveDescription]);

  // Reset form when task changes or modal opens
  useEffect(() => {
    if (open) {
      if (task) {
        // Skip resetting title if user is actively editing it (focused),
        // unless we navigated to a different task
        if (!titleFocusedRef.current || task.id !== prevTaskIdRef.current) {
          setTitle(task.title);
        }
        setDescription(task.description as TiptapContent | null);
        setStatus(task.status);
        setSection(task.section);
        setDueDate(task.dueDate ?? null);
        setDateFlexibility(task.dateFlexibility);
        setRecurringConfig(task.recurringConfig);
        if (!assigneePickerOpenRef.current) {
          setAssigneeIds(task.assignees.map((a) => a.id));
        }
      } else {
        // New task - reset to defaults
        setTitle('');
        setDescription(null);
        setStatus(statusOptions[0]?.id ?? '');
        setSection(null);
        setDueDate(null);
        setDateFlexibility('not_set');
        setRecurringConfig(null);
        setAssigneeIds([]);
      }
      // Reset activeTab when the modal first opens OR when navigating
      // to a different task (e.g. clicking a subtask from the subtasks tab)
      if (!prevOpenRef.current || prevTaskIdRef.current !== task?.id) {
        setActiveTab('details');
      }
      prevTaskIdRef.current = task?.id ?? null;
    }
    prevOpenRef.current = open;
  }, [open, task, statusOptions, highlightedCommentId]);

  // Get selected assignees
  const selectedAssignees = assignableUsers.filter((user) => assigneeIds.includes(user.id));

  // Get current status option
  const currentStatus = statusOptions.find((s) => s.id === status);

  // Handle create (only for new tasks)
  const handleCreate = useCallback(async () => {
    if (!title.trim() || !isNew || !onCreate) return;

    setIsSaving(true);
    try {
      const createInput = {
        title: title.trim(),
        descriptionJson: description ? JSON.stringify(description) : undefined,
        status,
        section: section ?? undefined,
        dueDate: dueDate ?? undefined,
        dateFlexibility,
        recurringConfig: recurringConfig ?? undefined,
        assigneeIds,
      };
      onCreate(createInput);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  }, [
    isNew,
    title,
    description,
    status,
    section,
    dueDate,
    dateFlexibility,
    recurringConfig,
    assigneeIds,
    onCreate,
    onOpenChange,
  ]);

  // Get mention users - use all users so anyone can be mentioned
  const { data: allMentionUsers = [] } = useMentionableUsers();
  const mentionUsers: MentionUser[] = (allMentionUsers.length > 0 ? allMentionUsers : assignableUsers).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatarUrl,
  }));

  // Convert attachments to file mention items
  const fileMentionItems = attachments.map((a) => ({
    id: a.id,
    filename: a.filename,
    url: a.url,
    mimeType: a.mimeType ?? 'application/octet-stream',
  }));

  // Handle image upload for the editor
  const handleUploadImage = useCallback(async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('files', file);

    const response = await fetch('/api/blob', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload image');
    }

    const data = await response.json();
    return data.files[0].url;
  }, []);

  // Handle "Upload new file" from the + attachment mention popup
  const handleUploadAttachment = useCallback(async (): Promise<FileMentionItem | null> => {
    if (!task?.id) return null;

    // Open native file picker via hidden input and wait for selection
    const file = await new Promise<File | null>((resolve) => {
      uploadResolverRef.current = (f) => {
        window.removeEventListener('focus', onWindowFocus);
        resolve(f);
      };
      // Detect cancel: when the file picker closes without selection, window regains focus
      const onWindowFocus = () => {
        setTimeout(() => {
          if (uploadResolverRef.current) {
            uploadResolverRef.current(null);
            uploadResolverRef.current = null;
          }
        }, 300);
      };
      window.addEventListener('focus', onWindowFocus, { once: true });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
        fileInputRef.current.click();
      }
    });

    if (!file) return null;

    try {
      // Upload the file
      const formData = new FormData();
      formData.append('files', file);
      const response = await fetch('/api/blob', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Failed to upload file');
      const data = await response.json();
      const uploaded = data.files[0];

      // Create attachment record
      const result = await createTaskAttachment({
        taskId: task.id,
        filename: uploaded.name,
        url: uploaded.url,
        size: uploaded.size,
        mimeType: uploaded.type,
      });

      if (result.success && result.attachment) {
        setAttachments((prev) => [...prev, result.attachment!]);
        return {
          id: result.attachment.id,
          filename: result.attachment.filename,
          url: result.attachment.url,
          mimeType: result.attachment.mimeType ?? 'application/octet-stream',
        };
      }
    } catch (err) {
      toast.error('Failed to upload file');
    }
    return null;
  }, [task?.id]);

  return (
    <Sheet open={open} onOpenChange={(isOpen) => {
        if (!isOpen) {
          debouncedSaveTitle.flush();
          debouncedSaveDescription.flush();
        }
        onOpenChange(isOpen);
      }}>
      <SheetContent side="right" className="!w-full sm:!w-[80vw] lg:!w-[66vw] !max-w-none p-0 flex flex-col gap-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <SheetHeader className="border-b px-6 py-5 shrink-0">
          {/* Parent task breadcrumb for subtasks */}
          {!isNew && task?.parentTaskId && onOpenSubtask && (
            <button
              type="button"
              onClick={() => onOpenSubtask(task.parentTaskId!)}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mb-1 -ml-2"
            >
              <CornerDownRight className="size-3" />
              <span>This is a subtask — view parent task</span>
            </button>
          )}
          <div className="flex items-center gap-3 pr-8">
            {/* Status badge */}
            {currentStatus && (
              <Badge
                className="shrink-0"
                style={{ backgroundColor: currentStatus.color }}>
                {currentStatus.label}
              </Badge>
            )}
            {/* Recurring indicator */}
            {(task?.recurringConfig || recurringConfig) && (
              <Badge variant="outline" className="mt-1 shrink-0 gap-1">
                <Repeat className="size-3" />
                Recurring
              </Badge>
            )}
            {/* Title - always editable with auto-save */}
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (isAutoSaveEnabled) {
                  debouncedSaveTitle(e.target.value);
                }
              }}
              onFocus={() => { titleFocusedRef.current = true; }}
              onBlur={() => { titleFocusedRef.current = false; }}
              placeholder="Task title"
              className="flex-1 border-0 bg-transparent pl-2 py-0 text-lg font-semibold shadow-none focus-visible:ring-0"
            />
            {/* Saving indicator */}
            {isSaving && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          {/* Hidden title for accessibility */}
          <SheetTitle className="sr-only">{title || 'Edit task'}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Main content area */}
          <div className="flex flex-1 flex-col overflow-hidden min-w-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col overflow-hidden">
              <div className="mx-6 mt-4 flex items-center shrink-0">
                <TabsList>
                  <TabsTrigger value="details" className="gap-1.5">
                    <ListTodo className="h-4 w-4" />
                    Details
                  </TabsTrigger>
                  <TabsTrigger value="attachments" className="gap-1.5">
                    <Paperclip className="h-4 w-4" />
                    Attachments
                  </TabsTrigger>
                  {!isNew && task && !task.parentTaskId && (
                    <TabsTrigger value="subtasks" className="gap-1.5">
                      <ListTree className="h-4 w-4" />
                      Subtasks
                      {task.subtaskCount > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                          {task.subtaskCompletedCount}/{task.subtaskCount}
                        </Badge>
                      )}
                    </TabsTrigger>
                  )}
                </TabsList>
                {!isNew && task?.archivedAt && (
                  <Badge variant="secondary" className="ml-2">
                    <Archive className="mr-1 h-3 w-3" />
                    Archived {format(new Date(task.archivedAt), 'MMM d, yyyy')}
                  </Badge>
                )}
                {!isNew && task?.id && taskBasePath && (
                  <div className="ml-auto flex items-center gap-1">
                    {slackChannelUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 text-muted-foreground"
                        onClick={handleSendToSlack}
                      >
                        <Hash className="h-3.5 w-3.5" />
                        Slack
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 text-muted-foreground"
                      onClick={handleCopyLink}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Copy link
                    </Button>
                  </div>
                )}
              </div>

              <ScrollArea className="flex-1 overflow-hidden px-6 py-4">
                <TabsContent value="details" className="mt-0 space-y-6">
                  {/* Task metadata fields */}
                  <div className="grid grid-cols-2 gap-4 rounded-lg border bg-muted p-4 md:grid-cols-3">
                    {/* Status - always editable */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Status</label>
                      <Select
                        value={status}
                        onValueChange={(v) => {
                          // Check if completing a parent task with incomplete subtasks
                          const hasIncompleteSubtasks =
                            task &&
                            !task.parentTaskId &&
                            task.subtaskCount > 0 &&
                            task.subtaskCompletedCount < task.subtaskCount;
                          const movingToComplete = isCompleteStatus(v, statusOptions);
                          const wasNotComplete = !isCompleteStatus(status, statusOptions);

                          if (hasIncompleteSubtasks && movingToComplete && wasNotComplete && isAutoSaveEnabled) {
                            setPendingStatus(v);
                            setCompleteParentOpen(true);
                            return;
                          }

                          setStatus(v);
                          if (isAutoSaveEnabled) {
                            autoSave({ status: v });
                          }
                        }}
                      >
                        {(() => {
                          const selectedStatus = statusOptions.find(o => o.id === status);
                          return (
                            <SelectTrigger
                              className="h-9"
                              style={selectedStatus?.color ? {
                                backgroundColor: hexToSubtleBg(selectedStatus.color, 0.08),
                                borderColor: hexToSubtleBg(selectedStatus.color, 0.25),
                              } : undefined}
                            >
                              <SelectValue />
                            </SelectTrigger>
                          );
                        })()}
                        <SelectContent>
                          {statusOptions.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: option.color }}
                                />
                                {option.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Section - always editable */}
                    {sectionOptions.length > 0 && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Section</label>
                        <Select
                          value={section ?? '__none__'}
                          onValueChange={(v) => {
                            const newSection = v === '__none__' ? null : v;
                            setSection(newSection);
                            if (isAutoSaveEnabled) {
                              autoSave({ section: newSection });
                            }
                          }}
                        >
                          {(() => {
                            const selectedSection = section ? sectionOptions.find(o => o.id === section) : null;
                            return (
                              <SelectTrigger
                                className="h-9"
                                style={selectedSection?.color ? {
                                  backgroundColor: hexToSubtleBg(selectedSection.color, 0.08),
                                  borderColor: hexToSubtleBg(selectedSection.color, 0.25),
                                } : undefined}
                              >
                                <SelectValue placeholder="None" />
                              </SelectTrigger>
                            );
                          })()}
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {sectionOptions.map((option) => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Due Date - always editable */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Due Date</label>
                      <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              'h-9 w-full justify-start text-left font-normal bg-background',
                              !dueDate && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dueDate ? format(parseISO(dueDate), 'MMM d, yyyy') : 'Set date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={dueDate ? parseISO(dueDate) : undefined}
                            onSelect={(date) => {
                              const dateStr = date ? format(date, 'yyyy-MM-dd') : null;
                              setDueDate(dateStr);
                              setIsDatePickerOpen(false);
                              if (isAutoSaveEnabled) {
                                autoSave({ dueDate: dateStr });
                              }
                            }}
                            initialFocus
                            hideWeekends={ignoreWeekends}
                          />
                          {dueDate && (
                            <div className="border-t p-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full"
                                onClick={() => {
                                  setDueDate(null);
                                  setIsDatePickerOpen(false);
                                  if (isAutoSaveEnabled) {
                                    autoSave({ dueDate: null });
                                  }
                                }}
                              >
                                Clear date
                              </Button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Date Flexibility - always visible, disabled without due date */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        <Clock className="mr-1 inline h-3 w-3" />
                        Flexibility
                      </label>
                      <Select
                        value={dateFlexibility}
                        onValueChange={(v) => {
                          const newFlex = v as DateFlexibility;
                          setDateFlexibility(newFlex);
                          if (isAutoSaveEnabled) {
                            autoSave({ dateFlexibility: newFlex });
                          }
                        }}
                        disabled={!dueDate}
                      >
                        {(() => {
                          const selectedFlex = DATE_FLEXIBILITY_OPTIONS.find(o => o.value === dateFlexibility);
                          return (
                            <SelectTrigger
                              className="h-9"
                              style={selectedFlex?.hex && dueDate ? {
                                backgroundColor: hexToSubtleBg(selectedFlex.hex, 0.08),
                                borderColor: hexToSubtleBg(selectedFlex.hex, 0.25),
                              } : undefined}
                            >
                              <SelectValue />
                            </SelectTrigger>
                          );
                        })()}
                        <SelectContent>
                          {DATE_FLEXIBILITY_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex items-center gap-2">
                                <div className={cn('h-2 w-2 rounded-full', option.color)} />
                                {option.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Assignees - hidden when no assignable users (e.g. personal board) */}
                    {assignableUsers.length > 0 && <div className="space-y-1.5 col-span-2 md:col-span-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        <Users className="mr-1 inline h-3 w-3" />
                        Assignees
                      </label>
                      <Popover
                        open={isAssigneePickerOpen}
                        onOpenChange={(open) => {
                          setIsAssigneePickerOpen(open);
                          assigneePickerOpenRef.current = open;
                          if (!open) {
                            setAssigneeSearch('');
                            setAssigneeHighlight(0);
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-auto min-h-9 w-full justify-start text-left font-normal bg-background"
                          >
                            {selectedAssignees.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {selectedAssignees.map((user) => (
                                  <div
                                    key={user.id}
                                    className="group/assignee flex items-center gap-1 rounded bg-muted px-1.5 py-0.5"
                                  >
                                    <Avatar className="h-4 w-4">
                                      <AvatarImage src={user.avatarUrl ?? undefined} />
                                      <AvatarFallback className="text-[8px]">
                                        {getInitials(user.name ?? user.email)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-xs">
                                      {user.name ?? user.email.split('@')[0]}
                                    </span>
                                    <span
                                      role="button"
                                      className="opacity-30 group-hover/assignee:opacity-100 inline-flex items-center justify-center h-4 w-4 rounded-full bg-muted-foreground/20 hover:bg-muted-foreground/40 text-foreground cursor-pointer"
                                      onPointerDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const newAssigneeIds = assigneeIds.filter((id) => id !== user.id);
                                        setAssigneeIds(newAssigneeIds);
                                        if (isAutoSaveEnabled) {
                                          autoSave({ assigneeIds: newAssigneeIds });
                                        }
                                      }}
                                    >
                                      <X className="h-3 w-3" />
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Add assignees</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-0" align="start">
                          {(() => {
                            const filteredAssignees = assignableUsers.filter((user) => {
                              if (!assigneeSearch) return true;
                              const s = assigneeSearch.toLowerCase();
                              return (
                                user.name?.toLowerCase().includes(s) ||
                                user.email.toLowerCase().includes(s)
                              );
                            });
                            return (
                              <>
                                <div className="p-2">
                                  <Input
                                    placeholder="Search users..."
                                    value={assigneeSearch}
                                    onChange={(e) => {
                                      setAssigneeSearch(e.target.value);
                                      setAssigneeHighlight(0);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'ArrowDown') {
                                        e.preventDefault();
                                        setAssigneeHighlight((prev) =>
                                          prev < filteredAssignees.length - 1 ? prev + 1 : 0
                                        );
                                      } else if (e.key === 'ArrowUp') {
                                        e.preventDefault();
                                        setAssigneeHighlight((prev) =>
                                          prev > 0 ? prev - 1 : filteredAssignees.length - 1
                                        );
                                      } else if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const user = filteredAssignees[assigneeHighlight];
                                        if (user) {
                                          const newAssigneeIds = assigneeIds.includes(user.id)
                                            ? assigneeIds.filter((id) => id !== user.id)
                                            : [...assigneeIds, user.id];
                                          setAssigneeIds(newAssigneeIds);
                                          setAssigneeSearch('');
                                          setAssigneeHighlight(0);
                                          if (isAutoSaveEnabled) {
                                            autoSave({ assigneeIds: newAssigneeIds });
                                          }
                                        }
                                      }
                                    }}
                                    className="h-8"
                                    autoFocus
                                  />
                                </div>
                                <div className="max-h-64 overflow-y-auto px-1 pb-1">
                                  {filteredAssignees.map((user, index) => (
                                    <button
                                      key={user.id}
                                      type="button"
                                      ref={(el) => {
                                        if (index === assigneeHighlight) {
                                          el?.scrollIntoView({ block: 'nearest' });
                                        }
                                      }}
                                      onPointerDown={(e) => {
                                        e.preventDefault();
                                        const newAssigneeIds = assigneeIds.includes(user.id)
                                          ? assigneeIds.filter((id) => id !== user.id)
                                          : [...assigneeIds, user.id];
                                        setAssigneeIds(newAssigneeIds);
                                        setAssigneeSearch('');
                                        setAssigneeHighlight(0);
                                        if (isAutoSaveEnabled) {
                                          autoSave({ assigneeIds: newAssigneeIds });
                                        }
                                      }}
                                      onMouseEnter={() => setAssigneeHighlight(index)}
                                      className={cn(
                                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                                        'hover:bg-accent',
                                        index === assigneeHighlight && 'bg-accent',
                                        assigneeIds.includes(user.id) && 'bg-accent'
                                      )}
                                    >
                                      <Avatar className="h-6 w-6">
                                        <AvatarImage src={user.avatarUrl ?? undefined} />
                                        <AvatarFallback className="text-xs">
                                          {getInitials(user.name ?? user.email)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="flex-1 truncate text-left">
                                        {user.name ?? user.email}
                                      </div>
                                      {assigneeIds.includes(user.id) && (
                                        <Check className="h-4 w-4 text-primary" />
                                      )}
                                    </button>
                                  ))}
                                </div>
                              </>
                            );
                          })()}
                        </PopoverContent>
                      </Popover>
                    </div>}

                    {/* Recurring - always visible, disabled without due date */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        <Repeat className="mr-1 inline h-3 w-3" />
                        Repeat
                      </label>
                      <RecurringPicker
                        value={recurringConfig}
                        onChange={(config) => {
                          setRecurringConfig(config);
                          if (isAutoSaveEnabled) {
                            autoSave({ recurringConfig: config });
                          }
                        }}
                        baseDueDate={dueDate ?? undefined}
                        disabled={!dueDate}
                      />
                    </div>
                  </div>

                  {/* Description - view/edit toggle */}
                  <div>
                    <div
                      className={cn(
                        'relative rounded-md border',
                        !descriptionFocused && 'group/desc hover:border-primary/50 transition-colors'
                      )}
                      onBlur={(e) => {
                        if (!descriptionFocused) return;
                        if (!e.currentTarget.contains(e.relatedTarget)) {
                          if ((e.relatedTarget as HTMLElement)?.closest('[data-radix-popper-content-wrapper]')) {
                            return;
                          }
                          // Flush any pending debounced save before leaving edit mode
                          debouncedSaveDescription.flush();
                          setDescriptionFocused(false);
                        }
                      }}
                    >
                      {descriptionFocused && editorRef.current?.getEditor() && (
                        <div className="flex items-center justify-between border-b bg-muted/30">
                          <EditorToolbar
                            editor={editorRef.current.getEditor()}
                            onUploadImage={handleUploadImage}
                            className="border-b-0"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mr-1 text-xs text-muted-foreground"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => setDescriptionFocused(false)}
                          >
                            <Check className="mr-1 h-3 w-3" />
                            Done
                          </Button>
                        </div>
                      )}
                      {!descriptionFocused && (
                        <button
                          type="button"
                          className="absolute right-3 top-1 z-10 opacity-0 group-hover/desc:opacity-100 transition-opacity p-1 rounded hover:bg-accent"
                          onClick={() => {
                            setDescriptionFocused(true);
                            setTimeout(() => editorRef.current?.focus(), 0);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      )}
                      <div
                        className="relative"
                        onClick={(e) => {
                          if (!descriptionFocused) {
                            const link = (e.target as HTMLElement).closest('a');
                            if (link?.href) {
                              window.open(link.href, '_blank', 'noopener,noreferrer');
                              return;
                            }
                            setDescriptionFocused(true);
                            setTimeout(() => editorRef.current?.focus(), 0);
                          }
                        }}
                      >
                        <TaskEditor
                          ref={editorRef}
                          content={description}
                          editable={descriptionFocused}
                          onChange={(content) => {
                            setDescription(content);
                            if (isAutoSaveEnabled) {
                              debouncedSaveDescription(content);
                            }
                          }}
                          users={mentionUsers}
                          attachments={fileMentionItems}
                          onUploadImage={handleUploadImage}
                          onUploadAttachment={!isNew && task?.id ? handleUploadAttachment : undefined}
                          onFileMentionClick={handleFileMentionClick}
                          placeholder="Add a description... (+ to reference attachments)"
                          className="[&>div]:border-0 [&>div]:focus-within:ring-0"
                          minHeight="150px"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Comments section */}
                  {!isNew && task?.id && currentUser && (
                    <div className="rounded-lg border bg-accent/50 p-4">
                      <CommentsSection
                        taskId={task.id}
                        currentUser={{
                          id: currentUser.id,
                          name: currentUser.name,
                          email: currentUser.email,
                          avatarUrl: currentUser.image,
                        }}
                        isAdmin={isAdmin}
                        mentionUsers={mentionUsers}
                        taskAttachments={fileMentionItems}
                        onFileMentionClick={handleFileMentionClick}
                        onUploadAttachment={handleUploadAttachment}
                        highlightedCommentId={highlightedCommentId}
                      />
                    </div>
                  )}
                </TabsContent>

                {/* Subtasks Tab */}
                {!isNew && task && !task.parentTaskId && (
                  <TabsContent value="subtasks" className="mt-0">
                    <SubtasksTab
                      parentTaskId={task.id}
                      boardId={task.boardId}
                      statusOptions={statusOptions}
                      sectionOptions={sectionOptions}
                      onOpenSubtask={onOpenSubtask}
                    />
                  </TabsContent>
                )}

                <TabsContent value="attachments" className="mt-0 space-y-4">
                  {isNew || !task?.id ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Paperclip className="mb-2 h-10 w-10 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">
                        Attachments can be added after the task is created.
                      </p>
                    </div>
                  ) : (
                    <>
                      <FileUpload
                        endpoint="attachmentUploader"
                        onUploadComplete={async (files) => {
                          // Save each uploaded file as an attachment
                          for (const file of files) {
                            const result = await createTaskAttachment({
                              taskId: task.id,
                              filename: file.name,
                              url: file.url,
                              size: file.size,
                              mimeType: file.type,
                            });
                            if (result.success && result.attachment) {
                              setAttachments((prev) => [...prev, result.attachment!]);
                            }
                          }
                        }}
                      />
                      <AttachmentList
                        attachments={attachments}
                        highlightedId={highlightedAttachmentId}
                        onDelete={async (attachmentId) => {
                          const result = await deleteTaskAttachment(attachmentId);
                          if (result.success) {
                            setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
                          }
                        }}
                        showDelete
                        emptyMessage="No attachments yet. Drop files above to upload."
                      />
                    </>
                  )}
                </TabsContent>

              </ScrollArea>
            </Tabs>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-6 py-4 shrink-0">
          <div className="flex items-center gap-2">
            {/* Delete button for existing tasks */}
            {!isNew && task?.id && onDelete && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  Delete task
                </Button>
                <DeleteTaskDialog
                  open={deleteConfirmOpen}
                  onOpenChange={setDeleteConfirmOpen}
                  onConfirm={() => onDelete(task.id)}
                  isSubtask={!!task.parentTaskId}
                />
              </>
            )}
            {/* Archive button for done non-archived parent tasks (admin only) */}
            {isAdmin && !isNew && task?.id && !task.parentTaskId && !task.archivedAt && isCompleteStatus(task.status, statusOptions) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  archiveTaskMutation.mutate(task.id);
                  onOpenChange(false);
                }}
                disabled={archiveTaskMutation.isPending}
              >
                <Archive className="mr-1 h-4 w-4" />
                Archive
              </Button>
            )}
            {/* Unarchive button for archived tasks (admin only) */}
            {isAdmin && !isNew && task?.id && task.archivedAt && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  unarchiveTaskMutation.mutate(task.id);
                  onOpenChange(false);
                }}
                disabled={unarchiveTaskMutation.isPending}
              >
                <ArchiveRestore className="mr-1 h-4 w-4" />
                Unarchive
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isNew ? (
              <>
                {/* Create mode: Cancel and Create buttons */}
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={!title.trim() || isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create task
                </Button>
              </>
            ) : (
              /* View/edit mode: Just Close button (auto-save handles everything) */
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            )}
          </div>
        </div>
      </SheetContent>

      {/* Hidden file input for upload-from-mention flow */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          uploadResolverRef.current?.(file);
          uploadResolverRef.current = null;
        }}
      />

      {/* Confirmation dialog for completing parent with incomplete subtasks */}
      <CompleteParentDialog
        open={completeParentOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCompleteParentOpen(false);
            setPendingStatus(null);
          }
        }}
        incompleteCount={
          task ? task.subtaskCount - task.subtaskCompletedCount : 0
        }
        onConfirm={(completeSubtasks) => {
          if (pendingStatus) {
            setStatus(pendingStatus);
            autoSave({ status: pendingStatus, completeSubtasks });
            setPendingStatus(null);
          }
        }}
      />
    </Sheet>
  );
}

function getInitials(name: string): string {
  const parts = name.split(/[\s@]+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
