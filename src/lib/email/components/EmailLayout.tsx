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

const darkModeStyles = `
  :root {
    color-scheme: light dark;
    supported-color-schemes: light dark;
  }

  @media (prefers-color-scheme: dark) {
    .email-body,
    .email-shell {
      background-color: #1a1a1f !important;
    }

    .email-card,
    .email-panel {
      background-color: #262629 !important;
      border-color: #42424a !important;
    }

    .email-heading,
    .email-brand,
    .email-strong {
      color: #f5f5f5 !important;
    }

    .email-text {
      color: #d0d0d5 !important;
    }

    .email-muted {
      color: #a0a0a8 !important;
    }

    .email-subtle,
    .email-footer {
      color: #6b6b74 !important;
    }

    .email-pill {
      background-color: #42424a !important;
      color: #d0d0d5 !important;
    }

    .email-logo-light {
      display: none !important;
      max-height: 0 !important;
      overflow: hidden !important;
    }

    .email-logo-dark {
      display: inline-block !important;
      max-height: none !important;
    }
  }

  [data-ogsc] .email-body,
  [data-ogsc] .email-shell {
    background-color: #1a1a1f !important;
  }

  [data-ogsc] .email-card,
  [data-ogsc] .email-panel {
    background-color: #262629 !important;
    border-color: #42424a !important;
  }

  [data-ogsc] .email-heading,
  [data-ogsc] .email-brand,
  [data-ogsc] .email-strong {
    color: #f5f5f5 !important;
  }

  [data-ogsc] .email-text {
    color: #d0d0d5 !important;
  }

  [data-ogsc] .email-muted {
    color: #a0a0a8 !important;
  }

  [data-ogsc] .email-subtle,
  [data-ogsc] .email-footer {
    color: #6b6b74 !important;
  }

  [data-ogsc] .email-pill {
    background-color: #42424a !important;
    color: #d0d0d5 !important;
  }

  [data-ogsc] .email-logo-light {
    display: none !important;
    max-height: 0 !important;
    overflow: hidden !important;
  }

  [data-ogsc] .email-logo-dark {
    display: inline-block !important;
    max-height: none !important;
  }
`;

export function EmailLayout({ preheader, children }: EmailLayoutProps) {
  const appUrl = getAppUrl();

  return (
    <Html>
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{darkModeStyles}</style>
      </Head>
      {preheader && <Preview>{preheader}</Preview>}
      <Body
        className="email-body"
        style={{
          fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          lineHeight: '1.6',
          color: '#18181b',
          margin: '0 auto',
          padding: '0',
          backgroundColor: '#f4f4f5',
        }}
      >
        <Container style={{ maxWidth: '600px', margin: '0 auto' }}>
          <Section className="email-shell" style={{ backgroundColor: '#f4f4f5', padding: '20px' }}>
            <Section style={{ textAlign: 'center' as const, padding: '24px 0 16px' }}>
              <Img
                className="email-logo-light"
                src={`${appUrl}/clix_logo_black.png`}
                alt="Clix"
                width="36"
                height="36"
                style={{
                  display: 'inline-block',
                  verticalAlign: 'middle',
                  marginRight: '10px',
                }}
              />
              <Img
                className="email-logo-dark"
                src={`${appUrl}/clix_logo_white.png`}
                alt="Clix"
                width="36"
                height="36"
                style={{
                  display: 'none',
                  maxHeight: '0',
                  overflow: 'hidden',
                  verticalAlign: 'middle',
                  marginRight: '10px',
                }}
              />
              <Text
                className="email-brand"
                style={{
                  color: '#18181b',
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

            <Section
              className="email-card"
              style={{
                background: '#ffffff',
                padding: '24px',
                borderRadius: '8px',
                border: '1px solid #e4e4e7',
              }}
            >
              {children}
            </Section>

            <Section style={{ textAlign: 'center' as const, padding: '16px' }}>
              <Text className="email-footer" style={{ color: '#71717a', fontSize: '12px', margin: '0' }}>
                Clix Digital Marketing Agency
              </Text>
              <Text className="email-footer" style={{ color: '#71717a', fontSize: '11px', margin: '8px 0 0' }}>
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
