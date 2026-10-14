import { expect } from '../../../../test/verificationExpect';
import { test } from 'vitest';
import { actor, commit, project, unit } from '../support/projectionFixture';
import { directions, optionsFixture, singleFixture } from '../support/optionsFixture';

/**
 * The hosted reader shows a version of design options as planning committed it: each option with
 * its direction, exact prompts, generator and own images, the image it revises, and an approval
 * of one option as that option's alone. Options that do not divide the images exactly are refused.
 * A single design reads as it always did. SYNTHETIC data written by the real planning package.
 */
type Fixture = Awaited<ReturnType<typeof optionsFixture>>;
type Option = { id: string; images: Array<{ file: string; sha256: string }> };
const entity = (f: { projection: Fixture['projection'] }) =>
	f.projection.entity(actor, project.id, { entityId: unit.id, commit, branch: 'main' });
const stored = (f: Fixture, at: number) => f.stored.versions[at].options as unknown as Option[];

test('every option keeps its direction, exact prompts, generator and own images', async () => {
	const f = await optionsFixture();
	const [first, latest] = (await entity(f)).versions;
	expect(latest.options).toEqual(
		stored(f, 1).map((option, at) => ({
			...{ id: `o${at + 1}`, direction: directions[at], prompt: `Synthetic prompt 2.${at + 1}` },
			revisedPrompt: at === 1 ? 'Synthetic revised prompt 2.2' : null,
			generator: at === 2 ? 'codex · synthetic-alt' : 'codex · synthetic',
			imageHashes: option.images.map((image) => image.sha256)
		}))
	);
	expect(new Set(latest.images.map((image) => image.sha256)).size).toBe(3);
	expect(latest.images.map((image) => image.option)).toEqual(['o1', 'o2', 'o3']);
	expect(first.options?.map((option) => option.id)).toEqual(['o1', 'o2', 'o3']);
}, 30_000);

test('a version keeps the exact earlier image it revises', async () => {
	const f = await optionsFixture();
	const [first, latest] = (await entity(f)).versions;
	expect(latest.revises).toEqual({
		...{ version: 'v001', imageSha256: stored(f, 0)[1].images[0].sha256 },
		...{ region: null, threadId: null, option: 'o2' }
	});
	expect(first.revises ?? null).toBeNull();
}, 30_000);

test('the approval of option 2 is current, binds option 2 alone, and approves the plan', async () => {
	const f = await optionsFixture();
	const read = await entity(f);
	const [first, latest] = read.versions;
	expect(latest.approval).toMatchObject({
		...{ version: 'v002', option: 'o2', current: true },
		imageHashes: stored(f, 1)[1].images.map((image) => image.sha256)
	});
	expect(first.approval).toBeNull();
	expect(read.lifecycle).toBe('approved');
}, 30_000);

const tampered: Array<[string, (options: Option[]) => Option[]]> = [
	['claim one image twice', ([a, b, c]) => [a, b, { ...c, images: [...c.images, a.images[0]] }]],
	['leave an image unclaimed', ([a, b]) => [a, b]],
	[
		'bind a foreign hash',
		([a, b, c]) => [a, { ...b, images: [{ ...b.images[0], sha256: 'f'.repeat(64) }] }, c]
	],
	['skip an option id', ([a, b, c]) => [a, { ...b, id: 'o5' }, c]]
];
test.each(tampered)(
	'stored options that %s are refused',
	async (_name, edit) => {
		const f = await optionsFixture();
		f.change(f.design, (value) => ({ ...value, options: edit(value.options as Option[]) }));
		await expect(entity(f)).rejects.toThrow();
	},
	30_000
);

test('an approval of every image, naming no option, approves no option of the version', async () => {
	const f = await optionsFixture();
	const all = stored(f, 1).flatMap((option) => option.images);
	for (const file of f.approvals())
		f.change(file, ({ option: _option, ...value }) => ({ ...value, images: all }));
	const read = await entity(f);
	expect(read.versions[1].approval).toBeNull();
	expect(read.lifecycle).toBe('review');
}, 30_000);

test('an approval naming option 2 with the images of option 1 approves nothing', async () => {
	const f = await optionsFixture();
	for (const file of f.approvals())
		f.change(file, (value) => ({ ...value, images: stored(f, 1)[0].images }));
	const read = await entity(f);
	expect(read.versions[1].approval).toBeNull();
	expect(read.lifecycle).toBe('review');
}, 30_000);

test('a single design keeps its flat images, no options, and its approval of every image', async () => {
	const f = await singleFixture();
	const read = await entity(f);
	const [only] = read.versions;
	expect(only.options).toBeUndefined();
	expect(only.images.map((image) => image.option)).toEqual([undefined]);
	expect(only.approval).toMatchObject({ version: 'v001', current: true });
	expect(only.approval?.option).toBeUndefined();
	expect(read.lifecycle).toBe('approved');
}, 30_000);
