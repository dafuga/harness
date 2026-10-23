import type { ScreenOption, ScreenPick, Phase, Pane, EntityScreens } from './entityScreens.types';
import type {
	ExplorerCapture,
	ExplorerEvidence,
	ExplorerSide
} from '../../models/explorer-ui/Explorer.types';
import type { HarnessScenario } from '../../models/explorer-ui/Harness.types';
import type { Evidence } from '../../models/reports-media/Report.types';
import { captureProvenance } from '../reports-media/captureProvenance';
import { mediaFile } from './harnessEvidence';
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
function told(side: ExplorerSide, found: ExplorerCapture) {
	if (found.focused)
		return {
			standing: 'unvalidated' as const,
			label: 'Focused capture',
			facts: [{ label: 'Focused run', value: found.focused.loop + ' · ' + found.focused.status }],
			note: 'Captured from the exact served revision; this focused run grants no full verification verdict.'
		};
	const tested = side.record?.scenarios.find((entry) => entry.id === found.scenario);
	if (!side.record || !tested) return unrecorded;
	return captureProvenance(side.record, tested, found.capture);
}
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
		source: capture.server?.revision,
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
/** A side's own gap, never another's capture; an undeclared visual state says so. */
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
/** One side at the picked state: its own capture, or its stated gap. */
function pane(
	side: ExplorerSide | null,
	pick: ScreenPick | null,
	phase: Phase,
	why: string | null
): Pane {
	const found = pick ? side?.captures.find((entry) => matches(entry, pick)) : undefined;
	if (!side || !pick || !found) return { shown: gap(side, pick, phase, why) };
	// Validated unchanged proof keeps its original capture identity; rejected proof stays a gap.
	const stale = phase === 'current' && !found.usable;
	return stale
		? { found, shown: gap(side, pick, phase, borrowed(side, found)) }
		: { found, shown: item(side, found, phase) };
}
const current = (found: ExplorerCapture) => found.current;
/** Why a recorded capture is not shown as the screenshot of the branch tip. */
function borrowed(side: ExplorerSide, found: ExplorerCapture): string {
	const at = short(side.commit);
	return found.inheritedFrom
		? `The capture on record was inherited from ${short(found.inheritedFrom)}; it was not captured at ${at}.`
		: `The capture on record is not usable for ${at}: it is ${found.standing}.`;
}
/** The selected state's current capture or parent/commit pair, keeping every side's own gaps. */
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
/** A catalog preview of this entity's shown version: fresh first, else validated unchanged proof. */
export function catalogShot(
	evidence: ExplorerEvidence,
	preview?: ScreenPick,
	allowFocusedDefault = false
): Evidence | null {
	const own = evidence.after.captures.filter(
		(entry) => entry.usable && entry.capture.kind === 'screenshot' && entry.capture.media !== null
	);
	let usable = own.filter(
		(entry) =>
			!preview ||
			matches(entry, { ...preview, scenario: entry.focused ? entry.scenario : preview.scenario })
	);
	// Only default card/hover callers opt in; an explicit unavailable state remains a gap.
	if (!usable.length && allowFocusedDefault) usable = own.filter((entry) => Boolean(entry.focused));
	const found = usable.find((entry) => entry.current) ?? usable[0];
	if (!found) return null;
	return item(evidence.after, found, evidence.mode === 'commit' ? 'after' : 'current');
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

export type { ScreenOption, ScreenPick, EntityScreens } from './entityScreens.types';
