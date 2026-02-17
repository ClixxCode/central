'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { signInWithGoogle, signInWithCredentials } from '@/lib/actions/auth';
import { resendVerificationEmail } from '@/lib/actions/email-verification';

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/my-tasks';
  const error = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFormError(null);

    const result = await signInWithCredentials(email, password, callbackUrl);

    if (!result.success) {
      setFormError(result.error ?? 'Failed to sign in');
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    await signInWithGoogle(callbackUrl);
  };

  const handleResendVerification = async () => {
    if (!email) {
      setFormError('Please enter your email address first');
      return;
    }
    setResendStatus('sending');
    await resendVerificationEmail(email);
    setResendStatus('sent');
  };

  const errorMessages: Record<string, string> = {
    NoInvitation: 'An invitation is required to sign up with this email.',
    CredentialsSignin: 'Invalid email or password.',
    EmailNotVerified: 'Please verify your email before signing in.',
    AccountDeactivated: 'Your account has been deactivated. Contact an administrator.',
    Default: 'An error occurred during sign in.',
  };

  const displayError = formError ?? (error ? errorMessages[error] ?? errorMessages.Default : null);
  const showResendButton = error === 'EmailNotVerified';

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
          <h2 className="mt-4 text-center text-xl text-muted-foreground">
            Sign in to your account
          </h2>
        </div>

        {displayError && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg">
            <p>{displayError}</p>
            {showResendButton && (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendStatus !== 'idle'}
                className="mt-2 text-sm underline hover:no-underline disabled:opacity-50"
              >
                {resendStatus === 'sending'
                  ? 'Sending...'
                  : resendStatus === 'sent'
                  ? 'Verification email sent!'
                  : 'Resend verification email'}
              </button>
            )}
          </div>
        )}

        <div className="mt-8 space-y-6">
          {/* Google Sign In */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-border rounded-lg shadow-sm bg-background text-foreground hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-muted/50 text-muted-foreground">Or continue with email</span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-border rounded-lg shadow-sm focus:outline-none focus:ring-ring focus:border-ring"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-border rounded-lg shadow-sm focus:outline-none focus:ring-ring focus:border-ring"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-primary hover:text-primary/80 font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function LoginFormFallback() {
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
          <h2 className="mt-4 text-center text-xl text-muted-foreground">
            Sign in to your account
          </h2>
        </div>
        <div className="mt-8 space-y-6 animate-pulse">
          <div className="h-12 bg-muted rounded-lg" />
          <div className="h-4 bg-muted rounded w-1/2 mx-auto" />
          <div className="space-y-4">
            <div className="h-16 bg-muted rounded-lg" />
            <div className="h-16 bg-muted rounded-lg" />
            <div className="h-12 bg-muted rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginForm />
    </Suspense>
  );
}
