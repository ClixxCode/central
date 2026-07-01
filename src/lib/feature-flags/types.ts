export interface CentralFeatureFlags {
  projectBoardBehaviorEnabled: boolean;
  appShellVisualRefreshEnabled: boolean;
}

export const defaultCentralFeatureFlags: CentralFeatureFlags = {
  projectBoardBehaviorEnabled: false,
  appShellVisualRefreshEnabled: false,
};
