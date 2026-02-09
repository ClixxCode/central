import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AttachmentList } from '@/components/attachments/AttachmentList';
import type { Attachment } from '@/components/attachments/AttachmentPreview';

// Mock window.open
vi.stubGlobal('open', vi.fn());

describe('AttachmentList', () => {
  const mockAttachments: Attachment[] = [
    {
      id: 'att-1',
      filename: 'document.pdf',
      url: 'https://example.com/document.pdf',
      size: 1024 * 1024,
      mimeType: 'application/pdf',
    },
    {
      id: 'att-2',
      filename: 'image.png',
      url: 'https://example.com/image.png',
      size: 500 * 1024,
      mimeType: 'image/png',
    },
    {
      id: 'att-3',
      filename: 'spreadsheet.xlsx',
      url: 'https://example.com/spreadsheet.xlsx',
      size: 2 * 1024 * 1024,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  ];

  it('renders all attachments', () => {
    render(<AttachmentList attachments={mockAttachments} />);
    expect(screen.getByText('document.pdf')).toBeInTheDocument();
    expect(screen.getByText('image.png')).toBeInTheDocument();
    expect(screen.getByText('spreadsheet.xlsx')).toBeInTheDocument();
  });

  it('renders empty state when no attachments', () => {
    render(<AttachmentList attachments={[]} />);
    expect(screen.getByText('No attachments')).toBeInTheDocument();
  });

  it('renders custom empty message', () => {
    render(
      <AttachmentList
        attachments={[]}
        emptyMessage="Upload files to get started"
      />
    );
    expect(screen.getByText('Upload files to get started')).toBeInTheDocument();
  });

  it('passes showDelete prop to AttachmentPreview components', () => {
    const onDelete = vi.fn();
    render(
      <AttachmentList
        attachments={mockAttachments}
        showDelete
        onDelete={onDelete}
      />
    );
    // Each attachment should have a delete button
    const deleteButtons = screen.getAllByTitle('Delete');
    expect(deleteButtons).toHaveLength(3);
  });

  it('calls onDelete with correct attachment id', () => {
    const onDelete = vi.fn();
    render(
      <AttachmentList
        attachments={mockAttachments}
        showDelete
        onDelete={onDelete}
      />
    );
    const deleteButtons = screen.getAllByTitle('Delete');
    fireEvent.click(deleteButtons[1]); // Click delete on second attachment
    expect(onDelete).toHaveBeenCalledWith('att-2');
  });

  it('renders in list layout by default', () => {
    const { container } = render(<AttachmentList attachments={mockAttachments} />);
    const listContainer = container.querySelector('.flex.flex-col');
    expect(listContainer).toBeInTheDocument();
  });

  it('renders in grid layout when specified', () => {
    const { container } = render(
      <AttachmentList attachments={mockAttachments} layout="grid" />
    );
    const gridContainer = container.querySelector('.grid');
    expect(gridContainer).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <AttachmentList
        attachments={mockAttachments}
        className="custom-class"
      />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('does not show delete buttons when showDelete is false', () => {
    render(<AttachmentList attachments={mockAttachments} showDelete={false} />);
    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument();
  });
});
