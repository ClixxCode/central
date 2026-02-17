'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { validateResetToken, resetPassword } from '@/lib/actions/password-reset';
import { CheckCircle, XCircle, Loader2, KeyRound } from 'lucide-react';

type PageState = 'loading' | 'form' | 'success' | 'invalid';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [state, setState] = useState<PageState>(token ? 'loading' : 'invalid');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState('invalid');
      return;
    }

    const validate = async () => {
      const result = await validateResetToken(token);
      if (result.valid && result.email) {
        setEmail(result.email);
        setState('form');
      } else {
        setState('invalid');
      }
    };

    validate();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!token) return;

    setIsSubmitting(true);

    const result = await resetPassword(token, password);

    if (!result.success) {
      setError(result.error ?? 'Failed to reset password');
      setIsSubmitting(false);
      return;
    }

    setState('success');
    setTimeout(() => {
      router.push('/login');
    }, 3000);
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
          {state === 'loading' && (
            <div className="text-center">
              <Loader2 className="w-16 h-16 text-primary animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Validating link...
              </h2>
              <p className="text-muted-foreground">
                Please wait while we verify your reset link.
              </p>
            </div>
          )}

          {state === 'form' && (
            <div>
              <div className="text-center mb-6">
                <KeyRound className="w-12 h-12 text-primary mx-auto mb-3" />
                <h2 className="text-xl font-semibold text-foreground mb-1">
                  Reset your password
                </h2>
                <p className="text-sm text-muted-foreground">
                  Set a new password for {email}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-foreground">
                    New password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-border rounded-lg shadow-sm focus:outline-none focus:ring-ring focus:border-ring"
                    placeholder="••••••••"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Min 8 characters, with uppercase, lowercase, and number
                  </p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
                    Confirm new password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-border rounded-lg shadow-sm focus:outline-none focus:ring-ring focus:border-ring"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Resetting password...' : 'Reset password'}
                </button>
              </form>
            </div>
          )}

          {state === 'success' && (
            <div className="text-center">
              <CheckCircle className="w-16 h-16 text-green-500 dark:text-green-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Password reset!
              </h2>
              <p className="text-muted-foreground mb-4">
                Your password has been updated successfully. You can now sign in with your new password.
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

          {state === 'invalid' && (
            <div className="text-center">
              <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Invalid or expired link
              </h2>
              <p className="text-muted-foreground mb-6">
                This password reset link is invalid or has expired.
                Please ask your administrator to send a new one.
              </p>
              <Link
                href="/login"
                className="inline-block px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Back to login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResetPasswordFallback() {
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
