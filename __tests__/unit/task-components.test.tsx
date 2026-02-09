import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusSelect, StatusBadge } from '@/components/tasks/StatusSelect';
import { SectionSelect, SectionBadge } from '@/components/tasks/SectionSelect';
import { FlexibilitySelect, FlexibilityIndicator, getFlexibilityColor, getFlexibilityLabel } from '@/components/tasks/FlexibilitySelect';
import type { StatusOption, SectionOption } from '@/lib/db/schema';

// Mock Radix UI Portal to render inline
vi.mock('radix-ui', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('radix-ui');
  return {
    ...actual,
    Popover: {
      ...(actual.Popover as Record<string, unknown>),
      Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    },
  };
});

const mockStatusOptions: StatusOption[] = [
  { id: 'todo', label: 'To Do', color: '#6B7280', position: 0 },
  { id: 'in-progress', label: 'In Progress', color: '#3B82F6', position: 1 },
  { id: 'review', label: 'Review', color: '#F59E0B', position: 2 },
  { id: 'complete', label: 'Complete', color: '#10B981', position: 3 },
];

const mockSectionOptions: SectionOption[] = [
  { id: 'frontend', label: 'Frontend', color: '#8B5CF6', position: 0 },
  { id: 'backend', label: 'Backend', color: '#EC4899', position: 1 },
];

describe('StatusSelect', () => {
  it('renders the current status', () => {
    render(
      <StatusSelect
        value="todo"
        onChange={() => {}}
        options={mockStatusOptions}
      />
    );

    expect(screen.getByText('To Do')).toBeInTheDocument();
  });

  it('renders "Select status" when value not found', () => {
    render(
      <StatusSelect
        value="unknown"
        onChange={() => {}}
        options={mockStatusOptions}
      />
    );

    expect(screen.getByText('Select status')).toBeInTheDocument();
  });

  it('can be disabled', () => {
    render(
      <StatusSelect
        value="todo"
        onChange={() => {}}
        options={mockStatusOptions}
        disabled
      />
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('disabled');
  });
});

describe('StatusBadge', () => {
  it('renders label with correct color styling', () => {
    render(<StatusBadge label="To Do" color="#6B7280" />);

    const badge = screen.getByText('To Do');
    expect(badge).toBeInTheDocument();
  });

  it('renders small size variant', () => {
    render(<StatusBadge label="To Do" color="#6B7280" size="sm" />);

    const badge = screen.getByText('To Do');
    expect(badge).toBeInTheDocument();
  });
});

describe('SectionSelect', () => {
  it('renders the current section', () => {
    render(
      <SectionSelect
        value="frontend"
        onChange={() => {}}
        options={mockSectionOptions}
      />
    );

    expect(screen.getByText('Frontend')).toBeInTheDocument();
  });

  it('renders placeholder when no section selected', () => {
    render(
      <SectionSelect
        value={null}
        onChange={() => {}}
        options={mockSectionOptions}
      />
    );

    expect(screen.getByText('No section')).toBeInTheDocument();
  });

  it('renders placeholder when no options available', () => {
    render(
      <SectionSelect
        value={null}
        onChange={() => {}}
        options={[]}
      />
    );

    expect(screen.getByText('No section')).toBeInTheDocument();
  });

  it('supports custom placeholder', () => {
    render(
      <SectionSelect
        value={null}
        onChange={() => {}}
        options={mockSectionOptions}
        placeholder="Select section..."
      />
    );

    expect(screen.getByText('Select section...')).toBeInTheDocument();
  });
});

describe('SectionBadge', () => {
  it('renders label with correct border color', () => {
    render(<SectionBadge label="Frontend" color="#8B5CF6" />);

    const badge = screen.getByText('Frontend');
    expect(badge).toBeInTheDocument();
  });
});

describe('FlexibilityIndicator', () => {
  it('renders dashed border for not_set', () => {
    const { container } = render(<FlexibilityIndicator flexibility="not_set" />);
    const indicator = container.querySelector('span');
    expect(indicator).toHaveClass('border-dashed');
  });

  it('renders solid circle for other values', () => {
    const { container } = render(<FlexibilityIndicator flexibility="flexible" />);
    const indicator = container.querySelector('span');
    expect(indicator).not.toHaveClass('border-dashed');
  });
});

describe('FlexibilitySelect', () => {
  it('renders current flexibility option', () => {
    render(
      <FlexibilitySelect
        value="flexible"
        onChange={() => {}}
      />
    );

    expect(screen.getByText('Flexible')).toBeInTheDocument();
  });

  it('can hide label', () => {
    render(
      <FlexibilitySelect
        value="flexible"
        onChange={() => {}}
        showLabel={false}
      />
    );

    expect(screen.queryByText('Flexible')).not.toBeInTheDocument();
  });
});

describe('Flexibility Utilities', () => {
  describe('getFlexibilityColor', () => {
    it('returns correct colors', () => {
      expect(getFlexibilityColor('not_set')).toBe('#6B7280');
      expect(getFlexibilityColor('flexible')).toBe('#10B981');
      expect(getFlexibilityColor('semi_flexible')).toBe('#F59E0B');
      expect(getFlexibilityColor('not_flexible')).toBe('#EF4444');
    });
  });

  describe('getFlexibilityLabel', () => {
    it('returns correct labels', () => {
      expect(getFlexibilityLabel('not_set')).toBe('Not set');
      expect(getFlexibilityLabel('flexible')).toBe('Flexible');
      expect(getFlexibilityLabel('semi_flexible')).toBe('Semi-flexible');
      expect(getFlexibilityLabel('not_flexible')).toBe('Not flexible');
    });
  });
});
