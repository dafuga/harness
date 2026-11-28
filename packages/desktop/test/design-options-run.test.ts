import type { Made } from './design-options-run.test.types';
import { expect } from '../../../test/verificationExpect';
import { test, vi } from 'vitest';
import { PNG } from 'pngjs';
import { createPlanning } from '../../planning/src/lib/planning/index';
import type { RunRequest } from '../src/models/DesktopBridge.types';
import { fixture, git, settled, visualAnswer } from './run-fixture';
const counted = (f: Made, designOptions: number) => ({ ...f.request, designOptions }) as RunRequest;
const visualTurnTimeout = 45000;
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

test('a page Plan saves three Sonnet mockups across all default widths in one version', async () => {
	const f = await fixture();
	distinct(f);
	const options = ['One', 'Two', 'Three'].map((direction) => ({
		direction,
		html: '<main>' + direction + '</main>',
		css: 'main { padding: 1rem; }'
	}));
	f.run.mockImplementation(async (turn) => ({
		model: turn.model,
		text: JSON.stringify({ sources: ['src/owned.ts'], stylesheets: [], before: null, options })
	}));
	const head = git(f.root, 'rev-parse', 'HEAD');
	await settled(f, f.request, visualTurnTimeout);
	const plan = await (await createPlanning(f.root)).readPlan({ unitId: f.request.entityId });
	expect(plan.versions[0]?.generator).toEqual({ provider: 'claude', model: 'claude-sonnet-5-5' });
	expect(
		plan.versions[0]?.options?.map((option) =>
			option.images.map(
				({ file }) => plan.versions[0].images.find((image) => image.file === file)?.viewport
			)
		)
	).toEqual(
		Array.from({ length: 3 }, () => ['width-390', 'width-834', 'width-1440', 'width-1920'])
	);
	expect(designCommits(f, head)).toHaveLength(1);
	expect(f.generator.generateImage).not.toHaveBeenCalled();
}, 60000);

test('a Plan that asks for two options generates two', async () => {
	const f = await fixture();
	await settled(f, counted(f, 2), visualTurnTimeout);
	expect(f.renderMockups).toHaveBeenCalledOnce();
	expect((await versions(f))[0].options).toHaveLength(2);
}, 60000);

test('a failed option leaves no version and no design commit', async () => {
	const f = await fixture();
	f.renderMockups.mockRejectedValueOnce(new Error('The second option could not be rendered'));
	const head = git(f.root, 'rev-parse', 'HEAD');
	await settled(f);
	expect(f.renderMockups).toHaveBeenCalledOnce();
	expect([await versions(f), designCommits(f, head)]).toEqual([[], []]);
}, 60000);

test('a Plan cancelled during an option leaves no version and no design commit', async () => {
	const f = await fixture();
	let runId = '';
	f.renderMockups.mockImplementationOnce(async (captures) => {
		f.service.cancel(runId);
		return captures.map(() => PNG.sync.write(new PNG({ width: 2, height: 2 })));
	});
	const head = git(f.root, 'rev-parse', 'HEAD');
	runId = (await f.service.start(f.request)).runId;
	await expect.poll(() => f.session.busy, { timeout: 30000 }).toBe(false);
	expect(f.renderMockups).toHaveBeenCalledOnce();
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
	expect(f.renderMockups).not.toHaveBeenCalled();
	const plan = await (await createPlanning(f.root)).readPlan({ unitId: entity.id });
	expect(plan.versions.map((version) => [version.images, version.notes !== null])).toEqual([
		[[], true]
	]);
}, 60000);

test('Haiku adds widths and states then rerenders the saved design without replacing its source', async () => {
	const f = await fixture();
	// Each turn persists real Git LFS mockups, including under background scheduling.
	const turnTimeout = 120000;
	const first = await settled(f, counted(f, 2), turnTimeout);
	expect(f.events.at(-1)).toMatchObject({ kind: 'finished', runId: first.runId });
	const pngs = f.renderMockups.mock.calls[0][0].map((capture) => capture.html);
	const busy = [
		{ html: '<main>Busy option 1</main>', css: '' },
		{ html: '<main>Busy option 2</main>', css: '' }
	];
	f.run.mockImplementation(async (turn) => ({
		model: turn.model,
		text:
			visualAnswer(turn) ??
			JSON.stringify(
				turn.prompt.includes('Rerender')
					? { widths: [], states: [] }
					: { widths: [1024], states: [{ id: 'busy', before: null, options: busy }] }
			)
	}));
	const change = { ...f.request, text: 'Add a 1024px viewport and a busy state' };
	await settled(f, change, turnTimeout);
	expect(f.events.at(-1)).toMatchObject({ kind: 'finished' });
	const captures = f.renderMockups.mock.calls[1][0];
	expect(
		captures
			.filter((capture) => capture.state === 'default' && capture.viewport.width !== 1024)
			.map((capture) => capture.html)
	).toEqual(pngs);
	expect(captures.filter((capture) => capture.state === 'busy')).toHaveLength(10);
	await settled(f, { ...f.request, text: 'Rerender' }, turnTimeout);
	expect(f.events.at(-1)).toMatchObject({ kind: 'finished' });
	expect(f.renderMockups.mock.calls[2][0]).toEqual(captures);
	expect(f.run.mock.calls.map(([turn]) => turn.model)).toEqual([
		'claude-sonnet-5-5',
		'claude-haiku-5-5',
		'claude-haiku-5-5'
	]);
}, 390000);
