'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useEffect } from 'react';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

function PostHogInit() {
  const { user, isAuthenticated } = useCurrentUser();

  useEffect(() => {
    if (!POSTHOG_KEY) return;

    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: true,
      capture_pageleave: true,
      persistence: 'localStorage+cookie',
    });
  }, []);

  useEffect(() => {
    if (!POSTHOG_KEY) return;

    if (isAuthenticated && user) {
      posthog.identify(user.id, {
        email: user.email,
        name: user.name,
        role: user.role,
      });
    } else {
      posthog.reset();
    }
  }, [isAuthenticated, user]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!POSTHOG_KEY) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      <PostHogInit />
      {children}
    </PHProvider>
  );
}
