import { expect } from '../../../test/verificationExpect';
import { test, vi } from 'vitest';
import { PNG } from 'pngjs';
import { createPlanning } from '../../planning/src/lib/planning/index';
import type { RunRequest } from '../src/models/DesktopBridge.types';
import { fixture, git, settled } from './run-fixture';

/**
 * A Plan of a page makes its design options one by one, each from its own direction, and commits
 * them together as one immutable version: three unless the Plan asks for another count. A failed
 * or cancelled option leaves no version and no commit of one. A headless Plan stays notes only.
 */
type Made = Awaited<ReturnType<typeof fixture>>;
const counted = (f: Made, designOptions: number) => ({ ...f.request, designOptions }) as RunRequest;
/** Each generation answers an image of its own; `step` may act on the nth one first. */
function distinct(f: Made, step: (call: number) => void = () => {}) {
	let call = 0;
	vi.mocked(f.generator.generateImage).mockImplementation(async () => {
		step(++call);
		return { bytes: PNG.sync.write(new PNG({ width: call + 1, height: 2 })), revisedPrompt: null };
	});
}
const designCommits = (f: Made, head: string) =>
	git(f.root, 'log', '--format=%s', `${head}..HEAD`)
		.split('\n')
		.filter((subject) => /design v\d+/.test(subject));
async function versions(f: Made) {
	const plan = await (await createPlanning(f.root)).readPlan({ unitId: f.request.entityId });
	return plan.versions as unknown as Array<{ options?: Array<{ images: { sha256: string }[] }> }>;
}

test('a page Plan generates three separately directed options and commits them once', async () => {
	const f = await fixture();
	distinct(f);
	const head = git(f.root, 'rev-parse', 'HEAD');
	await settled(f);
	const prompts = vi.mocked(f.generator.generateImage).mock.calls.map(([input]) => input.prompt);
	expect(new Set(prompts).size).toBe(3);
	expect(designCommits(f, head)).toHaveLength(1);
	const [saved] = await versions(f);
	const hashes = saved.options?.flatMap((option) => option.images.map((image) => image.sha256));
	expect(new Set(hashes).size).toBe(3);
}, 60000);

test('a Plan that asks for two options generates two', async () => {
	const f = await fixture();
	distinct(f);
	await settled(f, counted(f, 2));
	expect(f.generator.generateImage).toHaveBeenCalledTimes(2);
	expect((await versions(f))[0].options).toHaveLength(2);
}, 60000);

test('a failed option leaves no version and no design commit', async () => {
	const f = await fixture();
	distinct(f, (call) => {
		if (call === 2) throw new Error('The second option could not be generated');
	});
	const head = git(f.root, 'rev-parse', 'HEAD');
	await settled(f);
	expect(f.generator.generateImage).toHaveBeenCalledTimes(2);
	expect([await versions(f), designCommits(f, head)]).toEqual([[], []]);
}, 60000);

test('a Plan cancelled during an option leaves no version and no design commit', async () => {
	const f = await fixture();
	let runId = '';
	distinct(f, (call) => {
		if (call === 2) f.service.cancel(runId);
	});
	const head = git(f.root, 'rev-parse', 'HEAD');
	runId = (await f.service.start(f.request)).runId;
	await expect.poll(() => f.session.busy, { timeout: 30000 }).toBe(false);
	expect(f.generator.generateImage).toHaveBeenCalledTimes(2);
	expect([await versions(f), designCommits(f, head)]).toEqual([[], []]);
}, 60000);

test('a headless Plan keeps notes and generates no image, whatever count it is given', async () => {
	const f = await fixture();
	const entity = await f.planning.createPlan({
		category: 'functions',
		title: 'Totals',
		goal: 'Sum'
	});
	const thread = await f.planning.openThread({
		entityId: entity.id,
		version: null,
		imageSha256: null,
		state: null,
		viewport: null,
		region: null
	});
	await settled(f, { ...counted(f, 3), entityId: entity.id, threadId: thread.id });
	expect(f.generator.generateImage).not.toHaveBeenCalled();
	const plan = await (await createPlanning(f.root)).readPlan({ unitId: entity.id });
	expect(plan.versions.map((version) => [version.images, version.notes !== null])).toEqual([
		[[], true]
	]);
}, 60000);
