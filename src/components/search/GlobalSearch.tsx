'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, Building2, LayoutGrid, CheckSquare2, Archive } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSearch, type GlobalSearchResult, type TaskSearchResult, type ClientSearchResult, type BoardSearchResult } from '@/lib/hooks/useSearch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';

interface GlobalSearchProps {
  className?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export function GlobalSearch({ className, inputRef }: GlobalSearchProps) {
  const router = useRouter();
  const internalRef = React.useRef<HTMLInputElement>(null);
  const ref = inputRef || internalRef;
  const containerRef = React.useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(-1);

  const { query, setQuery, results, isLoading, isEmpty, shouldShowResults, clearSearch } =
    useSearch();

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset selected index when results change
  React.useEffect(() => {
    setSelectedIndex(-1);
  }, [results]);

  // Track search events
  const prevQueryRef = React.useRef('');
  React.useEffect(() => {
    if (shouldShowResults && !isLoading && query.length >= 2 && query !== prevQueryRef.current) {
      prevQueryRef.current = query;
      trackEvent('search_performed', { result_count: results.length, has_results: results.length > 0 });
    }
  }, [shouldShowResults, isLoading, results.length, query]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setIsOpen(true);
  };

  const handleResultClick = (result: GlobalSearchResult) => {
    switch (result.type) {
      case 'client':
        router.push(`/clients/${result.slug}`);
        break;
      case 'board':
        router.push(`/clients/${result.clientSlug}/boards/${result.id}`);
        break;
      case 'task':
        router.push(`/clients/${result.clientSlug}/boards/${result.boardId}?task=${result.id}`);
        break;
    }
    clearSearch();
    setIsOpen(false);
    ref.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleResultClick(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        ref.current?.blur();
        break;
    }
  };

  const showDropdown = isOpen && shouldShowResults;

  // Group results by type for section headers
  const groupedResults = React.useMemo(() => {
    const groups: { type: string; label: string; startIndex: number }[] = [];
    let lastType = '';
    results.forEach((r, i) => {
      if (r.type !== lastType) {
        const label = r.type === 'client' ? 'Clients' : r.type === 'board' ? 'Boards' : 'Tasks';
        groups.push({ type: r.type, label, startIndex: i });
        lastType = r.type;
      }
    });
    return groups;
  }, [results]);

  const getGroupForIndex = (index: number) => {
    for (let i = groupedResults.length - 1; i >= 0; i--) {
      if (index >= groupedResults[i].startIndex) return groupedResults[i];
    }
    return null;
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70 pointer-events-none" />
      <Input
        ref={ref}
        value={query}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search… (b t c to filter)"
        className="w-64 pl-9 pr-8"
        aria-label="Search"
        aria-expanded={showDropdown}
        aria-haspopup="listbox"
        role="combobox"
        aria-autocomplete="list"
      />
      {isLoading && (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground/70" />
      )}

      {showDropdown && (
        <div
          className="absolute top-full left-0 right-0 mt-1 max-h-80 overflow-y-auto rounded-lg border bg-popover shadow-lg z-50"
          role="listbox"
        >
          {isEmpty ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No results found for &quot;{query}&quot;
            </p>
          ) : (
            results.map((result, index) => {
              const group = getGroupForIndex(index);
              const showHeader = group && group.startIndex === index;

              return (
                <React.Fragment key={`${result.type}-${result.id}`}>
                  {showHeader && (
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/50">
                      {group.label}
                    </div>
                  )}
                  {result.type === 'client' ? (
                    <ClientResultItem
                      result={result}
                      isSelected={index === selectedIndex}
                      onClick={() => handleResultClick(result)}
                    />
                  ) : result.type === 'board' ? (
                    <BoardResultItem
                      result={result}
                      isSelected={index === selectedIndex}
                      onClick={() => handleResultClick(result)}
                    />
                  ) : (
                    <TaskResultItem
                      result={result}
                      isSelected={index === selectedIndex}
                      onClick={() => handleResultClick(result)}
                    />
                  )}
                </React.Fragment>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function ClientResultItem({ result, isSelected, onClick }: { result: ClientSearchResult; isSelected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
        'hover:bg-muted focus:bg-muted focus:outline-none',
        isSelected && 'bg-muted'
      )}
      role="option"
      aria-selected={isSelected}
    >
      <div
        className="flex h-6 w-6 items-center justify-center rounded"
        style={{ backgroundColor: result.color ? `${result.color}20` : undefined }}
      >
        <Building2 className="h-3.5 w-3.5" style={{ color: result.color ?? undefined }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{result.name}</p>
        <p className="text-xs text-muted-foreground">
          {result.boardCount} {result.boardCount === 1 ? 'board' : 'boards'}
        </p>
      </div>
    </button>
  );
}

function BoardResultItem({ result, isSelected, onClick }: { result: BoardSearchResult; isSelected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
        'hover:bg-muted focus:bg-muted focus:outline-none',
        isSelected && 'bg-muted'
      )}
      role="option"
      aria-selected={isSelected}
    >
      <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-50 dark:bg-blue-950">
        <LayoutGrid className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{result.name}</p>
        <p className="text-xs text-muted-foreground truncate">{result.clientName}</p>
      </div>
    </button>
  );
}

function TaskResultItem({ result, isSelected, onClick }: { result: TaskSearchResult; isSelected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
        'hover:bg-muted focus:bg-muted focus:outline-none',
        isSelected && 'bg-muted'
      )}
      role="option"
      aria-selected={isSelected}
    >
      <div className="flex h-6 w-6 items-center justify-center rounded bg-green-50 dark:bg-green-950">
        <CheckSquare2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium truncate">{result.title}</p>
          {result.archivedAt && (
            <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0 h-4">
              <Archive className="mr-0.5 h-2.5 w-2.5" />
              Archived
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {result.clientName} / {result.boardName}
        </p>
      </div>
      {result.assignees.length > 0 && (
        <div className="flex -space-x-1">
          {result.assignees.slice(0, 2).map((assignee) => (
            <Avatar key={assignee.id} className="h-5 w-5 border border-background">
              <AvatarImage src={assignee.avatarUrl ?? undefined} alt={assignee.name ?? ''} />
              <AvatarFallback className="text-[10px]">
                {assignee.name?.charAt(0) ?? '?'}
              </AvatarFallback>
            </Avatar>
          ))}
          {result.assignees.length > 2 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
              +{result.assignees.length - 2}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
