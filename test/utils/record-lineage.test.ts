import { expect, test } from 'vitest';
import type { VerificationRecord } from '../../src/core/verificationTypes';
import { recordLineage } from '../../src/utils/recordLineage';
import { verificationSample } from '../support/verificationSample';
import { evidenceHistory } from '../../packages/hub/test/support/evidenceHistory';
import { recordIntact, sealRecord } from '../../src/utils/sealRecord';

const commitOf = (letter: string) => letter.repeat(40);
const idOf = (letter: string) => letter.repeat(64);
type Scenario = VerificationRecord['scenarios'][number];

function record(
	letter: string,
	extra: Partial<VerificationRecord['source']> = {},
	scenarios: Scenario[] = []
) {
	const sample = verificationSample();
	return {
		...sample,
		id: idOf(letter),
		source: { commit: commitOf(letter), tree: commitOf('f'), base: null, ...extra },
		scenarios
	} satisfies VerificationRecord;
}
const tested = (letter: string): Scenario => ({
	id: 'clock',
	status: 'passed',
	testedRevision: commitOf(letter),
	states: []
});
const inherited = (from: string): Scenario => ({
	...tested(from),
	status: 'referenced',
	referencedRecord: idOf(from)
});
function lineage(subject: VerificationRecord, stored: VerificationRecord[], broken: string[] = []) {
	return recordLineage(subject, {
		find: (id) => stored.find((item) => item.id === id),
		problems: (item) => (broken.includes(item.id) ? ['evidence clock.txt is missing'] : [])
	});
}

test('a record with no base and no inherited scenario depends on nothing', () => {
	expect(lineage(record('a'), [])).toEqual([]);
});

test('the base record and the record behind an inherited scenario must be present and sound', () => {
	const parent = record('a', {}, [tested('a')]);
	const child = record('b', { base: commitOf('a'), baseRecord: idOf('a') }, [inherited('a')]);
	expect(lineage(child, [parent])).toEqual([]);
	expect(lineage(child, [])).toEqual([
		'base record aaaaaaaaaaaa is not available',
		'scenario clock is inherited from record aaaaaaaaaaaa, which is not available'
	]);
	expect(lineage(child, [parent], [idOf('a')])).toEqual([
		'base record aaaaaaaaaaaa is not sound: evidence clock.txt is missing',
		'scenario clock is inherited from record aaaaaaaaaaaa, which is not sound: evidence clock.txt is missing'
	]);
});

test('a base that failed, another commit, or a scenario the record did not test is refused', () => {
	const failed = { ...record('a', {}, [tested('a')]), status: 'failed' as const };
	const child = record('b', { base: commitOf('a'), baseRecord: idOf('a') });
	expect(lineage(child, [failed])).toEqual(['base record aaaaaaaaaaaa did not pass']);
	const elsewhere = record('b', { base: commitOf('c'), baseRecord: idOf('a') });
	expect(lineage(elsewhere, [record('a')])).toEqual([
		`base record aaaaaaaaaaaa is for commit ${commitOf('a')}, not ${commitOf('c')}`
	]);
	const borrowed = record('b', {}, [inherited('a')]);
	expect(lineage(borrowed, [record('a')])).toEqual([
		'scenario clock is inherited from record aaaaaaaaaaaa, which did not test it'
	]);
});

test('lineage is followed to its root and a cycle is refused', () => {
	const root = record('a', {}, [tested('a')]);
	const middle = record('b', { base: commitOf('a'), baseRecord: idOf('a') }, [inherited('a')]);
	const leaf = record('c', { base: commitOf('b'), baseRecord: idOf('b') }, [inherited('a')]);
	expect(lineage(leaf, [root, middle])).toEqual([]);
	expect(lineage(leaf, [middle])).toEqual([
		'base record bbbbbbbbbbbb is not sound: base record aaaaaaaaaaaa is not available',
		'scenario clock is inherited from record aaaaaaaaaaaa, which is not available'
	]);
	const one = record('a', { base: commitOf('b'), baseRecord: idOf('b') });
	const two = record('b', { base: commitOf('a'), baseRecord: idOf('a') });
	expect(lineage(one, [one, two])).toEqual([
		'base record bbbbbbbbbbbb is not sound: base record aaaaaaaaaaaa is not sound: inherited records form a cycle'
	]);
});

test('a record that failed proves nothing that is inherited from it, even a scenario it passed', () => {
	// The origin tested the scenario and passed it, and failed as a whole for another reason.
	const origin = { ...record('a', {}, [tested('a')]), status: 'failed' as const };
	const child = record('b', {}, [inherited('a')]);
	expect(lineage(child, [origin])).toEqual([
		'scenario clock is inherited from record aaaaaaaaaaaa, which did not pass'
	]);
	// The same origin, passed and intact, still proves the scenario it is inherited for.
	expect(lineage(child, [{ ...origin, status: 'passed' as const }])).toEqual([]);
});

test('sealed inherited states and capture bindings must equal their tested origin, also transitively', () => {
	const fixture = evidenceHistory();
	const origin = fixture.records.first.record;
	const child = fixture.records.second.record;
	expect(lineage(child, [origin])).toEqual([]);
	const mutations = [
		(s: Scenario) => {
			s.states[0].id = 'never-tested-state';
		},
		(s: Scenario) => {
			s.states[0].captures[0].state = 'never-tested-state';
		},
		(s: Scenario) => {
			s.states[0].captures[0].sha256 = 'f'.repeat(64);
		},
		(s: Scenario) => {
			s.states[0].captures[0].path = 'captures/another.txt';
		},
		(s: Scenario) => {
			s.states[0].captures[0].status = 'failed';
		}
	];
	for (const mutate of mutations) {
		const draft = JSON.parse(JSON.stringify(child)) as VerificationRecord;
		const inherited = draft.scenarios.find((s) => s.status === 'referenced')!;
		mutate(inherited);
		const { id, ...body } = draft;
		expect(id).toBe(child.id);
		const forged = sealRecord(body);
		expect(recordIntact(forged)).toBe(true);
		expect(lineage(forged, [origin])).toContain(
			`scenario ${inherited.id} differs from the states and captures in its inherited record`
		);
		const leaf = record('c', { base: forged.source.commit, baseRecord: forged.id });
		expect(lineage(leaf, [origin, forged]).join('\n')).toContain(
			'differs from the states and captures'
		);
	}
});
