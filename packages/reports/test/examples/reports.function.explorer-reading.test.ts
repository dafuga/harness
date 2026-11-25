import { createHash } from 'node:crypto';
import { test } from 'vitest';
import type {
	ExplorerArtifact,
	ExplorerBehavior,
	ExplorerBehaviorRow
} from '../../src/models/explorer-ui/Explorer.types';
import type { HarnessCapture } from '../../src/models/explorer-ui/Harness.types';
import {
	artifactDifferences,
	explorerReading
} from '../../src/utils/explorer-reading/explorerReading';
import { capture } from '../explorerFixture';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';
import type { Cases } from './reports.function.explorer-reading.test.types';
const unitId = 'reports.function.explorer-reading';
const record = (symbol: string, state: string, cases: Cases) =>
	recordExampleCases(
		{ unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);

const base = '/m/';
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
/** Bytes the fake media path serves by file name; the addresses the loader asked for. */
const served = new Map<string, string>();
const requested: string[] = [];
const fetcher = (address: string) => {
	requested.push(address);
	const text = served.get(address.slice(base.length));
	return Promise.resolve(new Response(text ?? '', { status: text === undefined ? 404 : 200 }));
};

/** A recorded result whose bytes the fake media path serves under their own hash. */
function recorded(document: unknown): HarnessCapture {
	const text = typeof document === 'string' ? document : JSON.stringify(document);
	const sha256 = hash(text);
	served.set(`${sha256}.json`, text);
	return capture({
		kind: 'output',
		evidence: 'run',
		sha256,
		media: `media/${sha256}.json`,
		viewport: undefined
	});
}

/** What the hashes alone say of two results, as explorerBehavior states them. */
function standing(was: HarnessCapture | null, is: HarnessCapture | null, compared: boolean) {
	if (!compared) return 'unknown' as const;
	if (!was) return 'added' as const;
	if (!is) return 'removed' as const;
	return was.sha256 === is.sha256 ? ('unchanged' as const) : ('differs' as const);
}

/** One behavior row for a scenario, its results recorded from the given documents or absent. */
function behavior(
	before: unknown,
	after: unknown,
	mode: 'commit' | 'current' = 'commit'
): ExplorerBehavior {
	const [was, is] = [before, after].map((item) => (item === null ? null : recorded(item)));
	const compared = mode === 'commit';
	const row: ExplorerBehaviorRow = {
		scenario: 'slugify-run',
		state: 'default',
		evidence: 'run',
		kind: 'output',
		before: was,
		after: is,
		change: standing(was, is, compared),
		differences: []
	};
	return {
		mode,
		rows: [row],
		summary: compared ? 'changed' : 'not-compared',
		reason: null,
		scenarios: []
	};
}

const read = (before: unknown, after: unknown, mode?: 'commit' | 'current') =>
	explorerReading(behavior(before, after, mode), base, fetcher);
const run = (output: unknown, extra: object = {}) => ({
	input: ['  Hello World  '],
	output,
	...extra
});

/** What one side of a row shows of its read: its output, whether it was verified, its problem. */
const view = (artifact: ExplorerArtifact | null) => ({
	output: artifact?.behavior?.output ?? null,
	verified: artifact?.verified ?? null,
	problem: artifact?.problem ?? null
});

/** The observable result of one row, recorded as what was actually read and decided. */
function outcome(shown: ExplorerBehavior) {
	const [row] = shown.rows;
	return {
		summary: shown.summary,
		reason: shown.reason,
		change: row.change,
		differences: row.differences,
		beforeRead: view(row.beforeRead ?? null),
		afterRead: view(row.afterRead ?? null)
	};
}

test('scoped commit reads of runs differing only in their declared metadata are unchanged', async () => {
	const before = run(['hello world'], {
		harnessRun: { version: 1, startedAt: '2026-10-10T10:00:00Z', durationMs: 12, pid: 41 },
		trace: [{ call: 'slugify', harnessRun: { version: 1, at: 1 } }]
	});
	const after = run(['hello world'], {
		harnessRun: { version: 1, startedAt: '2026-10-11T09:00:00Z', durationMs: 7, pid: 97 },
		trace: [{ call: 'slugify', harnessRun: { version: 1, at: 9 } }]
	});
	const shown = await read(before, after);
	expect(shown.rows[0].before?.sha256).not.toBe(shown.rows[0].after?.sha256);
	expect(shown.summary).toBe('unchanged');
	expect(shown.rows[0]).toMatchObject({ change: 'unchanged', differences: [] });
	expect(shown.rows[0].afterRead?.behavior?.output).toEqual(['hello world']);
	record('explorerReading', 'explorer-reading-commit-declared-runs-unchanged', [
		{
			name: 'declared runs with other times and pids',
			input: { mode: 'commit', before, after },
			output: outcome(shown)
		}
	]);
});

test('scoped commit reads of a different answer are changed and name the path that differs', async () => {
	const shown = await read(run(['hello world']), run(['HELLO WORLD']));
	expect(shown.summary).toBe('changed');
	expect(shown.rows[0]).toMatchObject({ change: 'changed', differences: ['output[0]'] });
	expect(shown.rows[0].beforeRead?.behavior?.output).toEqual(['hello world']);
	expect(shown.rows[0].afterRead?.behavior?.output).toEqual(['HELLO WORLD']);
	record('explorerReading', 'explorer-reading-commit-different-answer-changed', [
		{
			name: 'different output is a changed path',
			input: { mode: 'commit', before: 'hello world', after: 'HELLO WORLD' },
			output: outcome(shown)
		}
	]);
});

test('actual current reads are shown with their output but are not compared', async () => {
	const shown = await read(null, run(['a']), 'current');
	expect(shown.summary).toBe('not-compared');
	expect(shown.rows[0]).toMatchObject({ change: 'unknown', beforeRead: null });
	expect(shown.rows[0].afterRead?.verified).toBe(true);
	expect(shown.rows[0].afterRead?.behavior?.output).toEqual(['a']);
	record('explorerReading', 'explorer-reading-current-read-uncompared', [
		{
			name: 'current read keeps its output uncompared',
			input: { mode: 'current', before: null, after: 'a' },
			output: outcome(shown)
		}
	]);
});

const appearedState = 'explorer-reading-appeared-and-removed-results';
test('a result that appeared or was removed keeps its standing, with the missing side null', async () => {
	const added = await read(null, run(['a']));
	const removed = await read(run(['a']), null);
	expect(added.rows[0]).toMatchObject({ change: 'added', beforeRead: null });
	expect(added.rows[0].afterRead?.verified).toBe(true);
	expect(added.summary).toBe('changed');
	expect(removed.rows[0]).toMatchObject({ change: 'removed', afterRead: null });
	expect(removed.summary).toBe('changed');
	record('explorerReading', appearedState, [
		{ name: 'added result', input: { before: null }, output: outcome(added) },
		{ name: 'removed result', input: { after: null }, output: outcome(removed) }
	]);
});

const unreadState = 'explorer-reading-unreadable-tampered-and-unstored-results';
test('loading, tampered and unstored results stay unknown, and a stored hash is fetched once', async () => {
	const same = behavior(run(['a']), run(['a']));
	served.clear();
	requested.length = 0;
	const missing = await explorerReading(same, base, fetcher);
	expect(missing).toMatchObject({
		summary: 'unknown',
		reason: 'A recorded result could not be read and checked, so it is not compared.'
	});
	expect(missing.rows[0]).toMatchObject({ change: 'unknown' });
	expect(missing.rows[0].afterRead?.problem).toBe('The artifact could not be read (404).');
	expect(requested, 'one distinct hash is fetched once').toHaveLength(1);

	const tampered = behavior(run(['a']), run(['b']));
	served.set(`${tampered.rows[0].after?.sha256}.json`, 'tampered');
	const altered = await explorerReading(tampered, base, fetcher);
	expect(altered.summary).toBe('unknown');
	expect(altered.rows[0].afterRead).toMatchObject({ verified: false, text: 'tampered' });

	const unstored = behavior(run(['a']), null);
	unstored.rows[0].after = capture({ media: null, gap: 'The run was not stored.' });
	const absent = await explorerReading(unstored, base, fetcher);
	expect(absent.rows[0].afterRead?.problem).toBe('The run was not stored.');
	expect(absent.summary).toBe('unknown');

	const noted = { ...same, summary: 'unknown' as const, reason: 'Source moved.' };
	const kept = await explorerReading(noted, base, fetcher);
	expect(kept).toMatchObject({ summary: 'unknown', reason: 'Source moved.' });
	record('explorerReading', unreadState, [
		{ name: 'missing bytes', input: { before: 'a', after: 'a' }, output: outcome(missing) },
		{ name: 'tampered bytes', input: { before: 'a', after: 'b' }, output: outcome(altered) },
		{ name: 'not stored', input: { after: 'a' }, output: outcome(absent) },
		{ name: 'supplied reason kept', input: { summary: 'unknown' }, output: outcome(kept) }
	]);
});

const differencesState = 'explorer-reading-artifact-differences-declared-metadata';
test('artifact differences set aside only supported declared metadata and name other paths', () => {
	const declared = (pid: unknown) => ({
		output: ['a'],
		harnessRun: { version: 1, startedAt: '2026-10-10T10:00:00Z', durationMs: 3, pid }
	});
	const undeclared = (stamp: number) => ({ output: ['a'], startedAt: stamp, durationMs: stamp });
	const found = {
		metadata: artifactDifferences(declared(1), declared(2)),
		undeclared: artifactDifferences(undeclared(1), undeclared(9)),
		notAKind: artifactDifferences(declared('x'), declared('y')),
		text: artifactDifferences('one', 'two')
	};
	expect(found.metadata).toEqual([]);
	expect(found.undeclared).toEqual(['durationMs', 'startedAt']);
	expect(found.notAKind, 'wrong kind is compared').toEqual(['harnessRun.pid']);
	expect(found.text, 'text that is not a document is compared whole').toEqual(['']);
	record('artifactDifferences', differencesState, [
		{ name: 'declared metadata set aside', input: { metadata: true }, output: found.metadata },
		{ name: 'undeclared times counted', input: { undeclared: true }, output: found.undeclared },
		{ name: 'wrong-kind pid kept', input: { notAKind: true }, output: found.notAKind },
		{ name: 'text compared whole', input: { text: true }, output: found.text }
	]);
});
