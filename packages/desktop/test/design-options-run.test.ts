import type { Made } from './design-options-run.test.types';
import { expect } from '../../../test/verificationExpect';
import { test, vi } from 'vitest';
import { PNG } from 'pngjs';
import { createPlanning } from '../../planning/src/lib/planning/index';
import type { RunRequest } from '../src/models/DesktopBridge.types';
import { fixture, git, settled } from './run-fixture';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { planDesign } from '../src/utils/planDesign';
import type { RunContext } from '../src/models/RunContext.types';
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
	await assertReferenceFormats();
	await assertPageReferences();
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

function referenceFixture(kind: 'wanted' | 'current' | 'missing') {
	const reference = PNG.sync.write(new PNG({ width: 4, height: 3 }));
	const version = referenceVersion(reference);
	const captured: Array<Buffer | null> = [];
	const generator = {
		generateImage: vi.fn(async (input: { reference: string | null; prompt: string }) => {
			captured.push(input.reference ? await readFile(input.reference) : null);
			return {
				bytes: PNG.sync.write(new PNG({ width: captured.length + 1, height: 2 })),
				revisedPrompt: null
			};
		})
	};
	const planning = {
		image: vi.fn().mockResolvedValue(reference),
		addDesign: vi.fn().mockResolvedValue({ ...version, version: 'v003' }),
		appendMessage: vi.fn().mockResolvedValue({ id: 'synthetic-message' })
	};
	const currentImage = vi.fn().mockResolvedValue(kind === 'current' ? reference : null);
	const emit = vi.fn();
	const context = {
		id: 'synthetic-run',
		root: '/synthetic-project',
		session: { atBranch: vi.fn().mockResolvedValue(undefined) },
		runner: {},
		request: { entityId: 'page.orders', threadId: 'unanchored', provider: 'codex', mode: 'plan' },
		revision: { branch: 'main', commit: 'a'.repeat(40), tip: 'a'.repeat(40), atTip: true },
		entity: {
			id: 'page.orders',
			title: 'Orders',
			category: 'pages',
			threads: [],
			latestVersion: kind === 'wanted' ? version.version : null,
			versions: kind === 'wanted' ? [{ ...version, version: 'v001' }, version] : []
		},
		planning,
		generator,
		currentImage,
		imageModel: 'synthetic-image',
		signal: new AbortController().signal,
		emit
	} as unknown as RunContext;
	return { context, generator, planning, currentImage, emit, captured, reference, version };
}
async function assertPageReferences() {
	for (const kind of ['wanted', 'current', 'missing'] as const) {
		const f = referenceFixture(kind);
		const count = kind === 'current' ? 1 : 3;
		f.context.request.designOptions = count;
		const request = kind === 'missing' ? 'Design the whole page' : 'Change only the right panel';
		f.context.request.text = request;
		const result = await planDesign(f.context, 'Use a compact composition');
		expect(f.generator.generateImage).toHaveBeenCalledTimes(count);
		for (const [input] of f.generator.generateImage.mock.calls) {
			expect(input.prompt).toContain(request);
			expect(input.prompt).toContain('Use a compact composition');
			expect(input.prompt).not.toMatch(/normalized rectangle whole image|Top icon navbar:/i);
			if (kind === 'missing') expect(input.prompt).toMatch(/no reference image (?:is )?available/i);
			else expect(input.prompt).toMatch(/preserve[\s\S]*outside[\s\S]*requested/i);
		}
		if (kind === 'missing') {
			expect(f.captured).toEqual([null, null, null]);
			expect(
				JSON.stringify([result, f.emit.mock.calls, f.planning.appendMessage.mock.calls])
			).toMatch(
				/no (?:visual |image )?reference|reference (?:unavailable|missing)|without (?:a |an )?(?:image )?reference/i
			);
		} else expect(f.captured).toEqual(Array(count).fill(f.reference));
		if (kind === 'wanted') {
			expect(f.planning.image).toHaveBeenCalledExactlyOnceWith({
				entityId: 'page.orders',
				version: 'v002',
				sha256: f.version.images[0].sha256,
				revision: 'a'.repeat(40),
				option: 'o2'
			});
			expect(f.currentImage).not.toHaveBeenCalled();
		} else {
			expect(f.planning.image).not.toHaveBeenCalled();
			expect(f.currentImage).toHaveBeenCalledTimes(1);
		}
		expect(f.planning.addDesign).toHaveBeenCalledTimes(1);
	}
}
function referenceVersion(reference: Buffer) {
	return {
		version: 'v002',
		createdAt: '2026-10-26T00:00:00.000Z',
		commit: 'a'.repeat(40),
		generator: 'synthetic',
		prompt: 'Earlier design',
		baseRevision: 'a'.repeat(40),
		approval: null,
		images: [
			{
				state: 'default',
				viewport: 'desktop',
				sha256: createHash('sha256').update(reference).digest('hex'),
				bytes: reference.length,
				option: 'o2'
			}
		]
	};
}

async function assertReferenceFormats() {
	for (const [extension, bytes] of [
		['png', PNG.sync.write(new PNG({ width: 2, height: 2 }))],
		['jpg', Buffer.from([255, 216, 255, 224, 0, 2, 255, 217])],
		['webp', Buffer.from('RIFF\x04\x00\x00\x00WEBP', 'binary')]
	] as const) {
		const f = referenceFixture('current');
		f.currentImage.mockResolvedValue(bytes);
		await planDesign(f.context, 'Preserve the screenshot format');
		expect(f.captured).toEqual([bytes, bytes, bytes]);
		for (const [input] of f.generator.generateImage.mock.calls)
			expect(input.reference).toMatch(new RegExp(`\\.${extension}$`));
	}
	const invalid = referenceFixture('current');
	invalid.currentImage.mockResolvedValue(Buffer.from('unsupported image format'));
	await expect(planDesign(invalid.context, 'Reject unsupported references')).rejects.toThrow();
	expect(invalid.generator.generateImage).not.toHaveBeenCalled();
	expect(invalid.planning.addDesign).not.toHaveBeenCalled();
}
