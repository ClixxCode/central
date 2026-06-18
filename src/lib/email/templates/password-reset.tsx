import { Text, Section, Link } from '@react-email/components';
import { render } from '@react-email/render';
import { EmailLayout, EmailButton } from '../components';

function AdminPasswordResetEmail({
  name,
  adminName,
  resetUrl,
}: {
  name?: string;
  adminName: string;
  resetUrl: string;
}) {
  const greeting = name ? `Hi ${name},` : 'Hi,';

  return (
    <EmailLayout preheader={`${adminName} has sent you a password reset link`}>
      <Text className="email-heading" style={{ margin: '0 0 16px', color: '#18181b' }}>{greeting}</Text>
      <Text className="email-text" style={{ margin: '0 0 16px', color: '#3f3f46' }}>
        {adminName} has sent you a link to reset your password for Central.
        Use the button below to set a new password and access your account.
      </Text>
      <Section style={{ margin: '0 0 24px', textAlign: 'center' as const }}>
        <EmailButton href={resetUrl}>Reset Password</EmailButton>
      </Section>
      <Text className="email-muted" style={{ margin: '0 0 16px', color: '#71717a', fontSize: '14px' }}>
        This link will expire in 24 hours. If you didn&apos;t expect this email,
        please contact your administrator.
      </Text>
      <Text className="email-subtle" style={{ margin: '0', color: '#71717a', fontSize: '13px' }}>
        If the button doesn&apos;t work, copy and paste this link into your browser:
        <br />
        <Link href={resetUrl} style={{ color: '#F5303D', wordBreak: 'break-all' }}>
          {resetUrl}
        </Link>
      </Text>
    </EmailLayout>
  );
}

export async function adminPasswordResetTemplate(params: {
  name?: string;
  adminName: string;
  resetUrl: string;
}): Promise<{ subject: string; html: string }> {
  return {
    subject: 'Reset your password for Central',
    html: await render(
      <AdminPasswordResetEmail
        name={params.name}
        adminName={params.adminName}
        resetUrl={params.resetUrl}
      />
    ),
  };
}
