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
import { useCreateClient } from '@/lib/hooks';
import { generateSlug } from '@/lib/validations/client';
import { IconPicker } from './IconPicker';
import { ClientIcon } from './ClientIcon';
import { ColorPicker, PRESET_COLORS } from './ColorPicker';

interface NewClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewClientModal({ open, onOpenChange }: NewClientModalProps) {
  const createClient = useCreateClient();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [icon, setIcon] = useState<string>('circle');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; slug?: string }>({});

  // Auto-generate slug from name unless manually edited
  useEffect(() => {
    if (!slugManuallyEdited && name) {
      setSlug(generateSlug(name));
    }
  }, [name, slugManuallyEdited]);

  const handleSlugChange = (value: string) => {
    setSlugManuallyEdited(true);
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
  };

  const resetForm = () => {
    setName('');
    setSlug('');
    setColor(PRESET_COLORS[0]);
    setIcon('circle');
    setSlugManuallyEdited(false);
    setErrors({});
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
      await createClient.mutateAsync({ name: name.trim(), slug, color, icon });
      resetForm();
      onOpenChange(false);
    } catch {
      // Error is handled by the mutation
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>New Client</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
          <div className="space-y-4 py-4 overflow-y-auto">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-foreground">
                Name
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Corporation"
                autoFocus
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="slug" className="text-sm font-medium text-foreground">
                Slug
              </label>
              <div className="flex items-center">
                <span className="text-sm text-muted-foreground mr-1">/clients/</span>
                <Input
                  id="slug"
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
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createClient.isPending}>
              {createClient.isPending ? 'Creating...' : 'Create Client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
