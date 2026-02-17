'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { verifyEmail, resendVerificationEmail } from '@/lib/actions/email-verification';
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';

type VerificationState = 'verifying' | 'success' | 'error' | 'no-token';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [state, setState] = useState<VerificationState>(token ? 'verifying' : 'no-token');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  useEffect(() => {
    if (!token) {
      setState('no-token');
      return;
    }

    const verify = async () => {
      const result = await verifyEmail(token);
      if (result.success) {
        setState('success');
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } else {
        setState('error');
        setErrorMessage(result.error ?? 'Verification failed');
      }
    };

    verify();
  }, [token, router]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail) return;

    setResendStatus('sending');
    await resendVerificationEmail(resendEmail);
    setResendStatus('sent');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="flex flex-col items-center">
          <Image
            src="/clix_logo_black.png"
            alt="Clix Logo"
            width={80}
            height={80}
            className="mb-4"
          />
          <h1 className="text-center text-3xl font-bold text-foreground">
            Central
          </h1>
        </div>

        <div className="bg-card shadow-lg rounded-lg p-8">
          {state === 'verifying' && (
            <div className="text-center">
              <Loader2 className="w-16 h-16 text-primary animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Verifying your email...
              </h2>
              <p className="text-muted-foreground">
                Please wait while we verify your email address.
              </p>
            </div>
          )}

          {state === 'success' && (
            <div className="text-center">
              <CheckCircle className="w-16 h-16 text-green-500 dark:text-green-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Email verified!
              </h2>
              <p className="text-muted-foreground mb-4">
                Your email has been verified successfully. You can now sign in to your account.
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Redirecting to login...
              </p>
              <Link
                href="/login"
                className="inline-block px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Sign in now
              </Link>
            </div>
          )}

          {state === 'error' && (
            <div className="text-center">
              <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Verification failed
              </h2>
              <p className="text-muted-foreground mb-6">
                {errorMessage}
              </p>

              <div className="border-t pt-6">
                <p className="text-sm text-muted-foreground mb-4">
                  Need a new verification email?
                </p>
                <form onSubmit={handleResend} className="space-y-3">
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  />
                  <button
                    type="submit"
                    disabled={resendStatus !== 'idle'}
                    className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {resendStatus === 'sending'
                      ? 'Sending...'
                      : resendStatus === 'sent'
                      ? 'Email sent!'
                      : 'Resend verification email'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {state === 'no-token' && (
            <div className="text-center">
              <Mail className="w-16 h-16 text-muted-foreground/70 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Check your email
              </h2>
              <p className="text-muted-foreground mb-6">
                We sent you a verification link. Click the link in the email to verify your account.
              </p>

              <div className="border-t pt-6">
                <p className="text-sm text-muted-foreground mb-4">
                  Didn&apos;t receive the email?
                </p>
                <form onSubmit={handleResend} className="space-y-3">
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  />
                  <button
                    type="submit"
                    disabled={resendStatus !== 'idle'}
                    className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {resendStatus === 'sending'
                      ? 'Sending...'
                      : resendStatus === 'sent'
                      ? 'Email sent!'
                      : 'Resend verification email'}
                  </button>
                </form>
              </div>

              <div className="mt-6 pt-4 border-t">
                <Link
                  href="/login"
                  className="text-sm text-primary hover:text-primary/80"
                >
                  Back to login
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VerifyEmailFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="flex flex-col items-center">
          <Image
            src="/clix_logo_black.png"
            alt="Clix Logo"
            width={80}
            height={80}
            className="mb-4"
          />
          <h1 className="text-center text-3xl font-bold text-foreground">
            Central
          </h1>
        </div>
        <div className="bg-card shadow-lg rounded-lg p-8">
          <div className="text-center animate-pulse">
            <div className="w-16 h-16 bg-muted rounded-full mx-auto mb-4" />
            <div className="h-6 bg-muted rounded w-3/4 mx-auto mb-2" />
            <div className="h-4 bg-muted rounded w-full mb-2" />
            <div className="h-4 bg-muted rounded w-2/3 mx-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailFallback />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
