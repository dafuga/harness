// @harness-uid u_i4vqq2pyhj
import { shortCommit } from '../../../helpers/strings/shortCommit';
import type { DeclaredVideoClip, ExpectedCaptureSlot, Judged, Told } from '../explorerState.types';
import { reasonText, coverageWorst } from '../explorerState';
import type {
	ExplorerSlotCoverage,
	ExplorerStateCoverage
} from '../../../models/explorer-ui/Explorer.types';
import type { HarnessCapture, HarnessScenario } from '../../../models/explorer-ui/Harness.types';

/** A screenshot always shows running software; other evidence does only when it says it does. */
const stamped = (capture: HarnessCapture) =>
	capture.kind === 'screenshot' || capture.provenance === 'actual-capture';

/**
 * Why a capture does not stand for a commit: it names another build, or it shows running
 * software and names none. Null when it is bound to the commit.
 */
export function captureUnbound(capture: HarnessCapture, commit: string): string | null {
	const built = capture.server?.revision;
	if (built && built !== commit)
		return `is of a build of ${shortCommit(built)}, not of ${shortCommit(commit)}`;
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

/** The clips of a state that a video records at one viewport: each is a slot of its own. */
function clipsAt(judged: Judged, state: string, viewport: string | null): DeclaredVideoClip[] {
	if (viewport === null) return [];
	return (judged.declared.video?.clips ?? []).filter(
		(clip) => clip.state === state && clip.viewports.includes(viewport)
	);
}

/** The slots one declared evidence must fill at a viewport: one per clip it records, else one. */
function expectedAt(
	judged: Judged,
	state: string,
	evidence: { id: string; kind: string },
	viewport: string | null
): ExpectedCaptureSlot[] {
	const { id, kind } = evidence;
	const clips = kind === 'video' ? clipsAt(judged, state, viewport) : [];
	if (clips.length === 0) return [{ id, kind, viewport }];
	return clips.map((clip) => ({ id, kind, viewport, clip }));
}

/** Whether a capture fills a slot: the same evidence, kind and viewport and, for a clip, its own. */
function fills(
	capture: HarnessCapture,
	{ id, kind, viewport, clip }: ExpectedCaptureSlot
): boolean {
	const same =
		capture.evidence === id && capture.kind === kind && (capture.viewport ?? null) === viewport;
	if (!clip) return same;
	return (
		same &&
		capture.state === clip.state &&
		capture.video?.clipId === clip.id &&
		capture.video?.unit === clip.unit
	);
}

/** The slot one expected capture makes of what the record holds for it. */
function slotFor(
	judged: Judged,
	named: string,
	expected: ExpectedCaptureSlot,
	captures: HarnessCapture[]
): ExplorerSlotCoverage {
	const { id, kind, viewport } = expected;
	const found = captures.find((capture) => fills(capture, expected));
	const [standing, reason] = slot(judged, `${named}${viewport ? ` at ${viewport}` : ''}`, found);
	return {
		evidence: id,
		kind,
		viewport,
		capture: found ?? null,
		standing,
		reason: reason || null
	};
}

/**
 * The captures a required state must have: one for each declared evidence, kind and viewport, and
 * for a video one for each clip the manifest records for that state and viewport.
 */
function slots(judged: Judged, state: string, captures: HarnessCapture[]): ExplorerSlotCoverage[] {
	const named = `${judged.declared.title}: ${state}`;
	return (judged.declared.evidence ?? [])
		.filter((evidence) => evidence.states.includes(state))
		.flatMap((evidence) =>
			(evidence.viewports.length > 0 ? evidence.viewports : [null]).flatMap((viewport) =>
				expectedAt(judged, state, evidence, viewport).map((expected) =>
					slotFor(judged, named, expected, captures)
				)
			)
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
