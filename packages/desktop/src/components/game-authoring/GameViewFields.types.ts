import type { GameView } from '../../../../game/src/models/game-authoring/Game.types';

/** A section of the game workspace; Level belongs to planned levels only. */
export type GameSection = 'Level' | 'Preview' | 'Checkpoints' | 'Mechanics';

export interface GameViewFieldsProps {
	view: GameView;
	views: GameView[];
	readonly?: boolean;
	/** The section on show, bindable; pressing another section or New level changes it. */
	section: GameSection;
	select: (id: string) => void;
	/** Adds the new level this toolbar prepared from the current view, before selecting it. */
	create: (level: GameView) => void;
	change: (patch: Partial<GameView>) => void;
}
