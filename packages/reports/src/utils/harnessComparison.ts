import type { HarnessCapture, HarnessRecord, HarnessRevision } from '../models/Harness.types';
import type { Evidence } from '../models/Report.types';
import { captureProvenance } from './captureProvenance';
import { mediaFile } from './harnessEvidence';

/** One revision of a comparison and the record of it that is looked at, if it has any. */
export interface ComparedSide {
	detail: HarnessRevision;
	record: HarnessRecord | null;
}
export interface StateChoice {
	scenario: string;
	state: string;
	viewport: string;
}
/** One recorded state on both sides, in words; a side without a capture says so. */
export interface AlignedState {
	key: string;
	label: string;
	before: string;
	after: string;
}

type Scenario = HarnessRecord['scenarios'][number];
interface Found {
	scenario: Scenario;
	state: string;
	capture: HarnessCapture;
}
const media = ['screenshot', 'audio'];
const short = (commit: string) => commit.slice(0, 7);
const keyOf = (found: Found) =>
	[
		found.scenario.id,
		found.state,
		found.capture.evidence,
		found.capture.viewport ?? found.capture.kind
	].join('|');

function captures(side: ComparedSide, choice: StateChoice): Found[] {
	const scenarios = (side.record?.scenarios ?? []).filter((item) => item.id === choice.scenario);
	return scenarios.flatMap((scenario) =>
		scenario.states
			.filter((state) => !choice.state || state.id === choice.state)
			.flatMap((state) =>
				state.captures
					.filter((capture) => media.includes(capture.kind))
					.filter(
						(capture) =>
							!choice.viewport || !capture.viewport || capture.viewport === choice.viewport
					)
					.map((capture) => ({ scenario, state: state.id, capture }))
			)
	);
}

/** The scenarios, states and viewports either side recorded, for the selectors. */
export function comparisonChoices(base: ComparedSide, head: ComparedSide) {
	const all = [base, head].flatMap((side) => side.record?.scenarios ?? []);
	const withMedia = all.filter((scenario) =>
		scenario.states.some((state) => state.captures.some((capture) => media.includes(capture.kind)))
	);
	const unique = (values: string[]) => [...new Set(values)].sort();
	return unique(withMedia.map((scenario) => scenario.id)).map((id) => {
		const states = withMedia
			.filter((scenario) => scenario.id === id)
			.flatMap((item) => item.states);
		return {
			scenario: id,
			states: unique(states.map((state) => state.id)),
			viewports: unique(
				states.flatMap((state) => state.captures.flatMap((item) => item.viewport ?? []))
			)
		};
	});
}

function gap(side: ComparedSide, where: string): string {
	const commit = short(side.detail.commit);
	return side.record
		? `no capture of ${where} in record ${side.record.id.slice(0, 12)}`
		: `no capture of ${where}: ${commit} has no verification record`;
}

function viewportLabel(sides: ComparedSide[], scenario: string, id?: string): string | undefined {
	const known = sides
		.flatMap((side) => side.detail.registry.scenarios)
		.find((item) => item.id === scenario);
	const found = known?.viewports.find((viewport) => viewport.id === id);
	return found ? `${found.width}px ${found.id}` : id;
}

interface Slot {
	key: string;
	scenario: string;
	state: string;
	where: string;
	viewport?: string;
	audio: boolean;
}

/** What every item of one aligned state shares, whichever side it is and whatever it holds. */
function shell(side: ComparedSide, phase: 'before' | 'after', slot: Slot) {
	const at = `${phase === 'before' ? 'Before' : 'After'} at ${short(side.detail.commit)}`;
	const item = {
		id: `${phase}-${slot.key}`,
		title: `${slot.scenario} · ${slot.state}`,
		category: slot.scenario,
		viewport: slot.viewport,
		phase,
		comparison: slot.key,
		mediaType: slot.audio ? ('audio' as const) : ('image' as const)
	};
	return { at, item };
}

/** A side that has no capture of the state: an explicit gap, never another side's capture. */
function absent(side: ComparedSide, phase: 'before' | 'after', slot: Slot) {
	const { at, item } = shell(side, phase, slot);
	const words = gap(side, slot.where);
	const missing: Evidence = {
		...item,
		file: '',
		status: 'not-proven',
		standing: `${at} · No capture`,
		note: `${at}: ${words}.`,
		missing: true
	};
	return { item: missing, words };
}

/** One side of one aligned state: its capture with its own provenance, or the stated gap. */
function sideItem(side: ComparedSide, phase: 'before' | 'after', slot: Slot, match?: Found) {
	if (!match || !side.record) return absent(side, phase, slot);
	const { at, item } = shell(side, phase, slot);
	const { capture } = match;
	const origin = captureProvenance(side.record, match.scenario, capture);
	const source = origin.facts.find((fact) => fact.label === 'Captured from');
	const recorded: Evidence = {
		...item,
		file: mediaFile(capture),
		status: capture.status,
		capturedAt: capture.capturedAt,
		standing: `${at} · ${origin.label}`,
		provenance: origin.facts,
		note: origin.note,
		missing: capture.media === null,
		mimeType: capture.mediaType,
		durationSeconds: capture.durationSeconds,
		transcript: capture.transcript
	};
	return { item: recorded, words: `${origin.label}, ${source ? source.value : ''}` };
}

function slotOf(sides: ComparedSide[], sample: Found, key: string): Slot {
	const { capture, scenario, state } = sample;
	const where = capture.viewport ? `${state} at ${capture.viewport}` : `${state} (${capture.kind})`;
	return {
		key,
		scenario: scenario.id,
		state,
		where,
		viewport: viewportLabel(sides, scenario.id, capture.viewport),
		audio: capture.kind === 'audio'
	};
}

/**
 * The recorded captures of one scenario on both sides of a comparison, aligned by state,
 * evidence and viewport, as gallery items the existing viewer pairs as before and after. Each
 * side keeps the provenance of its own capture. A side with no capture is an explicit gap; it
 * is never filled from the other side or from another revision.
 */
export function harnessComparison(base: ComparedSide, head: ComparedSide, choice: StateChoice) {
	const found = { before: captures(base, choice), after: captures(head, choice) };
	const every = [...found.after, ...found.before];
	const keys = [...new Set(every.map(keyOf))].sort();
	const items: Evidence[] = [];
	const aligned: AlignedState[] = [];
	for (const key of keys) {
		const slot = slotOf([head, base], every.find((item) => keyOf(item) === key) as Found, key);
		const match = (list: Found[]) => list.find((item) => keyOf(item) === key);
		const before = sideItem(base, 'before', slot, match(found.before));
		const after = sideItem(head, 'after', slot, match(found.after));
		items.push({ ...before.item, order: items.length }, { ...after.item, order: items.length + 1 });
		aligned.push({ key, label: slot.where, before: before.words, after: after.words });
	}
	return { items, aligned };
}
