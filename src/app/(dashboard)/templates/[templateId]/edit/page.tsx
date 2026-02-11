import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { TemplateEditorClient } from './TemplateEditorClient';

interface Props {
  params: Promise<{ templateId: string }>;
}

export default async function TemplateEditPage({ params }: Props) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const { templateId } = await params;

  return <TemplateEditorClient templateId={templateId} isAdmin={user.role === 'admin'} />;
}
