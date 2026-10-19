import { expect, test } from 'vitest';
import { mergeNoteLines } from '../../src/repositories/history-note-repository/noteLines';
import { readNoteLines } from '../../src/utils/note-lines/noteCommit';

const commit = 'a'.repeat(40);
const other = 'b'.repeat(40);
const line = (record: string, source = commit) =>
	JSON.stringify({
		schemaVersion: 1,
		kind: 'verification',
		record,
		status: 'passed',
		profile: 'p1',
		finishedAt: '2026-10-10T00:00:00.000Z',
		source: { commit: source, tree: 'c'.repeat(40), base: null },
		evidence: {
			commit: 'd'.repeat(40),
			path: `records/${source}/${record}`,
			manifest: 'e'.repeat(64)
		}
	});

test('mergeNoteLines is a sorted union: order and repetition do not matter', () => {
	const left = `${line('r2')}\n${line('r1')}\n`;
	const right = `${line('r3')}\n${line('r1')}\n\n`;
	const merged = mergeNoteLines(left, right);
	expect(merged).toBe(mergeNoteLines(right, left));
	expect(merged.trim().split('\n')).toHaveLength(3);
	expect(mergeNoteLines(merged, left)).toBe(merged);
	expect(merged.endsWith('\n')).toBe(true);
});

test('readNoteLines keeps valid entries of this commit and names every other line', () => {
	const text = `${line('r1')}\nnot json\n${line('r2', other)}\n{"kind":"verification"}\n`;
	const read = readNoteLines(text, commit);
	expect(read.entries.map((entry) => entry.kind === 'verification' && entry.record)).toEqual([
		'r1'
	]);
	expect(read.problems).toEqual([
		'note line 2 is not a valid history entry',
		`note line 3 was written for commit ${other}, not this commit`,
		'note line 4 is not a valid history entry'
	]);
});
