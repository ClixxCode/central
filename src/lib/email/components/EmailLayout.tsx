import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Img,
  Text,
  Link,
  Preview,
} from '@react-email/components';
import { getAppUrl } from '../client';

interface EmailLayoutProps {
  preheader?: string;
  children: React.ReactNode;
}

export function EmailLayout({ preheader, children }: EmailLayoutProps) {
  const appUrl = getAppUrl();

  return (
    <Html>
      <Head>
        <meta name="color-scheme" content="dark" />
        <meta name="supported-color-schemes" content="dark" />
      </Head>
      {preheader && <Preview>{preheader}</Preview>}
      <Body
        style={{
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          lineHeight: '1.6',
          color: '#f5f5f5',
          margin: '0 auto',
          padding: '0',
          backgroundColor: '#1a1a1f',
        }}
      >
        <Container style={{ maxWidth: '600px', margin: '0 auto' }}>
          <Section style={{ backgroundColor: '#1a1a1f', padding: '20px' }}>
            {/* Logo header */}
            <Section style={{ textAlign: 'center' as const, padding: '24px 0 16px' }}>
              <Img
                src={`${appUrl}/clix_logo_white.png`}
                alt="Clix"
                width="36"
                height="36"
                style={{
                  display: 'inline-block',
                  verticalAlign: 'middle',
                  marginRight: '10px',
                }}
              />
              <Text
                style={{
                  color: '#f5f5f5',
                  fontSize: '20px',
                  fontWeight: '600',
                  display: 'inline',
                  verticalAlign: 'middle',
                  margin: '0',
                }}
              >
                Central
              </Text>
            </Section>

            {/* Content card */}
            <Section
              style={{
                background: '#262629',
                padding: '24px',
                borderRadius: '12px',
                border: '1px solid #42424a',
              }}
            >
              {children}
            </Section>

            {/* Footer */}
            <Section style={{ textAlign: 'center' as const, padding: '16px' }}>
              <Text style={{ color: '#6b6b74', fontSize: '12px', margin: '0' }}>
                Clix Digital Marketing Agency
              </Text>
              <Text style={{ color: '#6b6b74', fontSize: '11px', margin: '8px 0 0' }}>
                <Link
                  href={`${appUrl}/settings/notifications`}
                  style={{ color: '#F5303D', textDecoration: 'underline' }}
                >
                  Manage notification preferences
                </Link>
              </Text>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
