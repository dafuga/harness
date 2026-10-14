import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import { createPlanning } from '../../planning/src';
import { fixture, git } from './run-fixture';

/**
 * A shell is planned as visual composition: its plan names the desktop viewport, and an agent
 * asked from Shells plans it with an image through the image capability, as a component is.
 */
test('a shell plan is visual: it is planned for the desktop viewport under Shells', async () => {
	const f = await fixture();
	const plan = await f.planning.createPlan({
		category: 'shells',
		title: 'Host frame',
		goal: 'Frames the workspace of a host.'
	});
	expect(plan.category).toBe('shells');
	const stored = await (await createPlanning(f.root)).readPlan({ unitId: plan.id });
	expect([stored.category, stored.contract.viewports]).toEqual(['shell', ['desktop']]);
}, 20000);

test('an agent asked from Shells proposes a shell, and it is planned with an image', async () => {
	const f = await fixture();
	const proposal = {
		category: 'shells',
		title: 'Host frame',
		goal: 'Frames the workspace of a host.',
		proposal: 'A bar across the top, the content below it and a status line at the bottom.',
		contract: { inputs: [{ name: 'workspace', type: 'Workspace' }], outputs: [], errors: [] }
	};
	f.run.mockImplementation(async (turn) => ({ text: JSON.stringify(proposal), model: turn.model }));
	await f.service.start({
		intent: 'create',
		projectId: f.session.projectId!,
		category: 'shells',
		mode: 'plan',
		provider: 'codex',
		model: 'selected',
		effort: 'high',
		text: 'Add a frame for hosts'
	});
	await expect.poll(() => f.session.busy, { timeout: 12000 }).toBe(false);
	const plans = await f.planning.plans(git(f.root, 'rev-parse', 'HEAD'));
	const plan = plans.find((item) => item.title === 'Host frame');
	expect(plan?.category).toBe('shells');
	expect(plan?.versions[0].images).toHaveLength(1);
	expect(f.generator.generateImage).toHaveBeenCalledOnce();
	expect(f.events.at(-1)).toMatchObject({ kind: 'finished', created: { category: 'shells' } });
}, 20000);
