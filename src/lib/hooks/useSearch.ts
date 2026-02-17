'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchTasks, type SearchResult } from '@/lib/actions/tasks';
import { useClients } from './useClients';

export interface ClientSearchResult {
  type: 'client';
  id: string;
  name: string;
  slug: string;
  color: string | null;
  icon: string | null;
  boardCount: number;
}

export interface BoardSearchResult {
  type: 'board';
  id: string;
  name: string;
  boardType: 'standard' | 'rollup' | 'personal';
  clientId: string;
  clientName: string;
  clientSlug: string;
  clientColor: string | null;
}

export interface TaskSearchResult extends SearchResult {
  type: 'task';
}

export type GlobalSearchResult = ClientSearchResult | BoardSearchResult | TaskSearchResult;

interface UseSearchOptions {
  /** Minimum query length to trigger search */
  minLength?: number;
  /** Debounce delay in milliseconds */
  debounceMs?: number;
}

// Search modifier prefixes: "b ", "t ", "c " filter to a specific type
type SearchFilter = 'all' | 'board' | 'task' | 'client';

function parseSearchQuery(query: string): { filter: SearchFilter; term: string } {
  const trimmed = query.trimStart();
  const match = trimmed.match(/^([btc])\s+(.+)/i);
  if (match) {
    const prefix = match[1].toLowerCase();
    const filterMap: Record<string, SearchFilter> = { b: 'board', t: 'task', c: 'client' };
    return { filter: filterMap[prefix] ?? 'all', term: match[2] };
  }
  return { filter: 'all', term: query };
}

export function useSearch(options: UseSearchOptions = {}) {
  const { minLength = 2, debounceMs = 300 } = options;

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce the query
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, debounceMs]);

  const { filter, term: searchTerm } = useMemo(() => parseSearchQuery(debouncedQuery), [debouncedQuery]);
  const shouldSearch = searchTerm.length >= minLength;

  // Task search (server-side) — skip when filtering to boards or clients only
  const { data: taskResults, isLoading: tasksLoading, error } = useQuery({
    queryKey: ['search', 'tasks', searchTerm],
    queryFn: async () => {
      const result = await searchTasks(searchTerm);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.results ?? [];
    },
    enabled: shouldSearch && filter !== 'board' && filter !== 'client',
    staleTime: 30000,
  });

  // Client & board search (client-side from cached data)
  const { data: clients } = useClients();

  const { clientResults, boardResults } = useMemo(() => {
    if (!shouldSearch || !clients) return { clientResults: [] as ClientSearchResult[], boardResults: [] as BoardSearchResult[] };
    const term = searchTerm.toLowerCase();

    const matchedClients: ClientSearchResult[] = filter !== 'board' && filter !== 'task'
      ? clients
          .filter((c) => c.name.toLowerCase().includes(term))
          .slice(0, 5)
          .map((c) => ({
            type: 'client' as const,
            id: c.id,
            name: c.name,
            slug: c.slug,
            color: c.color,
            icon: c.icon,
            boardCount: c.boards.length,
          }))
      : [];

    const matchedBoards: BoardSearchResult[] = [];
    if (filter !== 'task' && filter !== 'client') {
      for (const client of clients) {
        for (const board of client.boards) {
          if (board.name.toLowerCase().includes(term)) {
            matchedBoards.push({
              type: 'board' as const,
              id: board.id,
              name: board.name,
              boardType: board.type,
              clientId: client.id,
              clientName: client.name,
              clientSlug: client.slug,
              clientColor: client.color,
            });
          }
        }
      }
    }

    return {
      clientResults: matchedClients,
      boardResults: matchedBoards.slice(0, 5),
    };
  }, [shouldSearch, clients, searchTerm, filter]);

  // Combine results: boards first, then tasks, then clients
  const results = useMemo<GlobalSearchResult[]>(() => {
    const tasks: TaskSearchResult[] = (taskResults ?? []).map((r) => ({
      ...r,
      type: 'task' as const,
    }));
    return [...boardResults, ...tasks, ...clientResults];
  }, [clientResults, boardResults, taskResults]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
  }, []);

  return {
    query,
    setQuery,
    results,
    isLoading: tasksLoading && shouldSearch,
    isEmpty: shouldSearch && !tasksLoading && results.length === 0,
    error: error as Error | null,
    clearSearch,
    shouldShowResults: shouldSearch && searchTerm.length >= minLength,
  };
}

export type { SearchResult };
