import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'admin' | 'user';
    } & DefaultSession['user'];
  }

  interface User {
    role?: 'admin' | 'user';
  }
}

// JWT type augmentation for Auth.js v5
declare module '@auth/core/jwt' {
  interface JWT {
    id: string;
    role: 'admin' | 'user';
    avatarUrl?: string | null;
  }
}
