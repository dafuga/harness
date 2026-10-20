import { expect, test } from 'vitest';
import { exampleDocument, validateDocument } from '../src/index';
test('both starter dimensions validate', () => {
	for (const d of ['2d', '3d'] as const) expect(validateDocument(exampleDocument(d))).toEqual([]);
});

test('cyclic prerequisites cannot be saved as executable graphs', () => {
	const document = exampleDocument();
	document.views[0].checkpoints[0].requires = ['door'];
	expect(validateDocument(document)).toContain('Cyclic checkpoint prerequisites');
});

test('checkpoint image metadata accepts local immutable assets and rejects unsafe paths', () => {
	const doc = exampleDocument();
	doc.views[0].checkpoints[0].image = {
		path: 'static/game/checkpoints/' + 'a'.repeat(64) + '.png',
		model: 'gpt-image-2',
		prompt: 'A key',
		createdAt: '2026-10-20T00:00:00Z'
	};
	expect(validateDocument(doc)).toEqual([]);
	doc.views[0].checkpoints[0].image!.path = '../.env.local';
	expect(validateDocument(doc)).toContain('Invalid checkpoint');
});
