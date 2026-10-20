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
