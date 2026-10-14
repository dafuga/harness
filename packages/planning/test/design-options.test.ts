import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import { PNG } from 'pngjs';
import type {
	AddDesignInput,
	ApproveDesignInput,
	OpenThreadInput
} from '../src/models/PlanningBridge.types';
import { author, contract, git, fixture } from './planFixture';

/**
 * Design options: a Plan of a visual unit keeps several distinct designs in one immutable version,
 * each an identity of its own apart from the version, state and viewport. An approval and a thread
 * bind one exact option. A version written before options reads and approves as it always did.
 */
type Api = Awaited<ReturnType<typeof fixture>>['api'];
type Image = { file: string; sha256: string };
type Option = { id: string; direction: unknown; images: Image[] };
const unitId = 'page.home';
const generator = { provider: 'codex', model: 'selected' };
const png = (width: number) => PNG.sync.write(new PNG({ width, height: 2 }));
const directions = ['Dense table', 'Card grid', 'Split view'];
/** `count` options, each one image of its own unless `same` gives every option one image. */
function draft(count: number, same = false): AddDesignInput {
	const options = Array.from({ length: count }, (_, at) => ({
		direction: directions[at] ?? `Direction ${at + 1}`,
		images: [{ state: 'default', viewport: 'desktop', bytes: png(same ? 2 : at + 2) }]
	}));
	return { unitId, prompt: 'Home', generator, options } as unknown as AddDesignInput;
}
async function saved(api: Api, count = 3): Promise<Option[]> {
	await api.addDesign(draft(count));
	const plan = await api.readPlan({ unitId });
	return (plan.versions[0] as unknown as { options: Option[] }).options;
}
/** A repository holding the draft plan of the home page. */
async function planned() {
	const made = await fixture();
	await made.api.createPlan({
		category: 'page',
		slug: 'home',
		title: 'Home',
		goal: 'Home',
		author,
		contract
	});
	return made;
}
const bindings = (option: Option) => option.images.map(({ file, sha256 }) => ({ file, sha256 }));

test('a version keeps every requested option as its own identity, committed once', async () => {
	const { root, api } = await planned();
	const head = git(root, 'rev-parse', 'HEAD');
	const options = await saved(api);
	expect(git(root, 'rev-list', '--count', `${head}..HEAD`)).toBe('1');
	expect(options.map((option) => option.direction)).toHaveLength(3);
	const ids = options.map((option) => option.id);
	expect(new Set(ids).size).toBe(3);
	expect(ids.filter((id) => /default|desktop|v001/.test(id))).toEqual([]);
	const hashes = options.flatMap((option) => option.images.map((image) => image.sha256));
	expect(new Set(hashes).size).toBe(3);
}, 30_000);

test('approving one option binds that option alone; binding two is refused', async () => {
	const { api } = await planned();
	const options = await saved(api);
	const plan = await api.readPlan({ unitId });
	const approval = (option: Option, images: Image[]) =>
		({
			unitId,
			version: 'v001',
			option: option.id,
			images,
			contractHash: plan.contractHash,
			reviewer: 'Reviewer'
		}) as unknown as ApproveDesignInput;
	await expect(
		api.approveDesign(approval(options[0], [...bindings(options[0]), ...bindings(options[1])]))
	).rejects.toMatchObject({ code: 'approval-mismatch' });
	await api.approveDesign(approval(options[1], bindings(options[1])));
	const approved = (await api.readPlan({ unitId })).approval as unknown as {
		option: string;
		images: Image[];
	};
	expect([approved.option, approved.images]).toEqual([options[1].id, bindings(options[1])]);
}, 30_000);

test.each([0, 11])(
	'%i options are refused, and nothing is committed',
	async (count) => {
		const { root, api } = await planned();
		const head = git(root, 'rev-parse', 'HEAD');
		await expect(api.addDesign(draft(count))).rejects.toMatchObject({
			code: 'invalid-input',
			message: expect.stringMatching(/option/i)
		});
		expect(git(root, 'rev-parse', 'HEAD')).toBe(head);
	},
	30_000
);

test('options that are one image copied are refused, and nothing is committed', async () => {
	const { root, api } = await planned();
	const head = git(root, 'rev-parse', 'HEAD');
	await expect(api.addDesign(draft(3, true))).rejects.toMatchObject({
		message: expect.stringMatching(/option/i)
	});
	expect(git(root, 'rev-parse', 'HEAD')).toBe(head);
}, 30_000);

test('a thread anchors one exact image of one option', async () => {
	const { api } = await planned();
	const options = await saved(api);
	const [image] = options[2].images;
	const thread = await api.openThread({
		unitId,
		version: 'v001',
		option: options[2].id,
		file: image.file,
		imageSha256: image.sha256,
		region: { x: 0, y: 0, width: 0.5, height: 0.5 },
		author
	} as unknown as OpenThreadInput);
	expect(thread.value.anchor).toMatchObject({ option: options[2].id, imageSha256: image.sha256 });
}, 30_000);

test('a single design written without options reads and approves as before', async () => {
	const { api } = await planned();
	const bytes = png(2);
	const design = await api.addDesign({
		unitId,
		prompt: 'Home',
		generator,
		images: [{ state: 'default', viewport: 'desktop', bytes }]
	});
	const plan = await api.readPlan({ unitId });
	expect(plan.versions.map((version) => version.images.length)).toEqual([1]);
	await api.approveDesign({
		unitId,
		version: 'v001',
		images: design.value.images.map(({ file, sha256 }) => ({ file, sha256 })),
		contractHash: plan.contractHash,
		reviewer: 'Reviewer'
	});
	expect((await api.readPlan({ unitId })).approval?.version).toBe('v001');
}, 30_000);
