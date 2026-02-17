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
      <Text style={{ margin: '0 0 16px', color: '#f5f5f5' }}>{greeting}</Text>
      <Text style={{ margin: '0 0 16px', color: '#d0d0d5' }}>
        {adminName} has sent you a link to reset your password for Central.
        Use the button below to set a new password and access your account.
      </Text>
      <Section style={{ margin: '0 0 24px', textAlign: 'center' as const }}>
        <EmailButton href={resetUrl}>Reset Password</EmailButton>
      </Section>
      <Text style={{ margin: '0 0 16px', color: '#a0a0a8', fontSize: '14px' }}>
        This link will expire in 24 hours. If you didn&apos;t expect this email,
        please contact your administrator.
      </Text>
      <Text style={{ margin: '0', color: '#6b6b74', fontSize: '13px' }}>
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
