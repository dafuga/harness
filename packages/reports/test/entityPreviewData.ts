import type {
	HarnessExplanation,
	HarnessRecord,
	HarnessRevision,
	HarnessUnit
} from '../src/models/Harness.types';
import { record } from './entityFixture';
import { capture, ids, units } from './entityUnits';

/** What a preview is asked to show beside the plain history: named in the address it opens at. */
export type PreviewVariant = '' | 'legacy' | 'partial' | 'declared' | 'shells';

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
		{ name: 'branch', type: 'string', description: 'The branch, as one encoded path segment.' },
		{
			name: 'commit',
			type: 'hash | absent',
			description: 'The selected commit; absent at the tip.'
		}
	],
	outputs: [{ name: '+page', type: 'markup', description: 'The orders of an account as a list.' }],
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
