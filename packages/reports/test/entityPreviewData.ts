import type {
	HarnessExplanation,
	HarnessRecord,
	HarnessRevision,
	HarnessUnit
} from '../src/models/Harness.types';
import { record } from './entityFixture';
import { capture, commits, ids, units } from './entityUnits';
import { categorySources, projectPageSources } from './entityPreviewGroups';
import { withSourceMeasures } from './entityStates';
export function stateRecord(commit: string): HarnessRecord {
	const taken = previewRecord(commit);
	taken.scenarios[0].states.push({
		id: 'error',
		coverage: 'required',
		captures: ['desktop', 'mobile'].map((viewport) =>
			capture(commit, { kind: 'screenshot', state: 'error', viewport })
		)
	});
	return taken;
}
export function withStates(detail: HarnessRevision): HarnessRevision {
	const scenarios = detail.registry.scenarios.map((scenario) =>
		scenario.id === 'orders-page'
			? {
					...scenario,
					states: [...scenario.states, { id: 'error', coverage: 'required' }],
					evidence: scenario.evidence?.map((item) =>
						item.kind === 'screenshot' ? { ...item, states: [...item.states, 'error'] } : item
					)
				}
			: scenario
	);
	return {
		...detail,
		registry: { ...detail.registry, scenarios },
		records: [stateRecord(detail.commit)]
	};
}
export function withInherited(detail: HarnessRevision, origin: string): HarnessRevision {
	const taken = detail.records[0];
	const original = previewRecord(origin);
	const scenario = original.scenarios[0];
	const inherited = {
		...scenario,
		status: 'referenced' as const,
		inherited: true,
		origin: { record: original.id, commit: origin },
		originTests: original.tests.map(({ id, status }) => ({ id, status }))
	};
	return {
		...detail,
		records: [{ ...taken, scenarios: [inherited, ...taken.scenarios.slice(1)] }]
	};
}
export function withScale(detail: HarnessRevision): HarnessRevision {
	const template = detail.registry.units.find((unit) => unit.id === ids.filter)!;
	const generated = Array.from({ length: 1000 }, (_, at) => ({
		...template,
		id: `function.generated-${at}`,
		title: `Generated ${at}`,
		dependencies: [{ unit: ids.filter, via: 'import' }]
	}));
	return {
		...detail,
		registry: { ...detail.registry, units: [...detail.registry.units, ...generated] }
	};
}
export function previewRecord(commit: string, whole = true): HarnessRecord {
	const taken = record(commit, whole);
	taken.scenarios[1].states[0].captures.push(capture(commit, { kind: 'audio', state: 'match' }));
	return taken;
}
const inventory = Array.from({ length: 70 }, (_, order) => `unit ${order + 1}`).join(', ');
const tried = 'Registration only; implementation unchanged.';
export const legacyReasons: HarnessExplanation[] = [
	'cpuSample',
	'cpuClient',
	'cpuGroups',
	'cpuHistory'
].map((symbol) => ({
	unit: ids.filter,
	symbol,
	file: 'src/utils/cpuClient.ts',
	change: 'modified',
	behavior: `Register ${symbol} of the analytics CPU client beside ${inventory}.`,
	simplification: { attempt: tried, outcome: 'not-applicable' },
	performance: {
		attempt: symbol === 'cpuHistory' ? `Sampled once a second instead of ${inventory}.` : tried,
		outcome: symbol === 'cpuHistory' ? 'improved' : 'not-applicable'
	}
}));
export const declaredContract = {
	inputs: [
		{
			name: 'branch',
			type: 'string',
			description: 'The branch, as one encoded path segment.',
			examples: ['feature/orders']
		},
		{
			name: 'commit',
			type: 'hash | absent',
			description: 'The selected commit; absent at the tip.'
		},
		{ name: 'enabled', type: 'boolean', examples: [false] },
		{ name: 'limit', type: 'number', examples: [0] },
		{ name: 'empty', type: 'unknown', examples: [null] },
		{ name: 'query', type: 'string', examples: [''] },
		{
			name: 'settings',
			type: 'object',
			examples: [
				{ label: 'Safe <tag> ' + 'a long readable contract example '.repeat(40) },
				{ label: 'Other' }
			]
		},
		{ name: 'label', type: 'string' }
	],
	outputs: [
		{
			name: '+page',
			type: 'markup',
			description: 'The orders of an account as a list.',
			examples: ['<main>Orders</main>']
		}
	],
	errors: [
		{
			name: 'not-at-revision',
			type: 'notice',
			description: 'A missing page is said, not replaced.'
		}
	]
};
export const frameId = 'app.component.order-frame';
export function withFrame(head: HarnessRevision, kind: string): HarnessRevision {
	const list = units.find((unit) => unit.id === ids.list)!;
	const frame: HarnessUnit = {
		...list,
		id: frameId,
		kind,
		title: 'OrderFrame',
		responsibility: 'Frames the orders workspace: its bar, its list and its status.',
		owns: { source: ['src/layouts/OrderFrame.svelte'], symbols: ['OrderFrame'] },
		dependencies: [{ unit: ids.list, via: 'import' }],
		version: `v-${frameId}`
	};
	const mounted = head.registry.units.map((unit) =>
		unit.id === ids.page
			? { ...unit, dependencies: [...unit.dependencies, { unit: frameId, via: 'import' }] }
			: unit
	);
	return { ...head, registry: { ...head.registry, units: [...mounted, frame] } };
}
export function withMeasurements(detail: HarnessRevision): HarnessRevision {
	detail = withSourceMeasures(detail);
	const helper = detail.registry.units.find((unit) => unit.id === ids.filter)!;
	helper.budgets.performance = [];
	const baseline = detail.commit === commits.first;
	for (const taken of detail.records) {
		const timing = taken.measurements.find((item) => item.unit === ids.filter && item.workload)!;
		timing.profile = '1db6ce9451b5e530';
		timing.method =
			'Median of five batches of 1000 direct calls after three warmups using representative input.';
		taken.measurements.push(
			{
				...timing,
				metric: 'process-peak-rss-bytes',
				unitOfMeasure: 'bytes',
				value: 93_000_000,
				method:
					'Peak RSS of the whole benchmark process including the test runner, not attributable to one function.'
			},
			{
				unit: ids.page,
				metric: 'latency-warm-ms',
				unitOfMeasure: 'ms',
				value: baseline ? 14.2 : 12.1,
				workload: 'orders-page',
				profile: 'bun-reference',
				target: 'browser'
			},
			{
				unit: ids.page,
				metric: 'process-peak-rss-bytes',
				unitOfMeasure: 'bytes',
				value: baseline ? 3_000_000 : 2_500_000,
				workload: 'orders-page',
				profile: 'bun-reference',
				target: 'browser'
			}
		);
	}
	return detail;
}
export { withDocumentation } from './entityPreviewDocumentation';
/** Category metadata is synthetic selected-revision data, like contracts and measurements. */
export function withGroups(detail: HarnessRevision): HarnessRevision {
	return projectPageSources(categorySources(withFrame(detail, 'layout')));
}

export type { PreviewVariant } from './entityPreviewData.types';
