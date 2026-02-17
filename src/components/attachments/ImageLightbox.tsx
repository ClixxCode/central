'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ImageItem {
  id: string;
  filename: string;
  url: string;
  mimeType?: string | null;
}

interface ImageLightboxProps {
  images: ImageItem[];
}

export function ImageLightbox({ images }: ImageLightboxProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selected = selectedIndex !== null ? images[selectedIndex] : null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {images.map((image, index) => (
          <button
            key={image.id}
            type="button"
            onClick={() => setSelectedIndex(index)}
            className="overflow-hidden rounded-md border transition-shadow hover:shadow-md"
          >
            <img
              src={image.url}
              alt={image.filename}
              className="h-32 max-w-64 object-cover"
            />
          </button>
        ))}
      </div>

      <Dialog open={selected !== null} onOpenChange={() => setSelectedIndex(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>{selected?.filename}</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto p-4">
            {selected && (
              <img
                src={selected.url}
                alt={selected.filename}
                className="mx-auto max-h-[80vh] object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
