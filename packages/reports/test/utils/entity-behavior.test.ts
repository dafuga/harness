import { expect, test } from 'vitest';
import { behaviorDuration, entityBehavior } from '../../src/utils/entityBehavior';
import { explorerReading } from '../../src/utils/explorerReading';
import { servedArtifacts } from '../entityArtifacts';
import { record, revision } from '../entityFixture';
import { answers, view } from '../entityPlaces';
import { commits, ids } from '../entityUnits';

const shown = (mode: 'current' | 'commit', changed = {}) =>
	entityBehavior(answers(view(mode, changed), ids.filter).behavior);

test('the branch tip shows one run: each state with what the state recorded', () => {
	const run = shown('current');
	expect(run).toMatchObject({
		mode: 'current',
		label: 'Current behavior',
		recorded: true,
		passed: true,
		unknown: false
	});
	expect(run.groups.map((group) => [group.scenario, group.state, group.after])).toEqual([
		['order-filter', 'match', 'passed'],
		['order-filter', 'no-match', 'passed']
	]);
	expect(run.groups[0].lines.map((line) => line.kind)).toEqual(['assertions', 'output']);
	expect(run.groups[0].lines[0].after.capture?.media).toBe('media/ccccccc-match-assertions.json');
	expect(run.reasons).toEqual([]);
});

test('equal results on both sides are behaviour unchanged, said in those words', () => {
	const run = shown('commit');
	expect(run.label).toBe('Behavior unchanged');
	expect(run.passed).toBe(true);
	expect(run.groups[0]).toMatchObject({ before: 'passed', after: 'passed' });
	expect(run.groups[0].lines[1].before.capture?.media).toBe('media/aaaaaaa-match-output.json');
	expect(run.scenarios).toEqual([
		{
			id: 'order-filter',
			title: 'Search across synthetic orders',
			before: 'passed',
			after: 'passed'
		}
	]);
});

test('results with other bytes are not yet called a change: only what they hold says that', () => {
	const altered = record(commits.middle);
	altered.scenarios[1].states[0].captures[1].sha256 = 'e'.repeat(64);
	const run = shown('commit', { head: revision(commits.middle, [altered]) });
	expect(run.label).toBe('Recorded results differ');
	expect(run.unknown).toBe(true);
	// The host says so once, in its own words; nothing is added that calls it a change.
	expect(run.reasons).toHaveLength(1);
	expect(run.reasons[0]).toMatch(/differ in bytes/);
});

test('runs that differ only in when they ran are unchanged behaviour once they are read', async () => {
	const at = view('commit');
	const fetcher = servedArtifacts([at.head, at.parent!]);
	const found = answers(at, ids.filter).behavior;
	expect(found.summary).toBe('differs');
	const run = entityBehavior(await explorerReading(found, '/media/', fetcher));
	expect(run).toMatchObject({ label: 'Behavior unchanged', unknown: false, passed: true });
	expect(run.reasons).toEqual([]);
	// What each side recorded is held by its cell, ready to be shown without asking for it.
	const [assertions, output] = run.groups[0].lines;
	expect(output.after.read?.behavior?.output).toEqual(['Order 1042 · Service call']);
	expect(output.before.read?.behavior?.steps).toHaveLength(2);
	expect(assertions.after.read?.behavior?.assertions.map((item) => item.passed)).toEqual([
		true,
		true
	]);
});

test('an answer that differs is a behaviour change that names where it differs', async () => {
	const at = view('commit');
	const fetcher = servedArtifacts([at.head, at.parent!], {
		[commits.middle]: (stated, state) =>
			state === 'match' && 'output' in stated ? { ...stated, output: ['Order 7 · Other'] } : stated
	});
	const read = await explorerReading(answers(at, ids.filter).behavior, '/media/', fetcher);
	const run = entityBehavior(read);
	expect(run.label).toBe('Behavior changed');
	expect(run.unknown).toBe(false);
	expect(run.reasons).toEqual(['match: the recorded output changed at output[0]']);
});

test('a result that cannot be read and checked leaves the behaviour unknown', async () => {
	const at = view('commit');
	servedArtifacts([at.head, at.parent!]);
	const missing = () =>
		Promise.resolve({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) });
	const run = entityBehavior(await explorerReading(answers(at, ids.filter).behavior, '/', missing));
	expect(run.label).toBe('Behavior unknown');
	expect(run.unknown).toBe(true);
	expect(run.groups[0].lines[0].after.read?.verified).toBe(false);
});

test('how long the end-to-end checks ran is the record own figure, or nothing', () => {
	expect(behaviorDuration(record(commits.middle), ['order-filter'])).toBe('40 ms');
	expect(behaviorDuration(record(commits.middle), ['orders-page', 'order-filter'])).toBe('940 ms');
	expect(behaviorDuration(record(commits.middle), ['order'])).toBeNull();
	expect(behaviorDuration(null, ['order-filter'])).toBeNull();
});

test('a parent that recorded nothing leaves the change unknown, never unchanged', () => {
	const run = shown('commit', { parent: revision(commits.first, []) });
	expect(run.label).toBe('Behavior unknown');
	expect(run.unknown).toBe(true);
	expect(run.groups[0].before).toBe('missing');
	expect(run.groups[0].lines[0].before).toEqual({ outcome: 'missing', capture: null });
	expect(run.reasons.length).toBeGreaterThan(0);
});

test('a run whose scenario failed is not passed, whatever results remain listed', () => {
	const failing = record(commits.tip);
	failing.scenarios[1].states[0].captures[0].status = 'failed';
	failing.scenarios[1].status = 'failed';
	const run = shown('current', { head: revision(commits.tip, [failing]) });
	// Whether the host lists the rejected result or leaves it out, the run is not passed.
	expect(run.passed).toBe(false);
	expect(run.scenarios[0].after).toBe('failed');
});

test('an entity with no recorded end-to-end result says so and is not passed', () => {
	const run = shown('current', { head: revision(commits.tip, []) });
	expect(run).toMatchObject({ recorded: false, passed: false, unknown: true, groups: [] });
	expect(run.label).toBe('No end-to-end result is recorded');
});
