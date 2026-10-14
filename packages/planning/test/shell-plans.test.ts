import { PNG } from 'pngjs';
import { expect, test } from 'vitest';
import type { CreatePlanInput } from '../src/models/PlanningBridge.types';
import { author, contract, fixture } from './planFixture';

/**
 * A shell is planned as visual composition: its plan has an id of its own kind in the folder of
 * Shells, and its designs are images, as those of pages and components are.
 */
const generator = { provider: 'codex', model: 'selected' };
const shell: CreatePlanInput = {
	category: 'shell',
	slug: 'host-frame',
	title: 'Host frame',
	goal: 'Frames the workspace of a host.',
	author,
	contract
};

test('a shell plan has an id of its own kind in the folder of Shells', async () => {
	const { api } = await fixture();
	const created = await api.createPlan(shell);
	expect([created.value.unitId, created.value.category, created.value.path]).toEqual([
		'shell.host-frame',
		'shell',
		'src/shells/host-frame'
	]);
});

test('a shell design is an image: notes alone are refused, and an image is taken', async () => {
	const { api } = await fixture();
	await api.createPlan(shell);
	const design = { unitId: 'shell.host-frame', prompt: 'Draw the frame', generator };
	await expect(
		api.addDesign({ ...design, images: [], notes: 'A bar, the content and a status line.' })
	).rejects.toThrow('A visual design needs images; headless designs need notes');
	const bytes = PNG.sync.write(new PNG({ width: 2, height: 2 }));
	const pictured = await api.addDesign({
		...design,
		images: [{ state: 'default', viewport: 'desktop', bytes }]
	});
	expect([pictured.value.version, pictured.value.images.length]).toEqual(['v001', 1]);
});
