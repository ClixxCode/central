import { Section, Text } from '@react-email/components';

interface CommentQuoteProps {
  children: React.ReactNode;
}

export function CommentQuote({ children }: CommentQuoteProps) {
  return (
    <Section
      className="email-panel"
      style={{
        background: '#f7f7f8',
        borderLeft: '3px solid #F5303D',
        padding: '12px',
        margin: '16px 0',
        borderRadius: '0 8px 8px 0',
      }}
    >
      <Text className="email-text" style={{ margin: '0', color: '#3f3f46', fontStyle: 'italic' }}>
        &ldquo;{children}&rdquo;
      </Text>
    </Section>
  );
}
