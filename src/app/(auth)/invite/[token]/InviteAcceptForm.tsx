'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { acceptInvitation } from '@/lib/actions/auth';

interface InviteAcceptFormProps {
  invitationId: string;
  email: string;
}

export default function InviteAcceptForm({ invitationId, email }: InviteAcceptFormProps) {
  const router = useRouter();

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    const result = await acceptInvitation(invitationId, password, name);

    if (!result.success) {
      setError(result.error ?? 'Failed to accept invitation');
      setIsLoading(false);
      return;
    }

    router.push('/login?message=Account created successfully. Please sign in.');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-foreground">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          disabled
          value={email}
          className="mt-1 block w-full px-3 py-2 border border-border rounded-lg shadow-sm bg-muted text-muted-foreground"
        />
      </div>

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

      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Creating account...' : 'Create account'}
      </button>
    </form>
  );
}
