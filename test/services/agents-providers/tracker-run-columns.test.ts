import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import { trackerRunSchema } from '../../../src/repositories/projects-sessions/tracker-dispatch-repository/trackerRunSchema';
import { runColumns, runColumnUsage } from '../../support/trackerRunColumns';
import { expect } from '../../verificationExpect';

/**
 * Columns no native code reads back. `record` columns are history for `tracker runs --json`.
 * `retired` columns only keep the legacy table layout and must never be given a value.
 * A column that is meant to change behaviour belongs in neither list: write its consumer.
 */
const unread: Record<string, { as: 'record' | 'retired'; why: string }> = {
	kill_at: { as: 'retired', why: 'finished panes close from run state (6g3n83)' },
	exit_code: { as: 'record', why: 'exit status kept for diagnosis' },
	credits_balance: { as: 'record', why: 'provider balance seen at the end of the run' }
};

const columns = runColumns(trackerRunSchema);
const sources = execFileSync('git', ['ls-files', '--', 'src'], { encoding: 'utf8' })
	.split('\n')
	.filter((path) => /tracker.*\.ts$/i.test(path))
	.map((path) => ({ path, text: readFileSync(path, 'utf8') }));

test('every runs column that native Tracker code stores is also read back', () => {
	const { read } = runColumnUsage(columns, sources);
	const unconsumed = columns.filter((column) => !read.has(column) && !unread[column]);
	expect(unconsumed).toEqual([]);
});

test('unread exceptions stay accurate and retired columns are never given a value', () => {
	const { read, assigned } = runColumnUsage(columns, sources);
	const stale = Object.keys(unread).filter((name) => !columns.includes(name) || read.has(name));
	expect(stale).toEqual([]);
	const revived = Object.keys(unread).filter(
		(name) => unread[name].as === 'retired' && assigned.has(name)
	);
	expect(revived).toEqual([]);
});

test('a column that is only declared, copied and written does not count as consumed', () => {
	const writer = `
		const columns = ['kill_at'] as const;
		interface Run { kill_at?: number }
		const finished = { ...run, kill_at: now + keep };
		run.kill_at = undefined;
		const stored = columns.map((column) => run[column]);
		database.prepare('UPDATE runs SET kill_at = ? WHERE id = ?');
		database.prepare('INSERT INTO runs (id, kill_at) VALUES (?, ?)');
		const unrelated = item.kill_at;
	`;
	const written = runColumnUsage(['kill_at'], [{ path: 'writer.ts', text: writer }]);
	expect([...written.read]).toEqual([]);
	expect([...written.assigned]).toEqual(['kill_at']);
	for (const reader of [
		'if (run.kill_at && run.kill_at <= now) close(run);',
		'const { kill_at } = run;',
		"database.prepare('SELECT * FROM runs WHERE kill_at <= ?');",
		"database.prepare('SELECT r.id FROM runs r WHERE r.kill_at IS NOT NULL');"
	]) {
		const usage = runColumnUsage(['kill_at'], [{ path: 'reader.ts', text: reader }]);
		expect([...usage.read]).toEqual(['kill_at']);
	}
});
