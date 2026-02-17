'use client';

import type { Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Copy,
  Pencil,
  ExternalLink,
  Trash2,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface LinkBubbleMenuProps {
  editor: Editor;
}

export function LinkBubbleMenu({ editor }: LinkBubbleMenuProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [url, setUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const currentHref = editor.getAttributes('link').href as string | undefined;

  const handleEdit = useCallback(() => {
    setUrl(currentHref || '');
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [currentHref]);

  const handleSave = useCallback(() => {
    if (url.trim()) {
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: url.trim() })
        .run();
    }
    setIsEditing(false);
  }, [editor, url]);

  const handleDelete = useCallback(() => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setIsEditing(false);
  }, [editor]);

  const handleCopy = useCallback(() => {
    if (currentHref) {
      navigator.clipboard.writeText(currentHref);
    }
  }, [currentHref]);

  const handleOpen = useCallback(() => {
    if (currentHref) {
      window.open(currentHref, '_blank', 'noopener,noreferrer');
    }
  }, [currentHref]);

  // Reset editing state when link changes
  useEffect(() => {
    setIsEditing(false);
  }, [currentHref]);

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: e }: { editor: Editor }) => e.isActive('link')}
      options={{
        onHide: () => setIsEditing(false),
      }}
    >
      <TooltipProvider delayDuration={300}>
        <div className="flex items-center gap-1 rounded-lg border bg-popover p-1 shadow-md">
          {isEditing ? (
            <>
              <Input
                ref={inputRef}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSave();
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setIsEditing(false);
                  }
                }}
                placeholder="https://..."
                className="h-7 w-56 text-xs"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleSave}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Save</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleDelete}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Remove link</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <span className="max-w-48 truncate px-2 text-xs text-muted-foreground">
                {currentHref || 'No URL'}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleCopy}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Copy URL</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleEdit}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Edit URL</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleOpen}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Open link</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleDelete}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Remove link</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      </TooltipProvider>
    </BubbleMenu>
  );
}
