import { Metadata } from 'next';
import { SchedulePageClient } from '@/components/calendar/SchedulePageClient';

export const metadata: Metadata = {
  title: 'Schedule | Central',
  description: 'Check team availability and create calendar holds',
};

export default function SchedulePage() {
  return <SchedulePageClient />;
}
