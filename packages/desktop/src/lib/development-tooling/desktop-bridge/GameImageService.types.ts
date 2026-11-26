// @harness-uid u_semfvbq3vk
import type { GameDesktopBridge } from '../../../models/game-authoring/GameDesktopBridge.types';

export type Request = Parameters<NonNullable<GameDesktopBridge['gameImageGenerate']>>[0];
export { GameImageRequestError } from './GameImageRequestError';
