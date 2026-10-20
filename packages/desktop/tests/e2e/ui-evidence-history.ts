import { createHash } from 'node:crypto';
import { PNG } from 'pngjs';
import type {
	HarnessCapture,
	HarnessRecord,
	HarnessRevision,
	HarnessScenario
} from '../../../reports/src/models/Harness.types';
import { runDocument } from '../../../reports/test/entityArtifacts';
import { record, revision, tested } from '../../../reports/test/entityFixture';
import { commits, ids, scenarios } from '../../../reports/test/entityUnits';
/**
 * SYNTHETIC SEALED HISTORY. The invented orders application of the reports tests at its three
 * commits, with real bytes behind every capture: each capture states the SHA-256 of the bytes
 * that are kept for it, as a sealed record does. The first commit has no record. The middle one
 * did not capture the empty state. At the tip one capture was rejected, the order card was not
 * run again and is inherited from the middle commit, and only the tip recorded a clip.
 */
export const cardScenario = 'order-card';
export const soundScenario = 'search-sound';
type Result = HarnessRecord['scenarios'][number];
/** The colour a screenshot is filled with, one for each commit, so two sides can be told apart. */
export const tones: Record<string, [number, number, number]> = {
	[commits.middle]: [40, 90, 200],
	[commits.tip]: [230, 170, 40]
};
/** The order card alone; its viewport was narrowed at the tip, so the two sides are not alike. */
const card = (commit: string): HarnessScenario => ({
	id: cardScenario,
	title: 'Order card alone',
	kind: 'ui',
	units: [ids.card],
	states: [{ id: 'default', coverage: 'required' }],
	viewports: [{ id: 'desktop', width: commit === commits.tip ? 1280 : 1440, height: 900 }],
	tests: [{ id: 'card-browser', kind: 'e2e', runner: 'playwright' }],
	evidence: [{ id: 'screens', kind: 'screenshot', states: ['default'], viewports: ['desktop'] }]
});
const sound: HarnessScenario = {
	id: soundScenario,
	title: 'Search box announcement',
	kind: 'headless',
	units: [ids.search],
	states: [{ id: 'announced', coverage: 'required' }],
	viewports: [],
	tests: [{ id: 'sound-flow', kind: 'e2e', runner: 'vitest' }],
	evidence: [{ id: 'audio', kind: 'audio', states: ['announced'], viewports: [] }]
};
const job = (id: string) => ({
	id,
	kind: 'e2e',
	target: id,
	status: 'passed' as const,
	durationMs: 20
});
const shot = { kind: 'screenshot', state: '', viewport: 'desktop' };
export interface Example {
	input: unknown;
	output: unknown;
}

/** What the tip keeps of the order card: the result of the middle commit, not run again. */
function inherited(origin: Result): Result {
	return {
		...origin,
		status: 'referenced',
		inherited: true,
		originTests: [job(`${cardScenario}:card-browser`)]
	} as Result;
}

function recorded(commit: string): HarnessRecord {
	const made = record(commit, commit !== commits.middle);
	const own = tested(commit, cardScenario, [{ id: 'default', captures: [shot] }]);
	const clip = tested(commit, soundScenario, [
		{ id: 'announced', captures: [{ kind: 'audio', state: '' }] }
	]);
	const middle = tested(commits.middle, cardScenario, [{ id: 'default', captures: [shot] }]);
	const more = commit === commits.tip ? [inherited(middle), clip] : [own];
	const jobs = [job(`${cardScenario}:card-browser`), job(`${soundScenario}:sound-flow`)];
	return { ...made, tests: [...made.tests, ...jobs], scenarios: [...made.scenarios, ...more] };
}

function at(commit: string, records: HarnessRecord[]): HarnessRevision {
	const made = revision(commit, records);
	const all = [...scenarios, card(commit), sound];
	return { ...made, registry: { ...made.registry, scenarios: all } };
}

function png(tone: [number, number, number], mark: number): Buffer {
	const image = new PNG({ width: 160, height: 100 });
	for (let offset = 0; offset < image.data.length; offset += 4)
		image.data.set([...tone, 255], offset);
	// One row that differs for each state and viewport, so no two captures are the same bytes.
	for (let x = 0; x < image.width; x++) image.data.set([mark, mark, mark, 255], x * 4);
	return PNG.sync.write(image);
}

/** One second of silence as a real WAV file: 8-bit mono at 8 kHz. */
function wav(): Buffer {
	const data = Buffer.alloc(8000, 128);
	const head = Buffer.alloc(44);
	head.write('RIFF', 0);
	head.writeUInt32LE(36 + data.length, 4);
	head.write('WAVEfmt ', 8);
	head.writeUInt32LE(16, 16);
	head.writeUInt16LE(1, 20);
	head.writeUInt16LE(1, 22);
	head.writeUInt32LE(8000, 24);
	head.writeUInt32LE(8000, 28);
	head.writeUInt16LE(1, 32);
	head.writeUInt16LE(8, 34);
	head.write('data', 36);
	head.writeUInt32LE(data.length, 40);
	return Buffer.concat([head, data]);
}

/** What the filter answered at a commit: the tip finds one order more than the middle did. */
function answered(commit: string, state: string, kind: string) {
	const stated = runDocument(state, kind, `taken for ${commit.slice(0, 7)}`);
	const found = 'output' in stated ? (stated.output ?? []) : [];
	const more = commit === commits.tip && kind === 'output';
	return more ? { ...stated, output: [...found, 'Order 1077 · Service plan'] } : stated;
}

/** The bytes one capture stands for, by what kind of capture it is. */
function bytesOf(
	commit: string,
	state: string,
	item: HarnessCapture,
	sample: { order: number; example?: Example }
): Buffer {
	if (item.kind === 'screenshot') return png(tones[commit], 10 + sample.order * 20);
	if (item.kind === 'audio') return wav();
	const original = answered(commit, state, item.kind);
	const document =
		sample.example && state === 'match'
			? {
					...original,
					input: sample.example.input,
					...(item.kind === 'output' ? { output: sample.example.output } : {})
				}
			: original;
	return Buffer.from(JSON.stringify(document, null, 2));
}

export interface SealedHistory {
	revisions: Record<string, HarnessRevision>;
	/** Every kept artifact by the SHA-256 its capture states. */
	bytes: Record<string, { mediaType: string; data: number[] }>;
}

/** Gives every capture its bytes and states their hash and where they are kept on the capture. */
function sealed(detail: HarnessRevision, bytes: SealedHistory['bytes'], example?: Example): void {
	const results = detail.records.flatMap((item) => item.scenarios);
	let order = 0;
	for (const found of results) {
		for (const state of found.states) {
			for (const item of state.captures) {
				const data = bytesOf(found.testedRevision, state.id, item, { order: order++, example });
				item.sha256 = createHash('sha256').update(data).digest('hex');
				item.media = `media/${item.sha256}.${item.media?.split('.').pop()}`;
				bytes[item.sha256] = { mediaType: item.mediaType, data: [...data] };
			}
		}
	}
}

/** The mobile capture of the empty state at the tip did not pass: it is kept, and rejected. */
function rejected(detail: HarnessRevision): void {
	const page = detail.records[0].scenarios.find((item) => item.id === 'orders-page');
	const empty = page?.states.find((state) => state.id === 'empty');
	const mobile = empty?.captures.find((item) => item.viewport === 'mobile');
	if (mobile) mobile.status = 'failed';
}

export function sealedHistory(example?: Example): SealedHistory {
	const bytes: SealedHistory['bytes'] = {};
	const middle = at(commits.middle, [recorded(commits.middle)]);
	const tip = at(commits.tip, [recorded(commits.tip)]);
	rejected(tip);
	sealed(middle, bytes, example);
	// What the tip inherited is the same capture of the middle commit, bytes and hash included.
	const kept = middle.records[0].scenarios.find((item) => item.id === cardScenario);
	const borrowed = tip.records[0].scenarios.find((item) => item.id === cardScenario);
	if (kept && borrowed) borrowed.states = kept.states;
	sealed({ ...tip, records: tip.records.map(withoutCard) }, bytes, example);
	const first = at(commits.first, []);
	return {
		revisions: { [commits.first]: first, [commits.middle]: middle, [commits.tip]: tip },
		bytes
	};
}

/** A record as it is sealed here: what it inherited was sealed with the record it came from. */
function withoutCard(item: HarnessRecord): HarnessRecord {
	return { ...item, scenarios: item.scenarios.filter((found) => found.id !== cardScenario) };
}

/** Only this fixture adds entities and diagnostics to its synthetic recorded observations. */
export function observedHistory(
	observedUnits: string[],
	browserErrors?: unknown[],
	example?: Example
) {
	const history = sealedHistory(example);
	for (const revision of Object.values(history.revisions)) {
		revision.registry = {
			...revision.registry,
			scenarios: revision.registry.scenarios.map((scenario) =>
				scenario.id === 'order-filter'
					? { ...scenario, units: [...new Set([...scenario.units, ...observedUnits])] }
					: scenario
			)
		};
	}
	if (browserErrors)
		Object.assign(history.revisions[commits.tip].records[0].tests[0], { browserErrors });
	return history;
}
