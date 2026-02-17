'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  FileText,
  FileImage,
  FileSpreadsheet,
  FileVideo,
  FileAudio,
  File,
  ExternalLink,
  Download,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createPortal } from 'react-dom';

export interface Attachment {
  id: string;
  filename: string;
  url: string;
  size?: number | null;
  mimeType?: string | null;
}

interface AttachmentPreviewProps {
  attachment: Attachment;
  onDelete?: (id: string) => void;
  showDelete?: boolean;
  className?: string;
}

export function AttachmentPreview({
  attachment,
  onDelete,
  showDelete = false,
  className,
}: AttachmentPreviewProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const { filename, url, mimeType } = attachment;

  const isImage = mimeType?.startsWith('image/');
  const isPdf = mimeType === 'application/pdf';
  const isVideo = mimeType?.startsWith('video/');

  const Icon = getFileIcon(mimeType);

  // Strip rogue inline body styles from Radix scroll lock when PDF panel is open
  useEffect(() => {
    if (!isPreviewOpen || !isPdf) return;

    const cleanup = () => {
      document.body.style.removeProperty('background-color');
    };

    cleanup();

    const observer = new MutationObserver(cleanup);
    observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });

    return () => observer.disconnect();
  }, [isPreviewOpen, isPdf]);

  const handlePreview = () => {
    if (isImage || isPdf) {
      setIsPreviewOpen(true);
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <>
      <div
        className={cn(
          'group relative flex items-center gap-3 rounded-md border bg-card p-3',
          'transition-colors hover:bg-muted/50',
          className
        )}
      >
        {/* Thumbnail/Icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted">
          {isImage ? (
            <img
              src={url}
              alt={filename}
              className="h-10 w-10 rounded object-cover"
            />
          ) : (
            <Icon className="h-5 w-5 text-muted-foreground" />
          )}
        </div>

        {/* File info */}
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={handlePreview}
            className="block max-w-full truncate text-left text-sm font-medium hover:underline"
          >
            {filename}
          </button>
          {attachment.size && (
            <p className="text-xs text-muted-foreground">
              {formatFileSize(attachment.size)}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => window.open(url, '_blank')}
            title="Open in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            asChild
            title="Download"
          >
            <a href={url} download={filename}>
              <Download className="h-4 w-4" />
            </a>
          </Button>
          {showDelete && onDelete && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => onDelete(attachment.id)}
              title="Delete"
              className="text-destructive hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Image Preview Dialog */}
      {isImage && (
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-h-[95vh] max-w-4xl overflow-hidden p-0">
            <DialogHeader className="sr-only">
              <DialogTitle>{filename}</DialogTitle>
            </DialogHeader>
            <div className="overflow-auto p-4">
              <img
                src={url}
                alt={filename}
                className="mx-auto max-h-[80vh] object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* PDF Preview Panel */}
      {isPdf && isPreviewOpen && createPortal(
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50 animate-in fade-in-0 duration-300"
            onClick={() => setIsPreviewOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l bg-background shadow-lg animate-in slide-in-from-right duration-300 sm:max-w-2xl lg:max-w-4xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="truncate pr-8 text-sm font-semibold">{filename}</p>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setIsPreviewOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <iframe
              src={url}
              title={filename}
              className="h-full w-full border-0"
            />
          </div>
        </>,
        document.body
      )}
    </>
  );
}

function getFileIcon(mimeType?: string | null) {
  if (!mimeType) return File;

  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType.startsWith('video/')) return FileVideo;
  if (mimeType.startsWith('audio/')) return FileAudio;
  if (mimeType === 'application/pdf') return FileText;
  if (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType === 'text/csv'
  ) {
    return FileSpreadsheet;
  }
  if (mimeType.includes('document') || mimeType.includes('word')) {
    return FileText;
  }

  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
