import { measureWorkload } from '../../../test/support/measureWorkload';
import { hubPlans } from '../src/utils/hubPlans';
import { hubSource } from '../src/utils/hubSource';
import { hubContractHash } from '../src/utils/hubJson';
import { actor, project, commit, projectionFixture } from './support/projectionFixture';
import { expect, test } from 'vitest';
import { hubPlanSchema, hubSchemas } from '../src/utils/hubSchemas';

/** A hosted project reads the plan of a shell as it reads every other plan. */
test('the hub reads the plan of a shell, and still refuses a category that does not exist', () =>
	measureWorkload('hub.function.hub-plans', 'recorded-layout-plan-read', async () => {
		const plan = {
			unitId: 'shell.host-frame',
			category: 'shell',
			slug: 'host-frame',
			title: 'Host frame',
			goal: 'Frames the workspace of a host.',
			path: 'src/shells/host-frame',
			createdAt: '2026-10-14T08:00:00.000Z',
			baseRevision: 'a'.repeat(40),
			contract: {
				responsibility: 'Frames the workspace of a host.',
				inputs: [],
				outputs: [],
				errors: [],
				states: ['default'],
				viewports: ['desktop']
			},
			contractHash: 'b'.repeat(64)
		};
		for (const category of ['shell', 'layout'] as const) {
			expect(
				hubSchemas(hubPlanSchema, {
					...plan,
					category,
					unitId: `${category}.host-frame`,
					path: `src/${category}s/host-frame`
				}).category
			).toBe(category);
			const actual = {
				...plan,
				category,
				unitId: `${category}.host-frame`,
				path: `src/${category}s/host-frame`,
				contractHash: await hubContractHash(plan.contract)
			};
			const fixture = projectionFixture();
			fixture.files.set(
				actual.path + '/plan.json',
				new TextEncoder().encode(JSON.stringify(actual))
			);
			const context = await hubSource({
				source: fixture.source,
				cache: fixture.cache,
				actor,
				project,
				ref: commit
			});
			expect(await hubPlans(context)).toEqual([actual]);
		}
		expect(() => hubSchemas(hubPlanSchema, { ...plan, category: 'widget' })).toThrow();
	}));
