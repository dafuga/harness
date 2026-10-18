import type {
	HarnessExplanation,
	HarnessRecord,
	HarnessRevision,
	HarnessUnit
} from '../src/models/Harness.types';
import { record } from './entityFixture';
import { capture, ids, units } from './entityUnits';

/** What a preview is asked to show beside the plain history: named in the address it opens at. */
export type PreviewVariant =
	| ''
	| 'legacy'
	| 'partial'
	| 'declared'
	| 'shells'
	| 'console'
	| 'inherited'
	| 'states';

/** A visual error state in the same standardized synthetic history as its ordinary states. */
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

/** Valid unchanged visual evidence: the target keeps the capture's tested origin and build. */
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

/** The same recorded project at repository scale; generated units describe no real source. */
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

/**
 * The record of a commit as the preview shows it: the search scenario also recorded a spoken
 * clip of its matching state. `whole` is whether every required state of the page was captured.
 */
export function previewRecord(commit: string, whole = true): HarnessRecord {
	const taken = record(commit, whole);
	taken.scenarios[1].states[0].captures.push(capture(commit, { kind: 'audio', state: 'match' }));
	return taken;
}

const inventory = Array.from({ length: 70 }, (_, order) => `unit ${order + 1}`).join(', ');
const tried = 'Registration only; implementation unchanged.';

/**
 * Reasons as a history holds them from before notes were limited: four functions of one unit,
 * each repeating an inventory of everything its commit registered. Invented text, at the length
 * and in the shape of the analytics CPU client history that the limits were written for.
 */
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

/** A contract as a person declared it for the page: each item says in words what it is. */
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

/** A frame of the orders workspace: the page mounts it, and it holds the order list. */
export const frameId = 'app.component.order-frame';

/**
 * A revision with the orders page mounted inside the frame, of the kind that commit declared it:
 * a component where it was recorded as one, a shell where its manifest says so.
 */
export function withFrame(head: HarnessRevision, kind: string): HarnessRevision {
	const list = units.find((unit) => unit.id === ids.list)!;
	const frame: HarnessUnit = {
		...list,
		id: frameId,
		kind,
		title: 'OrderFrame',
		responsibility: 'Frames the orders workspace: its bar, its list and its status.',
		owns: { source: ['src/shells/OrderFrame.svelte'], symbols: ['OrderFrame'] },
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
