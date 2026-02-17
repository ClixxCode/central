import { Section, Text } from '@react-email/components';

interface TaskCardProps {
  title: string;
  status: string;
  dueDate?: string;
  clientName?: string;
  boardName?: string;
}

export function TaskCard({ title, status, dueDate, clientName, boardName }: TaskCardProps) {
  const location = [clientName, boardName].filter(Boolean).join(' / ');

  return (
    <Section
      style={{
        background: '#333338',
        border: '1px solid #42424a',
        borderRadius: '8px',
        padding: '12px',
        margin: '8px 0',
      }}
    >
      <Text style={{ fontWeight: '500', color: '#f5f5f5', margin: '0 0 4px' }}>
        {title}
      </Text>
      <Text style={{ margin: '0' }}>
        <span
          style={{
            background: '#42424a',
            color: '#d0d0d5',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '500',
          }}
        >
          {status}
        </span>
        {dueDate && (
          <span style={{ color: '#a0a0a8', fontSize: '13px', marginLeft: '8px' }}>
            Due: {dueDate}
          </span>
        )}
      </Text>
      {location && (
        <Text style={{ color: '#6b6b74', fontSize: '12px', margin: '4px 0 0' }}>
          {location}
        </Text>
      )}
    </Section>
  );
}
