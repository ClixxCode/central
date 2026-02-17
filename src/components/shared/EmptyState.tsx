import { LucideIcon, Inbox, FolderOpen, Search, FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?:
    | {
        label: string;
        onClick: () => void;
      }
    | React.ReactNode;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: EmptyStateProps) {
  const isActionObject = action && typeof action === 'object' && 'label' in action && 'onClick' in action;

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground/70" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
      )}
      {action && (
        isActionObject ? (
          <Button onClick={action.onClick}>{action.label}</Button>
        ) : (
          action
        )
      )}
    </div>
  );
}

export function NoTasksEmpty({ onAddTask }: { onAddTask?: () => void }) {
  return (
    <EmptyState
      icon={Inbox}
      title="No tasks yet"
      description="Get started by creating your first task for this board."
      action={onAddTask ? { label: 'Add Task', onClick: onAddTask } : undefined}
    />
  );
}

export function NoBoardsEmpty({ onAddBoard }: { onAddBoard?: () => void }) {
  return (
    <EmptyState
      icon={FolderOpen}
      title="No boards"
      description="Create a board to start organizing tasks for this client."
      action={onAddBoard ? { label: 'Create Board', onClick: onAddBoard } : undefined}
    />
  );
}

export function NoClientsEmpty({ onAddClient }: { onAddClient?: () => void }) {
  return (
    <EmptyState
      icon={FolderOpen}
      title="No clients yet"
      description="Add your first client to start managing projects."
      action={onAddClient ? { label: 'Add Client', onClick: onAddClient } : undefined}
    />
  );
}

export function NoSearchResults({ query }: { query: string }) {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description={`We couldn't find any tasks matching "${query}". Try adjusting your search.`}
    />
  );
}

export function NoNotifications() {
  return (
    <EmptyState
      icon={Inbox}
      title="All caught up!"
      description="You have no new notifications."
    />
  );
}

export function NotFoundState() {
  return (
    <EmptyState
      icon={FileQuestion}
      title="Not found"
      description="The page or resource you're looking for doesn't exist or you don't have access to it."
    />
  );
}
