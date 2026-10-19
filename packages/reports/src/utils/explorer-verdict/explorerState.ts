import type { Judged, Told } from '../explorerState';
import { reasonText, coverageWorst } from '../explorerState';
import type { ExplorerSlotCoverage, ExplorerStateCoverage } from '../../models/Explorer.types';
import type { HarnessCapture, HarnessScenario } from '../../models/Harness.types';

const short = (commit: string) => commit.slice(0, 7);

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
