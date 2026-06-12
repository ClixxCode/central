import { defineConfig } from 'drizzle-kit';
import * as nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());

export default defineConfig({
  schema: './src/lib/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
