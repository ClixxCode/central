import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';

// Maximum file sizes by type (in bytes)
const MAX_SIZES = {
  image: 8 * 1024 * 1024, // 8MB
  pdf: 16 * 1024 * 1024, // 16MB
  document: 16 * 1024 * 1024, // 16MB
  spreadsheet: 16 * 1024 * 1024, // 16MB
  presentation: 32 * 1024 * 1024, // 32MB
  video: 50 * 1024 * 1024, // 50MB
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
  // Videos
  'video/mp4',
  'video/webm',
  'video/quicktime',
  // Archives
  'application/zip',
  'application/x-zip-compressed',
  // CSV
  'text/csv',
];

function getFileCategory(type: string): keyof typeof MAX_SIZES {
  if (type.startsWith('image/')) return 'image';
  if (type === 'application/pdf') return 'pdf';
  if (type === 'text/plain') return 'text';
  if (type === 'text/csv') return 'spreadsheet';
  if (type.includes('word')) return 'document';
  if (type.includes('excel') || type.includes('spreadsheet')) return 'spreadsheet';
  if (type.includes('powerpoint') || type.includes('presentation')) return 'presentation';
  if (type.startsWith('video/')) return 'video';
  if (type.includes('zip')) return 'archive';
  return 'default';
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const user = await getCurrentUser();
        if (!user) {
          throw new Error('Unauthorized');
        }

        // Parse and validate client payload
        if (clientPayload) {
          const { type, size } = JSON.parse(clientPayload);

          if (!ALLOWED_TYPES.includes(type)) {
            throw new Error(`File type not allowed: ${type}`);
          }

          const category = getFileCategory(type);
          const maxSize = MAX_SIZES[category];
          if (size > maxSize) {
            throw new Error(
              `File too large. Maximum size for this type is ${maxSize / 1024 / 1024}MB`
            );
          }
        }

        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_SIZES.video, // 50MB absolute max
          addRandomSuffix: false,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
