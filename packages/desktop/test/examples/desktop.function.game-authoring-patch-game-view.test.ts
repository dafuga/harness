import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { patchGameView } from '../../src/components/game-authoring/game-workspace/patchGameView';
import type { GameDocument, GameView } from '../../../game/src/index';

const UNIT = 'desktop.function.game-authoring-patch-game-view';

const intro: GameView = {
	id: 'view.intro',
	title: 'Introduction',
	dimension: '2d',
	style: 'platformer',
	checkpoints: [
		{
			id: 'checkpoint.start',
			title: 'Start',
			description: 'Begin here.',
			x: 0,
			y: 0,
			requires: [],
			conditions: [],
			actions: []
		}
	]
};

const credits: GameView = { ...intro, id: 'view.credits', title: 'Credits' };

const doc: GameDocument = {
	version: 1,
	views: [intro, credits],
	mechanics: [
		{
			id: 'mechanic.open-door',
			title: 'Open door',
			description: 'Opens the marked door.',
			inputs: ['interact'],
			events: ['door.opened']
		}
	]
};

function summarize(result: GameDocument | undefined) {
	if (!result) return null;
	return {
		viewTitles: result.views.map((view) => view.title),
		mechanicIds: result.mechanics.map((item) => item.id)
	};
}

test('Merges the patch into the matching view only', () => {
	const result = patchGameView(doc, intro, { title: 'Welcome' });

	expect(result?.views).toEqual([{ ...intro, title: 'Welcome' }, credits]);
	expect(result?.mechanics).toBe(doc.mechanics);
	expect(result).not.toBe(doc);
	expect(doc.views[0].title).toBe('Introduction');

	recordExampleCases(
		{
			unitId: UNIT,
			symbol: 'patchGameView',
			state: 'merges-the-patch-into-the-matching-view-only',
			evidence: 'examples-cases',
			file: 'merges-the-patch-into-the-matching-view-only.json'
		},
		[
			{
				name: 'title patch applied to the intro view',
				input: { viewId: 'view.intro', patch: { title: 'Welcome' } },
				output: summarize(result)
			}
		]
	);
});

test('Keeps every view when no view matches the selection', () => {
	const missing: GameView = { ...intro, id: 'view.missing' };
	const result = patchGameView(doc, missing, { title: 'Nowhere' });

	expect(result).toEqual(doc);
	expect(result).not.toBe(doc);
	expect(result?.views).not.toBe(doc.views);

	recordExampleCases(
		{
			unitId: UNIT,
			symbol: 'patchGameView',
			state: 'keeps-every-view-when-no-view-matches-the-selection',
			evidence: 'examples-cases',
			file: 'keeps-every-view-when-no-view-matches-the-selection.json'
		},
		[
			{
				name: 'selected view id is not in the document',
				input: { viewId: 'view.missing', patch: { title: 'Nowhere' } },
				output: summarize(result)
			}
		]
	);
});

test('Returns undefined when the document or view is missing', () => {
	const noDoc = patchGameView(undefined, intro, { title: 'Welcome' });
	const noView = patchGameView(doc, undefined, { title: 'Welcome' });

	expect(noDoc).toBeUndefined();
	expect(noView).toBeUndefined();

	recordExampleCases(
		{
			unitId: UNIT,
			symbol: 'patchGameView',
			state: 'returns-undefined-when-the-document-or-view-is-missing',
			evidence: 'examples-cases',
			file: 'returns-undefined-when-the-document-or-view-is-missing.json'
		},
		[
			{
				name: 'no document given returns undefined',
				input: { doc: null, viewId: 'view.intro' },
				output: summarize(noDoc)
			},
			{
				name: 'no selected view returns undefined',
				input: { doc: 'example document', viewId: null },
				output: summarize(noView)
			}
		]
	);
});
