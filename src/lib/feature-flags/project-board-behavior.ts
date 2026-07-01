import { projectBoardBehaviorEnabled } from '@/flags';

export const PROJECT_BOARD_BEHAVIOR_DISABLED_ERROR =
  'Project board behavior is currently disabled';

export async function isProjectBoardBehaviorEnabled(): Promise<boolean> {
  return projectBoardBehaviorEnabled();
}

export async function getProjectBoardBehaviorDisabledResult(): Promise<{
  success: false;
  error: string;
} | null> {
  return (await isProjectBoardBehaviorEnabled())
    ? null
    : { success: false, error: PROJECT_BOARD_BEHAVIOR_DISABLED_ERROR };
}
