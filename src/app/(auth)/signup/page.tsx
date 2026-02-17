'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { registerUser, canRegister, signInWithGoogle } from '@/lib/actions/auth';
import { trackEvent } from '@/lib/analytics';

export default function SignUpPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitationId, setInvitationId] = useState<string | null>(null);
  const [emailChecked, setEmailChecked] = useState(false);

  const handleEmailCheck = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await canRegister(email);

    if (!result.allowed) {
      setError(result.reason ?? 'Unable to register with this email');
      setIsLoading(false);
      return;
    }

    setInvitationId(result.invitationId ?? null);
    setEmailChecked(true);
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    const result = await registerUser({
      email,
      password,
      name,
      invitationId: invitationId ?? undefined,
    });

    if (!result.success) {
      setError(result.error ?? 'Failed to create account');
      setIsLoading(false);
      return;
    }

    trackEvent('user_signed_up', { provider: 'credentials' });

    // Redirect to verify-email page
    if (result.requiresVerification) {
      router.push('/verify-email');
    } else {
      router.push('/login?message=Account created successfully. Please sign in.');
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    await signInWithGoogle();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center text-3xl font-bold text-foreground">
            Central
          </h1>
          <h2 className="mt-6 text-center text-xl text-muted-foreground">
            Create your account
          </h2>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="mt-8 space-y-6">
          {/* Google Sign Up */}
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
          <form onSubmit={emailChecked ? handleSubmit : (e) => { e.preventDefault(); handleEmailCheck(); }} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                Email address
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={emailChecked}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full px-3 py-2 border border-border rounded-lg shadow-sm focus:outline-none focus:ring-ring focus:border-ring disabled:bg-muted"
                  placeholder="you@example.com"
                />
                {!emailChecked && (
                  <button
                    type="button"
                    onClick={handleEmailCheck}
                    disabled={isLoading}
                    className="px-4 py-2 border border-border rounded-lg shadow-sm bg-background text-foreground hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50"
                  >
                    Check
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                @clix.co emails can register directly. Others need an invitation.
              </p>
            </div>

            {emailChecked && (
              <>
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-foreground">
                    Full name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-border rounded-lg shadow-sm focus:outline-none focus:ring-ring focus:border-ring"
                    placeholder="John Doe"
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
                    Confirm password
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
              </>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Please wait...' : emailChecked ? 'Create account' : 'Continue'}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:text-primary/80 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
