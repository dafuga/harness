import type { Made } from './design-options-creation.test.types';
import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import type { RunRequest } from '../src/models/DesktopBridge.types';
import { fixture, git, settled, visualAnswer } from './run-fixture';
const contract = {
	inputs: [{ name: 'milliseconds', type: 'number' }],
	outputs: [{ name: 'formatted', type: 'string' }],
	errors: ['negative-value']
};
/** Asks, from the `hint` catalog, for something the agent proposes as `category` named `title`. */
async function created(f: Made, proposed: { category: string; title: string }, extra = {}) {
	const { category, title } = proposed;
	const text = JSON.stringify({ category, title, goal: title, proposal: `A ${title}`, contract });
	f.run.mockImplementation(async (turn) => ({
		text: visualAnswer(turn) ?? text,
		model: turn.model
	}));
	const request = {
		...{ intent: 'create', projectId: f.session.projectId!, category: 'functions', mode: 'plan' },
		...{ provider: 'codex', model: 'selected', effort: 'high', text: 'Add it', ...extra }
	} as unknown as RunRequest;
	await settled(f, request, 45000);
	const plans = await f.planning.plans(git(f.root, 'rev-parse', 'HEAD'));
	return plans.find((item) => item.title === title);
}
test('a new visual plan is made as three separately directed options in one version', async () => {
	const f = await fixture();
	const plan = await created(f, { category: 'components', title: 'Elapsed badge' });
	expect(plan?.versions.map((version) => version.options?.length)).toEqual([3]);
	expect(f.renderMockups.mock.calls[0][0]).toHaveLength(12);
	expect(f.events.at(-1)).toMatchObject({ kind: 'finished', created: { category: 'components' } });
}, 60000);

test('a new visual plan asked for two options from a headless catalog makes two', async () => {
	const f = await fixture();
	const plan = await created(f, { category: 'pages', title: 'Orders' }, { designOptions: 2 });
	expect(plan?.versions.map((version) => version.options?.length)).toEqual([2]);
	expect(f.renderMockups.mock.calls[0][0]).toHaveLength(8);
}, 60000);

test('a new headless plan makes no image whatever count it is given', async () => {
	const f = await fixture();
	const plan = await created(
		f,
		{ category: 'functions', title: 'Format time' },
		{ designOptions: 3 }
	);
	expect(f.renderMockups).not.toHaveBeenCalled();
	expect(plan?.versions.map((version) => [version.images, version.options])).toEqual([
		[[], undefined]
	]);
}, 60000);

test('a failed option of a new plan saves no version and names the draft it made', async () => {
	const f = await fixture();
	f.renderMockups.mockRejectedValueOnce(new Error('This option could not be rendered'));
	const plan = await created(f, { category: 'components', title: 'Elapsed badge' });
	expect(f.renderMockups).toHaveBeenCalledOnce();
	expect(plan?.versions).toEqual([]);
	expect(f.events.at(-1)).toMatchObject({ kind: 'failed', created: { entityId: plan?.id } });
}, 60000);
