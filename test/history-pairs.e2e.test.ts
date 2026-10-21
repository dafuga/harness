import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { sideImpact } from '../packages/reports/src/components/harness/harness-compare/sideImpact';
import { type StoredSide } from '../src/utils/sideImpact';
import { baselineRepo, type VerifyRepo } from './support/verifyRepo';

interface Impact {
	expanded: boolean;
	units: Record<'direct' | 'indirect' | 'added' | 'removed', string[]>;
	scenarios: { affected: string[] };
	uncertain: unknown[];
	changed: unknown[];
}

let repo: VerifyRepo;
let out: string;
const at: Record<string, string> = {};
const slug = 'src/utils/slugify.ts';

/** Commits a source edit as it is: no re-index, no reason, no verification. */
async function commit(name: string, path: string, change: (source: string) => string) {
	await repo.write(path, change(await repo.read(path)));
	at[name] = await repo.commit(`feat: ${name}`);
}
async function side(name: string): Promise<{ commit: string; side: StoredSide }> {
	const detail = JSON.parse(await readFile(join(out, 'revisions', `${at[name]}.json`), 'utf8')) as {
		side: string;
	};
	const stored = JSON.parse(await readFile(join(out, detail.side), 'utf8')) as StoredSide;
	return { commit: at[name], side: stored };
}
async function cli(base: string, head: string): Promise<Impact> {
	const result = await repo.run(['impact', '--base', at[base], '--head', at[head], '--json']);
	return JSON.parse(result.stdout) as Impact;
}
const upper = (source: string) => source.replace('toLowerCase', 'toUpperCase');
const lower = (source: string) => source.replace('toUpperCase', 'toLowerCase');

// main: start - shout - clock - quiet (shout reverted); side branch from start: shout again.
beforeAll(async () => {
	repo = await baselineRepo();
	at.start = await repo.git(['rev-parse', 'HEAD']);
	await commit('shout', slug, upper);
	await commit('clock', 'src/utils/clock.ts', (source) =>
		source.replace('return value', 'return value.trim()')
	);
	await commit('quiet', slug, lower);
	await repo.git(['checkout', '-q', '-b', 'side', at.start]);
	await commit('picked', slug, upper);
	await repo.git(['checkout', '-q', 'main']);
	out = await mkdtemp(join(tmpdir(), 'harness-pairs-index-'));
	await repo.harness(['history', 'build', '--out', out]);
}, 300_000);
afterAll(async () => {
	await repo.dispose();
	await rm(out, { recursive: true, force: true });
});

const pairs: Array<[string, string, string]> = [
	['two commits apart on one branch', 'start', 'clock'],
	['across a change that was reverted', 'start', 'quiet'],
	['between diverged branches', 'clock', 'picked'],
	['between the same change made on two branches', 'shout', 'picked'],
	['backwards, from a later commit to an earlier one', 'quiet', 'shout']
];

test.each(pairs)(
	'%s the stored sides give what the impact command gives',
	async (_, base, head) => {
		const [stored, command] = [
			await sideImpact(await side(base), await side(head)),
			await cli(base, head)
		];
		expect(stored).toEqual({
			base: at[base],
			expanded: command.expanded,
			units: command.units,
			scenarios: command.scenarios.affected,
			uncertain: command.uncertain,
			changed: command.changed
		});
	}
);

test('a reverted change is not a change, and the same change elsewhere is no difference', async () => {
	// Two commits touched slugify between start and quiet; its content is the same again.
	const reverted = await sideImpact(await side('start'), await side('quiet'));
	expect(reverted.units.direct).toEqual(['function.clock']);
	expect(reverted.units.direct).not.toContain('function.slugify');
	const same = await sideImpact(await side('shout'), await side('picked'));
	expect([same.units, same.changed, same.scenarios]).toEqual([
		{ direct: [], indirect: [], added: [], removed: [] },
		[],
		[]
	]);
	const diverged = await sideImpact(await side('clock'), await side('picked'));
	expect(diverged.units.direct).toEqual(['function.clock']);
});

test('one stored side is kept per source tree, however many commits share it', async () => {
	const [shout, picked] = [await side('shout'), await side('picked')];
	expect(picked.side.files).toEqual(shout.side.files);
	const paths = async (name: string) =>
		(
			JSON.parse(await readFile(join(out, 'revisions', `${at[name]}.json`), 'utf8')) as {
				side: string;
			}
		).side;
	// The same source on two branches is one stored side.
	expect(await paths('picked')).toBe(await paths('shout'));
	expect(await paths('quiet')).not.toBe(await paths('shout'));
	expect(JSON.stringify(shout.side).length).toBeLessThan(60_000);
});
