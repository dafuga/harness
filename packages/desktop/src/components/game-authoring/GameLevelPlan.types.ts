import type {
	GameDocument,
	GameRun,
	GameView
} from '../../../../game/src/models/game-authoring/Game.types';
import type { DesktopBridge } from '../../models/development-tooling/DesktopBridge.types';

/** Concept, brief, review of a generated proposal, and the level once it is built. */
export type LevelStep = 'concept' | 'brief' | 'review' | 'built';

/** Where generation stands, as the brief and review steps show it. */
export interface LevelStatus {
	busy: boolean;
	readonly: boolean;
	/** Why generation cannot run now, in words; empty when it can. */
	reason: string;
	error: string;
}

export interface GameLevelPlanProps {
	context: {
		view: GameView;
		/** The document as it stands, sent whole with a generation request. */
		document: GameDocument;
		projectId?: string | null;
		revision?: string;
		commit?: string;
		bridge?: DesktopBridge;
		/** History or a game that cannot be saved: nothing is generated, edited or approved. */
		readonly: boolean;
	};
	/** The preview run; a build restarts this level's part of it at the spawn point. */
	run: GameRun;
	change: (patch: Partial<GameView>) => void;
}
