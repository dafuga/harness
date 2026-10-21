import { createHash } from 'node:crypto';
import { fail } from '../core/errors';
import {
	regressionRecordSchema,
	type RegressionRecord,
	type RegressionView,
	type RegressionPoint
} from '../core/regressionTypes';
import type { HistoryNote } from '../core/historyTypes';
import { canonicalJson } from './canonicalJson';
import { checkedMedia, type MediaPlacer } from './mediaPlace';
import { mediaFacts } from './mediaFacts';
import type { ReadNote } from './note-lines/noteCommit';

type RegressionNote = Extract<HistoryNote, { kind: 'regression' }>;
export const regressionHash = (bytes: string | Buffer) =>
	createHash('sha256').update(bytes).digest('hex');
type Loaded = { record: RegressionRecord; output: string; files?: Map<string, Buffer> };
type Loader = (note: RegressionNote) => Promise<Loaded>;

/** A red commit never borrows a future green result. Corrupt evidence remains a visible gap. */
export async function regressionHistory(
	commit: string,
	notes: Map<string, ReadNote>,
	load: Loader,
	media: MediaPlacer = checkedMedia
): Promise<RegressionView[]> {
	const selected =
		notes
			.get(commit)
			?.entries.filter((note): note is RegressionNote => note.kind === 'regression') ?? [];
	const found: RegressionView[] = [];
	for (const note of selected) {
		try {
			found.push(await pairedRegression(await load(note), note, { notes, load }, media));
		} catch (error) {
			found.push({
				loop: note.loop,
				units: [],
				red: null,
				gap: error instanceof Error ? error.message : 'Regression evidence could not be read.'
			});
		}
	}
	return found;
}

async function pairedRegression(
	own: Loaded,
	note: RegressionNote,
	context: { notes: Map<string, ReadNote>; load: Loader },
	media?: MediaPlacer
): Promise<RegressionView> {
	const current = await regressionPoint(own, media),
		units = own.record.units;
	if (own.record.phase === 'red') return { loop: note.loop, units, red: current };
	const origin = own.record.red;
	if (!origin) return fail('The failing-test checkpoint is missing.');
	const entries = context.notes.get(origin.commit)?.entries ?? [];
	const redNote = entries.find(
		(item): item is RegressionNote =>
			item.kind === 'regression' &&
			item.record === origin.record &&
			item.phase === 'red' &&
			item.loop === note.loop
	);
	if (!redNote) return fail('The failing-test checkpoint is missing.');
	const red = await context.load(redNote);
	if (!sameRegression(red.record, own.record))
		return fail('The checkpoints do not prove unchanged tests and command.');
	return { loop: note.loop, units, red: await regressionPoint(red, media), green: current };
}

export function sameRegression(red: RegressionRecord, green: RegressionRecord): boolean {
	const phases =
		red.phase === 'red' &&
		red.status === 'failed' &&
		green.phase === 'green' &&
		green.status === 'passed';
	return phases && sameRun(red, green) && sameInputs(red, green);
}
function sameRun(red: RegressionRecord, green: RegressionRecord): boolean {
	return (
		red.source.commit !== green.source.commit &&
		green.red?.record === red.id &&
		green.red.commit === red.source.commit &&
		red.command === green.command &&
		red.assertion === green.assertion &&
		red.profile === green.profile
	);
}
function sameInputs(red: RegressionRecord, green: RegressionRecord): boolean {
	return (
		canonicalJson(red.inputs) === canonicalJson(green.inputs) &&
		canonicalJson(red.units) === canonicalJson(green.units) &&
		canonicalJson(red.tests) === canonicalJson(green.tests)
	);
}
async function regressionPoint(loaded: Loaded, media?: MediaPlacer): Promise<RegressionPoint> {
	const { record, output } = loaded;
	const captures = await Promise.all(
		(record.captures ?? []).map(async (item) => ({
			...item,
			capture: {
				...item.capture,
				...((await media?.place(
					loaded.files?.get(item.capture.path),
					item.capture,
					'Focused capture is missing.'
				)) ?? { media: null, gap: 'Focused media is not resolved by this reader.' })
			}
		}))
	);
	return {
		commit: record.source.commit,
		id: record.id,
		status: record.status,
		command: record.command,
		assertion: record.assertion,
		finishedAt: record.finishedAt,
		...(captures.length ? { captures } : {}),
		...(record.measurements ? { measurements: record.measurements } : {}),
		output
	};
}

/** Local Git and hosted GitHub readers validate the same bytes and exact identities. */
export async function readRegression(
	note: RegressionNote,
	read: (path: string) => Promise<Buffer | undefined>
) {
	const { json, log } = await regressionBytes(note, read);
	const record = regressionRecordSchema.parse(JSON.parse(json.toString()));
	assertIdentity(record, note, log);
	if (!validPhase(record, log))
		return fail('Regression phase does not match the recorded outcome.');
	return { record, output: log.toString('utf8'), files: await regressionCaptures(record, read) };
}
async function regressionBytes(
	note: RegressionNote,
	read: (path: string) => Promise<Buffer | undefined>
) {
	if (note.evidence.path !== `regressions/${note.commit}/${note.record}`)
		return fail('Regression evidence path does not match its commit and record.');
	const [manifest, json, log] = await Promise.all(
		['manifest.json', 'record.json', 'output.log'].map(read)
	);
	if (!manifest || !json || !log) return fail('Regression evidence is missing.');
	if (regressionHash(manifest) !== note.evidence.manifest)
		return fail('Regression manifest hash does not match.');
	const files = JSON.parse(manifest.toString()) as { record: string; log: string };
	if (files.record !== regressionHash(json) || files.log !== regressionHash(log))
		return fail('Regression evidence hashes do not match.');
	return { json, log };
}
function assertIdentity(record: RegressionRecord, note: RegressionNote, log: Buffer): void {
	const { id, ...draft } = record;
	if (id !== regressionHash(canonicalJson(draft)) || id !== note.record)
		fail('Regression record identity does not match.');
	if (
		record.source.commit !== note.commit ||
		record.loop !== note.loop ||
		record.phase !== note.phase
	)
		fail('Regression evidence belongs to a different commit or checkpoint.');
	if (record.log.sha256 !== regressionHash(log) || record.log.bytes !== log.length)
		fail('Regression output does not match its recorded hash.');
}
function validPhase(record: RegressionRecord, log: Buffer): boolean {
	if (record.phase === 'red')
		return (
			record.status === 'failed' &&
			record.exitCode > 0 &&
			!record.red &&
			log.includes(record.assertion)
		);
	return record.status === 'passed' && record.exitCode === 0 && Boolean(record.red);
}

async function regressionCaptures(
	record: RegressionRecord,
	read: (path: string) => Promise<Buffer | undefined>
) {
	const files = new Map<string, Buffer>();
	for (const { capture } of record.captures ?? []) {
		const bytes = await read(capture.path);
		if (!bytes) return fail(`Focused capture ${capture.path} is missing.`);
		if (bytes.length !== capture.bytes || regressionHash(bytes) !== capture.sha256)
			return fail(`Focused capture ${capture.path} has different bytes.`);
		const facts = mediaFacts(bytes, capture.mediaType);
		if ('error' in facts || facts.kind !== 'image')
			return fail(`Focused capture ${capture.path} cannot be decoded.`);
		assertCaptureRevision(capture, record.source.commit);
		files.set(capture.path, bytes);
	}
	return files;
}

function assertCaptureRevision(
	capture: NonNullable<RegressionRecord['captures']>[number]['capture'],
	commit: string
): void {
	if (capture.provenance === 'actual-capture' && capture.server?.revision !== commit)
		fail(`Focused capture ${capture.path} has a different served revision.`);
}
