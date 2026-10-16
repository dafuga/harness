import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import {
	browserRun,
	eventually,
	runPassed as passed,
	seededHistories,
	type BrowserRun,
	type SeededHistory
} from './support/browserRun';
import { openRunGate, type RunGate } from './support/runGate';

/**
 * Two browser runs at once, as an independent check and a verification snapshot are. Each seeds
 * its own history, so the commits, records and media of one are unknown to the other: a run that
 * reads the fixtures of the other one fails, and so does a run whose fixtures the other removed.
 */
let scratch: string;
const runs: BrowserRun[] = [];
const gates: RunGate[] = [];
// Specs of the explorer that read the seeded history of their own run: its addresses, its
// catalogue, and the media and data only its own server may give out.
const quick = ['tests/e2e/harness-cache.spec.ts'];
const longer = [
	'tests/e2e/harness-cache.spec.ts',
	'tests/e2e/harness-explorer-routes.spec.ts',
	'tests/e2e/harness-explorer-catalog.spec.ts',
	'tests/e2e/harness-protection.spec.ts'
];
/**
 * How often the longer run repeats its specs: they take seconds, and it has to outlast the whole
 * of the shorter run, from the seeding of its history to the removal of it.
 */
const lasting = 60;
const media = (home: string) =>
	readdirSync(home, { recursive: true, withFileTypes: true }).filter(
		(entry) => entry.isFile() && /^[0-9a-f]{64}\.(png|wav)$/.test(entry.name)
	).length;
/** Waits until exactly this many runs have seeded a history somewhere below the scratch. */
const histories = (count: number, wanted: string): Promise<SeededHistory[]> =>
	eventually(() => {
		const found = seededHistories(scratch);
		return found.length === count ? found : undefined;
	}, wanted);

beforeAll(async () => {
	scratch = await mkdtemp(join(tmpdir(), 'harness-concurrent-runs-'));
}, 60_000);
afterAll(async () => {
	// A teardown still held at its gate is let go first, so that each run removes its own fixtures.
	await Promise.all(gates.map((gate) => gate.close()));
	await Promise.all(runs.map((run) => run.stop()));
	await rm(scratch, { recursive: true, force: true });
});

test('two runs at once each keep their own history, media and results, through the teardown of the other', async () => {
	// The longer run starts first and goes on while the shorter one seeds, runs and clears away.
	// Each run keeps its history after its specs until the observer has seen what it needs of it.
	const gated = async (name: string) => {
		const gate = await openRunGate(scratch, name);
		gates.push(gate);
		return gate;
	};
	const secondGate = await gated('second');
	const second = await browserRun('second', scratch, longer, {
		repeat: lasting,
		gate: secondGate.path
	});
	runs.push(second);
	await histories(1, 'the longer run to seed its history');
	const firstGate = await gated('first');
	const first = await browserRun('first', scratch, quick, { repeat: 1, gate: firstGate.path });
	runs.push(first);
	const both = await histories(2, 'both runs to seed a history each');
	// Two runs, two places, two histories: no commit of one is a commit of the other.
	expect(both[0].home).not.toBe(both[1].home);
	expect(both[0].commits.baseline).not.toBe(both[1].commits.baseline);
	const kept = (history: SeededHistory) => ({
		meta: readFileSync(history.file, 'utf8'),
		media: media(history.home)
	});
	const before = both.map(kept);
	expect(before.every((history) => history.media > 0)).toBe(true);

	// The shorter run ends and removes what it made. Nothing of the other is touched by that.
	firstGate.release();
	await passed(first, 'first');
	const left = both.filter((history) => existsSync(history.home));
	expect(left).toHaveLength(1);
	expect(kept(left[0])).toEqual(before[both.indexOf(left[0])]);

	// Its peer gone and its own history seen to be untouched, the longer run may clear away too.
	secondGate.release();
	await passed(second, 'second');
	const [quickly, fully] = [first.results(), second.results()];
	expect([quickly.unexpected, fully.unexpected]).toEqual([0, 0]);
	expect(quickly.files).toEqual(['harness-cache.spec.ts']);
	expect(fully.files).toHaveLength(longer.length);
	expect(fully.expected).toBeGreaterThan(quickly.expected);
	// Each run cleared away its own fixtures, and only those.
	expect(existsSync(left[0].home)).toBe(false);
}, 900_000);
