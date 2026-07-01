import { vercelAdapter } from '@flags-sdk/vercel';
import { dedupe, flag } from 'flags/next';
import { getCurrentUser } from '@/lib/auth/session';
import {
  getCentralFlagEntities,
  type CentralFlagEntities,
} from '@/lib/feature-flags/entities';
import type { CentralFeatureFlags } from '@/lib/feature-flags/types';

const booleanOptions = [
  { label: 'Disabled', value: false },
  { label: 'Enabled', value: true },
];

const identify = dedupe(async (): Promise<CentralFlagEntities> => {
  const user = await getCurrentUser();
  return getCentralFlagEntities(user);
});

export const projectBoardBehaviorEnabled = flag<boolean, CentralFlagEntities>({
  key: 'project-board-behavior',
  description: 'Enable nested project-board behavior in Central.',
  adapter: vercelAdapter(),
  identify,
  defaultValue: false,
  options: booleanOptions,
});

export const appShellVisualRefreshEnabled = flag<boolean, CentralFlagEntities>({
  key: 'app-shell-visual-refresh',
  description: 'Enable the refreshed Central app shell visuals.',
  adapter: vercelAdapter(),
  identify,
  defaultValue: false,
  options: booleanOptions,
});

export async function getCentralFeatureFlags(): Promise<CentralFeatureFlags> {
  const [
    projectBoardBehaviorEnabledValue,
    appShellVisualRefreshEnabledValue,
  ] = await Promise.all([
    projectBoardBehaviorEnabled(),
    appShellVisualRefreshEnabled(),
  ]);

  return {
    projectBoardBehaviorEnabled: projectBoardBehaviorEnabledValue,
    appShellVisualRefreshEnabled: appShellVisualRefreshEnabledValue,
  };
}
