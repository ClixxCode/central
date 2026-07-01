import { vercelAdapter } from '@flags-sdk/vercel';
import { flag } from 'flags/next';
import type { CentralFeatureFlags } from '@/lib/feature-flags/types';

const booleanOptions = [
  { label: 'Disabled', value: false },
  { label: 'Enabled', value: true },
];

export const projectBoardBehaviorEnabled = flag<boolean>({
  key: 'project-board-behavior',
  description: 'Enable nested project-board behavior in Central.',
  adapter: vercelAdapter(),
  defaultValue: false,
  options: booleanOptions,
});

export const appShellVisualRefreshEnabled = flag<boolean>({
  key: 'app-shell-visual-refresh',
  description: 'Enable the refreshed Central app shell visuals.',
  adapter: vercelAdapter(),
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
