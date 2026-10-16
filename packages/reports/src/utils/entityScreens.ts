import type { ExplorerCapture, ExplorerEvidence, ExplorerSide } from '../models/Explorer.types';
import type { HarnessScenario } from '../models/Harness.types';
import type { Evidence } from '../models/Report.types';
import { captureProvenance } from './captureProvenance';
import { mediaFile } from './harnessEvidence';

export interface ScreenOption {
	scenario: string;
	title: string;
	/** The states the scenario requires; one it marks missing or inapplicable is not offered. */
	states: string[];
	viewports: Array<{ id: string; label: string; size: string }>;
}

export interface ScreenPick {
	scenario: string;
	state: string;
	viewport: string;
}

export interface EntityScreens {
	/** The parent's capture at a selected commit; absent at the branch tip. */
	before?: Evidence;
	/** The capture of the shown revision, or the stated gap when it has none. */
	after: Evidence;
	/** True only when the shown capture is usable and was taken for the shown revision itself. */
	fresh: boolean;
	/** The revision an inherited capture was taken at. */
	origin?: string;
}

type Phase = NonNullable<Evidence['phase']>;
const media = ['screenshot', 'audio'];
const title = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);
const short = (commit: string) => commit.slice(0, 7);

/** The scenarios of an entity that are seen: those with a viewport, with what each declares. */
export function screenOptions(scenarios: HarnessScenario[]): ScreenOption[] {
	return scenarios
		.filter((scenario) => scenario.viewports.length > 0)
		.map((scenario) => ({
			scenario: scenario.id,
			title: scenario.title,
			states: scenario.states
				.filter((state) => state.coverage === 'required')
				.map((state) => state.id),
			viewports: scenario.viewports.map((viewport) => ({
				id: viewport.id,
				label: title(viewport.id),
				size: `${viewport.width} × ${viewport.height}`
			}))
		}));
}

/** What is shown: what a person picked where the scenario has it, else its first of each. */
export function screenPick(
	options: ScreenOption[],
	wanted: Partial<ScreenPick>
): ScreenPick | null {
	const option = options.find((item) => item.scenario === wanted.scenario) ?? options[0];
	if (!option) return null;
	const viewports = option.viewports.map((viewport) => viewport.id);
	const pick = (known: string[], asked?: string) =>
		asked && known.includes(asked) ? asked : (known[0] ?? '');
	return {
		scenario: option.scenario,
		state: pick(option.states, wanted.state),
		viewport: pick(viewports, wanted.viewport)
	};
}

const unrecorded = { standing: null, label: undefined, facts: undefined, note: undefined };

/** What the record of a side says produced a capture; nothing when the side has no such record. */
function told(side: ExplorerSide, found: ExplorerCapture) {
	const tested = side.record?.scenarios.find((entry) => entry.id === found.scenario);
	if (!side.record || !tested) return unrecorded;
	return captureProvenance(side.record, tested, found.capture);
}

/** A recorded capture as a gallery item, with the standing the record gives it and nothing more. */
function item(side: ExplorerSide, found: ExplorerCapture, phase: Phase): Evidence {
	const { capture, scenario, state } = found;
	const origin = told(side, found);
	const where = capture.viewport ?? capture.kind;
	return {
		id: `${phase}-${short(side.commit)}-${scenario}-${state}-${capture.evidence}-${where}`,
		title: `${scenario} · ${state}`,
		category: scenario,
		file: mediaFile(capture),
		status: origin.standing === 'unvalidated' ? 'not-proven' : capture.status,
		capturedAt: capture.capturedAt,
		viewport: capture.viewport,
		phase,
		comparison: `${scenario}|${state}|${capture.evidence}|${where}`,
		standing: origin.label,
		provenance: origin.facts,
		note: origin.note,
		missing: capture.media === null,
		mediaType: capture.kind === 'audio' ? 'audio' : 'image',
		mimeType: capture.mediaType,
		durationSeconds: capture.durationSeconds,
		transcript: capture.transcript
	};
}

/** What a gap is named by: the picked state, or that no visual scenario names the entity. */
function gapOf(pick: ScreenPick | null, at: string) {
	if (!pick) {
		const none = `No scenario with a viewport names this entity, so no screenshot of it is recorded at ${at}.`;
		return { key: 'undeclared', title: 'No screenshot', category: '', none };
	}
	return {
		key: `${pick.scenario}-${pick.state}-${pick.viewport}`,
		title: `${pick.scenario} · ${pick.state}`,
		category: pick.scenario,
		none: null
	};
}

/**
 * A side that has no capture of the picked state: its own stated gap, never another's capture.
 * With nothing to pick, no visual scenario names the entity, and the gap says that instead.
 */
function gap(
	side: ExplorerSide | null,
	pick: ScreenPick | null,
	phase: Phase,
	why: string | null
): Evidence {
	const at = short(side?.commit ?? '');
	const { key, title, category, none } = gapOf(pick, at);
	const own =
		side?.gap ?? `No capture of ${pick?.state} at ${pick?.viewport} is recorded for ${at}.`;
	return {
		id: `${phase}-gap-${key}`,
		title,
		category,
		file: '',
		status: 'not-proven',
		phase,
		note: why ?? none ?? own,
		missing: true,
		mediaType: 'image'
	};
}

const matches = (found: ExplorerCapture, pick: ScreenPick) =>
	found.capture.kind === 'screenshot' &&
	found.scenario === pick.scenario &&
	found.state === pick.state &&
	found.capture.viewport === pick.viewport;

interface Pane {
	found?: ExplorerCapture;
	shown: Evidence;
}

/** One side at the picked state: its own capture, or its stated gap. */
function pane(
	side: ExplorerSide | null,
	pick: ScreenPick | null,
	phase: Phase,
	why: string | null
): Pane {
	const found = pick ? side?.captures.find((entry) => matches(entry, pick)) : undefined;
	if (!side || !pick || !found) return { shown: gap(side, pick, phase, why) };
	// What stands for the branch tip is a capture of the tip; an older or rejected one is a gap.
	const stale = phase === 'current' && !current(found);
	return stale
		? { found, shown: gap(side, pick, phase, borrowed(side, found)) }
		: { found, shown: item(side, found, phase) };
}

/** True when the host says a capture was made from the build of exactly the commit of its side. */
const current = (found: ExplorerCapture) => found.current;

/** Why a recorded capture is not shown as the screenshot of the branch tip. */
function borrowed(side: ExplorerSide, found: ExplorerCapture): string {
	const at = short(side.commit);
	return found.inheritedFrom
		? `The capture on record was inherited from ${short(found.inheritedFrom)}; it was not captured at ${at}.`
		: `The capture on record is not usable for ${at}: it is ${found.standing}.`;
}

/**
 * The screenshot of one state at one viewport, out of the evidence the host gave. At the branch
 * tip that is exactly one image; at a selected commit it is the parent's and the commit's capture
 * of the same scenario, state and viewport. Nothing is aligned or compared here: a side that
 * holds no such capture is shown as its gap, and no other side or revision fills it. An entity
 * no visual scenario names has nothing to pick: each of its sides is that gap.
 */
export function entityScreens(evidence: ExplorerEvidence, pick: ScreenPick | null): EntityScreens {
	const paired = evidence.mode === 'commit';
	const after = pane(evidence.after, pick, paired ? 'after' : 'current', null);
	// The host says whether a capture stands for the commit of its side; an inherited one does not.
	const fresh = after.found !== undefined && current(after.found);
	const result: EntityScreens = { after: after.shown, fresh };
	if (after.found?.inheritedFrom) result.origin = after.found.inheritedFrom;
	if (!paired) return result;
	const why = evidence.before ? null : evidence.initial;
	return { before: pane(evidence.before, pick, 'before', why).shown, ...result };
}

/** Every screenshot and audio clip of the evidence, for the gallery, the viewer and the player. */
export function galleryItems(evidence: ExplorerEvidence): Evidence[] {
	const paired = evidence.mode === 'commit';
	const of = (side: ExplorerSide | null, phase: Phase) =>
		(side?.captures ?? [])
			.filter((found) => media.includes(found.capture.kind))
			.map((found) => item(side as ExplorerSide, found, phase));
	const items = [
		...(paired ? of(evidence.before, 'before') : []),
		...of(evidence.after, paired ? 'after' : 'current')
	];
	return items.map((entry, order) => ({ ...entry, order }));
}
