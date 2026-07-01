import { beforeEach, describe, expect, it, vi } from 'vitest';
import { projectBoardBehaviorEnabled } from '@/flags';
import {
  getProjectBoardBehaviorDisabledResult,
  isProjectBoardBehaviorEnabled,
  PROJECT_BOARD_BEHAVIOR_DISABLED_ERROR,
} from '@/lib/feature-flags/project-board-behavior';

vi.mock('@/flags', () => ({
  projectBoardBehaviorEnabled: vi.fn(),
}));

const mockedProjectBoardBehaviorEnabled = vi.mocked(projectBoardBehaviorEnabled);

describe('project board behavior flag guard', () => {
  beforeEach(() => {
    mockedProjectBoardBehaviorEnabled.mockReset();
  });

  it('returns an unsupported result while project-board behavior is disabled', async () => {
    mockedProjectBoardBehaviorEnabled.mockResolvedValue(false);

    await expect(isProjectBoardBehaviorEnabled()).resolves.toBe(false);
    await expect(getProjectBoardBehaviorDisabledResult()).resolves.toEqual({
      success: false,
      error: PROJECT_BOARD_BEHAVIOR_DISABLED_ERROR,
    });
  });

  it('allows project-board behavior when the flag is enabled', async () => {
    mockedProjectBoardBehaviorEnabled.mockResolvedValue(true);

    await expect(isProjectBoardBehaviorEnabled()).resolves.toBe(true);
    await expect(getProjectBoardBehaviorDisabledResult()).resolves.toBeNull();
  });
});
