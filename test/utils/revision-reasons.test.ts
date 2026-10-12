import { expect, test } from 'vitest';
import type { Explanation, RequiredReason } from '../../src/core/explanationTypes';
import { revisionReasons } from '../../src/utils/revisionReasons';

const [parent, earlier] = ['p'.repeat(40), 'e'.repeat(40)];
const attempt = { attempt: 'Nothing simpler was found.', outcome: 'not-improved' as const };
/** A reason for one step of a symbol's content, told apart from the others by what it says. */
function reason(
	unit: string,
	from: string | null,
	to: string | null,
	behavior = unit
): Explanation {
	return {
		unit,
		symbol: 'run',
		file: `src/${unit}.ts`,
		change: from === null ? 'added' : 'modified',
		from,
		to,
		behavior,
		simplification: attempt,
		performance: attempt,
		recordedAt: '2026-10-12T00:00:00.000Z'
	};
}
/** A change the commit itself made to a unit against its first parent. */
const changed = (unit: string, from: string | null, to: string): RequiredReason => ({
	unit,
	symbol: 'run',
	file: `src/${unit}.ts`,
	change: from === null ? 'added' : 'modified',
	from,
	to
});
const told = (found: { explanations: Explanation[] }) =>
	found.explanations.map((entry) => entry.behavior).sort();

// The reproduced history: an earlier commit mounted a page, this one repaired a contract, and
// the record of this one was verified against a revision before both.
const mount = reason('page.catalog', 'a1', 'a2', 'Mounts the catalog');
const repair = reason('function.contract', 'c1', 'c2', 'Repairs the contract');
const own = [changed('function.contract', 'c1', 'c2')];

test('a reason of an earlier commit in a verified range is not a reason of this commit', () => {
	const found = revisionReasons({
		parent,
		own,
		noted: [],
		records: [{ base: earlier, entries: [mount, repair] }]
	});
	expect(told(found)).toEqual(['Repairs the contract']);
	expect(found.range).toBe(1);
});

test('a note that a longer record copied onto the commit is held to the same question', () => {
	// Attaching a record writes each of its reasons into the notes of its commit.
	const found = revisionReasons({
		parent,
		own,
		noted: [mount, repair],
		records: [{ base: earlier, entries: [mount, repair] }]
	});
	expect(told(found)).toEqual(['Repairs the contract']);
	expect(found.range).toBe(1);
	const noteOnly = revisionReasons({ parent, own, noted: [mount, repair], records: [] });
	expect(told(noteOnly)).toEqual(['Repairs the contract']);
});

test('the reasons a commit noted for its own change stay, each once, however often they are held', () => {
	const found = revisionReasons({
		parent,
		own,
		noted: [repair, repair],
		records: [
			{ base: earlier, entries: [mount, repair] },
			{ base: earlier, entries: [mount, repair] }
		]
	});
	expect(found.explanations).toEqual([repair]);
	expect(found.range).toBe(1);
});

test('a change made in steps keeps the reason of every step, and no step before its first parent', () => {
	const before = reason('function.contract', 'c0', 'c1', 'An earlier commit');
	const [one, two] = [
		reason('function.contract', 'c1', 'cx', 'First step'),
		reason('function.contract', 'cx', 'c2', 'Second step')
	];
	const found = revisionReasons({
		parent,
		own,
		noted: [],
		records: [{ base: earlier, entries: [before, one, two] }]
	});
	expect(told(found)).toEqual(['First step', 'Second step']);
	expect(found.range).toBe(1);
});

test('a reason for the whole range of a symbol is not dated to the commit that changed it last', () => {
	const whole = reason('function.contract', 'c0', 'c2', 'Everything since the base');
	const other = reason('function.contract', 'c1', 'c9', 'Written before a later edit');
	const found = revisionReasons({
		parent,
		own,
		noted: [],
		records: [{ base: earlier, entries: [whole, other] }]
	});
	expect([found.explanations, found.range]).toEqual([[], 2]);
});

test('a record that verified exactly this commit keeps its reasons, whatever their fingerprints', () => {
	// A record of an earlier Harness: its fingerprints are not those computed today.
	const legacy = reason('function.contract', 'old-1', 'old-2', 'Legacy reason');
	const found = revisionReasons({
		parent,
		own,
		noted: [],
		records: [{ base: parent, entries: [legacy] }]
	});
	expect([told(found), found.range]).toEqual([['Legacy reason'], 0]);
	const root = revisionReasons({
		parent: null,
		own: [changed('function.contract', null, 'c2')],
		noted: [],
		records: [{ base: null, entries: [legacy] }]
	});
	expect(told(root)).toEqual(['Legacy reason']);
	// Verified from an empty tree, a commit that has a parent is the end of a longer range.
	const scratch = revisionReasons({
		parent,
		own,
		noted: [],
		records: [{ base: null, entries: [mount, repair] }]
	});
	expect([told(scratch), scratch.range]).toEqual([['Repairs the contract'], 1]);
});

test('where the change of a commit cannot be read, its own notes stay and a longer record adds nothing', () => {
	const noted = reason('function.clock', 'k1', 'k2', 'Noted on the commit');
	const exact = reason('function.title', 't1', 't2', 'Verified against the parent');
	const found = revisionReasons({
		parent,
		own: undefined,
		noted: [noted, mount],
		records: [
			{ base: earlier, entries: [mount, repair] },
			{ base: parent, entries: [exact] }
		]
	});
	expect(told(found)).toEqual(['Noted on the commit', 'Verified against the parent']);
	expect(found.range).toBe(2);
});

test('a commit that changed nothing has no reason, and one without notes or records has none', () => {
	const unchanged = revisionReasons({
		parent,
		own: [],
		noted: [mount],
		records: [{ base: earlier, entries: [mount, repair] }]
	});
	expect([unchanged.explanations, unchanged.range]).toEqual([[], 2]);
	expect(revisionReasons({ parent, own, noted: [], records: [] })).toEqual({
		explanations: [],
		range: 0
	});
});
