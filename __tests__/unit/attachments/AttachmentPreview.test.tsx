import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AttachmentPreview, type Attachment } from '@/components/attachments/AttachmentPreview';

// Mock window.open
const mockWindowOpen = vi.fn();
vi.stubGlobal('open', mockWindowOpen);

describe('AttachmentPreview', () => {
  const mockAttachment: Attachment = {
    id: 'att-1',
    filename: 'document.pdf',
    url: 'https://example.com/document.pdf',
    size: 1024 * 1024, // 1MB
    mimeType: 'application/pdf',
  };

  beforeEach(() => {
    mockWindowOpen.mockReset();
  });

  it('renders attachment filename', () => {
    render(<AttachmentPreview attachment={mockAttachment} />);
    expect(screen.getByText('document.pdf')).toBeInTheDocument();
  });

  it('renders file size', () => {
    render(<AttachmentPreview attachment={mockAttachment} />);
    expect(screen.getByText('1 MB')).toBeInTheDocument();
  });

  it('renders correctly for image attachments', () => {
    const imageAttachment: Attachment = {
      id: 'att-2',
      filename: 'photo.jpg',
      url: 'https://example.com/photo.jpg',
      size: 500 * 1024,
      mimeType: 'image/jpeg',
    };
    render(<AttachmentPreview attachment={imageAttachment} />);
    expect(screen.getByText('photo.jpg')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', imageAttachment.url);
  });

  it('shows delete button when showDelete is true', () => {
    const onDelete = vi.fn();
    render(
      <AttachmentPreview
        attachment={mockAttachment}
        showDelete
        onDelete={onDelete}
      />
    );
    expect(screen.getByTitle('Delete')).toBeInTheDocument();
  });

  it('hides delete button when showDelete is false', () => {
    render(<AttachmentPreview attachment={mockAttachment} showDelete={false} />);
    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument();
  });

  it('calls onDelete when delete button is clicked', () => {
    const onDelete = vi.fn();
    render(
      <AttachmentPreview
        attachment={mockAttachment}
        showDelete
        onDelete={onDelete}
      />
    );
    fireEvent.click(screen.getByTitle('Delete'));
    expect(onDelete).toHaveBeenCalledWith('att-1');
  });

  it('opens file in new tab when external link is clicked', () => {
    render(<AttachmentPreview attachment={mockAttachment} />);
    fireEvent.click(screen.getByTitle('Open in new tab'));
    expect(mockWindowOpen).toHaveBeenCalledWith(mockAttachment.url, '_blank');
  });

  it('renders download link', () => {
    render(<AttachmentPreview attachment={mockAttachment} />);
    const downloadLink = screen.getByTitle('Download');
    expect(downloadLink).toHaveAttribute('href', mockAttachment.url);
    expect(downloadLink).toHaveAttribute('download', 'document.pdf');
  });

  it('handles missing size gracefully', () => {
    const attachmentNoSize: Attachment = {
      id: 'att-3',
      filename: 'file.txt',
      url: 'https://example.com/file.txt',
      mimeType: 'text/plain',
    };
    render(<AttachmentPreview attachment={attachmentNoSize} />);
    expect(screen.getByText('file.txt')).toBeInTheDocument();
  });

  it('handles missing mimeType gracefully', () => {
    const attachmentNoMime: Attachment = {
      id: 'att-4',
      filename: 'unknown-file',
      url: 'https://example.com/unknown-file',
    };
    render(<AttachmentPreview attachment={attachmentNoMime} />);
    expect(screen.getByText('unknown-file')).toBeInTheDocument();
  });
});
