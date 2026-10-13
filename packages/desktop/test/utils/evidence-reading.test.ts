import { expect, test } from 'vitest';
import { evidenceReading } from '../../src/utils/evidenceReading';
import { commits, data, evidenceBridge, ids, refusal, scopeOf } from '../evidence-fixture';

const scope = scopeOf(ids.filter, commits.tip);
const result = data.results[`${ids.filter}|commit|${commits.tip}`];
const output = result.behavior.rows.find((row) => row.kind === 'output')!;
const changes = (rows: typeof result.behavior.rows) =>
	rows.map((row) => `${row.state}/${row.kind}:${row.change}`);

test('results are read by their bindings and compared by what they hold', async () => {
	const { bridge, calls } = evidenceBridge();
	expect(result.behavior.summary).toBe('differs');
	const read = await evidenceReading(bridge, result, scope);
	expect(read.behavior.summary).toBe('changed');
	expect(changes(read.behavior.rows)).toEqual([
		'match/assertions:unchanged',
		'match/output:changed',
		'no-match/assertions:unchanged'
	]);
	expect(read.behavior.rows[1].differences).toEqual(['output[1]']);
	expect(read.refusals).toEqual({});
	// Six results, each read once and on the side that lists it.
	const sides = calls.map((call) => `${call.side}|${call.recordId}`).sort();
	expect(sides).toEqual([
		...Array(3).fill('after|rec-cccccc-0000'),
		...Array(3).fill('before|rec-bbbbbb-0000')
	]);
});

test('damaged bytes are not read: the result is unverified and the behaviour unknown', async () => {
	const { bridge } = evidenceBridge({ corrupt: [output.after!.sha256] });
	const read = await evidenceReading(bridge, result, scope);
	expect(read.behavior.summary).toBe('unknown');
	const row = read.behavior.rows.find((item) => item.kind === 'output')!;
	expect(row.afterRead).toMatchObject({ verified: false, behavior: null });
	expect(row.change).toBe('unknown');
});

test('a refusal is kept in the words of the backend, and nothing is called changed', async () => {
	const { bridge } = evidenceBridge({ refuse: [output.after!.sha256] });
	const read = await evidenceReading(bridge, result, scope);
	expect(read.refusals).toEqual({ [output.after!.sha256]: refusal });
	expect(read.behavior.summary).toBe('unknown');
	expect(changes(read.behavior.rows)).not.toContain('match/output:changed');
});

test('a bridge without the read reads nothing, and no result is taken as read', async () => {
	const read = await evidenceReading({}, result, scope);
	expect(read.behavior.summary).toBe('unknown');
	expect(read.behavior.rows.every((row) => row.afterRead?.verified === false)).toBe(true);
});
