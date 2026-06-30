import { defineConfig } from 'drizzle-kit';
import * as nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());

function getMigrationDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to run migrations');
  }

  const url = new URL(databaseUrl);

  if (url.hostname.endsWith('.neon.tech')) {
    url.hostname = url.hostname.replace('-pooler.', '.');
    url.searchParams.set('options', '-c search_path=public');
  }

  return url.toString();
}

export default defineConfig({
  schema: './src/lib/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: getMigrationDatabaseUrl(),
  },
});
