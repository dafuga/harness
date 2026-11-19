import { expect, test } from 'vitest';
import type { ScenarioManifest } from '../src/core/development-tooling/unitTypes';
import type {
	GuidanceContext,
	StateRegistry
} from '../src/workflows/development-tooling/guide-units/guideUnits.types';
import { namedUnitStates } from '../src/workflows/development-tooling/guide-units/guidanceContext';

const unitId = 'component.alpha';
const unit = { id: unitId } as Parameters<typeof namedUnitStates>[1];
const viewports = [{ id: 'desktop', width: 920, height: 700 }];
const reason = 'The default presentation draws none of this notice style.';

function scenario(overrides: Partial<ScenarioManifest>): ScenarioManifest {
	return {
		schemaVersion: 1,
		id: 'visual.coverage',
		title: 'Visual coverage',
		kind: 'ui',
		units: [unitId],
		states: [],
		viewports,
		tests: [{ id: 'states', kind: 'e2e', runner: 'vitest', target: 'test/alpha.test.ts' }],
		evidence: [],
		...overrides
	};
}

function names(scenarios: ScenarioManifest[], registries: StateRegistry[] = []): string[] {
	const context = { registries, loaded: { scenarios } } as unknown as GuidanceContext;
	return namedUnitStates(context, unit).map((state) => state.name);
}

const declaredDefault = {
	id: 'default',
	title: 'Default',
	coverage: 'inapplicable' as const,
	reason,
	units: [unitId]
};
const problem = {
	id: 'component-alpha-problem',
	title: 'Problem',
	coverage: 'required' as const,
	units: [unitId]
};

test('a UI scenario that lists this unit with a reason suppresses only the generated default', () => {
	expect(names([scenario({ states: [declaredDefault, problem] })])).toEqual(['problem']);
});

test('an inapplicable default outside a UI scenario or without a reason keeps the generated default', () => {
	for (const kind of ['headless', 'audio'] as const)
		expect(names([scenario({ kind, viewports: [], states: [declaredDefault, problem] })])).toEqual([
			'default',
			'problem'
		]);
	const blank = { ...declaredDefault, reason: '   ' };
	expect(names([scenario({ states: [blank, problem] })])).toEqual(['default', 'problem']);
});

test('an inapplicable default must explicitly list this unit', () => {
	const unowned = { ...declaredDefault, units: undefined };
	expect(names([scenario({ states: [unowned, problem] })])).toEqual(['default', 'problem']);
	const otherUnit = { ...declaredDefault, units: ['component.beta'] };
	const shared = scenario({
		units: [unitId, 'component.beta'],
		states: [otherUnit, problem]
	});
	expect(names([shared])).toEqual(['default', 'problem']);
});

test('a registry default wins over an inapplicable default', () => {
	const registry: StateRegistry = {
		entity: unitId,
		where: 'catalog.json',
		kind: 'catalog',
		states: ['default']
	};
	expect(names([scenario({ states: [declaredDefault, problem] })], [registry])).toEqual([
		'default',
		'problem'
	]);
});

test('a unit-qualified default state wins over an inapplicable default', () => {
	const qualified = {
		id: 'component-alpha',
		title: 'Default',
		coverage: 'required' as const,
		units: [unitId]
	};
	expect(
		names([
			scenario({ states: [declaredDefault, problem] }),
			scenario({ id: 'visual.qualified', states: [qualified] })
		])
	).toEqual(['default', 'problem']);
});

test('a shared UI scenario that lists this unit on a required generic default wins', () => {
	const sharedRequired = {
		id: 'default',
		title: 'Default',
		coverage: 'required' as const,
		units: [unitId]
	};
	const shared = scenario({
		id: 'visual.shared',
		units: [unitId, 'component.beta'],
		states: [sharedRequired, problem]
	});
	const winner = namedUnitStates(
		{
			registries: [],
			loaded: {
				scenarios: [scenario({ states: [declaredDefault, problem] }), shared]
			}
		} as unknown as GuidanceContext,
		unit
	);
	expect(winner.map((state) => state.name)).toEqual(['default', 'problem']);
	expect(winner[0].reasons).toContain('Default presentation.');
});
