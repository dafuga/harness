import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { author, fixture as planningFixture, git } from '../../../planning/test/planFixture';
import { projectionFixture, unit, unitPath } from './projectionFixture';

/**
 * SYNTHETIC design options as the real planning package commits them: plans are written in a
 * temporary Git repository by planning itself, and the hub then reads exactly the files committed
 * there. No image was generated; every picture is a small synthetic PNG of its own.
 */
type Json = Record<string, unknown>;
type Planning = Awaited<ReturnType<typeof planningFixture>>['api'];
const generator = { provider: 'codex', model: 'synthetic' };
const contract = {
	responsibility: 'Synthetic options',
	...{ inputs: [], outputs: [], errors: [], states: ['default'], viewports: ['desktop'] }
};
export const directions = ['Synthetic dense table', 'Synthetic card grid', 'Synthetic split view'];
function png(width: number, shade: number) {
	const image = new PNG({ width, height: 2 });
	image.data.fill(shade);
	return PNG.sync.write(image);
}
/** Three options of version `n`: distinct direction, prompt, picture; o2 revised, o3 its own model. */
function options(n: number) {
	return directions.map((direction, at) => ({
		...{ direction, prompt: `Synthetic prompt ${n}.${at + 1}` },
		revisedPrompt: at === 1 ? `Synthetic revised prompt ${n}.2` : null,
		...(at === 2 ? { generator: { provider: 'codex', model: 'synthetic-alt' } } : {}),
		images: [{ state: 'default', viewport: 'desktop', bytes: png(at + 2, n * 40 + at * 10) }]
	}));
}
async function planned() {
	const made = await planningFixture();
	await mkdir(join(made.root, 'specification/units'), { recursive: true });
	await writeFile(join(made.root, unitPath), JSON.stringify(unit));
	git(made.root, 'add', '.');
	git(made.root, 'commit', '-m', 'register the synthetic page');
	const plan = { unitId: unit.id, category: 'page', slug: 'example', title: 'Example' };
	await made.api.createPlan({ ...plan, goal: 'Review options', author, contract } as never);
	return made;
}
type Stored = { versions: Json[]; path: string; contractHash: string };
const read = async (api: Planning) =>
	(await api.readPlan({ unitId: unit.id })) as unknown as Stored;
const optionsOf = (version: Json) =>
	version.options as Array<{ id: string; images: Array<{ file: string; sha256: string }> }>;

/** The hub's projection fixture serving every committed file of the plan, by Git's own list. */
async function served(root: string, path: string) {
	const f = projectionFixture();
	for (const file of git(root, 'ls-files', path).split('\n').filter(Boolean))
		f.files.set(file, new Uint8Array(await readFile(join(root, file))));
	const json = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
	const change = (file: string, edit: (value: Json) => Json) => {
		const value = JSON.parse(new TextDecoder().decode(f.files.get(file)!)) as Json;
		f.files.set(file, json(edit(value)));
	};
	return {
		...f,
		change,
		approvals: () => [...f.files.keys()].filter((key) => key.includes('/approvals/'))
	};
}

/** v001 and v002 of three options each; v002 revises option 2 of v001 and its option 2 is approved. */
export async function optionsFixture() {
	const { root, api } = await planned();
	await api.addDesign({
		unitId: unit.id,
		prompt: 'Synthetic v001',
		generator,
		options: options(1)
	} as never);
	const source = optionsOf((await read(api)).versions[0])[1].images[0];
	const revises = { version: 'v001', file: source.file, imageSha256: source.sha256, region: null };
	await api.addDesign({
		...{ unitId: unit.id, prompt: 'Synthetic v002', generator, options: options(2) },
		revises: { ...revises, threadId: null, option: 'o2' },
		expectedLatest: 'v001'
	} as never);
	const before = await read(api);
	const chosen = optionsOf(before.versions[1])[1];
	await api.approveDesign({
		...{ unitId: unit.id, version: 'v002', option: 'o2', reviewer: 'Synthetic reviewer' },
		images: chosen.images.map(({ file, sha256 }) => ({ file, sha256 })),
		contractHash: before.contractHash
	} as never);
	const stored = await read(api);
	return {
		...(await served(root, stored.path)),
		stored,
		design: `${stored.path}/designs/v002/design.json`
	};
}

/** One legacy single design, written before options existed, and its approval of every image. */
export async function singleFixture() {
	const { root, api } = await planned();
	const images = [{ state: 'default', viewport: 'desktop', bytes: png(3, 90) }];
	await api.addDesign({ unitId: unit.id, prompt: 'Synthetic single', generator, images } as never);
	const before = await read(api);
	const flat = before.versions[0].images as Array<{ file: string; sha256: string }>;
	await api.approveDesign({
		...{ unitId: unit.id, version: 'v001', reviewer: 'Synthetic reviewer' },
		images: flat.map(({ file, sha256 }) => ({ file, sha256 })),
		contractHash: before.contractHash
	} as never);
	const stored = await read(api);
	return { ...(await served(root, stored.path)), stored };
}
