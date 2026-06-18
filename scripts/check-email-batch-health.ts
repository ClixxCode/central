import { and, asc, eq, isNotNull, isNull, lt } from 'drizzle-orm';
import { db } from '../src/lib/db';
import { notificationEmailBatches, notifications } from '../src/lib/db/schema';
import {
  EMAIL_BATCH_CHANNEL,
  EMAIL_BATCH_WINDOW_MS,
} from '../src/lib/email/notification-batches';

const DEFAULT_RETRY_BUFFER_MINUTES = 10;
const DEFAULT_LIMIT = 25;

type HealthReport = {
  checkedAt: string;
  batchWindowMinutes: number;
  retryBufferMinutes: number;
  sampleLimit: number;
  stalePendingBatches: Awaited<ReturnType<typeof listStalePendingBatches>>;
  stuckSendingBatches: Awaited<ReturnType<typeof listStuckSendingBatches>>;
  unsentNotificationsInFlushableBatches: Awaited<
    ReturnType<typeof listUnsentNotificationsInFlushableBatches>
  >;
};

async function main() {
  const retryBufferMinutes = readNumberOption(
    '--retry-buffer-minutes',
    Number(process.env.EMAIL_BATCH_HEALTH_RETRY_BUFFER_MINUTES) ||
      DEFAULT_RETRY_BUFFER_MINUTES
  );
  const sampleLimit = readNumberOption('--limit', DEFAULT_LIMIT);
  const retryBufferMs = retryBufferMinutes * 60 * 1000;
  const cutoff = new Date(Date.now() - retryBufferMs);

  const report: HealthReport = {
    checkedAt: new Date().toISOString(),
    batchWindowMinutes: EMAIL_BATCH_WINDOW_MS / 60_000,
    retryBufferMinutes,
    sampleLimit,
    stalePendingBatches: await listStalePendingBatches(cutoff, sampleLimit),
    stuckSendingBatches: await listStuckSendingBatches(cutoff, sampleLimit),
    unsentNotificationsInFlushableBatches:
      await listUnsentNotificationsInFlushableBatches(cutoff, sampleLimit),
  };

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHumanReport(report);
  }

  const hasIssues =
    report.stalePendingBatches.length > 0 ||
    report.stuckSendingBatches.length > 0 ||
    report.unsentNotificationsInFlushableBatches.length > 0;

  process.exit(hasIssues && !process.argv.includes('--no-fail') ? 1 : 0);
}

async function listStalePendingBatches(cutoff: Date, limit: number) {
  return db
    .select({
      id: notificationEmailBatches.id,
      userId: notificationEmailBatches.userId,
      sendAfter: notificationEmailBatches.sendAfter,
      createdAt: notificationEmailBatches.createdAt,
      updatedAt: notificationEmailBatches.updatedAt,
    })
    .from(notificationEmailBatches)
    .where(
      and(
        eq(notificationEmailBatches.channel, EMAIL_BATCH_CHANNEL),
        eq(notificationEmailBatches.status, 'pending'),
        lt(notificationEmailBatches.sendAfter, cutoff)
      )
    )
    .orderBy(asc(notificationEmailBatches.sendAfter))
    .limit(limit);
}

async function listStuckSendingBatches(cutoff: Date, limit: number) {
  return db
    .select({
      id: notificationEmailBatches.id,
      userId: notificationEmailBatches.userId,
      sendAfter: notificationEmailBatches.sendAfter,
      createdAt: notificationEmailBatches.createdAt,
      updatedAt: notificationEmailBatches.updatedAt,
    })
    .from(notificationEmailBatches)
    .where(
      and(
        eq(notificationEmailBatches.channel, EMAIL_BATCH_CHANNEL),
        eq(notificationEmailBatches.status, 'sending'),
        lt(notificationEmailBatches.updatedAt, cutoff)
      )
    )
    .orderBy(asc(notificationEmailBatches.updatedAt))
    .limit(limit);
}

async function listUnsentNotificationsInFlushableBatches(cutoff: Date, limit: number) {
  return db
    .select({
      notificationId: notifications.id,
      notificationType: notifications.type,
      recipientId: notifications.userId,
      notificationCreatedAt: notifications.createdAt,
      batchId: notificationEmailBatches.id,
      batchStatus: notificationEmailBatches.status,
      batchSendAfter: notificationEmailBatches.sendAfter,
      batchUpdatedAt: notificationEmailBatches.updatedAt,
    })
    .from(notifications)
    .innerJoin(
      notificationEmailBatches,
      eq(notifications.emailBatchId, notificationEmailBatches.id)
    )
    .where(
      and(
        eq(notificationEmailBatches.channel, EMAIL_BATCH_CHANNEL),
        isNotNull(notifications.emailBatchId),
        isNull(notifications.emailSentAt),
        lt(notificationEmailBatches.sendAfter, cutoff)
      )
    )
    .orderBy(asc(notificationEmailBatches.sendAfter), asc(notifications.createdAt))
    .limit(limit);
}

function printHumanReport(report: HealthReport) {
  console.log('Email batch health check');
  console.log(`Checked at: ${report.checkedAt}`);
  console.log(`Batch window: ${report.batchWindowMinutes} minutes`);
  console.log(`Retry buffer: ${report.retryBufferMinutes} minutes`);
  console.log(`Sample limit per check: ${report.sampleLimit}`);

  printSection(
    'Pending batches past sendAfter plus retry buffer',
    report.stalePendingBatches,
    (row) =>
      `${row.id} user=${row.userId} sendAfter=${formatDate(row.sendAfter)} updatedAt=${formatDate(row.updatedAt)}`
  );

  printSection(
    'Batches stuck in sending past retry buffer',
    report.stuckSendingBatches,
    (row) =>
      `${row.id} user=${row.userId} sendAfter=${formatDate(row.sendAfter)} updatedAt=${formatDate(row.updatedAt)}`
  );

  printSection(
    'Notifications assigned to old batches without emailSentAt',
    report.unsentNotificationsInFlushableBatches,
    (row) =>
      `${row.notificationId} type=${row.notificationType} recipient=${row.recipientId} batch=${row.batchId} batchStatus=${row.batchStatus} batchSendAfter=${formatDate(row.batchSendAfter)}`
  );
}

function printSection<T>(title: string, rows: T[], format: (row: T) => string) {
  console.log('');
  console.log(`${title}: ${rows.length}`);

  if (rows.length === 0) {
    console.log('  ok');
    return;
  }

  for (const row of rows) {
    console.log(`  ${format(row)}`);
  }
}

function readNumberOption(name: string, fallback: number): number {
  const args = process.argv.slice(2);
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  const optionIndex = args.indexOf(name);
  const rawValue = inline?.split('=')[1] ?? (optionIndex >= 0 ? args[optionIndex + 1] : undefined);
  const value = Number(rawValue);

  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function formatDate(value: Date) {
  return value.toISOString();
}

main().catch((error) => {
  console.error('Email batch health check failed', error);
  process.exit(1);
});
