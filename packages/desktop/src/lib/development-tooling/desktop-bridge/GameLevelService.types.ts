// @harness-uid u_mzhcxeicv4
import type { GameDesktopBridge } from '../../../models/game-authoring/GameDesktopBridge.types';
export type LevelRequest = Parameters<NonNullable<GameDesktopBridge['gameLevelGenerate']>>[0];
/** A level generation that was refused or failed; its fixed message names the failed check. */
export class LevelGenerationError extends Error {
	override name = 'LevelGenerationError';
}
