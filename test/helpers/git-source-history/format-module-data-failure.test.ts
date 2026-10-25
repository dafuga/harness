import { expect, test } from 'vitest';
import { formatModuleDataFailure } from '../../../src/helpers/git-source-history/formatModuleDataFailure';

test('formatModuleDataFailure describes complete, scoped missing and unknown module data', () => {
	const complete = { commit: 'a'.repeat(40), modules: [], issues: [] };
	expect(formatModuleDataFailure(complete)).toBeNull();
	expect(formatModuleDataFailure(complete, 'page.orders')).toBe(
		`Incomplete module data for ${complete.commit}. Run harness validate --module page.orders --commit ${complete.commit} --json. Unknown module: page.orders`
	);
	const incomplete = { ...complete, issues: ['Missing source'] };
	expect(formatModuleDataFailure(incomplete)).toBe(
		`Incomplete module data for ${complete.commit}. Run harness validate --commit ${complete.commit} --json. Missing source`
	);
	expect(incomplete.issues).toEqual(['Missing source']);
	const module = {
		id: 'page.orders',
		kind: 'page',
		category: 'pages',
		issues: [
			{
				kind: 'evidence' as const,
				field: 'screenshots.desktop',
				message: 'Missing image.',
				repair: 'Capture it.'
			}
		]
	};
	expect(formatModuleDataFailure({ ...complete, modules: [module] })).toBeNull();
	expect(
		formatModuleDataFailure({
			...complete,
			modules: [{ ...module, issues: [{ ...module.issues[0], kind: 'metadata' as const }] }]
		})
	).toContain('page.orders: screenshots.desktop');
});
