import { Section, Text } from '@react-email/components';

interface CommentQuoteProps {
  children: React.ReactNode;
}

export function CommentQuote({ children }: CommentQuoteProps) {
  return (
    <Section
      style={{
        background: '#333338',
        borderLeft: '3px solid #F5303D',
        padding: '12px',
        margin: '16px 0',
        borderRadius: '0 8px 8px 0',
      }}
    >
      <Text style={{ margin: '0', color: '#d0d0d5', fontStyle: 'italic' }}>
        &ldquo;{children}&rdquo;
      </Text>
    </Section>
  );
}
