import type {
	CoverageStanding,
	ExplorerSlotCoverage,
	ExplorerStateCoverage
} from '../models/Explorer.types';
import type {
	HarnessCapture,
	HarnessRecord,
	HarnessScenario,
	HarnessUnit
} from '../models/Harness.types';

type Result = HarnessRecord['scenarios'][number];
export type Told = [CoverageStanding, string];
/** One declared scenario with its result, and the commit its captures must be of. */
export interface Judged {
	declared: HarnessScenario;
	result: Result;
	record: HarnessRecord;
	bound: string;
}
const short = (commit: string) => commit.slice(0, 7);
const located = / in (?:[\w.@+-]+\/)+[\w.@+[\]-]+/g;
const path = /(?:[\w.@+-]+\/)+[\w.@+[\]-]+\.[A-Za-z0-9]+/g;

/**
 * A reason as a reader is told it: without the file a recorded sentence names. Where something
 * is, in source or among the runner's files, is shown under Details and in the stored record.
 */
export function reasonText(text: string): string {
	return text.replace(located, '').replace(path, 'a file');
}
const order: CoverageStanding[] = ['failed', 'stale', 'missing', 'incomplete', 'passed'];

type Users = Map<string, string[]>;
const usersOf = new WeakMap<HarnessUnit[], Users>();

/** What uses each unit directly, read once from the units of a registry. */
function users(units: HarnessUnit[]): Users {
	const known = usersOf.get(units);
	if (known) return known;
	const found: Users = new Map();
	for (const unit of units.filter((item) => item.status === 'active')) {
		for (const { unit: used } of unit.dependencies) {
			found.set(used, [...(found.get(used) ?? []), unit.id]);
		}
	}
	usersOf.set(units, found);
	return found;
}

/** Everything made of a unit: what uses it, and what uses that, to any depth. */
function madeOf(units: HarnessUnit[], unit: string): Set<string> {
	const direct = users(units);
	const seen = new Set<string>();
	const queue = [...(direct.get(unit) ?? [])];
	while (queue.length > 0) {
		const next = queue.shift() as string;
		if (seen.has(next)) continue;
		seen.add(next);
		queue.push(...(direct.get(next) ?? []));
	}
	return seen;
}

/**
 * A scenario as it applies to one unit: with the states that show that unit. A state names what
 * it is a state of, a page as a rule, and so shows what that is made of in the registry of the
 * revision. A unit is shown by the states that name it and by no other; a unit no state names,
 * by the states that name something made of it; and a unit that nothing named is made of, as an
 * endpoint behind every screen is, stays under every state.
 */
export function scenarioFor(
	declared: HarnessScenario,
	unit: string,
	units: HarnessUnit[] = []
): HarnessScenario {
	const own = declared.states.filter((state) => state.units?.includes(unit));
	if (own.length > 0) return { ...declared, states: own };
	const made = madeOf(units, unit);
	const drawn = declared.states.filter((state) => state.units?.some((id) => made.has(id)));
	return drawn.length > 0 ? { ...declared, states: drawn } : declared;
}

/** The worst of several standings; what has nothing that applies is inapplicable. */
export function coverageWorst(standings: CoverageStanding[]): CoverageStanding {
	return order.find((standing) => standings.includes(standing)) ?? 'inapplicable';
}

/** A screenshot always shows running software; other evidence does only when it says it does. */
const stamped = (capture: HarnessCapture) =>
	capture.kind === 'screenshot' || capture.provenance === 'actual-capture';

/**
 * Why a capture does not stand for a commit: it names another build, or it shows running
 * software and names none. Null when it is bound to the commit.
 */
export function captureUnbound(capture: HarnessCapture, commit: string): string | null {
	const built = capture.server?.revision;
	if (built && built !== commit) return `is of a build of ${short(built)}, not of ${short(commit)}`;
	return !built && stamped(capture) ? 'names no build, so it is bound to no commit' : null;
}

/** What the record holds for one capture a state must have. */
function slot(judged: Judged, where: string, capture: HarnessCapture | undefined): Told {
	if (!capture) return ['incomplete', `No capture of ${where}.`];
	if (capture.status !== 'passed') return ['failed', `The capture of ${where} was rejected.`];
	if (capture.media === null) {
		const gap = reasonText(capture.gap ?? 'no bytes');
		return ['missing', `The capture of ${where} is not stored: ${gap}.`];
	}
	const unbound = captureUnbound(capture, judged.bound);
	return unbound ? ['stale', `The capture of ${where} ${unbound}.`] : ['passed', ''];
}

/** The captures a required state must have: one for each declared evidence, kind and viewport. */
function slots(judged: Judged, state: string, captures: HarnessCapture[]): ExplorerSlotCoverage[] {
	const named = `${judged.declared.title}: ${state}`;
	return (judged.declared.evidence ?? [])
		.filter((evidence) => evidence.states.includes(state))
		.flatMap(({ id, kind, viewports }) =>
			(viewports.length > 0 ? viewports : [null]).map((viewport): ExplorerSlotCoverage => {
				const found = captures.find(
					(capture) =>
						capture.evidence === id &&
						capture.kind === kind &&
						(capture.viewport ?? null) === viewport
				);
				const [standing, reason] = slot(
					judged,
					`${named}${viewport ? ` at ${viewport}` : ''}`,
					found
				);
				return {
					evidence: id,
					kind,
					viewport,
					capture: found ?? null,
					standing,
					reason: reason || null
				};
			})
		);
}

/**
 * One declared state of a scenario against what a record holds for it. An inapplicable state is
 * not asked for; one declared and not covered is incomplete. A required state must be recorded
 * as covered and have, for each declared evidence, kind and viewport, a capture that passed, is
 * stored and is of the commit that produced the result. Without a result to judge, `absent`
 * says how the state stands; nothing that is not recorded counts as covered.
 */
export function explorerState(
	judged: Judged | null,
	declared: HarnessScenario['states'][number],
	absent: Told
): ExplorerStateCoverage {
	const named = `${judged?.declared.title ?? declared.id}: ${declared.id}`;
	if (declared.coverage === 'inapplicable') return told(declared, ['inapplicable', '']);
	if (declared.coverage !== 'required') {
		const why = `${named} is declared and not covered. ${declared.reason ?? ''}`.trim();
		return told(declared, ['incomplete', why]);
	}
	const recorded = judged?.result.states.find((item) => item.id === declared.id);
	if (!judged) return told(declared, [absent[0], '']);
	if (!recorded) return told(declared, [absent[0], `${named} has no result in the record.`]);
	return required(judged, declared, recorded.coverage, recorded.captures);
}

/** A state with its standing, what is wrong with it and the captures that were looked for. */
function told(
	declared: HarnessScenario['states'][number],
	[standing, reason]: Told,
	found: ExplorerSlotCoverage[] = []
): ExplorerStateCoverage {
	return {
		state: declared.id,
		declared: declared.coverage,
		standing,
		reasons: [reason, ...found.flatMap((item) => item.reason ?? [])].filter(Boolean),
		slots: found
	};
}

/** A required state that has a result: recorded as covered, with every capture it must have. */
function required(
	judged: Judged,
	declared: HarnessScenario['states'][number],
	coverage: string,
	captures: HarnessCapture[]
): ExplorerStateCoverage {
	const named = `${judged.declared.title}: ${declared.id}`;
	if (coverage !== 'required') {
		return told(declared, ['incomplete', `${named} was recorded as ${coverage}, not as covered.`]);
	}
	const found = slots(judged, declared.id, captures);
	if (found.length === 0) {
		return told(declared, ['incomplete', `${named} declares no evidence to record.`]);
	}
	return told(declared, [coverageWorst(found.map((item) => item.standing)), ''], found);
}
