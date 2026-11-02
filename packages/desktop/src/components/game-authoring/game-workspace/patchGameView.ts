import type { GameDocument, GameView } from '../../../../../game/src/index';

export function patchGameView(
	doc: GameDocument | undefined,
	current: GameView | undefined,
	patch: Partial<GameView>
): GameDocument | undefined {
	if (!doc || !current) return;
	const views = doc.views.map((item) => (item.id === current.id ? { ...item, ...patch } : item));
	return { ...doc, views };
}
