import { describe, expect, it } from 'vitest';
import {
  createSavedViewSchema,
  savedViewFiltersSchema,
  savedViewPresentationSchema,
} from '@/lib/validations/saved-view';

const boardId = '11111111-1111-4111-8111-111111111111';
const presentation = {
  layout: 'swimlane' as const,
  sort: { field: 'position' as const, direction: 'asc' as const },
  tableColumns: {
    title: true,
    status: true,
    section: true,
    assignees: true,
    dueDate: true,
    source: true,
  },
  cardFields: { section: true, dueDate: true, assignees: true },
};

describe('Saved View validation', () => {
  it('accepts a complete saved view definition', () => {
    const result = createSavedViewSchema.safeParse({
      name: 'Weekly delivery',
      sourceBoardIds: [boardId],
      filters: {
        statusLabels: ['In Progress'],
        statusMode: 'is',
        assigneeIds: ['22222222-2222-4222-8222-222222222222'],
        overdue: true,
      },
      presentation,
      reviewModeEnabled: true,
    });
    expect(result.success).toBe(true);
  });

  it('requires a name and at least one board', () => {
    const result = createSavedViewSchema.safeParse({
      name: ' ', sourceBoardIds: [], filters: {}, presentation, reviewModeEnabled: false,
    });
    expect(result.success).toBe(false);
  });

  it('persists semantic status and section labels', () => {
    const result = savedViewFiltersSchema.parse({
      statusLabels: ['To Do'],
      sectionLabels: ['This Week'],
      includeNoSection: true,
      sectionMode: 'is_not',
    });
    expect(result.statusLabels).toEqual(['To Do']);
    expect(result.includeNoSection).toBe(true);
  });

  it('prevents hiding every table column', () => {
    const result = savedViewPresentationSchema.safeParse({
      ...presentation,
      tableColumns: Object.fromEntries(Object.keys(presentation.tableColumns).map((key) => [key, false])),
    });
    expect(result.success).toBe(false);
  });
});
