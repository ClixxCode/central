import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MentionList, type MentionUser } from '@/components/editor/MentionList';

describe('MentionList', () => {
  const mockUsers: MentionUser[] = [
    {
      id: 'user-1',
      name: 'Alice Johnson',
      email: 'alice@example.com',
      avatarUrl: 'https://example.com/alice.jpg',
    },
    {
      id: 'user-2',
      name: 'Bob Smith',
      email: 'bob@example.com',
      avatarUrl: null,
    },
    {
      id: 'user-3',
      name: null,
      email: 'charlie@example.com',
      avatarUrl: null,
    },
  ];

  it('renders empty state when items is empty', () => {
    render(
      <MentionList items={[]} selectedIndex={0} onSelect={vi.fn()} />
    );
    expect(screen.getByText('No users found')).toBeInTheDocument();
  });

  it('renders all users', () => {
    render(
      <MentionList items={mockUsers} selectedIndex={0} onSelect={vi.fn()} />
    );
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    // User without name shows email prefix
    expect(screen.getByText('charlie')).toBeInTheDocument();
  });

  it('shows email as subtitle for users with names', () => {
    render(
      <MentionList items={mockUsers} selectedIndex={0} onSelect={vi.fn()} />
    );
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
  });

  it('does not show email subtitle for users without names', () => {
    render(
      <MentionList items={[mockUsers[2]]} selectedIndex={0} onSelect={vi.fn()} />
    );
    // Email should not appear as subtitle since it's used as main display
    const emailElements = screen.getAllByText(/charlie/);
    expect(emailElements).toHaveLength(1);
  });

  it('highlights selected user', () => {
    render(
      <MentionList items={mockUsers} selectedIndex={1} onSelect={vi.fn()} />
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons[1]).toHaveClass('bg-accent');
  });

  it('calls onSelect when user is clicked', () => {
    const onSelect = vi.fn();
    render(
      <MentionList items={mockUsers} selectedIndex={0} onSelect={onSelect} />
    );
    fireEvent.click(screen.getByText('Bob Smith'));
    expect(onSelect).toHaveBeenCalledWith(mockUsers[1]);
  });

  it('renders avatar component for user with avatarUrl', () => {
    const { container } = render(
      <MentionList items={mockUsers} selectedIndex={0} onSelect={vi.fn()} />
    );
    // Avatar component renders with data-slot="avatar"
    // In JSDOM, image doesn't load so fallback is shown, but avatar wrapper exists
    const avatars = container.querySelectorAll('[data-slot="avatar"]');
    expect(avatars).toHaveLength(3); // One avatar per user
  });

  it('renders avatar fallback with initials', () => {
    // Bob Smith has no avatar URL, should show initials
    render(
      <MentionList items={[mockUsers[1]]} selectedIndex={0} onSelect={vi.fn()} />
    );
    // The fallback should show "BS" for Bob Smith
    expect(screen.getByText('BS')).toBeInTheDocument();
  });

  it('applies custom style', () => {
    const { container } = render(
      <MentionList
        items={mockUsers}
        selectedIndex={0}
        onSelect={vi.fn()}
        style={{ left: '100px', top: '200px' }}
      />
    );
    expect(container.firstChild).toHaveStyle({ left: '100px', top: '200px' });
  });

  it('applies custom className', () => {
    const { container } = render(
      <MentionList
        items={mockUsers}
        selectedIndex={0}
        onSelect={vi.fn()}
        className="custom-mention-class"
      />
    );
    expect(container.firstChild).toHaveClass('custom-mention-class');
  });

  it('handles user with email-only name correctly', () => {
    const emailOnlyUser: MentionUser = {
      id: 'user-email',
      name: null,
      email: 'test.user@example.com',
      avatarUrl: null,
    };
    render(
      <MentionList items={[emailOnlyUser]} selectedIndex={0} onSelect={vi.fn()} />
    );
    // Should show email prefix as display name
    expect(screen.getByText('test.user')).toBeInTheDocument();
    // Should show initials from email
    expect(screen.getByText('TE')).toBeInTheDocument();
  });
});
