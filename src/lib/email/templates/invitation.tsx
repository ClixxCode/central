import { Text, Section, Link } from '@react-email/components';
import { render } from '@react-email/render';
import { EmailLayout, EmailButton } from '../components';

function InvitationEmail({
  inviterName,
  inviteUrl,
}: {
  inviterName: string;
  inviteUrl: string;
}) {
  return (
    <EmailLayout preheader={`${inviterName} has invited you to join Central`}>
      <Text style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 'bold', color: '#f5f5f5' }}>
        You&apos;re invited!
      </Text>
      <Text style={{ margin: '0 0 16px', color: '#d0d0d5' }}>
        {inviterName} has invited you to join Central.
      </Text>
      <Text style={{ margin: '0 0 24px', color: '#d0d0d5' }}>
        Click the button below to create your account and get started:
      </Text>
      <Section style={{ margin: '0 0 24px', textAlign: 'center' as const }}>
        <EmailButton href={inviteUrl}>Accept Invitation</EmailButton>
      </Section>
      <Text style={{ margin: '0 0 16px', color: '#a0a0a8', fontSize: '14px' }}>
        This invitation will expire in 7 days. If you didn&apos;t expect this invitation,
        you can safely ignore this email.
      </Text>
      <Text style={{ margin: '0', color: '#6b6b74', fontSize: '13px' }}>
        If the button doesn&apos;t work, copy and paste this link into your browser:
        <br />
        <Link href={inviteUrl} style={{ color: '#F5303D', wordBreak: 'break-all' }}>
          {inviteUrl}
        </Link>
      </Text>
    </EmailLayout>
  );
}

export async function invitationEmailHtml(inviterName: string, inviteUrl: string): Promise<string> {
  return render(<InvitationEmail inviterName={inviterName} inviteUrl={inviteUrl} />);
}
