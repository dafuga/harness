import { LevelValidator } from '../../../../../game/src/index';
import type { GameView } from '../../../../../game/src/index';
import type { GameSection } from '../GameViewFields.types';

/** A planned level shows its plan until it is built; Mechanics stays open throughout. */
export function gameWorkspaceSection(view: GameView | undefined, tab: GameSection): GameSection {
	if (!view?.planning) return tab === 'Level' ? 'Checkpoints' : tab;
	return tab === 'Mechanics' || (tab !== 'Level' && LevelValidator.isReady(view)) ? tab : 'Level';
}
