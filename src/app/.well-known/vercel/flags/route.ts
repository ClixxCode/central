import { getProviderData } from '@flags-sdk/vercel';
import { createFlagsDiscoveryEndpoint } from 'flags/next';
import {
  appShellVisualRefreshEnabled,
  projectBoardBehaviorEnabled,
} from '../../../../flags';

const centralFlags = {
  projectBoardBehaviorEnabled,
  appShellVisualRefreshEnabled,
};

export const GET = createFlagsDiscoveryEndpoint(() => getProviderData(centralFlags));
