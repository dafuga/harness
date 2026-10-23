import type {
	GameInput,
	GameRun,
	GameView
} from '../../../../game/src/models/game-authoring/Game.types';

export interface GameControlsProps {
	view: GameView;
	run: GameRun;
	/** Advances the run by one input. */
	step: (input: GameInput) => void;
	/** Starts the run again where the view begins. */
	reset: () => void;
}
