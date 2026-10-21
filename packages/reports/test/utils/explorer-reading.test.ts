import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import type { ExplorerBehavior, ExplorerBehaviorRow } from '../../src/models/Explorer.types';
import { explorerReading } from '../../src/utils/explorer-reading/explorerReading';
import { capture } from '../explorerFixture';

const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const stored = new Map<string, string>();
/** A recorded result whose bytes the fake media path serves under their own hash. */
function recorded(document: unknown) {
	const text = typeof document === 'string' ? document : JSON.stringify(document);
	stored.set(`${hash(text)}.json`, text);
	return capture({
		kind: 'output',
		evidence: 'run',
		sha256: hash(text),
		media: `media/${hash(text)}.json`,
		viewport: undefined
	});
}
const fetcher = (address: string) => {
	const text = stored.get(address.replace('/m/', ''));
	return Promise.resolve(new Response(text ?? '', { status: text === undefined ? 404 : 200 }));
};
/** What the hashes alone say of two results, as explorerBehavior would. */
function standing(was: ReturnType<typeof recorded> | null, is: ReturnType<typeof recorded> | null) {
	if (!was) return 'added' as const;
	if (!is) return 'removed' as const;
	return was.sha256 === is.sha256 ? ('unchanged' as const) : ('differs' as const);
}
function behavior(
	before: unknown,
	after: unknown,
	mode: 'commit' | 'current' = 'commit'
): ExplorerBehavior {
	const [was, is] = [before, after].map((item) => (item === null ? null : recorded(item)));
	const compared = mode === 'commit';
	const change = compared ? standing(was, is) : ('unknown' as const);
	const settled = change === 'unchanged' || change === 'differs' ? change : ('changed' as const);
	const row: ExplorerBehaviorRow = {
		scenario: 'slugify-run',
		state: 'default',
		evidence: 'run',
		kind: 'output',
		before: was,
		after: is,
		change,
		differences: []
	};
	return {
		mode,
		rows: [row],
		summary: compared ? settled : 'not-compared',
		reason: null,
		scenarios: []
	};
}
const read = (before: unknown, after: unknown, mode?: 'commit' | 'current') =>
	explorerReading(behavior(before, after, mode), '/m/', fetcher);
const run = (output: string[], extra: object = {}) => ({
	input: ['  Hello World  '],
	output,
	...extra
});

test('declared runs that differ only in when or how long they ran are the same behaviour', async () => {
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
});

test('an answer that is itself a date and a time is behaviour: another one is a change', async () => {
	// The reproduced case: the recorded output is the returned JSON, not a run around it.
	const shown = await read({ date: 'Monday', time: '10:00' }, { date: 'Tuesday', time: '11:00' });
	expect(shown.summary).toBe('changed');
	expect(shown.rows[0]).toMatchObject({ change: 'changed', differences: ['date', 'time'] });
	const timed = await read({ duration: 30, pid: 7 }, { duration: 45, pid: 8 });
	expect(timed.rows[0]).toMatchObject({ change: 'changed', differences: ['duration', 'pid'] });
});

test('a run that declares nothing about itself is compared whole, its times included', async () => {
	const undeclared = (stamp: number) =>
		run(['hello world'], { startedAt: stamp, durationMs: stamp, trace: [{ at: stamp }] });
	const shown = await read(undeclared(1), undeclared(9));
	expect(shown.summary).toBe('changed');
	expect(shown.rows[0].differences).toEqual(['durationMs', 'startedAt', 'trace[0].at']);
});

test('a different answer is a change of behaviour, and says where the two differ', async () => {
	const shown = await read(run(['hello world']), run(['HELLO WORLD']));
	expect(shown.summary).toBe('changed');
	expect(shown.rows[0]).toMatchObject({ change: 'changed', differences: ['output[0]'] });
	expect(shown.rows[0].beforeRead?.behavior?.output).toEqual(['hello world']);
	expect(shown.rows[0].afterRead?.behavior?.output).toEqual(['HELLO WORLD']);
});

test('a result that cannot be read and checked leaves the behaviour unknown, never unchanged', async () => {
	const same = behavior(run(['a']), run(['a']));
	stored.clear();
	const lost = await explorerReading(same, '/m/', fetcher);
	expect(lost).toMatchObject({
		summary: 'unknown',
		reason: 'A recorded result could not be read and checked, so it is not compared.'
	});
	expect(lost.rows[0].change).toBe('unknown');
	const differing = behavior(run(['a']), run(['b']));
	stored.set(`${differing.rows[0].after?.sha256}.json`, 'tampered');
	expect((await explorerReading(differing, '/m/', fetcher)).summary).toBe('unknown');
});

test('what appeared, went or was never comparable keeps its standing, with what it holds to read', async () => {
	const added = await read(null, run(['a']));
	expect(added.rows[0]).toMatchObject({ change: 'added', beforeRead: null });
	expect(added.rows[0].afterRead?.verified).toBe(true);
	expect(added.summary).toBe('changed');
	const tip = await read(null, run(['a']), 'current');
	expect(tip).toMatchObject({ summary: 'not-compared' });
	expect(tip.rows[0].afterRead?.behavior?.output).toEqual(['a']);
});
