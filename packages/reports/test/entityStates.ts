import { modelDefinition } from './entityClassFixtures';
import type { HarnessRevision, HarnessScenario, HarnessUnit } from '../src/models/Harness.types';
import { record, revision } from './entityFixture';
import { capture, commits, ids, scenarios, units } from './entityUnits';

/** A page of the synthetic app that is made of nothing the orders page is made of. */
export const otherPage = 'app.page.returns';

/**
 * The scenarios of the fixture with each state naming the page it is a state of, as a registry
 * that records it does, and one more required state that is a state of another page.
 */
export const namedScenarios: HarnessScenario[] = scenarios.map((scenario) =>
	scenario.id !== 'orders-page'
		? scenario
		: {
				...scenario,
				units: [...scenario.units, otherPage],
				states: [
					...scenario.states.map((state) => ({ ...state, units: [ids.page] })),
					{ id: 'returns', coverage: 'required', units: [otherPage] }
				]
			}
);

/** The units of the fixture with that other page, which uses none of them. */
export const namedUnits: HarnessUnit[] = [
	...units,
	{ ...units[0], id: otherPage, title: 'ReturnsPage', dependencies: [] }
];

/** A recorded revision whose registry says which page each state is a state of. */
export function namedRevision(commit: string, changed: Partial<HarnessRevision['registry']> = {}) {
	const found = revision(commit, [record(commit)]);
	const registry = { ...found.registry, scenarios: namedScenarios, units: namedUnits, ...changed };
	return { ...found, registry };
}

export const both = () => ({
	head: namedRevision(commits.middle),
	parent: namedRevision(commits.first)
});
/** Current source observations across every explorer kind, beside older record values. */
export function withSourceMeasures(detail: HarnessRevision): HarnessRevision {
	const sample = detail.registry.units[0];
	const extra = [
		{ ...sample, id: 'app.shell.orders', kind: 'shell', title: 'Orders shell' },
		{
			...sample,
			id: 'app.model.order',
			kind: 'model',
			title: 'Order model',
			owns: { source: ['src/models/Order.ts'], symbols: ['Order'] },
			modelDefinitions: [modelDefinition('Order', 'src/models/Order.ts')]
		}
	];
	const units = [...detail.registry.units, ...extra].map((unit) => ({
		...unit,
		sourceMeasurements: [
			{
				unit: unit.id,
				metric: 'source-bytes',
				unitOfMeasure: 'bytes',
				value: 12345,
				workload: null,
				profile: null,
				testedRevision: detail.commit
			},
			{
				unit: unit.id,
				metric: 'complexity',
				unitOfMeasure: 'points',
				value: 21,
				workload: null,
				profile: null,
				testedRevision: detail.commit
			}
		]
	}));
	const records = detail.records.map((taken) => ({
		...taken,
		measurements: [
			...taken.measurements,
			...units.flatMap((unit) =>
				['source-bytes', 'complexity'].map((metric) => ({
					unit: unit.id,
					metric,
					unitOfMeasure: metric === 'source-bytes' ? 'bytes' : 'points',
					value: null,
					workload: null,
					profile: null,
					unavailable: 'The earlier record did not collect this observation.'
				}))
			)
		]
	}));
	return { ...detail, records, registry: { ...detail.registry, units } };
}

/** Focused UI evidence exists independently of a full verification verdict. */
export function withFocused(
	detail: HarnessRevision,
	target = ids.page,
	viewports: Record<string, { width: number; height: number }> = {},
	deviceStates = false
): HarnessRevision {
	const captures = ['desktop', 'tablet', 'mobile'].map((viewport) => ({
		unit: target,
		viewport: viewports[viewport],
		capture: {
			...capture(detail.commit, { kind: 'screenshot', state: 'default', viewport }),
			state: deviceStates ? `default-${viewport}` : 'default',
			kind: 'screenshot' as const,
			status: 'passed' as const,
			bytes: 1,
			provenance: 'actual-capture' as const
		}
	}));
	const point = {
		commit: detail.commit,
		status: 'passed' as const,
		command: 'browser acceptance',
		assertion: 'page is rendered',
		output: 'passed',
		finishedAt: '2026-10-21T10:00:00Z',
		captures
	};
	return {
		...detail,
		records: [],
		regressions: [{ loop: 'visual-acceptance', units: [target], red: null, green: point }]
	};
}
