// @harness-uid u_mzhcxeicv4
import type { GameDesktopBridge } from '../../../models/game-authoring/GameDesktopBridge.types';
export type LevelRequest = Parameters<NonNullable<GameDesktopBridge['gameLevelGenerate']>>[0];
export { LevelGenerationError } from './LevelGenerationError';
