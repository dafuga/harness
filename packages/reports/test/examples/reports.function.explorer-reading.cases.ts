import { createHash } from 'node:crypto';
import { test } from 'vitest';
import type {
	ExplorerArtifact,
	ExplorerBehavior,
	ExplorerBehaviorRow
} from '../../src/models/explorer-ui/Explorer.types';
import type { HarnessCapture } from '../../src/models/explorer-ui/Harness.types';
import { explorerReading } from '../../src/utils/explorer-reading/explorerReading';
import { capture } from '../explorerFixture';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';
import type { Cases } from './reports.function.explorer-reading.test.types';

const unitId = 'reports.function.explorer-reading';
export const record = (symbol: string, state: string, cases: Cases) =>
	recordExampleCases(
		{ unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);

export const base = '/m/';
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
/** Bytes the fake media path serves by file name; the addresses the loader asked for. */
export const served = new Map<string, string>();
export const requested: string[] = [];
export const fetcher = (address: string) => {
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
export function behavior(
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

export const read = (before: unknown, after: unknown, mode?: 'commit' | 'current') =>
	explorerReading(behavior(before, after, mode), base, fetcher);
export const run = (output: unknown, extra: object = {}) => ({
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
export function outcome(shown: ExplorerBehavior) {
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
