import { z } from 'zod';

// Metadata schema for flexible client information
export const clientMetadataSchema = z.object({
  industry: z.string().max(100).optional(),
  website: z.string().url().optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  customFields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  leads: z.array(z.object({
    role: z.string().min(1).max(100),
    userId: z.string().uuid(),
  })).max(20).optional(),
  links: z.array(z.object({
    name: z.string().min(1).max(100),
    url: z.string().url(),
    showOnCard: z.boolean().optional(),
  })).max(50).optional(),
  slackChannelUrl: z.string().url().optional().or(z.literal('')),
}).optional();

export const createClientSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be 255 characters or less'),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(255, 'Slug must be 255 characters or less')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format (must be #RRGGBB)')
    .optional()
    .nullable(),
  icon: z.string().max(100).optional().nullable(),
  leadUserId: z.string().uuid().optional().nullable(),
  defaultBoardId: z.string().uuid().optional().nullable(),
  metadata: clientMetadataSchema,
});

export const updateClientSchema = createClientSchema.partial();

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ClientMetadataInput = z.infer<typeof clientMetadataSchema>;

/**
 * Generate a slug from a name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
