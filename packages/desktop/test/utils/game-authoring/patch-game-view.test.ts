import { expect, test } from 'vitest';
import { measureWorkload } from '../../../../../test/support/measureWorkload';
import { exampleDocument } from '../../../../game/src/utils/game-authoring/keyDoor';
import { patchGameView } from '../../../src/components/game-authoring/game-workspace/patchGameView';
import type { GameView } from '../../../../game/src/models/game-authoring/Game.types';

function inputAdmission() {
	const doc = exampleDocument(),
		view = doc.views[0];
	let reads = 0;
	const patch = {
		get title() {
			reads++;
			return 'Lantern island';
		}
	};
	const result = patchGameView(doc, view, patch)!;
	expect(result.views[0].title).toBe('Lantern island');
	expect(reads).toBe(1);
	const failure = new Error('Map unavailable');
	Object.defineProperty(doc.views, 'map', {
		value: () => {
			throw failure;
		}
	});
	expect(() => patchGameView(doc, view, {})).toThrow(failure);
	Object.defineProperty(doc, 'views', {
		get: () => {
			throw failure;
		}
	});
	expect(patchGameView(doc, undefined, {})).toBeUndefined();
	expect(patchGameView(undefined, view, {})).toBeUndefined();
	expect(() => patchGameView(doc, view, {})).toThrow(failure);
}

function collectionAdmission() {
	const doc = exampleDocument(),
		view = doc.views[0];
	class ViewList extends Array<GameView> {}
	const views = new ViewList(view, { ...view, id: 'harbor' });
	Object.defineProperty(views, Symbol.iterator, {
		get: () => {
			throw new Error('Iterator must not be read');
		}
	});
	doc.views = views;
	const result = patchGameView(doc, view, { title: 'Lantern island' })!;
	expect(result.views).toBeInstanceOf(ViewList);
	expect(result.views[1]).toBe(views[1]);
	expect(result.views[0]).not.toBe(view);
	expect(view.title).not.toBe('Lantern island');
}

test('patching a selected view preserves native map, spread and unselected references', () =>
	measureWorkload('desktop.function.game-authoring-patch-game-view', 'view-edit-admission', () => {
		const doc = exampleDocument(),
			view = doc.views[0];
		const result = patchGameView(doc, view, { title: 'Lantern island' })!;
		expect(result).not.toBe(doc);
		expect(result.views[0].title).toBe('Lantern island');
		expect(result.mechanics).toBe(doc.mechanics);
		inputAdmission();
		collectionAdmission();
	}));
