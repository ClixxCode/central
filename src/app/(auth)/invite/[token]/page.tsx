import { redirect } from 'next/navigation';
import { getInvitation } from '@/lib/actions/auth';
import InviteAcceptForm from './InviteAcceptForm';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params;
  const invitation = await getInvitation(token);

  if (!invitation) {
    redirect('/login?error=InvalidInvitation');
  }

  if (invitation.accepted) {
    redirect('/login?message=Invitation already accepted. Please sign in.');
  }

  if (invitation.expired) {
    redirect('/login?error=ExpiredInvitation');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center text-3xl font-bold text-foreground">
            Central
          </h1>
          <h2 className="mt-6 text-center text-xl text-muted-foreground">
            Accept your invitation
          </h2>
        </div>

        <div className="bg-primary/10 border border-primary/20 text-primary px-4 py-3 rounded-lg">
          <p className="text-sm">
            You&apos;ve been invited to join as a <strong>{invitation.role}</strong>.
          </p>
          <p className="text-sm mt-1">
            Email: <strong>{invitation.email}</strong>
          </p>
        </div>

        <InviteAcceptForm invitationId={token} email={invitation.email} />
      </div>
    </div>
  );
}
