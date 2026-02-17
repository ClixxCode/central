import { describe, it, expect } from 'vitest';
import {
  calculateNextOccurrence,
  shouldGenerateNextOccurrence,
  getRecurrenceDescription,
  getRecurringLabel,
  getNthWeekdayOfMonth,
} from '@/lib/utils/recurring';
import {
  recurringConfigSchema,
  validateRecurringConfig,
} from '@/lib/validations/recurring';
import type { RecurringConfig } from '@/lib/db/schema/tasks';

describe('calculateNextOccurrence', () => {
  // Use a fixed "today" date for tests to ensure consistent results
  const testToday = new Date('2024-01-15T00:00:00Z');

  describe('daily frequency', () => {
    it('calculates next daily occurrence with interval 1', () => {
      const config: RecurringConfig = { frequency: 'daily', interval: 1 };
      const result = calculateNextOccurrence(config, '2024-01-15', testToday);
      expect(result).toBe('2024-01-16');
    });

    it('calculates next daily occurrence with interval 3', () => {
      const config: RecurringConfig = { frequency: 'daily', interval: 3 };
      const result = calculateNextOccurrence(config, '2024-01-15', testToday);
      expect(result).toBe('2024-01-18');
    });

    it('handles year boundary', () => {
      const config: RecurringConfig = { frequency: 'daily', interval: 1 };
      const result = calculateNextOccurrence(
        config,
        '2024-12-31',
        new Date('2024-12-31')
      );
      expect(result).toBe('2025-01-01');
    });
  });

  describe('weekly frequency', () => {
    it('calculates next weekly occurrence on same day', () => {
      const config: RecurringConfig = {
        frequency: 'weekly',
        interval: 1,
        daysOfWeek: [1], // Monday
      };
      // 2024-01-15 is a Monday
      const result = calculateNextOccurrence(config, '2024-01-15', testToday);
      expect(result).toBe('2024-01-22'); // Next Monday
    });

    it('calculates next occurrence on next selected day in same week', () => {
      const config: RecurringConfig = {
        frequency: 'weekly',
        interval: 1,
        daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
      };
      // 2024-01-15 is a Monday
      const result = calculateNextOccurrence(config, '2024-01-15', testToday);
      expect(result).toBe('2024-01-17'); // Wednesday
    });

    it('wraps to next week when past all selected days', () => {
      const config: RecurringConfig = {
        frequency: 'weekly',
        interval: 1,
        daysOfWeek: [1], // Monday only
      };
      // 2024-01-17 is a Wednesday
      const result = calculateNextOccurrence(
        config,
        '2024-01-17',
        new Date('2024-01-17')
      );
      expect(result).toBe('2024-01-22'); // Next Monday
    });

    it('handles biweekly interval', () => {
      const config: RecurringConfig = {
        frequency: 'weekly',
        interval: 2,
        daysOfWeek: [1], // Monday
      };
      // 2024-01-15 is a Monday
      const result = calculateNextOccurrence(config, '2024-01-15', testToday);
      expect(result).toBe('2024-01-29'); // Two weeks later
    });
  });

  describe('biweekly frequency', () => {
    it('calculates next biweekly occurrence', () => {
      const config: RecurringConfig = {
        frequency: 'biweekly',
        interval: 1,
        daysOfWeek: [1], // Monday
      };
      // 2024-01-15 is a Monday
      const result = calculateNextOccurrence(config, '2024-01-15', testToday);
      expect(result).toBe('2024-01-29'); // Two weeks later
    });
  });

  describe('monthly frequency', () => {
    it('calculates next monthly occurrence', () => {
      const config: RecurringConfig = {
        frequency: 'monthly',
        interval: 1,
        dayOfMonth: 15,
      };
      const result = calculateNextOccurrence(config, '2024-01-15', testToday);
      expect(result).toBe('2024-02-15');
    });

    it('handles month with fewer days (31st -> 29th in Feb leap year)', () => {
      const config: RecurringConfig = {
        frequency: 'monthly',
        interval: 1,
        dayOfMonth: 31,
      };
      const result = calculateNextOccurrence(
        config,
        '2024-01-31',
        new Date('2024-01-31')
      );
      expect(result).toBe('2024-02-29'); // 2024 is a leap year
    });

    it('handles non-leap year February (31st -> 28th)', () => {
      const config: RecurringConfig = {
        frequency: 'monthly',
        interval: 1,
        dayOfMonth: 31,
      };
      const result = calculateNextOccurrence(
        config,
        '2023-01-31',
        new Date('2023-01-31')
      );
      expect(result).toBe('2023-02-28');
    });

    it('handles interval > 1', () => {
      const config: RecurringConfig = {
        frequency: 'monthly',
        interval: 3,
        dayOfMonth: 15,
      };
      const result = calculateNextOccurrence(config, '2024-01-15', testToday);
      expect(result).toBe('2024-04-15');
    });
  });

  describe('quarterly frequency', () => {
    it('calculates next quarterly occurrence', () => {
      const config: RecurringConfig = {
        frequency: 'quarterly',
        interval: 1,
        dayOfMonth: 15,
      };
      const result = calculateNextOccurrence(config, '2024-01-15', testToday);
      expect(result).toBe('2024-04-15');
    });

    it('handles end of quarter boundary', () => {
      const config: RecurringConfig = {
        frequency: 'quarterly',
        interval: 1,
        dayOfMonth: 31,
      };
      // Jan 31 -> Apr 30 (April has 30 days)
      const result = calculateNextOccurrence(
        config,
        '2024-01-31',
        new Date('2024-01-31')
      );
      expect(result).toBe('2024-04-30');
    });
  });

  describe('yearly frequency', () => {
    it('calculates next yearly occurrence', () => {
      const config: RecurringConfig = { frequency: 'yearly', interval: 1 };
      const result = calculateNextOccurrence(config, '2024-01-15', testToday);
      expect(result).toBe('2025-01-15');
    });

    it('handles leap year to non-leap year (Feb 29 -> Feb 28)', () => {
      const config: RecurringConfig = { frequency: 'yearly', interval: 1 };
      const result = calculateNextOccurrence(
        config,
        '2024-02-29',
        new Date('2024-02-29')
      );
      expect(result).toBe('2025-02-28');
    });

    it('handles interval > 1', () => {
      const config: RecurringConfig = { frequency: 'yearly', interval: 2 };
      const result = calculateNextOccurrence(config, '2024-01-15', testToday);
      expect(result).toBe('2026-01-15');
    });
  });

  describe('end conditions', () => {
    it('returns null when end date has passed', () => {
      const config: RecurringConfig = {
        frequency: 'daily',
        interval: 1,
        endDate: '2024-01-15',
      };
      const result = calculateNextOccurrence(
        config,
        '2024-01-15',
        new Date('2024-01-20')
      );
      expect(result).toBe(null);
    });

    it('returns date when end date not yet reached', () => {
      const config: RecurringConfig = {
        frequency: 'daily',
        interval: 1,
        endDate: '2024-01-20',
      };
      const result = calculateNextOccurrence(
        config,
        '2024-01-15',
        new Date('2024-01-15')
      );
      expect(result).toBe('2024-01-16');
    });

    it('returns null when next occurrence would exceed end date', () => {
      const config: RecurringConfig = {
        frequency: 'monthly',
        interval: 1,
        endDate: '2024-01-31',
        dayOfMonth: 15,
      };
      const result = calculateNextOccurrence(
        config,
        '2024-01-15',
        new Date('2024-01-16')
      );
      expect(result).toBe(null); // Feb 15 > Jan 31
    });
  });
});

describe('shouldGenerateNextOccurrence', () => {
  it('returns true when no limits set', () => {
    const config: RecurringConfig = { frequency: 'daily', interval: 1 };
    expect(shouldGenerateNextOccurrence(config, 5)).toBe(true);
    expect(shouldGenerateNextOccurrence(config, 100)).toBe(true);
  });

  it('returns false when occurrence limit reached', () => {
    const config: RecurringConfig = {
      frequency: 'daily',
      interval: 1,
      endAfterOccurrences: 5,
    };
    expect(shouldGenerateNextOccurrence(config, 4)).toBe(true);
    expect(shouldGenerateNextOccurrence(config, 5)).toBe(false);
    expect(shouldGenerateNextOccurrence(config, 6)).toBe(false);
  });

  it('returns false when end date has passed', () => {
    // Use a date that is definitely in the past
    const config: RecurringConfig = {
      frequency: 'daily',
      interval: 1,
      endDate: '2020-01-01',
    };
    expect(shouldGenerateNextOccurrence(config, 1)).toBe(false);
  });

  it('returns true when end date is in the future', () => {
    // Use a date that is definitely in the future
    const config: RecurringConfig = {
      frequency: 'daily',
      interval: 1,
      endDate: '2099-12-31',
    };
    expect(shouldGenerateNextOccurrence(config, 1)).toBe(true);
  });
});

describe('getRecurrenceDescription', () => {
  it('describes daily recurrence', () => {
    expect(
      getRecurrenceDescription({ frequency: 'daily', interval: 1 })
    ).toBe('Every day');
    expect(
      getRecurrenceDescription({ frequency: 'daily', interval: 3 })
    ).toBe('Every 3 days');
  });

  it('describes weekly recurrence with days', () => {
    expect(
      getRecurrenceDescription({
        frequency: 'weekly',
        interval: 1,
        daysOfWeek: [1, 3, 5],
      })
    ).toBe('Weekly on Mon, Wed, Fri');
  });

  it('describes weekly recurrence without specific days', () => {
    expect(
      getRecurrenceDescription({ frequency: 'weekly', interval: 1 })
    ).toBe('Weekly');
    expect(
      getRecurrenceDescription({ frequency: 'weekly', interval: 2 })
    ).toBe('Every 2 weeks');
  });

  it('describes biweekly recurrence', () => {
    expect(
      getRecurrenceDescription({
        frequency: 'biweekly',
        interval: 1,
        daysOfWeek: [1],
      })
    ).toBe('Every 2 weeks on Mon');
  });

  it('describes monthly recurrence with day of month', () => {
    expect(
      getRecurrenceDescription({
        frequency: 'monthly',
        interval: 1,
        dayOfMonth: 15,
      })
    ).toBe('Monthly on the 15th');
  });

  it('describes quarterly recurrence', () => {
    expect(
      getRecurrenceDescription({ frequency: 'quarterly', interval: 1 })
    ).toBe('Quarterly');
  });

  it('describes yearly recurrence', () => {
    expect(
      getRecurrenceDescription({ frequency: 'yearly', interval: 1 })
    ).toBe('Yearly');
    expect(
      getRecurrenceDescription({ frequency: 'yearly', interval: 2 })
    ).toBe('Every 2 years');
  });

  it('includes end date in description', () => {
    expect(
      getRecurrenceDescription({
        frequency: 'daily',
        interval: 1,
        endDate: '2024-12-31',
      })
    ).toBe('Every day until Dec 31, 2024');
  });

  it('includes occurrence limit in description', () => {
    expect(
      getRecurrenceDescription({
        frequency: 'weekly',
        interval: 1,
        endAfterOccurrences: 10,
      })
    ).toBe('Weekly, 10 times');
  });
});

describe('getRecurringLabel', () => {
  it('returns simple labels for interval 1', () => {
    expect(getRecurringLabel({ frequency: 'daily', interval: 1 })).toBe('Daily');
    expect(getRecurringLabel({ frequency: 'weekly', interval: 1 })).toBe('Weekly');
    expect(getRecurringLabel({ frequency: 'monthly', interval: 1 })).toBe('Monthly');
    expect(getRecurringLabel({ frequency: 'yearly', interval: 1 })).toBe('Yearly');
  });

  it('returns detailed labels for interval > 1', () => {
    expect(getRecurringLabel({ frequency: 'daily', interval: 3 })).toBe(
      'Every 3 days'
    );
    expect(getRecurringLabel({ frequency: 'weekly', interval: 2 })).toBe(
      'Every 2 weeks'
    );
    expect(getRecurringLabel({ frequency: 'monthly', interval: 6 })).toBe(
      'Every 6 months'
    );
  });

  it('includes day-of-week pattern in monthly label', () => {
    expect(
      getRecurringLabel({
        frequency: 'monthly',
        interval: 1,
        monthlyPattern: 'dayOfWeek',
        weekOfMonth: -1,
        monthlyDayOfWeek: 5,
      })
    ).toBe('Monthly on last Fri');
    expect(
      getRecurringLabel({
        frequency: 'monthly',
        interval: 2,
        monthlyPattern: 'dayOfWeek',
        weekOfMonth: 2,
        monthlyDayOfWeek: 1,
      })
    ).toBe('Every 2 months on 2nd Mon');
    expect(
      getRecurringLabel({
        frequency: 'quarterly',
        interval: 1,
        monthlyPattern: 'dayOfWeek',
        weekOfMonth: 3,
        monthlyDayOfWeek: 3,
      })
    ).toBe('Quarterly on 3rd Wed');
  });
});

describe('recurringConfigSchema validation', () => {
  it('validates valid daily config', () => {
    const result = recurringConfigSchema.safeParse({
      frequency: 'daily',
      interval: 1,
    });
    expect(result.success).toBe(true);
  });

  it('validates valid weekly config with days', () => {
    const result = recurringConfigSchema.safeParse({
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [1, 3, 5],
    });
    expect(result.success).toBe(true);
  });

  it('rejects weekly config without days', () => {
    const result = recurringConfigSchema.safeParse({
      frequency: 'weekly',
      interval: 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects biweekly config without days', () => {
    const result = recurringConfigSchema.safeParse({
      frequency: 'biweekly',
      interval: 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects both endDate and endAfterOccurrences', () => {
    const result = recurringConfigSchema.safeParse({
      frequency: 'daily',
      interval: 1,
      endDate: '2024-12-31',
      endAfterOccurrences: 10,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid frequency', () => {
    const result = recurringConfigSchema.safeParse({
      frequency: 'invalid',
      interval: 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects interval less than 1', () => {
    const result = recurringConfigSchema.safeParse({
      frequency: 'daily',
      interval: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects interval greater than 99', () => {
    const result = recurringConfigSchema.safeParse({
      frequency: 'daily',
      interval: 100,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid day of week', () => {
    const result = recurringConfigSchema.safeParse({
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [7], // Invalid: must be 0-6
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid endDate format', () => {
    const result = recurringConfigSchema.safeParse({
      frequency: 'daily',
      interval: 1,
      endDate: '2024/12/31', // Wrong format
    });
    expect(result.success).toBe(false);
  });
});

describe('validateRecurringConfig', () => {
  it('returns config for valid input', () => {
    const config = { frequency: 'daily', interval: 1 };
    const result = validateRecurringConfig(config);
    expect(result).toEqual(config);
  });

  it('returns null for invalid input', () => {
    const config = { frequency: 'invalid', interval: 1 };
    const result = validateRecurringConfig(config);
    expect(result).toBe(null);
  });

  it('validates monthly dayOfWeek config', () => {
    const config = {
      frequency: 'monthly',
      interval: 1,
      monthlyPattern: 'dayOfWeek',
      weekOfMonth: -1,
      monthlyDayOfWeek: 2,
    };
    const result = validateRecurringConfig(config);
    expect(result).toEqual(config);
  });

  it('rejects dayOfWeek pattern without weekOfMonth', () => {
    const config = {
      frequency: 'monthly',
      interval: 1,
      monthlyPattern: 'dayOfWeek',
      monthlyDayOfWeek: 2,
    };
    const result = validateRecurringConfig(config);
    expect(result).toBe(null);
  });

  it('rejects dayOfWeek pattern without monthlyDayOfWeek', () => {
    const config = {
      frequency: 'monthly',
      interval: 1,
      monthlyPattern: 'dayOfWeek',
      weekOfMonth: 2,
    };
    const result = validateRecurringConfig(config);
    expect(result).toBe(null);
  });

  it('rejects invalid weekOfMonth value', () => {
    const result = recurringConfigSchema.safeParse({
      frequency: 'monthly',
      interval: 1,
      monthlyPattern: 'dayOfWeek',
      weekOfMonth: 5,
      monthlyDayOfWeek: 2,
    });
    expect(result.success).toBe(false);
  });
});

describe('getNthWeekdayOfMonth', () => {
  it('finds the 1st Monday of January 2024', () => {
    const result = getNthWeekdayOfMonth(2024, 0, 1, 1); // Jan 2024, 1st Monday
    expect(result.getDate()).toBe(1); // Jan 1, 2024 is a Monday
  });

  it('finds the 2nd Friday of January 2024', () => {
    const result = getNthWeekdayOfMonth(2024, 0, 2, 5); // Jan 2024, 2nd Friday
    expect(result.getDate()).toBe(12);
  });

  it('finds the 3rd Wednesday of February 2024', () => {
    const result = getNthWeekdayOfMonth(2024, 1, 3, 3); // Feb 2024, 3rd Wednesday
    expect(result.getDate()).toBe(21);
  });

  it('finds the last Tuesday of January 2024', () => {
    const result = getNthWeekdayOfMonth(2024, 0, -1, 2); // Jan 2024, last Tuesday
    expect(result.getDate()).toBe(30);
  });

  it('finds the last Friday of February 2024 (leap year)', () => {
    const result = getNthWeekdayOfMonth(2024, 1, -1, 5); // Feb 2024, last Friday
    expect(result.getDate()).toBe(23);
  });

  it('finds the 4th Sunday of March 2024', () => {
    const result = getNthWeekdayOfMonth(2024, 2, 4, 0); // Mar 2024, 4th Sunday
    expect(result.getDate()).toBe(24);
  });
});

describe('calculateNextOccurrence with monthlyPattern dayOfWeek', () => {
  it('calculates next monthly occurrence on last Tuesday', () => {
    const config: RecurringConfig = {
      frequency: 'monthly',
      interval: 1,
      monthlyPattern: 'dayOfWeek',
      weekOfMonth: -1,
      monthlyDayOfWeek: 2, // Tuesday
    };
    // Jan 30 2024 is the last Tuesday of January
    const result = calculateNextOccurrence(
      config,
      '2024-01-30',
      new Date('2024-01-30')
    );
    // Last Tuesday of February 2024 = Feb 27
    expect(result).toBe('2024-02-27');
  });

  it('calculates next monthly occurrence on 2nd Friday', () => {
    const config: RecurringConfig = {
      frequency: 'monthly',
      interval: 1,
      monthlyPattern: 'dayOfWeek',
      weekOfMonth: 2,
      monthlyDayOfWeek: 5, // Friday
    };
    // 2nd Friday of Jan 2024 = Jan 12
    const result = calculateNextOccurrence(
      config,
      '2024-01-12',
      new Date('2024-01-12')
    );
    // 2nd Friday of Feb 2024 = Feb 9
    expect(result).toBe('2024-02-09');
  });

  it('calculates quarterly occurrence on 1st Monday', () => {
    const config: RecurringConfig = {
      frequency: 'quarterly',
      interval: 1,
      monthlyPattern: 'dayOfWeek',
      weekOfMonth: 1,
      monthlyDayOfWeek: 1, // Monday
    };
    // 1st Monday of Jan 2024 = Jan 1
    const result = calculateNextOccurrence(
      config,
      '2024-01-01',
      new Date('2024-01-01')
    );
    // 1st Monday of Apr 2024 = Apr 1
    expect(result).toBe('2024-04-01');
  });

  it('handles interval > 1 with dayOfWeek pattern', () => {
    const config: RecurringConfig = {
      frequency: 'monthly',
      interval: 2,
      monthlyPattern: 'dayOfWeek',
      weekOfMonth: 3,
      monthlyDayOfWeek: 3, // Wednesday
    };
    // 3rd Wednesday of Jan 2024 = Jan 17
    const result = calculateNextOccurrence(
      config,
      '2024-01-17',
      new Date('2024-01-17')
    );
    // 3rd Wednesday of Mar 2024 = Mar 20
    expect(result).toBe('2024-03-20');
  });
});

describe('getRecurrenceDescription with dayOfWeek pattern', () => {
  it('describes monthly on last Tuesday', () => {
    expect(
      getRecurrenceDescription({
        frequency: 'monthly',
        interval: 1,
        monthlyPattern: 'dayOfWeek',
        weekOfMonth: -1,
        monthlyDayOfWeek: 2,
      })
    ).toBe('Monthly on the last Tuesday');
  });

  it('describes monthly on 2nd Friday', () => {
    expect(
      getRecurrenceDescription({
        frequency: 'monthly',
        interval: 1,
        monthlyPattern: 'dayOfWeek',
        weekOfMonth: 2,
        monthlyDayOfWeek: 5,
      })
    ).toBe('Monthly on the 2nd Friday');
  });

  it('describes every 2 months on 1st Monday', () => {
    expect(
      getRecurrenceDescription({
        frequency: 'monthly',
        interval: 2,
        monthlyPattern: 'dayOfWeek',
        weekOfMonth: 1,
        monthlyDayOfWeek: 1,
      })
    ).toBe('Every 2 months on the 1st Monday');
  });

  it('describes quarterly on 3rd Wednesday', () => {
    expect(
      getRecurrenceDescription({
        frequency: 'quarterly',
        interval: 1,
        monthlyPattern: 'dayOfWeek',
        weekOfMonth: 3,
        monthlyDayOfWeek: 3,
      })
    ).toBe('Quarterly on the 3rd Wednesday');
  });
});
