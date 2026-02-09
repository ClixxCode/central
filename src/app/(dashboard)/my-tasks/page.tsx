import { Metadata } from 'next';
import { MyTasksPageClient } from '@/components/tasks/MyTasksPageClient';

export const metadata: Metadata = {
  title: 'My Tasks | Central',
  description: 'View all tasks assigned to you across clients',
};

export default function MyTasksPage() {
  return <MyTasksPageClient />;
}
