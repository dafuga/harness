import { test, expect } from 'vitest';
import { LocalDocumentAdapter } from '../../src/adapters/LocalDocumentAdapter';
test('concurrent app-data updates retain every pending change and a rejected change does not block the queue', async () => {
	const document = new LocalDocumentAdapter<number[]>(undefined, () => []);
	await Promise.all(
		Array.from({ length: 20 }, (_, index) => document.update((values) => values.push(index)))
	);
	await expect(
		document.update(() => {
			throw new Error('refused');
		})
	).rejects.toThrow('refused');
	await document.update((values) => values.push(20));
	expect(await document.read()).toEqual(Array.from({ length: 21 }, (_, index) => index));
});
