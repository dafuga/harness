import { PNG } from 'pngjs';
import { expect, test } from 'vitest';
import type { CreatePlanInput, DesignImageInput } from '../src/models/PlanningBridge.types';
import type { PlanCategory } from '../src/models/Planning.types';
import { author, contract, fixture } from './planFixture';

/**
 * What a plan may be given at the write boundary: a function takes notes and never an image; a
 * page still takes its images.
 */
const generator = { provider: 'codex', model: 'selected' };
const image = (): DesignImageInput => ({
	state: 'default',
	viewport: 'desktop',
	bytes: PNG.sync.write(new PNG({ width: 2, height: 2 }))
});
const plan = (category: PlanCategory, slug: string): CreatePlanInput => ({
	category,
	slug,
	title: slug,
	goal: `Plan ${slug}`,
	author,
	contract
});

test('the plan of a function takes notes and refuses an image', async () => {
	const { api } = await fixture();
	await api.createPlan(plan('function', 'filter'));
	const pictured = { unitId: 'function.filter', prompt: 'Draw it', generator, images: [image()] };
	await expect(api.addDesign(pictured)).rejects.toThrow('A function plan holds notes, not images');
	await expect(
		api.addDesign({ ...pictured, notes: 'Returns the values that match.' })
	).rejects.toThrow('A function plan holds notes, not images');
	const noted = await api.addDesign({
		unitId: 'function.filter',
		prompt: 'Write behavior',
		generator,
		images: [],
		notes: 'Returns the values that match.'
	});
	expect(noted.value.version).toBe('v001');
	expect(noted.value.images).toEqual([]);
});

test('the plan of a page still takes its images', async () => {
	const { api } = await fixture();
	await api.createPlan(plan('page', 'home'));
	const design = await api.addDesign({
		unitId: 'page.home',
		prompt: 'Home',
		generator,
		images: [image()]
	});
	expect(design.value.images).toHaveLength(1);
});
