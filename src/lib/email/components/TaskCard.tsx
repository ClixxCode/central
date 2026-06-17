import { Section, Text } from '@react-email/components';

interface TaskCardProps {
  title: string;
  status: string;
  statusColor?: string;
  statusBackgroundColor?: string;
  dueDate?: string;
  clientName?: string;
  boardName?: string;
}

export function TaskCard({
  title,
  status,
  statusColor = '#6B7280',
  statusBackgroundColor = 'rgba(107, 114, 128, 0.12)',
  dueDate,
  clientName,
  boardName,
}: TaskCardProps) {
  const location = [clientName, boardName].filter(Boolean).join(' / ');

  return (
    <Section
      className="email-panel"
      style={{
        background: '#f7f7f8',
        border: '1px solid #e4e4e7',
        borderRadius: '8px',
        padding: '12px',
        margin: '8px 0',
      }}
    >
      <Text className="email-heading" style={{ fontWeight: '500', color: '#18181b', margin: '0 0 4px' }}>
        {title}
      </Text>
      <Text style={{ margin: '0' }}>
        <span
          className="email-status-pill"
          style={{
            background: statusBackgroundColor,
            color: statusColor,
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '500',
          }}
        >
          <span
            style={{
              background: statusColor,
              borderRadius: '999px',
              display: 'inline-block',
              height: '6px',
              marginRight: '6px',
              verticalAlign: '1px',
              width: '6px',
            }}
          />
          {status}
        </span>
        {dueDate && (
          <span className="email-muted" style={{ color: '#71717a', fontSize: '13px', marginLeft: '8px' }}>
            Due: {dueDate}
          </span>
        )}
      </Text>
      {location && (
        <Text className="email-subtle" style={{ color: '#71717a', fontSize: '12px', margin: '4px 0 0' }}>
          {location}
        </Text>
      )}
    </Section>
  );
}
