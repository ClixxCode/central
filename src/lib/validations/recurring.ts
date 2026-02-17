import { z } from 'zod';

/**
 * Recurring frequency options
 */
export const recurringFrequencySchema = z.enum([
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'yearly',
]);

export type RecurringFrequency = z.infer<typeof recurringFrequencySchema>;

/**
 * Day of week (0 = Sunday, 6 = Saturday)
 */
export const dayOfWeekSchema = z.number().int().min(0).max(6);

/**
 * RecurringConfig validation schema
 * Validates the configuration for recurring tasks
 */
export const recurringConfigSchema = z
  .object({
    frequency: recurringFrequencySchema,
    interval: z.number().int().min(1).max(99),
    daysOfWeek: z.array(dayOfWeekSchema).optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    monthlyPattern: z.enum(['dayOfMonth', 'dayOfWeek']).optional(),
    weekOfMonth: z.number().int().refine((v) => [1, 2, 3, 4, -1].includes(v), {
      message: 'Must be 1-4 or -1 (last)',
    }).optional(),
    monthlyDayOfWeek: dayOfWeekSchema.optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
      .optional(),
    endAfterOccurrences: z.number().int().min(1).max(999).optional(),
  })
  .refine(
    (data) => {
      // For weekly/biweekly, require daysOfWeek with at least one day
      if (data.frequency === 'weekly' || data.frequency === 'biweekly') {
        return data.daysOfWeek && data.daysOfWeek.length > 0;
      }
      return true;
    },
    {
      message: 'Days of week required for weekly/biweekly frequency',
      path: ['daysOfWeek'],
    }
  )
  .refine(
    (data) => {
      // For dayOfWeek monthly pattern, require weekOfMonth and monthlyDayOfWeek
      if (data.monthlyPattern === 'dayOfWeek') {
        return data.weekOfMonth !== undefined && data.monthlyDayOfWeek !== undefined;
      }
      return true;
    },
    {
      message: 'Week of month and day of week required for day-of-week monthly pattern',
      path: ['weekOfMonth'],
    }
  )
  .refine(
    (data) => {
      // Cannot have both endDate and endAfterOccurrences
      if (data.endDate && data.endAfterOccurrences) {
        return false;
      }
      return true;
    },
    {
      message: 'Cannot set both end date and occurrence limit',
      path: ['endDate'],
    }
  );

export type RecurringConfigInput = z.infer<typeof recurringConfigSchema>;

/**
 * Validate a RecurringConfig object
 * @returns Validated config or null if invalid
 */
export function validateRecurringConfig(
  config: unknown
): RecurringConfigInput | null {
  const result = recurringConfigSchema.safeParse(config);
  return result.success ? result.data : null;
}
