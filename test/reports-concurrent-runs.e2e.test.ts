import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import {
	browserRun,
	eventually,
	seededHistories,
	type BrowserRun,
	type SeededHistory
} from './support/browserRun';

/**
 * Two browser runs at once, as an independent check and a verification snapshot are. Each seeds
 * its own history, so the commits, records and media of one are unknown to the other: a run that
 * reads the fixtures of the other one fails, and so does a run whose fixtures the other removed.
 */
let scratch: string;
const runs: BrowserRun[] = [];
const quick = ['tests/e2e/harness-legacy.spec.ts'];
const longer = [
	'tests/e2e/harness-legacy.spec.ts',
	'tests/e2e/harness-routes.spec.ts',
	'tests/e2e/harness-provenance.spec.ts',
	'tests/e2e/project-reports.spec.ts'
];
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

/** Waits for a run to end; one that failed says what its own output ended with. */
async function passed(run: BrowserRun, name: string): Promise<void> {
	const code = await run.finished;
	if (code !== 0) throw new Error(`The ${name} run exited ${code}:\n${run.output().slice(-3000)}`);
}

beforeAll(async () => {
	scratch = await mkdtemp(join(tmpdir(), 'harness-concurrent-runs-'));
}, 60_000);
afterAll(async () => {
	await Promise.all(runs.map((run) => run.stop()));
	await rm(scratch, { recursive: true, force: true });
});

test('two runs at once each keep their own history, media and results, through the teardown of the other', async () => {
	const first = await browserRun('first', scratch, quick);
	const second = await browserRun('second', scratch, longer);
	runs.push(first, second);
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
	await passed(first, 'first');
	const left = both.filter((history) => existsSync(history.home));
	expect(left).toHaveLength(1);
	expect(kept(left[0])).toEqual(before[both.indexOf(left[0])]);

	await passed(second, 'second');
	const [quickly, fully] = [first.results(), second.results()];
	expect([quickly.unexpected, fully.unexpected]).toEqual([0, 0]);
	expect(quickly.files).toEqual(['harness-legacy.spec.ts']);
	expect(fully.files).toHaveLength(longer.length);
	expect(fully.expected).toBeGreaterThan(quickly.expected);
	// Each run cleared away its own fixtures, and only those.
	expect(existsSync(left[0].home)).toBe(false);
}, 900_000);
