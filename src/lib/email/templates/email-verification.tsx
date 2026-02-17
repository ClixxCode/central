import { Text, Section, Link } from '@react-email/components';
import { render } from '@react-email/render';
import { getAppUrl } from '../client';
import { EmailLayout, EmailButton } from '../components';

function EmailVerificationEmail({
  name,
  verificationUrl,
}: {
  name?: string;
  verificationUrl: string;
}) {
  const greeting = name ? `Hi ${name},` : 'Hi,';

  return (
    <EmailLayout preheader="Please verify your email to complete registration">
      <Text style={{ margin: '0 0 16px', color: '#f5f5f5' }}>{greeting}</Text>
      <Text style={{ margin: '0 0 16px', color: '#d0d0d5' }}>
        Welcome to Central! Please verify your email address to complete your registration
        and start managing your projects.
      </Text>
      <Section style={{ margin: '0 0 24px', textAlign: 'center' as const }}>
        <EmailButton href={verificationUrl}>Verify Email</EmailButton>
      </Section>
      <Text style={{ margin: '0 0 16px', color: '#a0a0a8', fontSize: '14px' }}>
        This link will expire in 24 hours. If you didn&apos;t create an account with Central,
        you can safely ignore this email.
      </Text>
      <Text style={{ margin: '0', color: '#6b6b74', fontSize: '13px' }}>
        If the button doesn&apos;t work, copy and paste this link into your browser:
        <br />
        <Link href={verificationUrl} style={{ color: '#F5303D', wordBreak: 'break-all' }}>
          {verificationUrl}
        </Link>
      </Text>
    </EmailLayout>
  );
}

function EmailVerifiedEmail({ name }: { name?: string }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const loginUrl = `${getAppUrl()}/login`;

  return (
    <EmailLayout preheader="Your email has been verified">
      <Text style={{ margin: '0 0 16px', color: '#f5f5f5' }}>{greeting}</Text>
      <Text style={{ margin: '0 0 16px', color: '#d0d0d5' }}>
        Your email has been verified successfully! You can now sign in to Central
        and start managing your projects.
      </Text>
      <Section style={{ margin: '0 0 24px', textAlign: 'center' as const }}>
        <EmailButton href={loginUrl}>Sign In</EmailButton>
      </Section>
      <Text style={{ margin: '0', color: '#a0a0a8', fontSize: '14px' }}>
        Welcome to the team!
      </Text>
    </EmailLayout>
  );
}

export async function emailVerificationTemplate(params: {
  name?: string;
  verificationUrl: string;
}): Promise<{ subject: string; html: string }> {
  return {
    subject: 'Verify your email for Central',
    html: await render(
      <EmailVerificationEmail name={params.name} verificationUrl={params.verificationUrl} />
    ),
  };
}

export async function emailVerifiedTemplate(params: {
  name?: string;
}): Promise<{ subject: string; html: string }> {
  return {
    subject: 'Email verified - Welcome to Central',
    html: await render(<EmailVerifiedEmail name={params.name} />),
  };
}
