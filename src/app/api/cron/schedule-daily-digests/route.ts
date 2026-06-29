import { NextRequest, NextResponse } from 'next/server';
import { getCurrentOrgDate } from '@/lib/background-jobs';
import {
  enqueueDailyDigestSchedule,
  shouldDispatchBackgroundJobsViaQueue,
} from '@/lib/queues/background-jobs';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!shouldDispatchBackgroundJobsViaQueue()) {
    return NextResponse.json({
      skipped: true,
      reason: 'Background job delivery mode is Inngest-only',
    });
  }

  const orgDate = await getCurrentOrgDate();
  const result = await enqueueDailyDigestSchedule({ orgDate });

  return NextResponse.json({
    queued: true,
    kind: 'background.daily-digest.schedule',
    orgDate,
    messageId: result.messageId,
    duplicate: result.duplicate === true,
  });
}
