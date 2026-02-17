import { Button } from '@react-email/components';

interface EmailButtonProps {
  href: string;
  children: React.ReactNode;
}

export function EmailButton({ href, children }: EmailButtonProps) {
  return (
    <Button
      href={href}
      style={{
        display: 'inline-block',
        background: '#f5f5f5',
        color: '#1a1a1f',
        padding: '12px 24px',
        textDecoration: 'none',
        borderRadius: '8px',
        fontWeight: '600',
        fontSize: '14px',
      }}
    >
      {children}
    </Button>
  );
}
