import { expect } from '../../../test/verificationExpect';
import { test, vi } from 'vitest';
import { PNG } from 'pngjs';
import type { RunRequest } from '../src/models/DesktopBridge.types';
import { fixture, git } from './run-fixture';

/**
 * Something new asked of the project agent: a visual plan it proposes is made as separately
 * directed design options saved as one version, three unless asked otherwise, whatever catalog the
 * request came from; a headless one makes no image; a failed option saves no version.
 */
type Made = Awaited<ReturnType<typeof fixture>>;
const contract = {
	inputs: [{ name: 'milliseconds', type: 'number' }],
	outputs: [{ name: 'formatted', type: 'string' }],
	errors: ['negative-value']
};
/** Asks, from the `hint` catalog, for something the agent proposes as `category` named `title`. */
async function created(f: Made, proposed: { category: string; title: string }, extra = {}) {
	const { category, title } = proposed;
	const text = JSON.stringify({ category, title, goal: title, proposal: `A ${title}`, contract });
	f.run.mockImplementation(async (turn) => ({ text, model: turn.model }));
	await f.service.start({
		...{ intent: 'create', projectId: f.session.projectId!, category: 'functions', mode: 'plan' },
		...{ provider: 'codex', model: 'selected', effort: 'high', text: 'Add it', ...extra }
	} as unknown as RunRequest);
	await expect.poll(() => f.session.busy, { timeout: 12000 }).toBe(false);
	const plans = await f.planning.plans(git(f.root, 'rev-parse', 'HEAD'));
	return plans.find((item) => item.title === title);
}
/** Each generation answers an image of its own; the `failing` one throws. */
function distinct(f: Made, failing = 0) {
	let call = 0;
	vi.mocked(f.generator.generateImage).mockImplementation(async () => {
		if (++call === failing) throw new Error('This option could not be generated');
		return { bytes: PNG.sync.write(new PNG({ width: call + 1, height: 2 })), revisedPrompt: null };
	});
}
const prompts = (f: Made) =>
	new Set(vi.mocked(f.generator.generateImage).mock.calls.map(([input]) => input.prompt));

test('a new visual plan is made as three separately directed options in one version', async () => {
	const f = await fixture();
	distinct(f);
	const plan = await created(f, { category: 'components', title: 'Elapsed badge' });
	expect(plan?.versions.map((version) => version.options?.length)).toEqual([3]);
	expect(prompts(f).size).toBe(3);
	expect(f.events.at(-1)).toMatchObject({ kind: 'finished', created: { category: 'components' } });
}, 30000);

test('a new visual plan asked for two options from a headless catalog makes two', async () => {
	const f = await fixture();
	distinct(f);
	const plan = await created(f, { category: 'pages', title: 'Orders' }, { designOptions: 2 });
	expect(plan?.versions.map((version) => version.options?.length)).toEqual([2]);
	expect(prompts(f).size).toBe(2);
}, 30000);

test('a new headless plan makes no image whatever count it is given', async () => {
	const f = await fixture();
	const plan = await created(
		f,
		{ category: 'functions', title: 'Format time' },
		{ designOptions: 3 }
	);
	expect(f.generator.generateImage).not.toHaveBeenCalled();
	expect(plan?.versions.map((version) => [version.images, version.options])).toEqual([
		[[], undefined]
	]);
}, 30000);

test('a failed option of a new plan saves no version and names the draft it made', async () => {
	const f = await fixture();
	distinct(f, 2);
	const plan = await created(f, { category: 'components', title: 'Elapsed badge' });
	expect(f.generator.generateImage).toHaveBeenCalledTimes(2);
	expect(plan?.versions).toEqual([]);
	expect(f.events.at(-1)).toMatchObject({ kind: 'failed', created: { entityId: plan?.id } });
}, 30000);
