import type { SessionUser } from '@/lib/auth/session';

export type CentralFlagEntities = {
  user?: {
    id: string;
    email: string;
    role: SessionUser['role'];
    isAdmin: boolean;
    name?: string;
    emailDomain?: string;
  };
};

type CentralFlagUser = Pick<SessionUser, 'id' | 'email' | 'name' | 'role'>;

export function getCentralFlagEntities(user: CentralFlagUser | null): CentralFlagEntities {
  if (!user) {
    return {};
  }

  const normalizedEmail = user.email.trim().toLowerCase();
  const emailDomain = normalizedEmail.includes('@')
    ? normalizedEmail.split('@').pop()
    : undefined;

  return {
    user: {
      id: user.id,
      email: normalizedEmail,
      role: user.role,
      isAdmin: user.role === 'admin',
      ...(user.name ? { name: user.name } : {}),
      ...(emailDomain ? { emailDomain } : {}),
    },
  };
}
