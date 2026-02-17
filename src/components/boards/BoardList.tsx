'use client';

import { BoardCard } from './BoardCard';

interface BoardListProps {
  boards: {
    id: string;
    name: string;
    type: 'standard' | 'rollup' | 'personal';
  }[];
  clientSlug: string;
  onSettings?: (board: { id: string; name: string; type: 'standard' | 'rollup' | 'personal' }) => void;
  onDelete?: (board: { id: string; name: string; type: 'standard' | 'rollup' | 'personal' }) => void;
}

export function BoardList({ boards, clientSlug, onSettings, onDelete }: BoardListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {boards.map((board) => (
        <BoardCard
          key={board.id}
          board={board}
          clientSlug={clientSlug}
          onSettings={onSettings}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
