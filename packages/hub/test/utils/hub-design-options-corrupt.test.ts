import type { Fixture, Option, Json } from './hub-design-options-corrupt.test.types';
import { expect } from '../../../../test/verificationExpect';
import { test } from 'vitest';
import { actor, commit, project, unit } from '../support/projectionFixture';
import { directions, optionsFixture } from '../support/optionsFixture';
const entity = (f: Fixture) =>
	f.projection.entity(actor, project.id, { entityId: unit.id, commit, branch: 'main' });
const folder = (f: Fixture) => f.design.replace(/design\.json$/, '');

test('options whose directions differ only by case and spacing are refused', async () => {
	const f = await optionsFixture();
	const same = `  ${directions[0].toUpperCase()}  `;
	f.change(f.design, (value) => ({
		...value,
		options: (value.options as Option[]).map((option, at) =>
			at === 1 ? { ...option, direction: same } : option
		)
	}));
	await expect(entity(f)).rejects.toThrow();
}, 30_000);

test('two options holding one picture under two files are refused', async () => {
	const f = await optionsFixture();
	f.change(f.design, (value) => {
		const options = value.options as Option[];
		const [first, second] = [options[0].images[0], options[1].images[0]];
		const images = value.images as Json[];
		const held = images.find((image) => image.file === first.file)!;
		// The second file now holds the first picture, its record and binding coherent with it.
		f.files.set(folder(f) + second.file, f.files.get(folder(f) + first.file)!);
		return {
			...value,
			images: images.map((image) =>
				image.file === second.file ? { ...held, file: second.file } : image
			),
			options: options.map((option, at) =>
				at === 1 ? { ...option, images: [{ file: second.file, sha256: first.sha256 }] } : option
			)
		};
	});
	await expect(entity(f)).rejects.toThrow();
}, 30_000);

test('an option prompt whose file no longer hashes to its record is refused', async () => {
	const f = await optionsFixture();
	const prompt = (f.stored.versions[1].options as unknown as Option[])[0].prompt!;
	const rewritten = 'Synthetic prompt rewritten after it was recorded';
	f.files.set(folder(f) + prompt.file, new TextEncoder().encode(rewritten));
	await expect(entity(f)).rejects.toThrow();
}, 30_000);
