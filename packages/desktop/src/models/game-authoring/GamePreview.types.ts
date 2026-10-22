import type { GameRun, GameView } from '../../../../game/src/models/game-authoring/Game.types';
import type { DesktopBridge } from '../development-tooling/DesktopBridge.types';

export interface GamePreviewProps {
	view: GameView;
	initialRun?: GameRun;
	projectId: string | null;
	readonly?: boolean;
	onRun: (run: GameRun) => void;
	bridge?: DesktopBridge;
}
