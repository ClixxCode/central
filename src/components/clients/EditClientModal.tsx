'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateClient } from '@/lib/hooks';
import type { ClientWithBoards } from '@/lib/actions/clients';
import { IconPicker } from './IconPicker';
import { ClientIcon } from './ClientIcon';
import { ColorPicker, PRESET_COLORS } from './ColorPicker';

interface EditClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: ClientWithBoards;
}

export function EditClientModal({ open, onOpenChange, client }: EditClientModalProps) {
  const updateClient = useUpdateClient();

  const [name, setName] = useState(client.name);
  const [slug, setSlug] = useState(client.slug);
  const [color, setColor] = useState(client.color ?? PRESET_COLORS[0]);
  const [icon, setIcon] = useState(client.icon ?? 'circle');
  const [defaultBoardId, setDefaultBoardId] = useState<string | null>(client.defaultBoardId ?? null);
  const [errors, setErrors] = useState<{ name?: string; slug?: string }>({});

  // Reset form when client changes
  useEffect(() => {
    setName(client.name);
    setSlug(client.slug);
    setColor(client.color ?? PRESET_COLORS[0]);
    setIcon(client.icon ?? 'circle');
    setDefaultBoardId(client.defaultBoardId ?? null);
    setErrors({});
  }, [client]);

  const handleSlugChange = (value: string) => {
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Basic validation
    const newErrors: { name?: string; slug?: string } = {};
    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!slug.trim()) {
      newErrors.slug = 'Slug is required';
    } else if (!/^[a-z0-9-]+$/.test(slug)) {
      newErrors.slug = 'Slug must contain only lowercase letters, numbers, and hyphens';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await updateClient.mutateAsync({
        id: client.id,
        input: { name: name.trim(), slug, color, icon, defaultBoardId },
      });
      onOpenChange(false);
    } catch {
      // Error is handled by the mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Client</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
          <div className="space-y-4 py-4 overflow-y-auto">
            <div className="space-y-2">
              <label htmlFor="edit-name" className="text-sm font-medium text-foreground">
                Name
              </label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Corporation"
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="edit-slug" className="text-sm font-medium text-foreground">
                Slug
              </label>
              <div className="flex items-center">
                <span className="text-sm text-muted-foreground mr-1">/clients/</span>
                <Input
                  id="edit-slug"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="acme"
                  className="flex-1"
                />
              </div>
              {errors.slug && (
                <p className="text-sm text-destructive">{errors.slug}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Color</label>
              <ColorPicker value={color} onChange={setColor} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Icon</label>
              <IconPicker value={icon} onChange={setIcon} color={color} />
            </div>

            {client.boards.length > 1 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Default Board</label>
                <Select
                  value={defaultBoardId ?? 'auto'}
                  onValueChange={(value) => setDefaultBoardId(value === 'auto' ? null : value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    {client.boards.map((board) => (
                      <SelectItem key={board.id} value={board.id}>
                        {board.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Board to open when clicking the client name in the sidebar
                </p>
              </div>
            )}

            {/* Preview */}
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">Preview</p>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                  style={{ backgroundColor: color }}
                >
                  <ClientIcon icon={icon} color="white" name={name} size="lg" />
                </div>
                <div>
                  <p className="font-medium">{name || 'Client Name'}</p>
                  <p className="text-sm text-muted-foreground">/{slug || 'slug'}</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateClient.isPending}>
              {updateClient.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
