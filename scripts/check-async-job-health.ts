import {
  DEFAULT_ASYNC_JOB_HEALTH_LIMIT,
  DEFAULT_ASYNC_JOB_REPEATED_CLAIM_ATTEMPTS,
  DEFAULT_ASYNC_JOB_STALE_AFTER_MS,
  getAsyncJobHealth,
  type AsyncJob,
} from '../src/lib/async-jobs';

async function main() {
  const staleAfterMinutes = readNumberOption(
    '--stale-after-minutes',
    Number(process.env.ASYNC_JOB_HEALTH_STALE_AFTER_MINUTES) ||
      DEFAULT_ASYNC_JOB_STALE_AFTER_MS / 60_000
  );
  const repeatedClaimAttempts = readNumberOption(
    '--repeated-claim-attempts',
    Number(process.env.ASYNC_JOB_HEALTH_REPEATED_CLAIM_ATTEMPTS) ||
      DEFAULT_ASYNC_JOB_REPEATED_CLAIM_ATTEMPTS
  );
  const limit = readNumberOption('--limit', DEFAULT_ASYNC_JOB_HEALTH_LIMIT);

  const report = await getAsyncJobHealth({
    staleAfterMs: staleAfterMinutes * 60 * 1000,
    repeatedClaimAttempts,
    limit,
  });

  if (process.argv.includes('--json')) {
    console.log(
      JSON.stringify(
        {
          ...report,
          checkedAt: report.checkedAt.toISOString(),
        },
        null,
        2
      )
    );
  } else {
    printHumanReport({
      checkedAt: report.checkedAt.toISOString(),
      staleAfterMinutes,
      repeatedClaimAttempts,
      limit,
      staleRunningJobs: report.staleRunningJobs,
      failedJobs: report.failedJobs,
      repeatedClaimJobs: report.repeatedClaimJobs,
    });
  }

  const hasIssues =
    report.staleRunningJobs.length > 0 ||
    report.failedJobs.length > 0 ||
    report.repeatedClaimJobs.length > 0;

  process.exit(hasIssues && !process.argv.includes('--no-fail') ? 1 : 0);
}

function printHumanReport(report: {
  checkedAt: string;
  staleAfterMinutes: number;
  repeatedClaimAttempts: number;
  limit: number;
  staleRunningJobs: AsyncJob[];
  failedJobs: AsyncJob[];
  repeatedClaimJobs: AsyncJob[];
}) {
  console.log('Async job health check');
  console.log(`Checked at: ${report.checkedAt}`);
  console.log(`Stale running threshold: ${report.staleAfterMinutes} minutes`);
  console.log(`Repeated claim threshold: ${report.repeatedClaimAttempts} attempts`);
  console.log(`Sample limit per check: ${report.limit}`);

  printSection(
    'Stale running jobs',
    report.staleRunningJobs,
    (job) =>
      `${job.dedupeKey} kind=${job.kind} claimedBy=${job.claimedBy ?? 'unknown'} attempts=${job.attempts} lockedAt=${formatDate(job.lockedAt)}`
  );

  printSection(
    'Failed jobs',
    report.failedJobs,
    (job) =>
      `${job.dedupeKey} kind=${job.kind} attempts=${job.attempts} updatedAt=${formatDate(job.updatedAt)} error=${job.lastError ?? 'none'}`
  );

  printSection(
    'Jobs with repeated claim attempts',
    report.repeatedClaimJobs,
    (job) =>
      `${job.dedupeKey} kind=${job.kind} status=${job.status} attempts=${job.attempts} updatedAt=${formatDate(job.updatedAt)}`
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

function formatDate(value: Date | null) {
  return value ? value.toISOString() : 'none';
}

main().catch((error) => {
  console.error('Async job health check failed', error);
  process.exit(1);
});
