import type {
	ExplorerArtifact,
	ExplorerBehavior,
	ExplorerBehaviorRow
} from '../models/Explorer.types';
import type { HarnessCapture } from '../models/Harness.types';
import { explorerArtifact, type ArtifactFetcher } from './explorerArtifact';
import { behaviorSummary } from './explorerBehavior';

const moment = (value: unknown) => typeof value === 'string' || typeof value === 'number';
const amount = (value: unknown) => typeof value === 'number';
/** What a run may say of itself, each with what its value has to be to say it. */
const says = new Map<string, (value: unknown) => boolean>([
	['startedAt', moment],
	['finishedAt', moment],
	['at', moment],
	['durationMs', amount],
	['pid', amount]
]);
/**
 * Where a recorded run declares what it says about itself and not about what it did. A document
 * declares it under this one name, as an object of this version, and nothing is taken for it by
 * what a field happens to be called. Of a declaration only `metadata` is set aside: when the run
 * started, finished or was at something, how long it took, and which process it was.
 */
export const artifactRun = { field: 'harnessRun', version: 1, metadata: [...says.keys()] } as const;
const unreadable = 'A recorded result could not be read and checked, so it is not compared.';
type Fields = Record<string, unknown>;
const isObject = (value: unknown): value is Fields =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/** Where two values differ, with nothing left out: every field and every entry counts. */
function differs(before: unknown, after: unknown, path: string): string[] {
	if (Array.isArray(before) && Array.isArray(after)) {
		const longest = Math.max(before.length, after.length);
		return Array.from({ length: longest }, (_, at) =>
			differs(before[at], after[at], `${path}[${at}]`)
		).flat();
	}
	if (!isObject(before) || !isObject(after)) return before === after ? [] : [path];
	const names = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
	return names.flatMap((name) =>
		differs(before[name], after[name], path ? `${path}.${name}` : name)
	);
}

/** Whether a value is a declaration of the version that is read here. */
const declaration = (value: unknown): value is Fields =>
	isObject(value) && value.version === artifactRun.version;

/**
 * A value without what its declaration says of its run. Whatever else the declaration holds, a
 * field that is none of `metadata` or one whose value is not of its kind, stays under its name
 * and is compared. A value that carries no declaration of this version is left as it is.
 */
function undeclared(value: unknown): unknown {
	const run = isObject(value) ? value[artifactRun.field] : undefined;
	if (!isObject(value) || !declaration(run)) return value;
	const rest = Object.entries(value).filter(([name]) => name !== artifactRun.field);
	const more = Object.entries(run).filter(
		([name, held]) => name !== 'version' && !says.get(name)?.(held)
	);
	const kept = more.length > 0 ? [[artifactRun.field, Object.fromEntries(more)]] : [];
	return Object.fromEntries([...rest, ...kept]);
}

/**
 * What a document states once what its run declares about itself is set aside: at its root, and
 * on each entry of its trace that declares for itself. A document that declares nothing at its
 * root, or in a version that is not read here, is taken whole, its trace included.
 */
function stated(document: unknown): unknown {
	const rest = undeclared(document);
	if (rest === document || !isObject(rest)) return document;
	return Array.isArray(rest.trace) ? { ...rest, trace: rest.trace.map(undeclared) } : rest;
}

/**
 * Where two recorded results differ in what they hold, as paths such as `output[0]`. Every field
 * is compared, whatever it is called: a date, a time, a duration or a process id is behaviour
 * unless the document itself declares it as its run (`artifactRun`), at its root or on an entry
 * of its trace. Only the metadata of such a declaration is set aside, so two declared runs of
 * the same behaviour are the same, and a document that declares nothing is compared whole. Text
 * that is not a document is compared as it is. Empty when nothing differs.
 */
export function artifactDifferences(before: unknown, after: unknown): string[] {
	return differs(stated(before), stated(after), '');
}

/** What a read result holds to compare: its document, or its text when it is not one. */
const held = (read: ExplorerArtifact) => read.document ?? read.text;

/** One row with what both results hold, and what that says happened to the behaviour. */
function resolved(
	row: ExplorerBehaviorRow,
	before: ExplorerArtifact | null,
	after: ExplorerArtifact | null
): ExplorerBehaviorRow {
	const read = { ...row, beforeRead: before, afterRead: after };
	const unchecked = [before, after].some((item) => item && !item.verified);
	if (unchecked) return { ...read, change: 'unknown' };
	if (row.change !== 'differs' || !before || !after) return read;
	const differences = artifactDifferences(held(before), held(after));
	return { ...read, differences, change: differences.length > 0 ? 'changed' : 'unchanged' };
}

/**
 * A behaviour comparison with every recorded result read from the protected media path and
 * checked against its hash. Results whose bytes differ are compared by what they hold: two runs
 * that differ only in what they declare about themselves are unchanged behaviour, and any other
 * difference is a change that names where it is. A result that cannot be read and checked makes its
 * row unknown, also when the hashes were equal: nothing unread is called unchanged. Each row
 * carries what both results hold, so a reader is shown the actual inputs, outputs and assertions.
 */
export async function explorerReading(
	behavior: ExplorerBehavior,
	mediaBase: string,
	fetcher?: ArtifactFetcher
): Promise<ExplorerBehavior> {
	const cache = new Map<string, Promise<ExplorerArtifact>>();
	const read = (capture: HarnessCapture | null) => {
		if (!capture) return Promise.resolve(null);
		const pending = cache.get(capture.sha256) ?? explorerArtifact(capture, mediaBase, fetcher);
		cache.set(capture.sha256, pending);
		return pending;
	};
	const rows = await Promise.all(
		behavior.rows.map(async (row) => resolved(row, await read(row.before), await read(row.after)))
	);
	if (
		behavior.summary === 'not-compared' ||
		(behavior.reason !== null && behavior.summary === 'unknown')
	) {
		return { ...behavior, rows };
	}
	const lost = rows.some((row) =>
		[row.beforeRead, row.afterRead].some((item) => item && !item.verified)
	);
	const [summary, reason] = lost ? (['unknown', unreadable] as const) : behaviorSummary(rows);
	return { ...behavior, rows, summary, reason };
}
