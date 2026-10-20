import type { GameRun, GameView } from '../../../game/src/models/Game.types';
import type { DesktopBridge } from './DesktopBridge.types';

export interface GamePreviewProps {
	view: GameView;
	initialRun?: GameRun;
	projectId: string | null;
	readonly?: boolean;
	onRun: (run: GameRun) => void;
	bridge?: DesktopBridge;
}
