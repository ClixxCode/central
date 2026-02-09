'use client';

import { useCallback, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Upload, X, FileIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export interface UploadedFile {
  url: string;
  name: string;
  size: number;
  type: string;
  key: string;
}

interface FileUploadProps {
  endpoint: 'attachmentUploader' | 'imageUploader';
  onUploadComplete?: (files: UploadedFile[]) => void;
  onUploadError?: (error: Error) => void;
  disabled?: boolean;
  className?: string;
  maxFiles?: number;
  accept?: Record<string, string[]>;
}

interface FileWithProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}

// Default accepted file types for each endpoint
const ENDPOINT_ACCEPT: Record<string, Record<string, string[]>> = {
  attachmentUploader: {
    'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
    'application/pdf': ['.pdf'],
    'text/plain': ['.txt'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-powerpoint': ['.ppt'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    'application/zip': ['.zip'],
  },
  imageUploader: {
    'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  },
};

export function FileUpload({
  endpoint,
  onUploadComplete,
  onUploadError,
  disabled = false,
  className,
  maxFiles = 10,
  accept,
}: FileUploadProps) {
  const [files, setFiles] = useState<FileWithProgress[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptedTypes = accept ?? ENDPOINT_ACCEPT[endpoint];

  const uploadFiles = useCallback(
    async (filesToUpload: File[]) => {
      if (disabled || isUploading) return;

      setIsUploading(true);
      const newFiles: FileWithProgress[] = filesToUpload.map((file) => ({
        file,
        progress: 0,
        status: 'pending' as const,
      }));
      setFiles(newFiles);

      try {
        const formData = new FormData();
        filesToUpload.forEach((file) => {
          formData.append('files', file);
        });

        // Update progress to uploading
        setFiles((prev) =>
          prev.map((f) => ({ ...f, status: 'uploading' as const, progress: 50 }))
        );

        const response = await fetch('/api/blob', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Upload failed');
        }

        const result = await response.json();
        const uploadedFiles: UploadedFile[] = result.files;

        setFiles([]);
        onUploadComplete?.(uploadedFiles);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Upload failed');
        setFiles((prev) =>
          prev.map((f) => ({
            ...f,
            status: 'error' as const,
            error: err.message,
          }))
        );
        onUploadError?.(err);
      } finally {
        setIsUploading(false);
      }
    },
    [disabled, isUploading, onUploadComplete, onUploadError]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (disabled) return;
      const limitedFiles = acceptedFiles.slice(0, maxFiles);
      uploadFiles(limitedFiles);
    },
    [disabled, maxFiles, uploadFiles]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      if (disabled || isUploading) return;

      const droppedFiles = Array.from(e.dataTransfer.files);
      onDrop(droppedFiles);
    },
    [disabled, isUploading, onDrop]
  );

  const handleClick = useCallback(() => {
    if (disabled || isUploading) return;
    inputRef.current?.click();
  }, [disabled, isUploading]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      if (selectedFiles.length > 0) {
        onDrop(selectedFiles);
      }
      // Reset input value so the same file can be selected again
      e.target.value = '';
    },
    [onDrop]
  );

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Build accept string for input
  const acceptString = Object.entries(acceptedTypes)
    .flatMap(([type, extensions]) => [type, ...extensions])
    .join(',');

  return (
    <div className={cn('space-y-4', className)}>
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        className={cn(
          'relative flex cursor-pointer flex-col items-center justify-center',
          'rounded-lg border-2 border-dashed border-muted-foreground/25',
          'p-6 text-center transition-colors',
          'hover:border-muted-foreground/50 hover:bg-muted/50',
          isDragActive && 'border-primary bg-primary/5',
          (disabled || isUploading) && 'cursor-not-allowed opacity-50'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple={maxFiles > 1}
          accept={acceptString}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled || isUploading}
        />
        <Upload
          className={cn(
            'mb-2 h-8 w-8 text-muted-foreground',
            isDragActive && 'text-primary'
          )}
        />
        {isDragActive ? (
          <p className="text-sm font-medium text-primary">Drop files here</p>
        ) : (
          <>
            <p className="text-sm font-medium">
              Drag & drop files here, or click to select
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Images, PDFs, documents up to 32MB
            </p>
          </>
        )}
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((fileWithProgress, index) => (
            <div
              key={`${fileWithProgress.file.name}-${index}`}
              className="flex items-center gap-3 rounded-md border bg-muted/30 p-2"
            >
              <FileIcon className="h-8 w-8 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {fileWithProgress.file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(fileWithProgress.file.size)}
                </p>
                {fileWithProgress.status === 'uploading' && (
                  <Progress value={fileWithProgress.progress} className="mt-1 h-1" />
                )}
                {fileWithProgress.status === 'error' && (
                  <p className="text-xs text-destructive">{fileWithProgress.error}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {fileWithProgress.status === 'uploading' && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {fileWithProgress.status !== 'uploading' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
