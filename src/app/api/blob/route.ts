import { put, del } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';

// Maximum file sizes by type (in bytes)
const MAX_SIZES = {
  image: 8 * 1024 * 1024, // 8MB
  pdf: 16 * 1024 * 1024, // 16MB
  document: 16 * 1024 * 1024, // 16MB
  spreadsheet: 16 * 1024 * 1024, // 16MB
  presentation: 32 * 1024 * 1024, // 32MB
  archive: 32 * 1024 * 1024, // 32MB
  text: 1 * 1024 * 1024, // 1MB
  default: 16 * 1024 * 1024, // 16MB
};

// Allowed MIME types
const ALLOWED_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // Documents
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Spreadsheets
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Presentations
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Archives
  'application/zip',
  'application/x-zip-compressed',
];

function getFileCategory(type: string): keyof typeof MAX_SIZES {
  if (type.startsWith('image/')) return 'image';
  if (type === 'application/pdf') return 'pdf';
  if (type === 'text/plain') return 'text';
  if (type.includes('word')) return 'document';
  if (type.includes('excel') || type.includes('spreadsheet')) return 'spreadsheet';
  if (type.includes('powerpoint') || type.includes('presentation')) return 'presentation';
  if (type.includes('zip')) return 'archive';
  return 'default';
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const uploadedFiles = [];

    for (const file of files) {
      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `File type not allowed: ${file.type}` },
          { status: 400 }
        );
      }

      // Validate file size
      const category = getFileCategory(file.type);
      const maxSize = MAX_SIZES[category];
      if (file.size > maxSize) {
        return NextResponse.json(
          {
            error: `File too large: ${file.name}. Maximum size is ${maxSize / 1024 / 1024}MB`,
          },
          { status: 400 }
        );
      }

      // Generate unique filename with timestamp
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const pathname = `attachments/${user.id}/${timestamp}-${sanitizedName}`;

      // Upload to Vercel Blob
      const blob = await put(pathname, file, {
        access: 'public',
        addRandomSuffix: false,
      });

      uploadedFiles.push({
        url: blob.url,
        name: file.name,
        size: file.size,
        type: file.type,
        key: blob.pathname,
        uploadedBy: user.id,
      });
    }

    return NextResponse.json({ files: uploadedFiles });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
    }

    await del(url);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Delete failed' },
      { status: 500 }
    );
  }
}
