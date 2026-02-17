import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/lib/db';
import { users, accounts, invitations } from '@/lib/db/schema';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { verifyPassword } from '@/lib/auth/password';
import { isAllowedDomain } from '@/lib/auth/domains';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
  }),
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await db.query.users.findFirst({
          where: eq(users.email, email),
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        if (user.deactivatedAt) {
          return null;
        }

        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) {
        return false;
      }

      // For credentials login, check email verification and deactivation
      if (account?.provider === 'credentials') {
        const dbUser = await db.query.users.findFirst({
          where: eq(users.email, user.email),
        });

        if (dbUser?.deactivatedAt) {
          return '/login?error=AccountDeactivated';
        }

        if (dbUser && !dbUser.emailVerified) {
          return '/login?error=EmailNotVerified';
        }
      }

      // Check deactivation for Google sign-in (including allowed domains)
      if (account?.provider === 'google') {
        const existingGoogleUser = await db.query.users.findFirst({
          where: eq(users.email, user.email),
        });
        if (existingGoogleUser?.deactivatedAt) {
          return '/login?error=AccountDeactivated';
        }
      }

      // Auto-approve allowed domain emails
      if (isAllowedDomain(user.email)) {
        return true;
      }

      // For non-allowed domain emails, check for valid invitation
      if (account?.provider === 'google') {
        const invitation = await db.query.invitations.findFirst({
          where: and(
            eq(invitations.email, user.email),
            gt(invitations.expiresAt, new Date()),
            isNull(invitations.acceptedAt)
          ),
        });

        if (!invitation) {
          // Check if user already exists (returning user)
          const existingUser = await db.query.users.findFirst({
            where: eq(users.email, user.email),
          });

          if (!existingUser) {
            return '/login?error=NoInvitation';
          }
        }
      }

      return true;
    },

    async jwt({ token, user, trigger, session }) {
      if (user) {
        // Fetch full user data on sign in
        const dbUser = await db.query.users.findFirst({
          where: eq(users.email, user.email!),
        });

        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.name = dbUser.name;
          token.email = dbUser.email;
          // Use avatarUrl (custom upload) first, fall back to image (OAuth provider)
          token.avatarUrl = dbUser.avatarUrl || dbUser.image;
        }
      }

      // Handle session updates
      if (trigger === 'update' && session) {
        token.name = session.name;
        token.avatarUrl = session.avatarUrl;
      }

      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as 'admin' | 'user';
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.image = token.avatarUrl as string | null;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // Set auth provider for new OAuth users (don't overwrite existing role)
      if (user.email) {
        await db
          .update(users)
          .set({
            authProvider: 'google',
          })
          .where(eq(users.email, user.email));

        // Mark invitation as accepted if exists
        await db
          .update(invitations)
          .set({ acceptedAt: new Date() })
          .where(eq(invitations.email, user.email));
      }
    },
  },
});
