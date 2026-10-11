/**
 * Builds the fixed synthetic history the /harness browser acceptance inspects: a throwaway Git
 * repository with a shared function, a service, a page scenario at three viewports and an audio
 * scenario, verified commit by commit through the real CLI. Nothing here touches this
 * repository's own refs. The audio is a generated tone and its transcript says so.
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { legacyRun } from '../../../test/support/legacyStore';
import { e2eFixtures } from '../src/utils/e2eFixtures';
import { writeScaleData } from './harness-scale-data';
import { baselineRepo, reviewer, type VerifyRepo } from '../../../test/support/verifyRepo';

const root = e2eFixtures().console;
const keptBranch = 'feature/kept#1';
const tone = { FIXTURE_TRANSCRIPT: 'Synthetic test tone. No speech.' };
const attach = (repo: VerifyRepo, args: string[] = []) =>
	repo.harness(['history', 'attach', ...args]);
const head = (repo: VerifyRepo) => repo.git(['rev-parse', 'HEAD']);
const explain = (repo: VerifyRepo, behavior: string) =>
	repo.harness([
		'explain',
		'add',
		'--all',
		'--behavior',
		behavior,
		'--simplification',
		'A single guard clause was the smallest form found.',
		'--simplification-outcome',
		'not-improved',
		'--performance',
		'One length check and one scan per title; not measured.',
		'--performance-outcome',
		'not-applicable'
	]);
const verified = async (
	repo: VerifyRepo,
	env: Record<string, string> = {},
	args: string[] = []
) => {
	const outcome = await repo.verify(args, { ...tone, ...env });
	await attach(repo, ['--record', outcome.record.id]);
	return outcome;
};

await rm(root, { recursive: true, force: true });
await mkdir(root, { recursive: true });
const repo = await baselineRepo();
const commits: Record<string, string> = {};
commits.unbaselined = await repo.git(['rev-parse', 'HEAD~1']);
await attach(repo, ['--commit', commits.unbaselined]);
commits.baseline = await head(repo);
await verified(repo);

commits.shout = await repo.change('src/utils/slugify.ts', (source) =>
	source.replace('toLowerCase', 'toUpperCase')
);
await verified(repo);

// A branch that stays, with a slash and a character that must be encoded in a path.
await repo.git(['checkout', '-q', '-b', keptBranch]);
// One unit with two files, both changed for one reason: two recorded reasons that differ only
// in the file they are about.
const titles = 'src/routes/titles';
await repo.write(`${titles}/+page.server.ts`, 'export const prerender = false;\n');
await repo.harness(['units', 'index', '--write']);
commits.paired = await repo.commit('feat: give the titles page a server file');
await repo.explainAll(['--base', commits.shout, '--head', 'HEAD']);
await verified(repo);
await repo.write(`${titles}/+page.server.ts`, 'export const prerender = true;\n');
await repo.write(
	`${titles}/+page.svelte`,
	(await repo.read(`${titles}/+page.svelte`)).replace("'Hello'", "'Hello again'")
);
await repo.harness(['units', 'index', '--write']);
commits.twin = await repo.commit('feat: change both files of the titles page');
await repo.explainAll(['--base', commits.paired, '--head', 'HEAD']);
// Its reasons are kept in the notes of the commit, as a committed range's reasons are.
await repo.harness(['history', 'reasons', '--base', commits.paired, '--commit', 'HEAD']);
await verified(repo);
// Units in a language whose decision points are not counted. One has nothing that is counted:
// its complexity has no value and its reviewed baseline says so. The other also has a counted
// file: its value is that file's alone and says what it leaves out. Neither is frozen at a zero
// nobody measured.
const rust =
	'pub fn sign(value: i32) -> i32 {\n    if value < 0 {\n        return -1;\n    }\n    1\n}\n';
await repo.write('crates/counter/Cargo.toml', '[package]\nname = "counter"\nversion = "0.1.0"\n');
await repo.write('crates/counter/src/lib.rs', rust);
await repo.write('crates/mixed/src/lib.rs', rust);
await repo.write(
	'crates/mixed/bindings.ts',
	'export function bound(value: number): number {\n\tif (value > 1 && value < 9) return value;\n\treturn 0;\n}\n'
);
await repo.harness(['units', 'index', '--write']);
await explain(repo, 'Adds two native counters written in Rust, one with TypeScript bindings.');
commits.native = await repo.commit('feat: add native counters');
const uncounted = await verified(repo);
const native = ['budget', 'establish', 'kernel.counter', 'kernel.mixed', '--record'];
await repo.harness([...native, uncounted.record.id, ...reviewer]);
commits.measured = await repo.commit('chore: baselines for the native counters');
await verified(repo);
await repo.git(['commit', '-q', '--allow-empty', '-m', 'chore: work kept on a branch']);
commits.kept = await head(repo);
await repo.git(['checkout', '-q', 'main']);

await repo.git(['checkout', '-q', '-b', 'feature/retained']);
commits.retained = await repo.change('src/utils/clock.ts', (source) =>
	source.replaceAll('value', 'input')
);
await verified(repo);
await repo.git(['checkout', '-q', 'main']);
await repo.git(['branch', '-q', '-D', 'feature/retained']);

const grown = (await repo.read('src/utils/slugify.ts')).replace(
	'\treturn input',
	"\tif (input.length > 99 || input.includes('?')) return input;\n\treturn input"
);
await repo.write('src/utils/slugify.ts', grown);
await repo.harness(['units', 'index', '--write']);
await explain(repo, 'Leaves over-long and query-like titles unchanged instead of slugging them.');
commits.grown = await repo.commit('feat: leave over-long titles unchanged');
const blocked = await verified(repo);
await repo.harness([
	'budget',
	'approve',
	'function.slugify',
	'--record',
	blocked.record.id,
	...reviewer
]);
commits.approved = await repo.commit('chore: approve the larger slugify');
await verified(repo);

await repo.write(
	'src/utils/extra.ts',
	'export function extra(name: string): Promise<unknown> {\n\treturn import(name);\n}\n'
);
await repo.harness(['units', 'index', '--write']);
await explain(repo, 'Adds a loader whose target is only known at run time.');
commits.added = await repo.commit('feat: add a run-time loader');
const unbaselined = await verified(repo);
await repo.harness([
	'budget',
	'establish',
	'function.extra',
	'--record',
	unbaselined.record.id,
	...reviewer
]);
commits.established = await repo.commit('chore: baseline for the loader');
await verified(repo);

await repo.git(['rm', '-q', 'src/utils/extra.ts']);
await repo.harness(['units', 'retire', 'function.extra', '--reason', 'Nothing used the loader.']);
await repo.harness(['units', 'index', '--write']);
await explain(repo, 'Removes the unused loader.');
commits.removed = await repo.commit('cleanup: remove the unused loader');
await verified(repo);

commits.reordered = await repo.change('src/utils/slugify.ts', (source) =>
	source.replace(/input\.trim\(\)\.(to\w+Case)\(\)/, 'input.$1().trim()')
);
await verified(repo, { FIXTURE_SKIP: 'filled-mobile' });
await verified(repo, { FIXTURE_STALE_REVISION: commits.baseline });
await verified(repo);
await verified(repo, { HARNESS_PROFILE_LABEL: 'another-runner' }, ['--base', 'none']);

// Two failed attempts whose captures must never read as tested: screenshots that name no build,
// and audio rejected for having no transcript.
commits.restated = await repo.change('src/utils/slugify.ts', (source) =>
	source.replace(
		"input.length > 99 || input.includes('?')",
		"input.includes('?') || input.length > 99"
	)
);
await verified(repo, { FIXTURE_NO_STAMP: '1' });
await verified(repo, { FIXTURE_NO_TRANSCRIPT: '1' });

await repo.git(['commit', '-q', '--allow-empty', '-m', 'chore: not verified yet']);
commits.unverified = await head(repo);

// A source edit committed as it is: not indexed, not explained, not verified. Its impact still
// has to be shown, from the source of the two commits alone.
await repo.write(
	'src/utils/clock.ts',
	(await repo.read('src/utils/clock.ts')).replace('return value', 'return value.trim()')
);
commits.sourceOnly = await repo.commit('feat: trim the clock value');

// Two reports from before Git-backed records: one names a commit of this history, one none.
const legacy = { store: join(root, 'legacy-store'), project: repo.root };
await legacyRun(legacy, 'linked-run', { title: 'Uppercase titles', revision: commits.shout }, 90);
await legacyRun(legacy, 'unlinked-run', {
	title: 'Exploration without a revision',
	status: 'running',
	state: 'active'
});
await repo.harness(['history', 'import-reports', '--from', legacy.store]);

const refs = await repo.git(['for-each-ref', '--format=%(refname) %(objectname)']);
await repo.harness(['history', 'build', '--out', join(root, 'data')]);
await writeScaleData(join(root, 'data'), join(root, 'scale'), commits.sourceOnly);
await writeFile(
	join(root, 'meta.json'),
	JSON.stringify({ repository: repo.root, commits, refs, keptBranch }, null, '\t')
);
console.log(`Synthetic history at ${repo.root}; console data in ${join(root, 'data')}`);
