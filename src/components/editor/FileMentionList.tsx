'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { FileText, Image, FileArchive, FileSpreadsheet, File, Upload } from 'lucide-react';

export interface FileMentionItem {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
}

interface FileMentionListProps {
  items: FileMentionItem[];
  selectedIndex: number;
  onSelect: (file: FileMentionItem) => void;
  onUploadClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) {
    return <Image className="h-4 w-4 text-blue-500" />;
  }
  if (mimeType === 'application/pdf') {
    return <FileText className="h-4 w-4 text-red-500" />;
  }
  if (mimeType.includes('word') || mimeType === 'text/plain') {
    return <FileText className="h-4 w-4 text-blue-600" />;
  }
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
    return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
  }
  if (mimeType.includes('zip') || mimeType.includes('archive')) {
    return <FileArchive className="h-4 w-4 text-yellow-600" />;
  }
  return <File className="h-4 w-4 text-muted-foreground" />;
}

export const FileMentionList = forwardRef<HTMLDivElement, FileMentionListProps>(
  function FileMentionList({ items, selectedIndex, onSelect, onUploadClick, style, className }, ref) {
    const uploadRowSelected = selectedIndex === items.length;

    return (
      <div
        ref={ref}
        style={style}
        className={cn(
          'z-50 min-w-[200px] max-w-[300px]',
          'rounded-md border bg-popover p-1 shadow-md',
          'animate-in fade-in-0 zoom-in-95',
          className
        )}
      >
        {items.length > 0 && (
          <>
            <div className="mb-1 px-2 py-1 text-xs font-medium text-muted-foreground">
              Attachments
            </div>
            {items.map((file, index) => (
              <button
                key={file.id}
                type="button"
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                  'cursor-pointer outline-none',
                  'hover:bg-accent hover:text-accent-foreground',
                  index === selectedIndex && 'bg-accent text-accent-foreground'
                )}
                onClick={() => onSelect(file)}
              >
                {getFileIcon(file.mimeType)}
                <span className="truncate">{file.filename}</span>
              </button>
            ))}
          </>
        )}
        {items.length === 0 && (
          <div className="px-2 py-1 text-xs text-muted-foreground">
            No attachments found
          </div>
        )}
        {onUploadClick && (
          <>
            {items.length > 0 && <div className="my-1 border-t" />}
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-muted-foreground',
                'cursor-pointer outline-none',
                'hover:bg-accent hover:text-accent-foreground',
                uploadRowSelected && 'bg-accent text-accent-foreground'
              )}
              onClick={onUploadClick}
            >
              <Upload className="h-4 w-4" />
              <span>Upload new file...</span>
            </button>
          </>
        )}
      </div>
    );
  }
);
