'use client';

import { Columns, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

export interface ColumnDefinition {
  id: string;
  label: string;
}

interface TableColumnsButtonProps {
  columns: ColumnDefinition[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  visibleColumns: Record<string, any>;
  onToggle: (columnId: string) => void;
  label?: string;
  menuLabel?: string;
  icon?: LucideIcon;
}

export function TableColumnsButton({ columns, visibleColumns, onToggle, label = 'Columns', menuLabel = 'Toggle columns', icon: Icon = Columns }: TableColumnsButtonProps) {
  const hiddenCount = columns.filter((c) => !visibleColumns[c.id]).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Icon className="size-4" />
          {label}
          <Badge variant="secondary" className="ml-1 px-1.5 py-0 tabular-nums">
            {columns.length - hiddenCount}/{columns.length}
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>{menuLabel}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={visibleColumns[column.id] ?? true}
            onCheckedChange={() => onToggle(column.id)}
          >
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
