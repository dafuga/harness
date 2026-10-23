import type {
	Dimension,
	GameRun,
	GameView,
	LevelLayout
} from '../../../../game/src/models/game-authoring/Game.types';

export interface GameLevelPreviewProps {
	layout: LevelLayout;
	dimension: Dimension;
	/** The canvas's accessible name. */
	label: string;
}

/** One drawn frame: the run at the spawn point over a view holding only the layout. */
export interface LevelFrame {
	run: GameRun;
	view: GameView;
}
