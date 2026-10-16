import { expect } from '../../../../test/verificationExpect';
import { test } from 'vitest';
import { actor, commit, project, unit } from '../support/projectionFixture';
import { directions, optionsFixture } from '../support/optionsFixture';

/**
 * Stored design options are untrusted when hosted: besides dividing the images exactly, they
 * must keep what planning enforced when it wrote them. Directions differ after trimming and
 * case, no picture is shared by two options, and every option prompt hashes to its record.
 * SYNTHETIC planning-written Git files as checked out, changed here before the hub reads them.
 */
type Fixture = Awaited<ReturnType<typeof optionsFixture>>;
type Json = Record<string, unknown>;
type Binding = { file: string; sha256: string };
type Option = Json & { images: Binding[]; prompt: Binding | null };
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
