'use client';

import { type Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Link as LinkIcon,
  Unlink,
  ImageIcon,
  Loader2,
  ListChecks,
  Heading,
  ChevronDown,
  SquareCode,
  Table2,
  Plus,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCallback, useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface EditorToolbarProps {
  editor: Editor | null;
  className?: string;
  onUploadImage?: (file: File) => Promise<string>;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  tooltip: string;
  children: React.ReactNode;
}

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  tooltip,
  children,
}: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onClick}
          disabled={disabled}
          className={cn(isActive && 'bg-accent text-accent-foreground')}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

const headingOptions = [
  { label: 'Normal', level: 0 },
  { label: 'Heading 1', level: 1 },
  { label: 'Heading 2', level: 2 },
  { label: 'Heading 3', level: 3 },
] as const;

function getActiveHeadingLabel(editor: Editor): string {
  for (const opt of headingOptions) {
    if (opt.level > 0 && editor.isActive('heading', { level: opt.level })) {
      return opt.label;
    }
  }
  return 'Normal';
}

export function EditorToolbar({ editor, className, onUploadImage }: EditorToolbarProps) {
  const [linkUrl, setLinkUrl] = useState('');
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [headingPopoverOpen, setHeadingPopoverOpen] = useState(false);
  const [tablePopoverOpen, setTablePopoverOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleSetLink = useCallback(() => {
    if (!editor) return;

    if (linkUrl === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    }
    setLinkUrl('');
    setLinkPopoverOpen(false);
  }, [editor, linkUrl]);

  const handleOpenLinkPopover = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href ?? '';
    setLinkUrl(previousUrl || 'https://');
    setLinkPopoverOpen(true);
  }, [editor]);

  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editor || !onUploadImage) return;

    setIsUploadingImage(true);
    try {
      const url = await onUploadImage(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch (error) {
      console.error('Failed to upload image:', error);
    } finally {
      setIsUploadingImage(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }
  }, [editor, onUploadImage]);

  if (!editor) {
    return null;
  }

  const isInTable = editor.isActive('table');

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          'flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-1 py-1',
          className
        )}
        onMouseDown={(e) => {
          // Prevent toolbar clicks from stealing focus from the editor
          e.preventDefault();
        }}
      >
        {/* Heading dropdown */}
        <Popover open={headingPopoverOpen} onOpenChange={setHeadingPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className={cn(
                'ml-1 gap-0.5 px-1',
                editor.isActive('heading') && 'bg-accent text-accent-foreground'
              )}
            >
              <Heading className="h-3.5 w-3.5" />
              <ChevronDown className="h-2.5 w-2.5 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1" side="bottom" align="start">
            {headingOptions.map((opt) => (
              <Button
                key={opt.level}
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  'w-full justify-start text-sm font-normal',
                  opt.level === 0
                    ? editor.isActive('paragraph') && !editor.isActive('heading') && 'bg-accent'
                    : editor.isActive('heading', { level: opt.level }) && 'bg-accent'
                )}
                onClick={() => {
                  if (opt.level === 0) {
                    editor.chain().focus().setParagraph().run();
                  } else {
                    editor.chain().focus().toggleHeading({ level: opt.level as 1 | 2 | 3 }).run();
                  }
                  setHeadingPopoverOpen(false);
                }}
              >
                {opt.level === 1 && <span className="text-lg font-bold">{opt.label}</span>}
                {opt.level === 2 && <span className="text-base font-semibold">{opt.label}</span>}
                {opt.level === 3 && <span className="text-sm font-medium">{opt.label}</span>}
                {opt.level === 0 && <span>{opt.label}</span>}
              </Button>
            ))}
          </PopoverContent>
        </Popover>

        {/* Text formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          tooltip="Bold (Cmd+B)"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          tooltip="Italic (Cmd+I)"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          disabled={!editor.can().chain().focus().toggleStrike().run()}
          tooltip="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-5" />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          tooltip="Bullet list"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          tooltip="Numbered list"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          isActive={editor.isActive('taskList')}
          tooltip="Checklist"
        >
          <ListChecks className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          tooltip="Quote"
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>

        {/* Code block */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          isActive={editor.isActive('codeBlock')}
          tooltip="Code block"
        >
          <SquareCode className="h-4 w-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-5" />

        {/* Link */}
        <Popover open={linkPopoverOpen} onOpenChange={setLinkPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={handleOpenLinkPopover}
              className={cn(editor.isActive('link') && 'bg-accent text-accent-foreground')}
            >
              <LinkIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" side="bottom" align="start">
            <div className="flex gap-1.5">
              <Input
                type="url"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSetLink();
                  }
                }}
                className="h-8 flex-1 text-sm"
                autoFocus
              />
              <Button type="button" size="sm" className="h-8" onClick={handleSetLink}>
                {linkUrl && linkUrl !== 'https://' ? 'Set' : 'Remove'}
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {editor.isActive('link') && (
          <ToolbarButton
            onClick={() => editor.chain().focus().unsetLink().run()}
            tooltip="Remove link"
          >
            <Unlink className="h-4 w-4" />
          </ToolbarButton>
        )}

        {/* Image upload */}
        {onUploadImage && (
          <>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <ToolbarButton
              onClick={() => imageInputRef.current?.click()}
              tooltip="Insert image"
              disabled={isUploadingImage}
            >
              {isUploadingImage ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}
            </ToolbarButton>
          </>
        )}

        <Separator orientation="vertical" className="mx-1 h-5" />

        {/* Table */}
        {!isInTable ? (
          <ToolbarButton
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            tooltip="Insert table"
          >
            <Table2 className="h-4 w-4" />
          </ToolbarButton>
        ) : (
          <Popover open={tablePopoverOpen} onOpenChange={setTablePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="bg-accent text-accent-foreground"
              >
                <Table2 className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" side="bottom" align="start">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-sm font-normal"
                onClick={() => { editor.chain().focus().addRowBefore().run(); setTablePopoverOpen(false); }}
              >
                <Plus className="h-3.5 w-3.5" /> Add row above
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-sm font-normal"
                onClick={() => { editor.chain().focus().addRowAfter().run(); setTablePopoverOpen(false); }}
              >
                <Plus className="h-3.5 w-3.5" /> Add row below
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-sm font-normal"
                onClick={() => { editor.chain().focus().addColumnBefore().run(); setTablePopoverOpen(false); }}
              >
                <Plus className="h-3.5 w-3.5" /> Add column before
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-sm font-normal"
                onClick={() => { editor.chain().focus().addColumnAfter().run(); setTablePopoverOpen(false); }}
              >
                <Plus className="h-3.5 w-3.5" /> Add column after
              </Button>
              <Separator className="my-1" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-sm font-normal text-destructive hover:text-destructive"
                onClick={() => { editor.chain().focus().deleteRow().run(); setTablePopoverOpen(false); }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete row
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-sm font-normal text-destructive hover:text-destructive"
                onClick={() => { editor.chain().focus().deleteColumn().run(); setTablePopoverOpen(false); }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete column
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-sm font-normal text-destructive hover:text-destructive"
                onClick={() => { editor.chain().focus().deleteTable().run(); setTablePopoverOpen(false); }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete table
              </Button>
            </PopoverContent>
          </Popover>
        )}

        <Separator orientation="vertical" className="mx-1 h-5" />

        {/* History */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          tooltip="Undo (Cmd+Z)"
        >
          <Undo className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          tooltip="Redo (Cmd+Shift+Z)"
        >
          <Redo className="h-4 w-4" />
        </ToolbarButton>
      </div>
    </TooltipProvider>
  );
}
