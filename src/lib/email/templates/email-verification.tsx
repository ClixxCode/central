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
      <Text className="email-heading" style={{ margin: '0 0 16px', color: '#18181b' }}>{greeting}</Text>
      <Text className="email-text" style={{ margin: '0 0 16px', color: '#3f3f46' }}>
        Welcome to Central! Please verify your email address to complete your registration
        and start managing your projects.
      </Text>
      <Section style={{ margin: '0 0 24px', textAlign: 'center' as const }}>
        <EmailButton href={verificationUrl}>Verify Email</EmailButton>
      </Section>
      <Text className="email-muted" style={{ margin: '0 0 16px', color: '#71717a', fontSize: '14px' }}>
        This link will expire in 24 hours. If you didn&apos;t create an account with Central,
        you can safely ignore this email.
      </Text>
      <Text className="email-subtle" style={{ margin: '0', color: '#71717a', fontSize: '13px' }}>
        If the button doesn&apos;t work, copy and paste this link into your browser:
        <br />
        <Link href={verificationUrl} style={{ color: '#F5303D', wordBreak: 'break-all' }}>
          {verificationUrl}
        </Link>
      </Text>
    </EmailLayout>
  );
}

function EmailVerifiedEmail({ name, loginUrl }: { name?: string; loginUrl?: string }) {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const signInUrl = loginUrl ?? `${getAppUrl()}/login`;

  return (
    <EmailLayout preheader="Your email has been verified">
      <Text className="email-heading" style={{ margin: '0 0 16px', color: '#18181b' }}>{greeting}</Text>
      <Text className="email-text" style={{ margin: '0 0 16px', color: '#3f3f46' }}>
        Your email has been verified successfully! You can now sign in to Central
        and start managing your projects.
      </Text>
      <Section style={{ margin: '0 0 24px', textAlign: 'center' as const }}>
        <EmailButton href={signInUrl}>Sign In</EmailButton>
      </Section>
      <Text className="email-muted" style={{ margin: '0', color: '#71717a', fontSize: '14px' }}>
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
  loginUrl?: string;
}): Promise<{ subject: string; html: string }> {
  return {
    subject: 'Email verified - Welcome to Central',
    html: await render(<EmailVerifiedEmail name={params.name} loginUrl={params.loginUrl} />),
  };
}
